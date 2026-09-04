# Integração fiscal Brasil NFe (CT-e e MDF-e)

Este sistema emite **CT-e (modelo 57)** e **MDF-e (modelo 58)** pela API da
[Brasil NFe](https://www.brasilnfe.com.br). **Não há emissão de NF-e nem NFS-e.**
Chaves de NF-e só aparecem como documentos transportados (infDoc / infMunDescarga).

Ambiente homologação/produção é só configuração. A URL da API é a mesma; o
campo `TipoAmbiente` / `tipoAmbiente` no payload vale:

- `1` = produção
- `2` = homologação

Documentação oficial usada na implementação:

- https://www.brasilnfe.com.br/api/ct-e
- https://www.brasilnfe.com.br/api/mdf-e
- https://www.brasilnfe.com.br/api/empresas
- https://www.brasilnfe.com.br/api/consultas
- https://www.brasilnfe.com.br/autentication

## Variáveis de ambiente

No `backend/.env`:

```env
BRASIL_NFE_AMBIENTE=2
BRASIL_NFE_BASE_URL=https://api.brasilnfe.com.br/services
BRASIL_NFE_USER_TOKEN=
FISCAL_SECRETS_KEY=
FISCAL_HTTP_TIMEOUT_MS=30000
```

- `BRASIL_NFE_USER_TOKEN` — UserToken da conta Brasil NFe (cadastro de certificado).
  Também pode ser gravado por empresa fiscal (cifrado).
- `FISCAL_SECRETS_KEY` — cifra Token da empresa, UserToken por empresa e senha do A1.
- Token da empresa **não** vai no `.env` do app: cadastra-se em **Fiscal → Empresa fiscal**.

Legado ainda aceito: `FISCAL_AMBIENTE=producao` e `FISCAL_CTE_MDFE_URL`.

## 1. Cadastrar a empresa na Brasil NFe

1. Crie a conta em https://www.brasilnfe.com.br.
2. Cadastre o CNPJ emissor (mesmo CNPJ da transportadora).
3. Anote o **UserToken** da conta e o **Token** da empresa.
4. No ATrack, ative a feature `transporte_fiscal` do tenant.
5. Abra **Fiscal → Empresa fiscal** e cadastre CNPJ, razão social, CRT, IE e Token.

Cada tenant tem as próprias empresas. Emissão usa só os dados do tenant autenticado.

## 2. Configurar o certificado A1

1. Tenha o `.pfx` / `.p12` e a senha.
2. Em **Empresa fiscal**, selecione a empresa, envie o arquivo e a senha.
3. O backend chama `POST /empresa/AlterarCertificado` (`Senha`, `Base64CertificateFile`)
   com headers `UserToken` e `Token`.
4. A senha é cifrada (`FISCAL_SECRETS_KEY`). O frontend nunca recebe senha nem arquivo.

## 3. Configurar o UserToken

- Preferência: `BRASIL_NFE_USER_TOKEN` no servidor, ou
- Campo UserToken na empresa fiscal (cifrado).

Usado em certificado (`AlterarCertificado` / `VerificarCertificado`).

## 4. Configurar o Token da empresa

No cadastro da empresa fiscal, campo **Token da empresa**. Vai no header `Token`
de todas as chamadas `/fiscal/*`. Sem Token, a emissão retorna 503.

## 5. Ativar homologação

```env
BRASIL_NFE_AMBIENTE=2
```

Reinicie o backend. Novos documentos gravam `ambiente = 2`.

## 6. Criar CT-e de teste

1. Cadastre um **cliente/tomador** (CNPJ/CPF).
2. **Fiscal → CT-e → Emitir**.
3. Preencha CFOP, natureza, valores, participantes e documentos (NF-e relacionada
   é só chave de 44 dígitos — não emite NF-e).
4. **Salvar rascunho** (`POST /api/fiscal/cte`) ou emita direto.

Estados: `rascunho` → `processando` → `processado` | `rejeitado` | `erro`.

## 7. Emitir CT-e

- Formulário: **Emitir CT-e** → `POST /api/fiscal/cte/emitir`
- Lista: **Emitir** no rascunho → `POST /api/fiscal/cte/:id/emitir`

Fluxo: validação do formulário → validação de negócio (CRT, tomador, IBS/CBS) →
`POST /fiscal/EnviarConhecimentoTransporte` → SEFAZ.

Clique repetido em Emitir não reenvia: se já está `processado`, a API devolve o
mesmo documento; se está `processando` **e já foi enviado** (chave ou
identificador interno), consulta a Brasil NFe em vez de retransmitir. Sem chave
ainda (crash no meio do POST), o lock de 2 minutos devolve 409.

## 8. Consultar CT-e

Na lista: **Consultar** → `GET /api/fiscal/cte/:id/status`.

O backend reconcilia com a Brasil NFe:

1. `POST /fiscal/ObterNotasFiscais` (`IdentificadorInterno` = `cte-{id}`,
   `TipoDocumentoFiscal` 1 = saídas, `TipoAmbiente` da config).
2. Atualiza status, chave, protocolo e mensagem da SEFAZ.
3. Se autorizado e ainda sem XML: `POST /fiscal/ObterArquivoNotaFiscal`
   (`FileType` 1 = XML, `TipoDocumentoFiscal` 1).

XML/PDF: `GET /api/fiscal/cte/:id/xml` e `.../pdf`.

## 9. Cancelar CT-e

Só `processado`, em até 24h da autorização. Justificativa 15–1000 caracteres.
`POST /api/fiscal/cte/:id/cancelar` → `POST /fiscal/CancelarNotaFiscal`.

## 10. Criar MDF-e

**Fiscal → MDF-e → Emitir**. Informe UF de carga/descarga, veículo, motorista,
CT-e autorizados ainda sem manifesto, seguro e municípios. **Salvar rascunho**
grava `POST /api/fiscal/mdfe`.

## 11. Emitir MDF-e

`POST /api/fiscal/mdfe/emitir` ou `POST /api/fiscal/mdfe/:id/emitir` →
`POST /fiscal/EnviarManifestoTransporte`.

Status `2` da Brasil NFe permanece `processando` (lote aguardando SEFAZ).
Consulte depois.

## 12. Consultar MDF-e

**Consultar** → `GET /api/fiscal/mdfe/:id/status`.

Mesmo fluxo do CT-e (`ObterNotasFiscais` com `IdentificadorInterno` = `mdfe-{id}`,
depois XML via `ObterArquivoNotaFiscal`). Use isso quando o envio voltar
`status: 2` (lote aguardando SEFAZ) e o documento ficar `processando`.

XML/PDF nas rotas `/xml` e `/pdf`.

## 13. Encerrar MDF-e

Só `processado`. Informe UF/município/data para o registro interno.
O payload oficial da Brasil NFe (`EncerrarManifestoTransporte`) envia
`tipoAmbiente`, `chave`, `protocolo` e `numeroSequencial`.

`POST /api/fiscal/mdfe/:id/encerrar` → status `encerrado`.

## 14. Cancelar MDF-e

Igual ao CT-e: só autorizado, 24h. Depois disso, encerre a viagem.

## 15. Interpretar rejeições

A tela de detalhe mostra `sefaz_codigo`, `sefaz_mensagem`, `sefaz_operacao` e
detalhes sanitizados (sem XML/certificado/tokens). Códigos da SEFAZ (ex.: 204)
vêm na mensagem da Brasil NFe (`DsMotivo` / `erros[]`). Corrija o rascunho
(`rejeitado` ou `erro`) e emita de novo.

## 16. Homologação → produção

1. Certificado A1 de produção e Token/UserToken de produção na Brasil NFe.
2. Confirme CRT, IE, RNTRC e série.
3. Altere **somente**:

```env
BRASIL_NFE_AMBIENTE=1
```

4. Reinicie o backend. Não misture Token de homologação com ambiente 1.

## Rotas da API (prefixo `/api/fiscal`)

CT-e: `POST/GET /cte`, `GET/PUT/DELETE /cte/:id`, `POST /cte/emitir`,
`POST /cte/:id/emitir`, `GET /cte/:id/status`, `GET /cte/:id/xml|pdf`,
`POST /cte/:id/cancelar`.

MDF-e: o mesmo padrão + `POST /mdfe/:id/encerrar`.

Empresa: `GET/POST /empresas`, `PUT/DELETE /empresas/:id`,
`POST /empresas/:id/certificado`, `POST /empresas/:id/certificado/verificar`.
