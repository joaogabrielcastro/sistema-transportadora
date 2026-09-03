-- Tipos de gasto padrão (idempotente)
INSERT INTO "tipos_gastos" ("nome_tipo") VALUES
  ('Combustível'),
  ('Pedágio'),
  ('Multa'),
  ('Manutenção'),
  ('Peças'),
  ('Lavagem'),
  ('Estacionamento'),
  ('Seguro'),
  ('IPVA / Licenciamento'),
  ('Salário / Diária'),
  ('Alimentação'),
  ('Hospedagem'),
  ('Outros')
ON CONFLICT ("nome_tipo") DO NOTHING;
