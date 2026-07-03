/** Agrupa posições do banco em slots visuais do diagrama do caminhão. */

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const SLOT_RULES = [
  { slot: "front-left", test: (n) => /dianteir/.test(n) && /(esq|esquer)/.test(n) },
  { slot: "front-right", test: (n) => /dianteir/.test(n) && /(dir|direit)/.test(n) },
  {
    slot: "rear1-left-outer",
    test: (n) =>
      /(traseir|eixo\s*2|eixo\s*1)/.test(n) &&
      /(esq|esquer)/.test(n) &&
      /(ext|extern)/.test(n),
  },
  {
    slot: "rear1-left-inner",
    test: (n) =>
      /(traseir|eixo\s*2|eixo\s*1)/.test(n) &&
      /(esq|esquer)/.test(n) &&
      /(int|intern)/.test(n),
  },
  {
    slot: "rear1-right-inner",
    test: (n) =>
      /(traseir|eixo\s*2|eixo\s*1)/.test(n) &&
      /(dir|direit)/.test(n) &&
      /(int|intern)/.test(n),
  },
  {
    slot: "rear1-right-outer",
    test: (n) =>
      /(traseir|eixo\s*2|eixo\s*1)/.test(n) &&
      /(dir|direit)/.test(n) &&
      /(ext|extern)/.test(n),
  },
  {
    slot: "rear2-left-outer",
    test: (n) => /(eixo\s*3|traseir.*2)/.test(n) && /(esq|esquer)/.test(n) && /(ext|extern)/.test(n),
  },
  {
    slot: "rear2-left-inner",
    test: (n) => /(eixo\s*3|traseir.*2)/.test(n) && /(esq|esquer)/.test(n) && /(int|intern)/.test(n),
  },
  {
    slot: "rear2-right-inner",
    test: (n) => /(eixo\s*3|traseir.*2)/.test(n) && /(dir|direit)/.test(n) && /(int|intern)/.test(n),
  },
  {
    slot: "rear2-right-outer",
    test: (n) => /(eixo\s*3|traseir.*2)/.test(n) && /(dir|direit)/.test(n) && /(ext|extern)/.test(n),
  },
  { slot: "spare-1", test: (n) => /estepe/.test(n) && /(1|um|primeir)/.test(n) },
  { slot: "spare-2", test: (n) => /estepe/.test(n) && /(2|dois|segund)/.test(n) },
  { slot: "spare-1", test: (n) => n === "estepe" || n === "estepe 1" },
];

export const mapPosicoesToSlots = (posicoes) => {
  const bySlot = {};
  const unmapped = [];

  for (const pos of posicoes) {
    const n = normalize(pos.nome_posicao);
    const rule = SLOT_RULES.find((r) => r.test(n));
    if (rule && !bySlot[rule.slot]) {
      bySlot[rule.slot] = pos;
    } else if (!rule) {
      unmapped.push(pos);
    }
  }

  // Fallback: traseiro simples (sem interno/externo)
  for (const pos of posicoes) {
    const n = normalize(pos.nome_posicao);
    if (!bySlot["rear1-left-outer"] && /traseir/.test(n) && /(esq|esquer)/.test(n)) {
      bySlot["rear1-left-outer"] = pos;
    }
    if (!bySlot["rear1-right-outer"] && /traseir/.test(n) && /(dir|direit)/.test(n)) {
      bySlot["rear1-right-outer"] = pos;
    }
  }

  return { bySlot, unmapped };
};
