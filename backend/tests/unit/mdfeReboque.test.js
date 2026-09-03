import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import {
  MdfeService,
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

function dadosCarreta(id) {
  return {
    caminhao_id: id,
    renavam: `${id}00000000`,
    tara_kg: 7000,
    cap_kg: 25000,
    cap_m3: 90,
    tipo_carroceria: "03",
    uf: "sp",
  };
}

test("bitrem: cavalo com 2 carretas vinculadas -> 2 entradas em veicReboque", async () => {
  await withStubs(
    {
      vinculos: [
        { carreta_id: 31, ordem: 1 },
        { carreta_id: 32, ordem: 2 },
      ],
      carretas: [
        { id: 31, placa: "AAA1B23" },
        { id: 32, placa: "BBB2C34" },
      ],
      dados: [dadosCarreta(31), dadosCarreta(32)],
    },
    async () => {
      const reboques = await resolveReboques(
        TENANT,
        { caminhaoId: 10, tipoVeiculo: "cavalo" },
        { rodoviario: {} },
        "2026-08-31T12:00:00Z",
      );
      assert.equal(reboques.length, 2);
      assert.deepEqual(
        reboques.map((r) => r.placa),
        ["AAA1B23", "BBB2C34"],
      );

      const payload = montarPayloadMdfe(
        { data_emissao: "2026-08-31T12:00:00Z", rodoviario: {} },
        "CAV1D23",
        [{ nome: "Fulano", cpf: "11122233344" }],
        reboques,
      );
      assert.equal(payload.Rodoviario.veicReboque.length, 2);
    },
  );
});

test("rodotrem: cavalo com 3 carretas vinculadas -> 3 entradas em veicReboque", async () => {
  await withStubs(
    {
      vinculos: [
        { carreta_id: 41, ordem: 1 },
        { carreta_id: 42, ordem: 2 },
        { carreta_id: 43, ordem: 3 },
      ],
      carretas: [
        { id: 41, placa: "AAA1B23" },
        { id: 42, placa: "BBB2C34" },
        { id: 43, placa: "CCC3D45" },
      ],
      dados: [dadosCarreta(41), dadosCarreta(42), dadosCarreta(43)],
    },
    async () => {
      const reboques = await resolveReboques(
        TENANT,
        { caminhaoId: 10, tipoVeiculo: "cavalo" },
        { rodoviario: {} },
        "2026-08-31T12:00:00Z",
      );
      assert.equal(reboques.length, 3);
      assert.deepEqual(
        reboques.map((r) => r.placa),
        ["AAA1B23", "BBB2C34", "CCC3D45"],
      );
    },
  );
});

test("cavalo com 4 carretas vinculadas -> erro antes do provedor (via composição)", async () => {
  await withStubs(
    {
      vinculos: [
        { carreta_id: 51, ordem: 1 },
        { carreta_id: 52, ordem: 2 },
        { carreta_id: 53, ordem: 3 },
        { carreta_id: 54, ordem: 4 },
      ],
      carretas: [
        { id: 51, placa: "AAA1B23" },
        { id: 52, placa: "BBB2C34" },
        { id: 53, placa: "CCC3D45" },
        { id: 54, placa: "DDD4E56" },
      ],
      dados: [
        dadosCarreta(51),
        dadosCarreta(52),
        dadosCarreta(53),
        dadosCarreta(54),
      ],
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
          assert.match(err.message, /no máximo 3 reboques/i);
          return true;
        },
      );
    },
  );
});

test("cavalo com 4 reboques manuais -> erro antes do provedor (via rodoviario.reboques[])", async () => {
  await withStubs({ vinculos: [] }, async () => {
    const reboqueManual = (placa) => ({
      placa,
      tara_kg: 6000,
      cap_kg: 20000,
      tipo_carroceria: "02",
      uf: "PR",
    });
    await assert.rejects(
      () =>
        resolveReboques(
          TENANT,
          { caminhaoId: 10, tipoVeiculo: "cavalo" },
          {
            rodoviario: {
              reboques: [
                reboqueManual("AAA1B23"),
                reboqueManual("BBB2C34"),
                reboqueManual("CCC3D45"),
                reboqueManual("DDD4E56"),
              ],
            },
          },
          "2026-08-31T12:00:00Z",
        ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /no máximo 3 reboques/i);
        return true;
      },
    );
  });
});

test("emitirMdfeSchema aceita 3 reboques manuais e rejeita o 4º", () => {
  const base = {
    data_emissao: "2026-08-31T12:00:00Z",
    uf_carregamento: "SP",
    uf_descarregamento: "PR",
    rodoviario: {
      placa: "CAV1D23",
      condutores: [{ nome: "Fulano", cpf: "111.222.333-44" }],
      reboques: [],
    },
  };
  const reboque = (placa) => ({
    placa,
    tara_kg: 7000,
    cap_kg: 25000,
    tipo_carroceria: "03",
    uf: "sp",
  });

  const tres = structuredClone(base);
  tres.rodoviario.reboques = [
    reboque("AAA1B23"),
    reboque("BBB2C34"),
    reboque("CCC3D45"),
  ];
  assert.equal(emitirMdfeSchema.parse(tres).rodoviario.reboques.length, 3);

  const quatro = structuredClone(base);
  quatro.rodoviario.reboques = [
    reboque("AAA1B23"),
    reboque("BBB2C34"),
    reboque("CCC3D45"),
    reboque("DDD4E56"),
  ];
  assert.throws(() => emitirMdfeSchema.parse(quatro));
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

async function withPreviewStubs(
  { caminhao, vinculos = [], carretas = [], dados = [] },
  fn,
) {
  const restores = [];
  patch(prisma.caminhoes, "findFirst", async () => caminhao, restores);
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

test("previewReboques: cavalo com 2 carretas -> placas resolvidas sem emitir", async () => {
  await withPreviewStubs(
    {
      caminhao: { id: 10, placa: "CAV1D23", tipo_veiculo: "cavalo" },
      vinculos: [
        { carreta_id: 31, ordem: 1 },
        { carreta_id: 32, ordem: 2 },
      ],
      carretas: [
        { id: 31, placa: "AAA1B23" },
        { id: 32, placa: "BBB2C34" },
      ],
      dados: [dadosCarreta(31), dadosCarreta(32)],
    },
    async () => {
      const out = await MdfeService.previewReboques(TENANT, {
        caminhao_id: 10,
        data_emissao: "2026-08-31T12:00:00Z",
      });
      assert.equal(out.aviso, null);
      assert.equal(out.placa, "CAV1D23");
      assert.deepEqual(
        out.reboques.map((r) => r.placa),
        ["AAA1B23", "BBB2C34"],
      );
    },
  );
});

test("previewReboques: cavalo sem reboque -> aviso amigável, sem estourar", async () => {
  await withPreviewStubs(
    {
      caminhao: { id: 10, placa: "CAV1D23", tipo_veiculo: "cavalo" },
      vinculos: [],
    },
    async () => {
      const out = await MdfeService.previewReboques(TENANT, {
        caminhao_id: 10,
        data_emissao: "2026-08-31T12:00:00Z",
      });
      assert.deepEqual(out.reboques, []);
      assert.match(out.aviso, /ao menos um reboque/i);
    },
  );
});

test("previewReboques: veículo rígido (truck) -> sem reboques e sem aviso", async () => {
  await withPreviewStubs(
    { caminhao: { id: 5, placa: "TRK1A23", tipo_veiculo: "truck" } },
    async () => {
      const out = await MdfeService.previewReboques(TENANT, {
        caminhao_id: 5,
      });
      assert.deepEqual(out.reboques, []);
      assert.equal(out.aviso, null);
    },
  );
});
