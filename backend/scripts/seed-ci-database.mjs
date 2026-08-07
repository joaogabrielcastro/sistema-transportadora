/**
 * Dados de referência que as migrations SQL inserem, mas `prisma db push`
 * (CI / banco vazio) não aplica. Idempotente.
 */
import prisma from "../src/lib/prisma.js";

const POSICOES_EXTRA = [
  "Eixo 3 - Externo Esquerdo",
  "Eixo 3 - Interno Esquerdo",
  "Eixo 3 - Interno Direito",
  "Eixo 3 - Externo Direito",
  "Eixo 4 - Externo Esquerdo",
  "Eixo 4 - Interno Esquerdo",
  "Eixo 4 - Interno Direito",
  "Eixo 4 - Externo Direito",
  "Carreta - Eixo 1 - Externo Esquerdo",
  "Carreta - Eixo 1 - Interno Esquerdo",
  "Carreta - Eixo 1 - Interno Direito",
  "Carreta - Eixo 1 - Externo Direito",
  "Carreta - Eixo 2 - Externo Esquerdo",
  "Carreta - Eixo 2 - Interno Esquerdo",
  "Carreta - Eixo 2 - Interno Direito",
  "Carreta - Eixo 2 - Externo Direito",
  "Carreta - Eixo 3 - Externo Esquerdo",
  "Carreta - Eixo 3 - Interno Esquerdo",
  "Carreta - Eixo 3 - Interno Direito",
  "Carreta - Eixo 3 - Externo Direito",
  "Carreta - Estepe 1",
  "Carreta - Estepe 2",
];

async function main() {
  for (const nome_posicao of POSICOES_EXTRA) {
    await prisma.posicoes_pneus.upsert({
      where: { nome_posicao },
      update: {},
      create: { nome_posicao },
    });
  }
  console.log(`Seed CI: ${POSICOES_EXTRA.length} posições de pneu ok.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
