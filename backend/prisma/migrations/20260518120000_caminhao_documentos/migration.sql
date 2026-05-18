-- CreateTable
CREATE TABLE "caminhao_documentos" (
    "id" SERIAL NOT NULL,
    "caminhao_id" INTEGER NOT NULL,
    "nome_original" VARCHAR(255) NOT NULL,
    "arquivo_path" VARCHAR(500) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caminhao_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caminhao_documentos_caminhao_id_idx" ON "caminhao_documentos"("caminhao_id");

-- AddForeignKey
ALTER TABLE "caminhao_documentos" ADD CONSTRAINT "caminhao_documentos_caminhao_id_fkey" FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
