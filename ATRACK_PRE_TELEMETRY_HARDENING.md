# ATrack — Hardening pré-telemetria

Data: 2026-09-21. Esta etapa não implementa ingestão, rastreador, mapa nem canal em tempo real.

## 1. Estado atual antes da mudança

API Express, Prisma e PostgreSQL 16 no mesmo processo que, por padrão, também executava os workers BullMQ de PDF e averbação. Redis era obrigatório na validação de produção (`REDIS_URL`), mas a ordem de coleta ainda caía para fila em memória se a URL sumisse em runtime. O JWT de 7 dias não relia `users.ativo`. Não havia dispositivo, vínculo com vigência, nem unique de evento. O `/health` via banco, Redis, PDF e uploads, sem worker, fila, disco ou backup.

## 2. Alterações realizadas

- Produção recusa subir se o Redis não conectar. Fila em memória só existe fora de produção, com log explícito.
- Processo `npm run worker` (`scripts/worker.mjs`) sobe as duas filas, heartbeat e `GET /health` na porta `WORKER_HEALTH_PORT` (3021). A API continua podendo embutir o worker (`RUN_ORDEM_WORKER_IN_API`, default atual) para não quebrar o deploy de um serviço só.
- Compose local separa `backend` e `worker`.
- Tabelas `telemetry_devices`, `telemetry_device_assignments`, `telemetry_events`, `telemetry_current_state`, `telemetry_daily`.
- Credencial só como SHA-256. JWT de usuário e `API_TOKEN` são recusados como credencial de dispositivo. Tenant e veículo saem do cadastro, não do payload.
- Unique `(device_id, event_id)`. Vínculo aberto único por dispositivo e por veículo (índice parcial).
- Com `AUTH_ENABLED=true`, cada request relê usuário ativo, tenant ativo e `tenant_id`. Usuário desativado perde o acesso com o JWT ainda válido.
- `/health` passa a distinguir database, redis, worker, queues, storage e backup. Telemetria reporta `ingestionImplemented: false`.
- Log de toda request desceu para `debug`. Redação inclui credential e jwt.
- Pool do Postgres explícito. Backup grava duração em `.last-backup.json`. Restore só para outro banco (`scripts/restore-db.mjs`).
- Testes de isolamento ampliados e testes de idempotência/concorrência do evento.

## 3. Arquitetura atual

```text
Browser → API Express (JWT de usuário, tenant no banco a cada request)
              ├─ PostgreSQL (OLTP + tabelas de preparação)
              └─ Redis BullMQ
                    └─ Worker (no processo da API OU npm run worker)
```

## 4. Arquitetura preparada para telemetria

```text
Rastreador
  → futura Ingestion API (não existe)
  → credencial do dispositivo
  → telemetry_devices.tenant_id
  → assignment vigente
  → Redis (lote)
  → worker separado
  → telemetry_current_state | telemetry_events | telemetry_daily
  → API de leitura já autenticada por JWT de usuário
```

Contrato futuro do lote. Não há endpoint.

```json
{
  "events": [
    {
      "event_id": "abc123",
      "recorded_at": "2026-09-21T15:30:00Z",
      "latitude": -25.4284,
      "longitude": -49.2733,
      "speed": 72,
      "odometer": 152340
    }
  ]
}
```

Não enviar `tenant_id` nem `vehicle_id` como autoridade. O servidor grava:

| Contrato | Coluna |
| --- | --- |
| recorded_at | `registrado_em` |
| received_at | `recebido_em` |
| event_id | `event_id` |
| latitude / longitude | `latitude` / `longitude` |
| speed | `velocidade_kmh` |
| odometer | `odometro_km` (km, não metro) |
| dispositivo | `telemetry_devices` |
| veículo | `caminhoes` via assignment vigente na hora de `registrado_em` |

`caminhoes.km_atual` continua sendo o KM operacional lançado pela frota. Não é histórico.

Evento fora de ordem: o bruto permanece; `telemetry_current_state` só avança se `registrado_em` for estritamente maior. Empate não sobrescreve. Ponto atrasado não pisa o mapa.

Retenção prevista, sem job de expurgo nesta fase:

| Camada | Prazo | Uso |
| --- | --- | --- |
| Estado atual | sem prazo | mapa, última posição, último contato |
| Evento bruto | 90 dias (`RAW_EVENT_RETENTION_DAYS`) | rota e investigação |
| Resumo diário | sem prazo | km, velocidade máxima, indicadores |

Cota futura conta dispositivo ativo vinculado a veículo, não a quantidade de eventos. `telemetryLimitsForPlan` devolve `enforced: false`. Starter continua 8 veículos e 2 usuários.

Rate limit da API de usuário permanece 300 pedidos / 15 min. A ingestão de dispositivo, quando existir, terá limite próprio. Não foi aumentada.

O frontend já autentica com JWT e o TanStack Query aceita uma query paginada. `GET /telemetry/current` e `GET /telemetry/history` cabem nesse cliente, com `tenant` do token, `vehicle_id`, intervalo e limite. Não há poll nem tela.

## 5. Decisões

- Telemetria fica neste repositório e neste PostgreSQL.
- Worker separado é o caminho novo; o worker dentro da API permanece para o deploy atual não quebrar.
- Revogação de sessão vale com `AUTH_ENABLED=true`. Com auth desligada (só desenvolvimento), o JWT continua sendo aceito sem consulta ao banco, como já era.
- `API_TOKEN` segue sendo admin do tenant default para script. Não autentica rastreador.
- Idempotência é o unique do PostgreSQL. Duplicata devolve a linha existente.
- Pool `max` 10 por processo (default do `pg`, agora explícito). Dois processos ficam em cerca de 20 conexões, abaixo do `max_connections` padrão 100 do Postgres. Timeout de conexão 5s no lugar de espera infinita. Capacidade do VPS não foi medida.

## 6. Decisões que não foram tomadas

- MQTT: não adotado nesta fase
- Kafka: não adotado nesta fase
- TimescaleDB: não adotado nesta fase
- Segundo PostgreSQL: não adotado nesta fase
- WebSocket: não adotado nesta fase
- SSE: não adotado nesta fase
- Particionamento do bruto: fica para antes da primeira ingestão real, com a tabela ainda vazia
- RLS no Postgres: o isolamento continua na aplicação, agora com teste mais largo
- Mudança de preço, plano ou teto comercial

## 7. Limitações

- Não há ingestão. `lastDeviceSeen` no health fica nulo de propósito.
- O expurgo dos 90 dias não roda.
- Backup restaurado de ponta a ponta não foi executado contra um banco de produção. O script recusa o banco de origem. Restore real depende de `pg_dump`/`psql` e de um database vazio.
- Worker dentro da API ainda é o default do `npm start`. Quem não criar o segundo serviço no Coolify continua no modo compatível.
- `/health` da API só fica degradado por worker ausente quando o worker roda no próprio processo. No modo separado, a API não cai se o worker cair; o health do worker é o da porta 3021.

## 8. Próximos passos

1. Subir `atrack-worker` no Coolify com `RUN_ORDEM_WORKER_IN_API=false` na API.
2. Confirmar `/health` com Redis ok e heartbeat do worker.
3. Ensaiar backup e restore num banco vazio.
4. Só então implementar a primeira ingestão, em lote, no worker separado.

## 9. Riscos restantes

- Deploy atual de um serviço só ainda mistura HTTP e PDF até o worker ser separado.
- JWT de 7 dias ainda não tem refresh. A desativação do usuário agora corta o acesso; o roubo do token de um usuário ativo continua válido até expirar ou até o usuário ser desativado.
- Sem RLS, um endpoint novo que esqueça `tenant_id` vaza dados.
- Volume de telemetria ainda não foi medido no VPS.
- `pg_dump` do OLTP não é estratégia para o bruto quando a ingestão começar. A retenção de 90 dias precisa virar job antes do primeiro rastreador.
