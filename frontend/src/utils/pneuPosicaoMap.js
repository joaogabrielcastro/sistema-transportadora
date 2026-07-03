/** Agrupa posições do banco em diagrama dinâmico conforme o caminhão. */

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parsePosicaoMeta = (nome) => {
  const n = normalize(nome);

  if (/dianteir/.test(n) && /(esq|esquer)/.test(n)) {
    return { type: "front", side: "left" };
  }

  if (/dianteir/.test(n) && /(dir|direit)/.test(n)) {
    return { type: "front", side: "right" };
  }

  if (/estepe/.test(n)) {
    const indexMatch = n.match(/(\d+)/);
    return {
      type: "spare",
      index: indexMatch ? parseInt(indexMatch[1], 10) : 1,
    };
  }

  const axleMatch = n.match(/eixo\s*(\d+)/);
  if (axleMatch) {
    const axleNum = parseInt(axleMatch[1], 10);
    const side = /(dir|direit)/.test(n) ? "right" : "left";
    const mount = /(int|intern)/.test(n) ? "inner" : "outer";
    return { type: "axle", axleNum, side, mount };
  }

  if (/traseir/.test(n)) {
    const side = /(dir|direit)/.test(n) ? "right" : "left";
    const mount = /(int|intern)/.test(n) ? "inner" : "outer";
    return { type: "axle", axleNum: 2, side, mount };
  }

  return { type: "unknown" };
};

const emptyAxle = () => ({
  leftOuter: null,
  leftInner: null,
  rightInner: null,
  rightOuter: null,
});

const assignAxlePos = (axle, meta, pos) => {
  const key =
    meta.side === "left"
      ? meta.mount === "inner"
        ? "leftInner"
        : "leftOuter"
      : meta.mount === "inner"
        ? "rightInner"
        : "rightOuter";

  if (!axle[key]) {
    axle[key] = pos;
  }
};

const AXLE_SLOT_ORDER = [
  "leftOuter",
  "leftInner",
  "rightOuter",
  "rightInner",
];

const buildOrderedPositions = ({ front, axles, spares }) => {
  const ordered = [];

  if (front.left) ordered.push(front.left);
  if (front.right) ordered.push(front.right);

  for (const axle of axles) {
    for (const slot of AXLE_SLOT_ORDER) {
      if (axle[slot]) ordered.push(axle[slot]);
    }
  }

  for (const spare of spares) {
    ordered.push(spare);
  }

  return ordered;
};

export const inferTireLayout = (caminhao, orderedPositions) => {
  const qtd = parseInt(caminhao?.qtd_pneus, 10);
  const hasCarreta1 = Boolean(caminhao?.placa_carreta_1?.trim());
  const hasCarreta2 = Boolean(caminhao?.placa_carreta_2?.trim());

  if (!Number.isFinite(qtd) || qtd <= 0) {
    return {
      description: `${orderedPositions.length} posições cadastradas`,
      limit: orderedPositions.length,
    };
  }

  const parts = [`${qtd} pneus no veículo`];
  const visible = Math.min(qtd, orderedPositions.length);
  const rearVisible = Math.max(0, visible - 2);
  const rearAxles = Math.ceil(rearVisible / 4);

  if (rearAxles > 0) {
    parts.push(`${rearAxles} eixo(s) traseiro(s) no diagrama`);
  }

  if (hasCarreta1 || hasCarreta2) {
    const carretas = [hasCarreta1 && "1ª carreta", hasCarreta2 && "2ª carreta"]
      .filter(Boolean)
      .join(" + ");
    parts.push(carretas);
  }

  return {
    description: parts.join(" • "),
    limit: qtd,
  };
};

const pruneAxle = (axle, allowedIds) => {
  const next = { ...axle };
  for (const slot of AXLE_SLOT_ORDER) {
    if (next[slot] && !allowedIds.has(next[slot].id)) {
      next[slot] = null;
    }
  }
  return next;
};

export const buildPositionDiagram = (posicoes, caminhao = null) => {
  const front = { left: null, right: null };
  const axleMap = new Map();
  const spares = [];
  const unmapped = [];

  for (const pos of posicoes) {
    const meta = parsePosicaoMeta(pos.nome_posicao);

    if (meta.type === "front") {
      front[meta.side] = pos;
      continue;
    }

    if (meta.type === "spare") {
      spares.push({ ...meta, pos });
      continue;
    }

    if (meta.type === "axle") {
      if (!axleMap.has(meta.axleNum)) {
        axleMap.set(meta.axleNum, { number: meta.axleNum, ...emptyAxle() });
      }
      assignAxlePos(axleMap.get(meta.axleNum), meta, pos);
      continue;
    }

    unmapped.push(pos);
  }

  const allAxles = [...axleMap.values()].sort((a, b) => a.number - b.number);
  const allSpares = spares
    .sort((a, b) => a.index - b.index)
    .map((item) => item.pos);

  const ordered = buildOrderedPositions({
    front,
    axles: allAxles,
    spares: allSpares,
  });

  const layout = inferTireLayout(caminhao, ordered);
  const allowedIds = new Set(
    layout.limit > 0
      ? ordered.slice(0, layout.limit).map((pos) => pos.id)
      : ordered.map((pos) => pos.id),
  );

  const prunedFront = {
    left: front.left && allowedIds.has(front.left.id) ? front.left : null,
    right: front.right && allowedIds.has(front.right.id) ? front.right : null,
  };

  const prunedAxles = allAxles
    .map((axle) => pruneAxle(axle, allowedIds))
    .filter(
      (axle) =>
        axle.leftOuter ||
        axle.leftInner ||
        axle.rightInner ||
        axle.rightOuter,
    );

  const prunedSpares = allSpares.filter((pos) => allowedIds.has(pos.id));

  return {
    front: prunedFront,
    axles: prunedAxles,
    spares: prunedSpares,
    unmapped,
    layout,
    allowedIds,
  };
};

/** @deprecated use buildPositionDiagram */
export const mapPosicoesToSlots = (posicoes) => {
  const diagram = buildPositionDiagram(posicoes);
  const bySlot = {};

  if (diagram.front.left) bySlot["front-left"] = diagram.front.left;
  if (diagram.front.right) bySlot["front-right"] = diagram.front.right;

  diagram.axles.forEach((axle, index) => {
    const prefix = index === 0 ? "rear1" : `rear${index + 1}`;
    if (axle.leftOuter) bySlot[`${prefix}-left-outer`] = axle.leftOuter;
    if (axle.leftInner) bySlot[`${prefix}-left-inner`] = axle.leftInner;
    if (axle.rightInner) bySlot[`${prefix}-right-inner`] = axle.rightInner;
    if (axle.rightOuter) bySlot[`${prefix}-right-outer`] = axle.rightOuter;
  });

  if (diagram.spares[0]) bySlot["spare-1"] = diagram.spares[0];
  if (diagram.spares[1]) bySlot["spare-2"] = diagram.spares[1];

  return { bySlot, unmapped: diagram.unmapped };
};

export const filterPosicoesForCaminhao = (posicoes, caminhao) => {
  const diagram = buildPositionDiagram(posicoes, caminhao);
  return posicoes.filter((pos) => diagram.allowedIds.has(pos.id));
};

export const isPosicaoAllowedForCaminhao = (posicaoId, posicoes, caminhao) => {
  if (!posicaoId) return true;
  const diagram = buildPositionDiagram(posicoes, caminhao);
  return diagram.allowedIds.has(Number(posicaoId));
};
