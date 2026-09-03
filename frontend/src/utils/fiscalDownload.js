/**
 * Helpers puros do download de CT-e/MDF-e (individual + lote). Sem I/O — a parte
 * de rede/`saveAs` fica em `hooks/useFiscalDocDownload.js`. SÓ ADICIONA
 * comportamento: nenhuma rota/consulta existente muda.
 */

/** Teto de documentos por chamada de download em lote (espelha o backend). */
export const LIMITE_DOWNLOAD_LOTE = 300;

const norm = (tipo) => (tipo === "mdfe" ? "mdfe" : "cte");
const ext = (formato) => (formato === "pdf" ? "pdf" : "xml");

/** Nome sugerido do arquivo individual: `<chave>.<ext>`, com fallback. */
export function nomeArquivoDoc(chave, formato) {
  const limpa = String(chave || "").replace(/[^0-9A-Za-z_-]/g, "");
  return `${limpa || "documento"}.${ext(formato)}`;
}

/** Nome do zip do lote: `<tipo>-lote-AAAA-MM-DD.zip`. */
export function nomeArquivoLote(tipo, hoje = new Date()) {
  const dia =
    hoje instanceof Date && !Number.isNaN(hoje.getTime())
      ? hoje.toISOString().slice(0, 10)
      : "";
  return `${norm(tipo)}-lote-${dia}.zip`;
}

/** Caminho do endpoint de download individual. */
export function urlDownloadDoc(tipo, id, formato) {
  return `/fiscal/${norm(tipo)}/${id}/${ext(formato)}`;
}

/** Caminho do endpoint de download em lote. */
export function urlDownloadLote(tipo) {
  return `/fiscal/${norm(tipo)}/download-lote`;
}

/** Ids únicos e válidos (inteiros positivos) de uma lista de linhas. */
export function idsDe(items) {
  const vistos = new Set();
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const n = Number(it?.id);
    if (!Number.isInteger(n) || n <= 0 || vistos.has(n)) continue;
    vistos.add(n);
    out.push(n);
  }
  return out;
}

/** true quando o formato pedido tem arquivo disponível na linha. */
export function arquivoDisponivel(row, formato) {
  return Boolean(formato === "pdf" ? row?.pdf_path : row?.xml_path);
}

/** Rótulo do contador da barra de ação. */
export function rotuloSelecao(qtd) {
  const n = Number(qtd) || 0;
  return `${n} ${n === 1 ? "selecionado" : "selecionados"}`;
}

/**
 * Estado do checkbox "selecionar todos": `none` | `some` | `all`.
 * `some` liga o indeterminate do checkbox do cabeçalho.
 */
export function estadoSelecaoTotal(totalSelecionavel, qtdSelecionada) {
  const total = Number(totalSelecionavel) || 0;
  const sel = Number(qtdSelecionada) || 0;
  if (total <= 0 || sel <= 0) return "none";
  if (sel >= total) return "all";
  return "some";
}
