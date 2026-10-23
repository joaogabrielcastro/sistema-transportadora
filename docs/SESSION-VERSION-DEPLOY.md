# Preparação: migration `session_version` (não aplicar em produção nesta etapa)

## O que muda

- Coluna `users.session_version` (INTEGER NOT NULL DEFAULT 0).
- JWT passa a carregar claim `sv` com o valor atual.
- Em `requireAuth` (com `AUTH_ENABLED=true`), se `sv` do token ≠ `session_version` no banco → 401.
- Incremento em: reset de senha, troca de senha na conta, admin redefine senha do usuário.

Migration no repositório:

`backend/prisma/migrations/20261022180000_password_changed_at/migration.sql`

(O nome da pasta é legado; o SQL cria `session_version`.)

## Ordem de aplicação (produção — quando autorizar)

1. Deploy do **código** que lê `session_version` **e** grava `sv` no JWT **junto** com a migration (ou migration imediatamente antes do restart da API).
2. No container da API (Coolify):
   - `npx prisma migrate deploy` (já costuma rodar no `prestart` / entrypoint).
3. Reiniciar API (e worker, se separado).
4. Smoke: login → `/api/auth/me` 200; trocar senha → token antigo 401; login novo 200.

Não rode `migrate reset` nem restore sobre o banco de produção.

## Compatibilidade com usuários e tokens existentes

| Situação | Comportamento |
| --- | --- |
| Usuário já existente, coluna default 0 | OK |
| JWT emitido **antes** do deploy (sem claim `sv`) | `sv` tratado como `0` → continua válido enquanto `session_version` for 0 |
| JWT emitido **após** o deploy | Carrega `sv` atual |
| Senha alterada após o deploy | `session_version` sobe; tokens antigos (sv menor ou 0) falham |

Conclusão: deploy é **compatível com sessões abertas**; só invalida após mudança de senha (comportamento desejado).

## Impacto esperado nas sessões

- Usuários logados **não** são desconectados só pelo deploy.
- Após reset/troca de senha, todas as sessões JWT daquele usuário deixam de funcionar até novo login.
- `AUTH_ENABLED=false` (somente não-produção) não revalida `sv` no caminho “dev” — produção deve manter `AUTH_ENABLED=true`.

## Recuperação se a migration falhar

1. **Não** continue o rollout se `migrate deploy` falhar.
2. Inspecione o erro no log do Coolify (conflito de coluna, permissão, etc.).
3. Se a coluna **não** foi criada: corrija e rode `migrate deploy` de novo; código antigo sem a coluna quebraria o `SELECT session_version` — por isso código+migration devem ir juntos, ou faça rollback da imagem anterior.
4. Se a coluna **foi** criada mas o app novo falha por outro motivo: pode manter a coluna (inofensiva com default 0) e voltar a imagem anterior **somente** se essa imagem não selecionar `session_version`. Preferível: hotfix forward.
5. SQL manual de emergência (banco de staging/prod com backup):

```sql
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
```

6. Sempre tenha dump recente **antes** do deploy; restore só em banco isolado de teste (ver `npm run db:restore`).

## Checklist pré-produção

- [ ] Migration aplicada em staging / local clone
- [ ] Teste `passwordSession.integration.test.js` passou com `RUN_DB_TESTS=1`
- [ ] Backup do Postgres de produção verificado (existência do dump)
- [ ] Janela curta acordada; rollback de imagem documentado
- [ ] Comunicação: “trocar senha desconecta outros dispositivos” (já esperado)
