-- CT-e/MDF-e: grupo infRespTec (responsável técnico pelo sistema emissor) —
-- item 1.4. Como a transportadora é emissora própria (sistema próprio), os
-- dados do responsável técnico ficam na empresa fiscal e são repassados no
-- payload de emissão. NÃO há bloqueio na emissão por falta desses dados: o
-- CteService só registra um aviso em log quando não estão preenchidos — a
-- obrigatoriedade real ainda não foi confirmada em sandbox com o provedor.
--
-- ALTER apenas em fiscal_empresas (tabela NOSSA), somente ADD COLUMN nullable.
-- NENHUM ALTER em tabela existente. SQL idempotente, estilo ATrack.
-- resp_tec_csrt é gravado cifrado (AES-256-GCM / FISCAL_SECRETS_KEY), mesmo
-- padrão de cte_mdfe_provider_token e certificado_senha.

ALTER TABLE "fiscal_empresas"
  ADD COLUMN IF NOT EXISTS "resp_tec_cnpj"    VARCHAR(14),
  ADD COLUMN IF NOT EXISTS "resp_tec_contato" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "resp_tec_email"   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "resp_tec_fone"    VARCHAR(20),
  -- idCSRT: identificador do CSRT (não é segredo)
  ADD COLUMN IF NOT EXISTS "resp_tec_id_csrt" VARCHAR(10),
  -- CSRT: código de segurança do responsável técnico — cifrado antes de gravar
  ADD COLUMN IF NOT EXISTS "resp_tec_csrt"    TEXT;
