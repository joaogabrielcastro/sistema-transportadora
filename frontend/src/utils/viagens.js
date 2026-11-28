/** Apresentação do módulo de viagens (rótulos, durações, datas de formulário). */

export const VIAGEM_STATUS = Object.freeze({
  planejada: { label: "Planejada", tone: "bg-slate-50 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  em_andamento: { label: "Em andamento", tone: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  finalizada: { label: "Finalizada", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  cancelada: { label: "Cancelada", tone: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-400" },
});

export const STATUS_OPTIONS = Object.entries(VIAGEM_STATUS).map(([value, s]) => ({ value, label: s.label }));

export const HISTORICO_LABEL = Object.freeze({
  criada: "Viagem criada",
  iniciada: "Viagem iniciada",
  editada: "Dados alterados",
  encerrada: "Viagem encerrada",
  cancelada: "Viagem cancelada",
  despesa_registrada: "Despesa registrada",
  despesa_editada: "Despesa alterada",
  despesa_excluida: "Despesa excluída",
});

export const CAMPO_LABEL = Object.freeze({
  caminhao: "Caminhão",
  motorista: "Motorista",
  origem: "Origem",
  destino: "Destino",
  saida_em: "Saída",
  chegada_em: "Chegada",
  km_inicial: "Km inicial",
  km_final: "Km final",
  km_percorrido: "Km percorrido",
  duracao_min: "Duração",
  observacoes: "Observações",
  observacoes_encerramento: "Observações do encerramento",
  ocorrencias: "Ocorrências",
  status: "Situação",
  categoria: "Categoria",
  tipo_gasto_id: null,
  descricao: "Descrição",
  valor: "Valor",
  registrado_em: "Data e hora",
  quantidade_combustivel: "Litros",
  km_registro: "Km no lançamento",
  comprovante: "Comprovante",
  comprovante_nome: "Comprovante",
  total_despesas: "Total de despesas",
  custo_por_km: "Custo por km",
});

/** "2 d 4 h", "5 h 20 min", "35 min". */
export function formatDuracao(min) {
  if (min == null || !Number.isFinite(Number(min))) return "—";
  const m = Math.max(0, Math.round(Number(min)));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const r = m % 60;
  if (d > 0) return `${d} d${h ? ` ${h} h` : ""}`;
  if (h > 0) return `${h} h${r ? ` ${r} min` : ""}`;
  return `${r} min`;
}

/** Minutos desde a saída (viagem em andamento). */
export function minutosDesde(iso, now = Date.now()) {
  if (!iso) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
}

export const fmtKm = (n) => (n == null ? "—" : `${Number(n).toLocaleString("pt-BR")} km`);

export const fmtMoney = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtCustoKm = (n) =>
  n == null
    ? "—"
    : `${Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 3 })}/km`;

export function fmtDataHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valor para <input type="datetime-local"> no horário local. */
export function toLocalInput(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (horário local) → ISO com fuso, para a API. */
export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Valor legível de um campo do histórico. */
export function formatHistoricoValor(campo, v) {
  if (v == null || v === "") return "—";
  if (["saida_em", "chegada_em", "registrado_em"].includes(campo)) return fmtDataHora(v);
  if (["km_inicial", "km_final", "km_percorrido", "km_registro"].includes(campo)) return fmtKm(v);
  if (["valor", "total_despesas"].includes(campo)) return fmtMoney(v);
  if (campo === "custo_por_km") return fmtCustoKm(v);
  if (campo === "duracao_min") return formatDuracao(v);
  if (campo === "quantidade_combustivel") return `${Number(v).toLocaleString("pt-BR")} L`;
  if (campo === "status") return VIAGEM_STATUS[v]?.label || String(v);
  return String(v);
}

/** Linhas "campo: de → para" ou "campo: valor" de um registro do histórico. */
export function historicoLinhas(alteracoes) {
  if (!alteracoes || typeof alteracoes !== "object") return [];
  const out = [];
  for (const [campo, v] of Object.entries(alteracoes)) {
    const label = CAMPO_LABEL[campo];
    if (label === null) continue;
    if (v && typeof v === "object" && "de" in v) {
      out.push({ campo, label: label || campo, de: formatHistoricoValor(campo, v.de), para: formatHistoricoValor(campo, v.para) });
    } else if (v != null && v !== "") {
      out.push({ campo, label: label || campo, valor: formatHistoricoValor(campo, v) });
    }
  }
  return out;
}

/** Início do dia, N dias atrás (hoje conta como um dia). */
export function periodoDias(days, now = new Date()) {
  const de = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const ate = new Date(now);
  ate.setSeconds(59, 999);
  return { de: de.toISOString(), ate: ate.toISOString() };
}
