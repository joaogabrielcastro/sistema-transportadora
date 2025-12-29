-- Script de migração: Adicionar campos marca, modelo e ano na tabela caminhoes
-- Execute este script no SQL Editor do Supabase

-- Adicionar as novas colunas
ALTER TABLE caminhoes
ADD COLUMN IF NOT EXISTS marca VARCHAR(100),
ADD COLUMN IF NOT EXISTS modelo VARCHAR(100),
ADD COLUMN IF NOT EXISTS ano INTEGER;

-- Adicionar comentários nas colunas para documentação
COMMENT ON COLUMN caminhoes.marca IS 'Marca do caminhão (ex: Scania, Volvo, Mercedes)';
COMMENT ON COLUMN caminhoes.modelo IS 'Modelo do caminhão (ex: R 450, FH 540)';
COMMENT ON COLUMN caminhoes.ano IS 'Ano de fabricação do veículo';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'caminhoes'
AND column_name IN ('marca', 'modelo', 'ano')
ORDER BY column_name;
