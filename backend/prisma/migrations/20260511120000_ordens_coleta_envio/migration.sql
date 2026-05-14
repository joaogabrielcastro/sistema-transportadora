-- CreateTable
CREATE TABLE "ordens_coleta_envio" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(32) NOT NULL,
    "caminhao_id" INTEGER,
    "dados" JSONB NOT NULL,
    "email_destinatario" VARCHAR(255) NOT NULL,
    "assunto" VARCHAR(500),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMPTZ(6),
    "erro_envio" TEXT,

    CONSTRAINT "ordens_coleta_envio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordens_coleta_envio_criado_em_idx" ON "ordens_coleta_envio"("criado_em");

-- CreateIndex
CREATE INDEX "ordens_coleta_envio_tipo_idx" ON "ordens_coleta_envio"("tipo");

-- AddForeignKey
ALTER TABLE "ordens_coleta_envio" ADD CONSTRAINT "ordens_coleta_envio_caminhao_id_fkey" FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
