import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import brazilMap from "../data/brazilMapDots.json";

/**
 * Painel visual da referência (Norvia/laranja) com paleta ATrack (azul).
 * Silhueta do Brasil: pontos amostrados a partir do GeoJSON oficial dos estados.
 *
 * Tokens (laranja → azul):
 *  primary accent  #E87332 → #0891B2
 *  glow / bright   #FFB07A → #22D3EE
 *  dark accent     #C2410C → #0E7490
 *  map dots muted  #E8C4A8 → #9EC9D6
 *  map heat        #F0975A → #5BBECE
 *  panel bg        #FFF5F0 → #F4F9FC
 */

const TOKENS = {
  // creme do laranja → azul frio bem claro (mesmo “ar” da ref)
  bg: "#F6FAFC",
  dot: "125, 188, 205",
  heat: "64, 178, 198",
  accent: "#0891B2",
  accentRgb: "8, 145, 178",
  glow: "#22D3EE",
  glowRgb: "34, 211, 238",
  dark: "#0E7490",
  ink: "#0F172A",
  muted: "#64748B",
};

/** [minLon, minLat, maxLon, maxLat] do território brasileiro. */
const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = brazilMap.bbox;
const DOTS = brazilMap.dots;

const CITIES = {
  belem: { name: "Belém", lon: -48.5, lat: -1.45 },
  manaus: { name: "Manaus", lon: -60.02, lat: -3.1 },
  fortaleza: { name: "Fortaleza", lon: -38.52, lat: -3.73 },
  recife: { name: "Recife", lon: -34.88, lat: -8.05 },
  salvador: { name: "Salvador", lon: -38.5, lat: -12.97 },
  brasilia: { name: "Brasília", lon: -47.93, lat: -15.78 },
  goiania: { name: "Goiânia", lon: -49.25, lat: -16.68 },
  bh: { name: "Belo Horizonte", lon: -43.94, lat: -19.92 },
  sp: { name: "São Paulo", lon: -46.63, lat: -23.55 },
  curitiba: { name: "Curitiba", lon: -49.27, lat: -25.43 },
  poa: { name: "Porto Alegre", lon: -51.23, lat: -30.03 },
  cuiaba: { name: "Cuiabá", lon: -56.1, lat: -15.6 },
  vitoria: { name: "Vitória", lon: -40.3, lat: -20.3 },
  natal: { name: "Natal", lon: -35.2, lat: -5.8 },
};

/** Rotas: Curitiba → polos primeiro; depois transversais. */
const ROUTES = [
  {
    from: "curitiba",
    to: "sp",
    placa: "CPR2A11",
    label: "Curitiba/PR → São Paulo/SP",
    speed: 78,
    limit: 90,
    hours: "0h52",
    maxHours: "5h30",
    eta: "chegada sex 08:40",
    status: "Em rota",
    bend: 0.2,
    lift: 0.42,
    period: 3400,
    phase: 0.05,
  },
  {
    from: "curitiba",
    to: "bh",
    placa: "CPR4B28",
    label: "Curitiba/PR → Belo Horizonte/MG",
    speed: 82,
    limit: 90,
    hours: "1h28",
    maxHours: "5h30",
    eta: "chegada sex 10:15",
    status: "Em rota",
    bend: 0.24,
    lift: 0.48,
    period: 4000,
    phase: 0.18,
  },
  {
    from: "curitiba",
    to: "goiania",
    placa: "CPR7C44",
    label: "Curitiba/PR → Goiânia/GO",
    speed: 75,
    limit: 80,
    hours: "1h55",
    maxHours: "5h30",
    eta: "chegada sex 12:05",
    status: "Em rota",
    bend: -0.18,
    lift: 0.5,
    period: 4200,
    phase: 0.28,
  },
  {
    from: "curitiba",
    to: "salvador",
    placa: "CPR9D63",
    label: "Curitiba/PR → Salvador/BA",
    speed: 80,
    limit: 90,
    hours: "2h40",
    maxHours: "5h30",
    eta: "chegada sex 15:20",
    status: "Em rota",
    bend: 0.28,
    lift: 0.55,
    period: 4600,
    phase: 0.4,
  },
  {
    from: "curitiba",
    to: "fortaleza",
    placa: "CPR1E17",
    label: "Curitiba/PR → Fortaleza/CE",
    speed: 77,
    limit: 90,
    hours: "3h10",
    maxHours: "5h30",
    eta: "chegada sáb 06:50",
    status: "Em rota",
    bend: 0.32,
    lift: 0.58,
    period: 5000,
    phase: 0.52,
  },
  {
    from: "curitiba",
    to: "recife",
    placa: "QJM8D22",
    label: "Curitiba/PR → Recife/PE",
    speed: 79,
    limit: 90,
    hours: "3h05",
    maxHours: "5h30",
    eta: "chegada sáb 07:15",
    status: "Em rota",
    bend: 0.3,
    lift: 0.56,
    period: 4800,
    phase: 0.62,
  },
  {
    from: "curitiba",
    to: "poa",
    placa: "CPR3F09",
    label: "Curitiba/PR → Porto Alegre/RS",
    speed: 74,
    limit: 80,
    hours: "1h12",
    maxHours: "5h30",
    eta: "chegada sex 09:55",
    status: "Em rota",
    bend: -0.22,
    lift: 0.4,
    period: 3600,
    phase: 0.72,
  },
  {
    from: "bh",
    to: "salvador",
    placa: "RJM8F13",
    label: "Belo Horizonte/MG → Salvador/BA",
    speed: 0,
    limit: 80,
    hours: "0h00",
    maxHours: "5h30",
    eta: "No destino · descarga desde 10:12",
    status: "Descarregando",
    bend: 0.24,
    lift: 0.46,
    period: 4200,
    phase: 0.85,
    atDestination: true,
  },
];

/** Velocidade quase constante (laranja): sem frear no início/fim. */
function travelT(cycle) {
  // leve ease só nas pontas (5%), meio linear
  if (cycle < 0.05) {
    const u = cycle / 0.05;
    return 0.05 * u * u;
  }
  if (cycle > 0.95) {
    const u = (cycle - 0.95) / 0.05;
    return 0.95 + 0.05 * (1 - (1 - u) * (1 - u));
  }
  return cycle;
}

/**
 * Tilt Norvia (fidelidade): mapa bem deitado, sem compensar Y no layout.
 * Gaps vs vídeo: perspectiva, 1 rota “viva” + fundo quieto, arco alto, ping na chegada.
 */
/**
 * Perspectiva do norvis.mp4: leve foreshortening (não tilt extremo).
 * Brasil reconhecível, um pouco mais largo.
 */
const TILT = (32 * Math.PI) / 180;
const COS_T = Math.cos(TILT);
const SIN_T = Math.sin(TILT);
const FOCAL = 780;
const MAP_STRETCH_X = 1.16;
/** Anéis elípticos no plano do mapa. */
const RING_Y_RATIO = 0.55;

const TICKER = [
  "Velocidade normalizada · KZX9F64 · BR-116",
  "Pausa de 30 min cumprida · QXN7J84",
  "Chegada em São Paulo/SP · LMN3E02",
  "Chegada em Uberlândia/MG · HUB2L85",
];

/** Layout: largo + Y comprimido de verdade (mapa deitado). */
function makeLayout(w, h, inset) {
  const { left, right, top, bottom } = inset;
  const availW = w - left - right;
  const availH = h - top - bottom;
  const lonSpan = LON_MAX - LON_MIN;
  const latSpan = LAT_MAX - LAT_MIN;
  const geoAspect = (lonSpan / latSpan) * MAP_STRETCH_X;

  // Cabe o Brasil inteiro com leve compressão (como norvis.mp4)
  let drawW = availW * 0.92;
  let drawH = drawW / geoAspect;
  const screenH = drawH * COS_T;
  if (screenH > availH * 0.92) {
    drawH = (availH * 0.92) / COS_T;
    drawW = drawH * geoAspect;
    if (drawW > availW * 0.96) {
      drawW = availW * 0.96;
      drawH = drawW / geoAspect;
    }
  }
  const ox = left + (availW - drawW) / 2;
  const oyFlat = top + (availH - drawH * COS_T) / 2 + availH * 0.01;
  return {
    w,
    h,
    ox,
    oy: oyFlat,
    drawW,
    drawH,
    cx: ox + drawW / 2,
    cy: oyFlat + (drawH * COS_T) / 2,
    lonSpan,
    latSpan,
  };
}

/** Coordenadas no plano do mapa (antes da câmera). */
function toPlane(lon, lat, L) {
  return {
    x: L.ox + ((lon - LON_MIN) / L.lonSpan) * L.drawW,
    y: L.oy + ((LAT_MAX - lat) / L.latSpan) * L.drawH,
  };
}

/**
 * Projeta ponto do plano + altura (arco) para a tela.
 * height > 0 sobe “no ar” (efeito do vídeo Norvia).
 */
function project3d(xFlat, yFlat, height, L) {
  const dx = xFlat - L.cx;
  const dy = yFlat - (L.oy + L.drawH / 2);
  // sul mais perto; altura aproxima da câmera
  const depth = -dy * SIN_T - height * COS_T;
  const scale = FOCAL / (FOCAL + depth);
  return {
    x: L.cx + dx * scale,
    y: L.cy + (dy * COS_T - height * SIN_T) * scale,
  };
}

function project(lon, lat, L, height = 0) {
  const p = toPlane(lon, lat, L);
  return project3d(p.x, p.y, height, L);
}

/**
 * Arco no espaço da tela (como no vídeo Norvia):
 * endpoints no plano 3D do mapa; o meio sobe pra cima da tela.
 * Assim N–S (Goiânia→Belém) também fica com parábola visível, não reta.
 * ground=true → sombra no chão (sem lift).
 */
function sampleArc(from, to, bend, lift, L, n = 96, ground = false) {
  const a = project(from.lon, from.lat, L);
  const b = project(to.lon, to.lat, L);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  // perpendicular unitária (para abrir o arco pro lado)
  const px = -dy / dist;
  const py = dx / dist;
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const arch = 4 * t * (1 - t);
    const side = bend * dist * 0.55 * arch;
    const up = ground ? 0 : lift * dist * arch;
    pts.push({
      x: a.x + dx * t + px * side,
      y: a.y + dy * t + py * side - up,
    });
  }
  return pts;
}

function drawPolyline(ctx, pts, i0, i1) {
  const a = Math.max(0, Math.floor(i0));
  const b = Math.min(pts.length - 1, Math.ceil(i1));
  if (b <= a) return;
  ctx.beginPath();
  ctx.moveTo(pts[a].x, pts[a].y);
  for (let i = a + 1; i <= b; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

/**
 * Anéis finos no destino (ping local ao chegar).
 * impacts fine: [{ age, life, maxR }]
 */
function drawArrivalBurst(ctx, p, fineImpacts, strength = 1) {
  if (!fineImpacts?.length && strength < 0.05) return;
  const s = Math.min(1, strength);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, RING_Y_RATIO);
  const blob = ctx.createRadialGradient(0, 0, 0, 0, 0, 32 * s);
  blob.addColorStop(0, `rgba(${TOKENS.glowRgb}, ${0.48 * s})`);
  blob.addColorStop(0.5, `rgba(${TOKENS.accentRgb}, ${0.16 * s})`);
  blob.addColorStop(1, `rgba(${TOKENS.accentRgb}, 0)`);
  ctx.fillStyle = blob;
  ctx.beginPath();
  ctx.arc(0, 0, 32 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const imp of fineImpacts) {
    if (imp.age < 0) continue;
    const t = Math.min(1, imp.age / imp.life);
    const maxR = imp.maxR ?? 48;
    const rx = 4 + t * maxR;
    const ry = rx * RING_Y_RATIO;
    const alpha = (1 - t) * (1 - t) * 0.95 * s;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${TOKENS.glowRgb}, ${alpha})`;
    ctx.lineWidth = Math.max(0.85, (imp.line ?? 2.4) * (1 - t));
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const beamH = 26 * s;
  const beam = ctx.createLinearGradient(p.x, p.y, p.x, p.y - beamH);
  beam.addColorStop(0, `rgba(${TOKENS.glowRgb}, ${0.55 * s})`);
  beam.addColorStop(1, `rgba(${TOKENS.accentRgb}, 0)`);
  ctx.strokeStyle = beam;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - beamH);
  ctx.stroke();
}

/** Halo suave na origem quando a bolinha parte. */
function drawOriginPulse(ctx, p, strength) {
  if (strength <= 0.02) return;
  const s = Math.min(1, strength);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, RING_Y_RATIO);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * s);
  g.addColorStop(0, `rgba(${TOKENS.glowRgb}, ${0.35 * s})`);
  g.addColorStop(1, `rgba(${TOKENS.accentRgb}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Cometa do norvis.mp4: só um rastro CURTO atrás da bolinha
 * (contagem fixa de pontos — não % do arco, senão rotas longas
 * viram “linha inteira” na tela).
 */
function drawCometArc(ctx, pts, _groundPts, headT, featured, arrival = 0) {
  const n = pts.length - 1;
  const headIdx = Math.max(0, Math.min(n, headT * n));
  const nearEnd = headT > 0.88;
  const headBoost = nearEnd
    ? 1 + (headT - 0.88) * 2 + arrival * 0.45
    : 1 + arrival * 0.15;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ~8–12 amostras (~11–17% num arco de 72) — visual curto como no Norvia
  const trailSamples = featured ? 9 : 5;
  const steps = featured ? 18 : 8;
  for (let s = 0; s < steps; s += 1) {
    const f = s / (steps - 1);
    const tBack = headIdx - trailSamples * (1 - f);
    const tFwd = headIdx - trailSamples * (1 - Math.min(1, f + 1 / steps));
    if (tFwd < 0) continue;
    const alpha = featured ? 0.1 + f * 0.85 : 0.06 + f * 0.42;
    const width = featured ? 1.4 + f * 4.5 : 0.9 + f * 2.2;
    ctx.strokeStyle = `rgba(${TOKENS.accentRgb}, ${alpha})`;
    ctx.lineWidth = width;
    drawPolyline(ctx, pts, Math.max(0, tBack), Math.max(0, tFwd));
  }

  if (featured) {
    ctx.strokeStyle = `rgba(${TOKENS.glowRgb}, 0.92)`;
    ctx.lineWidth = 2.8;
    drawPolyline(ctx, pts, Math.max(0, headIdx - 4), headIdx);
  }

  const head = pts[Math.round(headIdx)] || pts[n];
  const r = (featured ? 24 : 10) * headBoost;
  const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.14, `rgba(${TOKENS.glowRgb}, 0.95)`);
  g.addColorStop(0.4, `rgba(${TOKENS.accentRgb}, 0.4)`);
  g.addColorStop(1, `rgba(${TOKENS.accentRgb}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#FFFFFF";
  ctx.arc(head.x, head.y, featured ? 3.1 * headBoost : 1.9, 0, Math.PI * 2);
  ctx.fill();

  return { head, dest: pts[n] };
}

/**
 * Ondas GRANDES no mapa — só nos dots, disparadas na chegada.
 * mapWaves: [{ x, y, age, life, maxR, band }]
 */
function applyArrivalMapWaves(dots, mapWaves) {
  if (!mapWaves?.length || !dots?.length) {
    return dots.map((d) => ({ ...d, wave: 0 }));
  }

  const fronts = [];
  for (const w of mapWaves) {
    if (w.age < 0) continue;
    const t = Math.min(1, w.age / w.life);
    fronts.push({
      x: w.x,
      y: w.y,
      rx: 6 + t * w.maxR,
      fade: (1 - t) * (1 - t),
      band: w.band ?? Math.max(12, w.maxR * 0.06),
      strength: w.strength ?? 1,
    });
  }
  if (!fronts.length) return dots.map((d) => ({ ...d, wave: 0 }));

  return dots.map((d) => {
    let wave = 0;
    for (const f of fronts) {
      const dx = d.x - f.x;
      const dy = (d.y - f.y) / RING_Y_RATIO;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const gap = Math.abs(dist - f.rx);
      if (gap > f.band) continue;
      const local = (1 - gap / f.band) * f.fade * f.strength;
      if (local > wave) wave = local;
    }
    return { ...d, wave };
  });
}

/** Feixe vertical fino nos nós (como no vídeo). */
function drawPin(ctx, p, strong) {
  const h = strong ? 30 : 14;
  const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y - h);
  grad.addColorStop(0, `rgba(${TOKENS.accentRgb}, ${strong ? 0.5 : 0.22})`);
  grad.addColorStop(1, `rgba(${TOKENS.accentRgb}, 0)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = strong ? 1.8 : 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - h);
  ctx.stroke();
}

export default function BrazilOpsMap({ className = "" }) {
  const canvasRef = useRef(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    [],
  );

  const [featured, setFeatured] = useState(0);
  const [progress, setProgress] = useState(38);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [clock, setClock] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const active = ROUTES[featured];

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setClock(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let disposed = false;
    let last = 0;
    let feat = 0;
    let featClock = 0;
    let lastProgress = -1;
    let lastFeat = -1;
    let lastProgressAt = 0;
    /** Opacidade dos nomes (fade in/out ao trocar rota). */
    const labelAlpha = {};
    /** Cache de geometria — evita recalcular ~6k pontos todo frame (causa “trava”). */
    let geoCache = null;
    /** Anéis finos no destino + ondas grandes no mapa (só na chegada). */
    let fineImpacts = [];
    let mapWaves = [];
    let lastCycleBucket = -1;
    let wasNearStart = false;

    const insetFor = (w, h) => ({
      left: w * 0.05,
      right: w * 0.05,
      top: h * 0.14,
      bottom: h * 0.2,
    });

    const rebuildGeo = (w, h) => {
      const L = makeLayout(w, h, insetFor(w, h));
      const hub = project(CITIES.curitiba.lon, CITIES.curitiba.lat, L);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      const dots = DOTS.map(([lon, lat]) => {
        const p = project(lon, lat, L);
        const dx = p.x - hub.x;
        const dy = p.y - hub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const heat = Math.max(0, 1 - dist / (Math.min(w, h) * 0.45));
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        return {
          x: p.x,
          y: p.y,
          // centro mais “quente” como o laranja da ref
          alpha: 0.42 + heat * 0.55,
          radius: 1.35 + heat * 1.55,
        };
      });
      const mapBounds = { minX, maxX, minY, maxY };
      const ptsCache = {};
      for (const [id, city] of Object.entries(CITIES)) {
        ptsCache[id] = project(city.lon, city.lat, L);
      }
      const arcs = ROUTES.map((r) => {
        const fromCity = CITIES[r.from];
        const toCity = CITIES[r.to];
        return {
          arc: sampleArc(fromCity, toCity, r.bend, r.lift ?? 0.48, L, 72),
          ground: sampleArc(fromCity, toCity, r.bend * 0.35, 0, L, 72, true),
        };
      });
      const mapDiag = Math.hypot(
        mapBounds.maxX - mapBounds.minX,
        mapBounds.maxY - mapBounds.minY,
      );
      geoCache = {
        key: `${w}x${h}`,
        L,
        hub,
        dots,
        ptsCache,
        arcs,
        mapBounds,
        mapDiag,
      };
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geoCache = null;
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const draw = (ts) => {
      if (disposed) return;
      if (!last) last = ts;
      const dt = Math.min(32, ts - last);
      last = ts;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) {
        raf = requestAnimationFrame(draw);
        return;
      }

      if (!reducedMotion) {
        featClock += dt;
        if (featClock >= 4800) {
          featClock = 0;
          feat = (feat + 1) % ROUTES.length;
        }
      }
      if (feat !== lastFeat && !disposed) {
        lastFeat = feat;
        fineImpacts = [];
        mapWaves = [];
        lastCycleBucket = -1;
        wasNearStart = true;
        setFeatured(feat);
        setTickerIdx((v) => (v + 1) % TICKER.length);
      }

      if (!geoCache || geoCache.key !== `${w}x${h}`) rebuildGeo(w, h);
      const { hub, dots, ptsCache, arcs, mapBounds, mapDiag } = geoCache;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = TOKENS.bg;
      ctx.fillRect(0, 0, w, h);

      // sombra suave sob o Brasil (mapa “pousado” na mesa)
      if (mapBounds) {
        const mx = (mapBounds.minX + mapBounds.maxX) / 2;
        const my = mapBounds.maxY + 10;
        const rw = (mapBounds.maxX - mapBounds.minX) * 0.4;
        const rh = Math.max(16, (mapBounds.maxY - mapBounds.minY) * 0.07);
        ctx.save();
        ctx.translate(mx, my);
        ctx.scale(1, rh / Math.max(rw, 1));
        const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
        shade.addColorStop(0, "rgba(15, 23, 42, 0.08)");
        shade.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(0, 0, rw, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const wash = ctx.createRadialGradient(
        hub.x,
        hub.y,
        6,
        hub.x,
        hub.y,
        Math.min(w, h) * 0.55,
      );
      wash.addColorStop(0, `rgba(${TOKENS.heat}, 0.5)`);
      wash.addColorStop(0.35, `rgba(${TOKENS.heat}, 0.2)`);
      wash.addColorStop(1, `rgba(${TOKENS.heat}, 0)`);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      const liveBg = [
        (feat + 2) % ROUTES.length,
        (feat + 5) % ROUTES.length,
      ];
      const order = [
        ...ROUTES.map((_, i) => i).filter((i) => i !== feat),
        feat,
      ];

      const featRoute = ROUTES[feat];
      const featCycle = ((ts / featRoute.period + featRoute.phase) % 1 + 1) % 1;
      const featArc = arcs[feat]?.arc;
      const destPt = featArc?.[featArc.length - 1];

      // Na chegada: anéis finos no destino + ondas GRANDES no mapa
      if (!reducedMotion && destPt) {
        const spawnArrivalFx = (big) => {
          // finos / nítidos no ponto
          fineImpacts.push(
            { born: ts, life: 720, maxR: 36, line: 2.2 },
            { born: ts + 110, life: 820, maxR: 48, line: 2 },
            { born: ts + 220, life: 900, maxR: 58, line: 1.7 },
          );
          // maiores — varrem o Brasil pelos dots
          const base = mapDiag || 280;
          mapWaves.push(
            {
              born: ts + 40,
              life: 2100,
              x: destPt.x,
              y: destPt.y,
              maxR: base * (big ? 0.72 : 0.55),
              band: base * 0.05,
              strength: 1,
            },
            {
              born: ts + 280,
              life: 2600,
              x: destPt.x,
              y: destPt.y,
              maxR: base * (big ? 0.95 : 0.78),
              band: base * 0.065,
              strength: 0.85,
            },
          );
        };

        if (featRoute.atDestination) {
          const pulseBucket = Math.floor(ts / 1600);
          if (pulseBucket !== lastCycleBucket) {
            lastCycleBucket = pulseBucket;
            spawnArrivalFx(false);
          }
        } else {
          const bucket = Math.floor(ts / featRoute.period + featRoute.phase);
          if (
            featCycle >= 0.86 &&
            featCycle < 0.92 &&
            bucket !== lastCycleBucket
          ) {
            lastCycleBucket = bucket;
            spawnArrivalFx(true);
          }
          if (featCycle < 0.14) wasNearStart = true;
        }
      }

      fineImpacts = fineImpacts
        .map((imp) => ({ ...imp, age: ts - imp.born }))
        .filter((imp) => imp.age < imp.life);
      mapWaves = mapWaves
        .map((w) => ({ ...w, age: ts - w.born }))
        .filter((w) => w.age < w.life);

      // pontos do mapa + ondas grandes (só após chegada)
      const waved = reducedMotion
        ? dots
        : applyArrivalMapWaves(dots, mapWaves);
      for (const d of waved) {
        const wAmt = d.wave || 0;
        const alpha = Math.min(1, d.alpha + wAmt * 0.6);
        const radius = d.radius + wAmt * 1.8;
        ctx.beginPath();
        if (wAmt > 0.08) {
          ctx.fillStyle = `rgba(${TOKENS.glowRgb}, ${wAmt * 0.6})`;
          ctx.arc(d.x, d.y, radius + 1.5 * wAmt, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
        }
        ctx.fillStyle =
          wAmt > 0.12
            ? `rgba(${TOKENS.heat}, ${alpha})`
            : `rgba(${TOKENS.dot}, ${alpha})`;
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      let originPulse = 0;
      if (
        !reducedMotion &&
        !featRoute.atDestination &&
        wasNearStart &&
        featCycle < 0.16
      ) {
        originPulse = 1 - featCycle / 0.16;
      }

      for (const i of order) {
        const r = ROUTES[i];
        const { arc, ground } = arcs[i];
        const isFeat = i === feat;
        const isLiveBg = liveBg.includes(i);
        let headT;
        let arrival = 0;

        if (reducedMotion) {
          headT = r.atDestination || isFeat ? (r.atDestination ? 1 : 0.4) : 0.55;
          arrival = r.atDestination && isFeat ? 1 : 0;
        } else if (r.atDestination && isFeat) {
          headT = 1;
          arrival = 0.8;
        } else if (isFeat) {
          if (featCycle < 0.86) {
            headT = travelT(featCycle / 0.86);
            arrival = 0;
          } else {
            headT = 1;
            arrival = 1 - (featCycle - 0.86) / 0.14;
          }
        } else if (isLiveBg) {
          const cycle = ((ts / r.period + r.phase) % 1 + 1) % 1;
          headT = travelT(cycle);
        } else {
          headT = 1;
        }

        if (isFeat || isLiveBg) {
          drawCometArc(ctx, arc, ground, headT, isFeat, arrival);
        }

        if (isFeat) {
          const dest = arc[arc.length - 1];
          const from = arc[0];
          if (originPulse > 0.05) drawOriginPulse(ctx, from, originPulse);
          if (arrival > 0.05 || fineImpacts.length) {
            drawArrivalBurst(
              ctx,
              dest,
              fineImpacts,
              Math.max(arrival, fineImpacts.length ? 0.5 : 0),
            );
          }
        }

        if (isFeat && ts - lastProgressAt > 120) {
          const pct = Math.round(Math.min(1, Math.max(0.05, headT)) * 100);
          if (Math.abs(pct - lastProgress) >= 3) {
            lastProgress = pct;
            lastProgressAt = ts;
            if (!disposed) setProgress(pct);
          }
        }
      }

      const activeRoute = ROUTES[feat];
      const labelTargets = {
        [activeRoute.from]: 1,
        [activeRoute.to]: 1,
      };

      // nós: feixes em todos (ref) + marcadores maiores na rota ativa
      for (const [id] of Object.entries(CITIES)) {
        const p = ptsCache[id];
        const isEnd = id === activeRoute.from || id === activeRoute.to;
        const isHub = id === "curitiba";
        drawPin(ctx, p, isEnd || isHub);

        ctx.beginPath();
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = isEnd || isHub ? TOKENS.dark : "#94A3B8";
        ctx.lineWidth = isEnd || isHub ? 2 : 1.1;
        ctx.arc(p.x, p.y, isHub ? 5.6 : isEnd ? 5 : 3.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Nomes: só origem/destino da rota ativa, com fade in/out
      const fadeSpeed = dt / 280;
      const labelIds = new Set([
        ...Object.keys(labelAlpha),
        activeRoute.from,
        activeRoute.to,
      ]);
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      for (const id of labelIds) {
        const target = labelTargets[id] ?? 0;
        const cur = labelAlpha[id] ?? 0;
        const next =
          cur < target
            ? Math.min(target, cur + fadeSpeed)
            : Math.max(target, cur - fadeSpeed);
        if (next <= 0.01) {
          delete labelAlpha[id];
          continue;
        }
        labelAlpha[id] = next;
        const city = CITIES[id];
        const p = ptsCache[id];
        if (!city || !p) continue;

        const name = city.name;
        const metrics = ctx.measureText(name);
        let lx = p.x + 12;
        let ly = p.y - 14;
        // mantém o texto dentro do canvas
        if (lx + metrics.width > w - 8) lx = p.x - metrics.width - 12;
        if (lx < 8) lx = 8;
        if (ly < 16) ly = p.y + 16;
        if (ly > h - 12) ly = h - 12;

        ctx.globalAlpha = next;
        ctx.fillStyle = TOKENS.ink;
        ctx.textAlign = "left";
        ctx.fillText(name, lx, ly);
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reducedMotion]);

  const journeyPct = active.atDestination ? 100 : progress;
  const hourFrac = (() => {
    const m = String(active.hours).match(/(\d+)h(\d+)/);
    if (!m) return 0.3;
    return (Number(m[1]) * 60 + Number(m[2])) / (5.5 * 60);
  })();

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: TOKENS.bg }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      />

      {/* Título — composição da referência */}
      <div className="pointer-events-none absolute left-8 top-8 z-10 max-w-[420px] xl:left-10 xl:top-10">
        <h2
          className="text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-primary xl:text-[2rem]"
        >
          Sua frota sob controle.
        </h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-text-secondary">
          <span className="font-medium text-secondary">Rotas</span>,{" "}
          <span className="font-medium text-secondary">veículos</span> e operação
          em um só lugar — com a visão do Brasil em tempo real.
        </p>
      </div>

      {/* Card do veículo — layout da referência */}
      <div className="pointer-events-none absolute bottom-[3.25rem] left-8 z-10 w-[min(100%-4rem,380px)] xl:left-10">
        <div className="rounded-[18px] border border-black/[0.04] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Placa estilo BRASIL */}
              <div className="flex overflow-hidden rounded-[5px] border border-slate-300 shadow-sm">
                <div className="flex flex-col items-center justify-center bg-[#0A3D91] px-1.5 py-[3px] text-white">
                  <span className="text-[7px] font-bold leading-none tracking-wide">
                    BRASIL
                  </span>
                </div>
                <div className="bg-white px-2 py-1 font-mono text-[13px] font-bold tracking-[0.14em] text-primary">
                  {active.placa}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  active.status === "Descarregando"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active.status === "Descarregando"
                      ? "bg-sky-500"
                      : "bg-emerald-500"
                  }`}
                />
                {active.status}
              </span>
            </div>
          </div>

          <p className="mt-3 text-[15px] font-semibold tracking-tight text-primary">
            {active.label}
          </p>

          <div className="mt-3 flex items-center gap-5">
            <div className="flex items-center gap-2">
              <p className="text-[28px] font-bold leading-none tracking-tight text-primary">
                {active.speed}
                <span className="ml-1 text-[12px] font-semibold text-text-secondary">
                  km/h
                </span>
              </p>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-rose-500 text-[11px] font-bold text-rose-600">
                {active.limit}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative h-11 w-11">
                <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="14.5"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14.5"
                    fill="none"
                    stroke={TOKENS.accent}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(6, hourFrac * 91)} 91`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-primary">
                  {active.hours}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-text-secondary">
                de{" "}
                <span className="font-semibold text-text-primary">
                  {active.maxHours}
                </span>{" "}
                máx.
              </p>
            </div>
          </div>

          <div className="mt-3.5">
            <div className="mb-1.5 flex justify-between text-[11px] text-text-secondary">
              <span>
                {active.atDestination
                  ? "No destino · descarga"
                  : `${journeyPct}% do trajeto`}
              </span>
              <span>{active.eta.replace(/^chegada /, "chegada ")}</span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${Math.min(100, Math.max(4, journeyPct))}%`,
                  background: `linear-gradient(90deg, ${TOKENS.glow}, ${TOKENS.accent} 55%, ${TOKENS.dark})`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ticker inferior — composição da referência */}
      <div className="pointer-events-none absolute inset-x-8 bottom-3 z-10 xl:inset-x-10">
        <div className="border-t border-slate-200/80 pt-2">
          <p className="truncate text-[11px] text-slate-400">
            {clock} {TICKER[tickerIdx]}
          </p>
        </div>
      </div>
    </div>
  );
}

BrazilOpsMap.propTypes = {
  className: PropTypes.string,
};
