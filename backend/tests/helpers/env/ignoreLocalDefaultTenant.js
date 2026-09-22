// O .env local pode fixar DEFAULT_TENANT_ID no id do banco de desenvolvimento.
// A suíte aponta para outro DATABASE_URL: o tenant padrão é o seed desse banco,
// como no CI. String vazia já está definida, então o dotenv não recoloca o valor.
process.env.DEFAULT_TENANT_ID = "";
