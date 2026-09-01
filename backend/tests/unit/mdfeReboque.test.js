import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import {
  resolveReboques,
  montarPayloadMdfe,
} from "../../src/services/fiscal/MdfeService.js";
import { emitirMdfeSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * Cobre o grupo veicReboque do MDF-e (rejeição 523 da SEFAZ: cavalo mecânico
 * exige ao menos um reboque). resolveReboques só toca em tabelas via prisma —
 * aqui os métodos usados são trocados por stubs, sem banco.
 */

const TENANT = 7;

function patch(target, name, impl, restores) {
  restores.push([target, name, target[name]]);
  target[name] = impl;
}

async function withStubs({ vinculos = [], carretas = [], dados = [] }, fn) {
  const restores = [];
  patch(
    prisma.vinculos_composicao,
    "findMany",
    async () => vinculos.map((v) => ({ ...v })),
    restores,
  );
  patch(
    prisma.caminhoes,
    "findMany",
    async () => carretas.map((c) => ({ ...c })),
    restores,
  );
  patch(
    prisma.fiscal_veiculo_dados,
    "findMany",
    async () => dados.map((d) => ({ ...d })),
    restores,
  );
  try {
    return await fn();
  } finally {
    for (const [t, n, orig] of restores) t[n] = orig;
  }
}

test("veículo rígido (truck) não exige reboque", async () => {
  const out = await resolveReboques(
    TENANT,
    { caminhaoId: 1, tipoVeiculo: "truck" },
    { rodoviario: {} },
    "2026-08-31T12:00:00Z",
  );
  assert.deepEqual(out, []);
});

test("carreta sozinha não exige reboque", async () => {
  const out = await resolveReboques(
    TENANT,
    { caminhaoId: 2, tipoVeiculo: "carreta" },
    {},
    "2026-08-31T12:00:00Z",
  );
  assert.deepEqual(out, []);
});

test("cavalo com carreta vinculada válida -> monta veicReboque no payload", async () => {
  await withStubs(
    {
      vinculos: [{ carreta_id: 20, ordem: 1 }],
      carretas: [{ id: 20, placa: "RBQ1D23" }],
      dados: [
        {
          caminhao_id: 20,
          renavam: "12345678901",
          tara_kg: 7000,
          cap_kg: 25000,
          cap_m3: 90,
          tipo_carroceria: "03",
          uf: "sp",
        },
      ],
    },
    async () => {
      const reboques = await resolveReboques(
        TENANT,
        { caminhaoId: 10, tipoVeiculo: "cavalo" },
        { rodoviario: {} },
        "2026-08-31T12:00:00Z",
      );
      assert.equal(reboques.length, 1);
      assert.deepEqual(reboques[0], {
        placa: "RBQ1D23",
        RENAVAM: "12345678901",
        tara: 7000,
        capKG: 25000,
        capM3: 90,
        tpCarroceria: "03",
        uf: "SP",
      });

      const payload = montarPayloadMdfe(
        { data_emissao: "2026-08-31T12:00:00Z", rodoviario: {} },
        "CAV1D23",
        [{ nome: "Fulano", cpf: "11122233344" }],
        reboques,
      );
      assert.deepEqual(payload.Rodoviario.veicReboque, reboques);
    },
  );
});

test("cavalo sem vínculo nem reboque manual -> erro amigável antes do provedor", async () => {
  await withStubs({ vinculos: [] }, async () => {
    await assert.rejects(
      () =>
        resolveReboques(
          TENANT,
          { caminhaoId: 10, tipoVeiculo: "cavalo" },
          { rodoviario: {} },
          "2026-08-31T12:00:00Z",
        ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cavalo mecânico precisa de ao menos um/i);
        return true;
      },
    );
  });
});

test("cavalo com carreta vinculada sem dados fiscais obrigatórios -> erro claro", async () => {
  await withStubs(
    {
      vinculos: [{ carreta_id: 21, ordem: 1 }],
      carretas: [{ id: 21, placa: "RBQ2E45" }],
      dados: [{ caminhao_id: 21, renavam: "999" }], // sem tara_kg / cap_kg / tipo_carroceria
    },
    async () => {
      await assert.rejects(
        () =>
          resolveReboques(
            TENANT,
            { caminhaoId: 10, tipoVeiculo: "cavalo" },
            { rodoviario: {} },
            "2026-08-31T12:00:00Z",
          ),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /RBQ2E45/);
          assert.match(err.message, /tara \(kg\)/);
          assert.match(err.message, /tipo de carroceria/);
          return true;
        },
      );
    },
  );
});

test("cavalo sem vínculo mas com rodoviario.reboques manual -> usa o fallback", async () => {
  await withStubs({ vinculos: [] }, async () => {
    const reboques = await resolveReboques(
      TENANT,
      { caminhaoId: 10, tipoVeiculo: "cavalo" },
      {
        rodoviario: {
          reboques: [
            {
              placa: "man1d23",
              tara_kg: 6000,
              cap_kg: 20000,
              tipo_carroceria: "02",
              uf: "PR",
            },
          ],
        },
      },
      "2026-08-31T12:00:00Z",
    );
    assert.equal(reboques.length, 1);
    assert.equal(reboques[0].placa, "MAN1D23");
    assert.equal(reboques[0].tara, 6000);
    assert.equal(reboques[0].tpCarroceria, "02");
  });
});

test("emitirMdfeSchema aceita rodoviario.reboques e exige os campos essenciais", () => {
  const base = {
    data_emissao: "2026-08-31T12:00:00Z",
    uf_carregamento: "SP",
    uf_descarregamento: "PR",
    rodoviario: {
      placa: "CAV1D23",
      condutores: [{ nome: "Fulano", cpf: "111.222.333-44" }],
      reboques: [
        {
          placa: "RBQ1D23",
          tara_kg: 7000,
          cap_kg: 25000,
          tipo_carroceria: "03",
          uf: "sp",
        },
      ],
    },
  };
  const ok = emitirMdfeSchema.parse(base);
  assert.equal(ok.rodoviario.reboques[0].uf, "SP");

  const semTara = structuredClone(base);
  delete semTara.rodoviario.reboques[0].tara_kg;
  assert.throws(() => emitirMdfeSchema.parse(semTara));
});
