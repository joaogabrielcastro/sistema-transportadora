-- Migration: Adicionar colunas faltantes na tabela caminhoes
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna ano
ALTER TABLE caminhoes 
ADD COLUMN IF NOT EXISTS ano INTEGER;

-- Adicionar coluna marca
ALTER TABLE caminhoes 
ADD COLUMN IF NOT EXISTS marca VARCHAR(100);

-- Adicionar coluna modelo
ALTER TABLE caminhoes 
ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);

-- Adicionar comentários
COMMENT ON COLUMN caminhoes.ano IS 'Ano de fabricação do caminhão';
COMMENT ON COLUMN caminhoes.marca IS 'Marca do caminhão';
COMMENT ON COLUMN caminhoes.modelo IS 'Modelo do caminhão';
