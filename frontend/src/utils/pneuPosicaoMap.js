/** Agrupa posições do banco em diagrama dinâmico conforme o veículo. */

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parsePosicaoMeta = (nome) => {
  const n = normalize(nome);
  const isCarreta = /carreta/.test(n);

  if (/dianteir/.test(n) && /(esq|esquer)/.test(n)) {
    return { type: "front", side: "left", scope: "cavalo" };
  }

  if (/dianteir/.test(n) && /(dir|direit)/.test(n)) {
    return { type: "front", side: "right", scope: "cavalo" };
  }

  if (/estepe/.test(n)) {
    const indexMatch = n.match(/(\d+)/);
    return {
      type: "spare",
      index: indexMatch ? parseInt(indexMatch[1], 10) : 1,
      scope: isCarreta ? "carreta" : "cavalo",
    };
  }

  const axleMatch = n.match(/eixo\s*(\d+)/);
  if (axleMatch) {
    const axleNum = parseInt(axleMatch[1], 10);
    const side = /(dir|direit)/.test(n) ? "right" : "left";
    const mount = /(int|intern)/.test(n) ? "inner" : "outer";
    return {
      type: "axle",
      axleNum,
      side,
      mount,
      scope: isCarreta ? "carreta" : "cavalo",
    };
  }

  if (/traseir/.test(n)) {
    const side = /(dir|direit)/.test(n) ? "right" : "left";
    const mount = /(int|intern)/.test(n) ? "inner" : "outer";
    return {
      type: "axle",
      axleNum: 2,
      side,
      mount,
      scope: "cavalo",
    };
  }

  return { type: "unknown", scope: "cavalo" };
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

/** Inferência de qtd de pneus a partir de config_eixos (ex: 6x2, 8x4). */
export const inferQtdFromConfig = (configEixos, com4Eixo = false) => {
  const m = String(configEixos || "").match(/(\d+)\s*[xX]\s*(\d+)/);
  if (!m) return null;
  const wheels = parseInt(m[1], 10);
  // Heurística comum: N em NxM ≈ posições de roda (não necessariamente pneus dual)
  // Preferimos qtd_pneus explícito; aqui só fallback.
  let qtd = wheels;
  if (com4Eixo && qtd < 10) qtd += 2;
  return qtd;
};

export const resolveTipoVeiculo = (veiculo) => {
  const t = String(veiculo?.tipo_veiculo || "").toLowerCase();
  if (t === "cavalo" || t === "carreta" || t === "truck") return t;
  if (veiculo?.placa_carreta_1 || veiculo?.numero_cavalo) return "cavalo";
  return "truck";
};

export const inferTireLayout = (caminhao, orderedPositions) => {
  const tipo = resolveTipoVeiculo(caminhao);
  let qtd = parseInt(caminhao?.qtd_pneus, 10);

  if (!Number.isFinite(qtd) || qtd <= 0) {
    const inferred = inferQtdFromConfig(
      caminhao?.config_eixos,
      caminhao?.com_4_eixo,
    );
    if (inferred) qtd = inferred;
  }

  const vinculos = caminhao?.composicao?.vinculos || [];
  const carretasVinculadas = vinculos.filter((v) => v.ativo !== false);

  if (!Number.isFinite(qtd) || qtd <= 0) {
    return {
      description: `${orderedPositions.length} posições cadastradas`,
      limit: orderedPositions.length,
      tipo,
    };
  }

  const tipoLabel =
    tipo === "carreta" ? "carreta" : tipo === "cavalo" ? "cavalo" : "truck";
  const parts = [`${qtd} pneus (${tipoLabel})`];

  if (caminhao?.config_eixos) {
    parts.push(caminhao.config_eixos);
  }
  if (caminhao?.com_4_eixo) {
    parts.push("c/ 4º eixo");
  }

  if (tipo === "carreta") {
    const axles = Math.ceil(qtd / 4);
    parts.push(`${axles} eixo(s) no diagrama`);
  } else {
    const visible = Math.min(qtd, orderedPositions.length);
    const rearVisible = Math.max(0, visible - 2);
    const rearAxles = Math.ceil(rearVisible / 4);
    if (rearAxles > 0) {
      parts.push(`${rearAxles} eixo(s) traseiro(s)`);
    }
  }

  if (carretasVinculadas.length) {
    parts.push(
      carretasVinculadas
        .map((v, i) => `${i + 1}ª carreta ${v.carreta?.placa || ""}`.trim())
        .join(" + "),
    );
  } else {
    const hasCarreta1 = Boolean(caminhao?.placa_carreta_1?.trim());
    const hasCarreta2 = Boolean(caminhao?.placa_carreta_2?.trim());
    if (hasCarreta1 || hasCarreta2) {
      const carretas = [hasCarreta1 && "1ª carreta", hasCarreta2 && "2ª carreta"]
        .filter(Boolean)
        .join(" + ");
      parts.push(carretas);
    }
  }

  return {
    description: parts.join(" • "),
    limit: qtd,
    tipo,
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

const filterPosicoesByScope = (posicoes, tipo) => {
  if (tipo === "carreta") {
    const carretaOnly = posicoes.filter((p) =>
      /carreta/i.test(p.nome_posicao || ""),
    );
    if (carretaOnly.length) return carretaOnly;
  }
  // truck/cavalo: ignora posições prefixadas Carreta
  return posicoes.filter((p) => !/carreta/i.test(p.nome_posicao || ""));
};

export const buildPositionDiagram = (posicoes, caminhao = null) => {
  const tipo = resolveTipoVeiculo(caminhao);
  const scoped = filterPosicoesByScope(posicoes, tipo);

  const front = { left: null, right: null };
  const axleMap = new Map();
  const spares = [];
  const unmapped = [];

  for (const pos of scoped) {
    const meta = parsePosicaoMeta(pos.nome_posicao);

    if (meta.type === "front") {
      if (tipo === "carreta") {
        unmapped.push(pos);
        continue;
      }
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

  // Carreta: sem dianteiro; eixos começam do 1
  const ordered = buildOrderedPositions({
    front: tipo === "carreta" ? { left: null, right: null } : front,
    axles: allAxles,
    spares: allSpares,
  });

  const layout = inferTireLayout(caminhao, ordered);
  const allowedIds = new Set(
    layout.limit > 0
      ? ordered.slice(0, layout.limit).map((pos) => pos.id)
      : ordered.map((pos) => pos.id),
  );

  const prunedFront =
    tipo === "carreta"
      ? { left: null, right: null }
      : {
          left: front.left && allowedIds.has(front.left.id) ? front.left : null,
          right:
            front.right && allowedIds.has(front.right.id) ? front.right : null,
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
    tipo,
    title:
      tipo === "carreta"
        ? `Carreta ${caminhao?.placa || ""}`.trim()
        : tipo === "cavalo"
          ? `Cavalo ${caminhao?.placa || ""}`.trim()
          : `Truck ${caminhao?.placa || ""}`.trim(),
  };
};

/**
 * Monta seções (cavalo + carretas) para instalação em composição.
 */
export const buildCompositionDiagrams = (posicoes, cavalo, carretas = []) => {
  const sections = [];
  if (cavalo) {
    sections.push({
      key: `veiculo-${cavalo.id}`,
      veiculo: cavalo,
      diagram: buildPositionDiagram(posicoes, {
        ...cavalo,
        tipo_veiculo: resolveTipoVeiculo(cavalo),
      }),
    });
  }
  for (const carreta of carretas) {
    sections.push({
      key: `veiculo-${carreta.id}`,
      veiculo: carreta,
      diagram: buildPositionDiagram(posicoes, {
        ...carreta,
        tipo_veiculo: "carreta",
      }),
    });
  }
  return sections;
};

export const isPosicaoAllowedForCaminhao = (posicaoId, posicoes, caminhao) => {
  if (!posicaoId) return true;
  const diagram = buildPositionDiagram(posicoes, caminhao);
  return diagram.allowedIds.has(Number(posicaoId));
};
