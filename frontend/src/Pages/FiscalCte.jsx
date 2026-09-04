import React, { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { Alert, Card, FormField, PageHeader, Tabs } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray, extractApiData } from "../utils/extractApiArray.js";
import {
  useApiMutation,
  useCteListQuery,
  useFiscalClientesQuery,
  useFiscalDocDownload,
  useFiscalEmpresasQuery,
} from "../hooks";
import { resolverEmpresaFiscalAtiva } from "../utils/fiscalForms.js";
import { idsDe } from "../utils/fiscalDownload.js";
import CteForm from "../components/fiscal/CteForm.jsx";
import CteList from "../components/fiscal/CteList.jsx";
import CteReferenciaModal from "../components/fiscal/CteReferenciaModal.jsx";
import FiscalDocDetailModal from "../components/fiscal/FiscalDocDetailModal.jsx";
import FiscalDownloadBar from "../components/fiscal/FiscalDownloadBar.jsx";
import CancelarDocModal from "../components/fiscal/CancelarDocModal.jsx";
import FiscalSimulacaoModal from "../components/fiscal/FiscalSimulacaoModal.jsx";

/** Extrai o texto cru devolvido pelo provedor/back para não escondê-lo do usuário. */
function textoErroProvedor(parsed, raw) {
  const partes = [];
  if (parsed?.message) partes.push(parsed.message);
  const detalhes = raw?.details;
  if (Array.isArray(detalhes)) partes.push(...detalhes.map(String));
  else if (detalhes && typeof detalhes === "object")
    partes.push(JSON.stringify(detalhes, null, 2));
  if (parsed?.fieldErrors)
    partes.push(
      ...Object.entries(parsed.fieldErrors).map(([k, v]) => `${k}: ${v}`),
    );
  return partes.join("\n");
}

export default function FiscalCte() {
  const { post } = useApiMutation();
  const [tab, setTab] = useState("emitir");
  const [msg, setMsg] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [simulacao, setSimulacao] = useState({
    open: false,
    loading: false,
    resultado: null,
    erro: null,
  });
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [draftPayload, setDraftPayload] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("");

  const [caminhoes, setCaminhoes] = useState([]);

  const clientesQuery = useFiscalClientesQuery();
  const ctesQuery = useCteListQuery({ status: filtroStatus || undefined });
  const empresasQuery = useFiscalEmpresasQuery();
  const clientes = useMemo(
    () => clientesQuery.data || [],
    [clientesQuery.data],
  );
  const ctes = useMemo(() => ctesQuery.data || [], [ctesQuery.data]);
  // Empresa fiscal emissora ativa — só leitura, para o CteForm ler o CRT.
  const empresaFiscal = useMemo(
    () => resolverEmpresaFiscalAtiva(empresasQuery.data),
    [empresasQuery.data],
  );

  const [detalhe, setDetalhe] = useState({
    open: false,
    loading: false,
    doc: null,
    erro: null,
  });
  const [cancelar, setCancelar] = useState({ open: false, row: null });
  const [cancelando, setCancelando] = useState(false);
  const [refModal, setRefModal] = useState({
    open: false,
    modo: "complemento",
    cte: null,
  });
  const [refSubmitting, setRefSubmitting] = useState(false);

  // Seleção para download em lote (zip). Como a lista não é paginada no servidor,
  // "selecionar todos" abrange todos os CT-e retornados pela consulta — ou seja,
  // todos os resultados do filtro atual, não só uma página.
  const [selecionados, setSelecionados] = useState(() => new Set());
  const { baixarIndividual, baixarLote, baixando } = useFiscalDocDownload("cte");

  useEffect(() => {
    setSelecionados((prev) => {
      if (prev.size === 0) return prev;
      const atuais = new Set(idsDe(ctes));
      const next = new Set([...prev].filter((id) => atuais.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [ctes]);

  const toggleSelecionado = (id) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleTodos = () =>
    setSelecionados((prev) => {
      const todos = idsDe(ctes);
      const marcadosTodos =
        todos.length > 0 && todos.every((id) => prev.has(id));
      return marcadosTodos ? new Set() : new Set(todos);
    });

  useEffect(() => {
    let ativo = true;
    apiFetch({ url: "/caminhoes", params: { page: 1, limit: 500 } })
      .then((res) => {
        if (ativo) setCaminhoes(extractApiArray(res));
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  const handleEmitir = async (payload) => {
    setEmitindo(true);
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/cte/emitir",
        data: draftId ? { id: draftId, ...payload } : payload,
      });
      const doc = extractApiData(res);
      setMsg(
        doc?.status === "processado"
          ? `CT-e autorizado. Chave: ${doc?.chave_acesso || "—"}`
          : `CT-e enviado. Status: ${doc?.status || "—"}`,
      );
      setDraftId(null);
      setDraftPayload(null);
      ctesQuery.refetch();
      setTab("documentos");
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: err?.response?.data?.details ? { sefaz_detalhes: err.response.data.details } : null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha na emissão do CT-e",
      });
      ctesQuery.refetch();
    } finally {
      setEmitindo(false);
    }
  };

  const handleSaveDraft = async (payload) => {
    setSavingDraft(true);
    setMsg("");
    try {
      const res = await apiFetch({
        method: draftId ? "PUT" : "POST",
        url: draftId ? `/fiscal/cte/${draftId}` : "/fiscal/cte",
        data: payload,
      });
      const doc = extractApiData(res);
      setDraftId(doc?.id || draftId);
      setDraftPayload(doc?.payload_json || payload);
      setMsg("Rascunho de CT-e salvo.");
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: null,
        erro: parsed.message || "Falha ao salvar o rascunho",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSimular = async (payload) => {
    setSimulando(true);
    setSimulacao({ open: true, loading: true, resultado: null, erro: null });
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/cte/simular",
        data: draftId ? { id: draftId, ...payload } : payload,
      });
      const data = extractApiData(res);
      if (data?.documento?.id) {
        setDraftId(data.documento.id);
        setDraftPayload(data.documento.payload_json || payload);
      }
      setSimulacao({
        open: true,
        loading: false,
        resultado: data,
        erro: null,
      });
      setMsg("Simulação concluída — nada foi enviado à SEFAZ.");
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setSimulacao({
        open: true,
        loading: false,
        resultado: null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha ao simular o CT-e",
      });
    } finally {
      setSimulando(false);
    }
  };

  const handleEmitirReferencia = async (payload) => {
    setRefSubmitting(true);
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/cte/emitir",
        data: payload,
      });
      const doc = extractApiData(res);
      const rotulo = payload.tipo_cte === "1" ? "Complemento" : "Substituto";
      setMsg(`CT-e (${rotulo}) emitido. Chave: ${doc?.chave_acesso || "—"}`);
      setRefModal({ open: false, modo: "complemento", cte: null });
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha na emissão do CT-e referenciado",
      });
    } finally {
      setRefSubmitting(false);
    }
  };

  const handleVerDetalhe = async (row) => {
    setDetalhe({ open: true, loading: true, doc: null, erro: null });
    try {
      const res = await apiFetch({ url: `/fiscal/cte/${row.id}` });
      setDetalhe({
        open: true,
        loading: false,
        doc: extractApiData(res),
        erro: null,
      });
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro: parsed.message || "Falha ao carregar o CT-e",
      });
    }
  };

  const handleConfirmarCancelamento = async (justificativa) => {
    if (!cancelar.row) return;
    setCancelando(true);
    try {
      await post(`/fiscal/cte/${cancelar.row.id}/cancelar`, { justificativa });
      setCancelar({ open: false, row: null });
      ctesQuery.refetch();
    } catch {
      /* toast automático do useApiMutation */
    } finally {
      setCancelando(false);
    }
  };

  const handleEmitirRascunho = async (row) => {
    setEmitindo(true);
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: `/fiscal/cte/${row.id}/emitir`,
      });
      const doc = extractApiData(res);
      setMsg(
        doc?.status === "processado"
          ? `CT-e autorizado. Chave: ${doc?.chave_acesso || "—"}`
          : `CT-e enviado. Status: ${doc?.status || "—"}`,
      );
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha na emissão do CT-e",
      });
      ctesQuery.refetch();
    } finally {
      setEmitindo(false);
    }
  };

  const handleConsultar = async (row) => {
    setDetalhe({ open: true, loading: true, doc: null, erro: null });
    try {
      const res = await apiFetch({ url: `/fiscal/cte/${row.id}/status` });
      setDetalhe({
        open: true,
        loading: false,
        doc: extractApiData(res),
        erro: null,
      });
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro: parsed.message || "Falha ao consultar o CT-e",
      });
    }
  };

  const handleEditarRascunho = async (row) => {
    try {
      const res = await apiFetch({ url: `/fiscal/cte/${row.id}` });
      const doc = extractApiData(res);
      setDraftId(doc.id);
      setDraftPayload(doc.payload_json || null);
      setTab("emitir");
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro: parsed.message || "Falha ao abrir o rascunho",
      });
    }
  };

  const handleExcluirRascunho = async (row) => {
    if (!window.confirm(`Excluir o rascunho de CT-e #${row.id}?`)) return;
    try {
      await apiFetch({ method: "DELETE", url: `/fiscal/cte/${row.id}` });
      if (draftId === row.id) {
        setDraftId(null);
        setDraftPayload(null);
      }
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro: parsed.message || "Falha ao excluir o rascunho",
      });
    }
  };

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "CT-e" }]}
      />
      <PageHeader
        title="CT-e — Conhecimento de Transporte"
        subtitle="Rascunho, emissão via Brasil NFe (homologação/produção) e consulta à SEFAZ."
      />

      {msg && (
        <Alert
          type="success"
          message={msg}
          dismissible
          onClose={() => setMsg("")}
        />
      )}
      {ctesQuery.isError && (
        <Alert type="error" message="Falha ao carregar a lista de CT-e." />
      )}
      {empresasQuery.isError && (
        <Alert
          type="error"
          message="Falha ao carregar a empresa fiscal. Sem isso a emissão e a simulação ficam incompletas."
        />
      )}

      <Tabs
        tabs={[
          { id: "emitir", label: draftId ? `Rascunho #${draftId}` : "Emitir" },
          { id: "documentos", label: `Documentos (${ctes.length})` },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "emitir" && (
        <CteForm
          key={draftId || "novo"}
          clientes={clientes}
          caminhoes={caminhoes}
          submitting={emitindo}
          savingDraft={savingDraft}
          simulating={simulando}
          onSubmit={handleEmitir}
          onSaveDraft={handleSaveDraft}
          onSimular={handleSimular}
          initialPayload={draftPayload}
          empresaFiscal={empresaFiscal}
          empresaFiscalCarregada={empresasQuery.isSuccess}
        />
      )}

      {tab === "documentos" && (
        <Card className="p-6 space-y-4">
          <FormField
            label="Filtrar por status"
            type="select"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            options={[
              { value: "", label: "Todos" },
              { value: "rascunho", label: "Rascunho" },
              { value: "processando", label: "Processando" },
              { value: "processado", label: "Autorizado" },
              { value: "rejeitado", label: "Rejeitado" },
              { value: "cancelado", label: "Cancelado" },
              { value: "erro", label: "Erro" },
            ]}
            className="mb-0 max-w-xs"
          />
          <CteList
            items={ctes}
            clientes={clientes}
            loading={ctesQuery.isLoading || emitindo}
            onView={handleVerDetalhe}
            onCancel={(row) => setCancelar({ open: true, row })}
            onComplemento={(row) =>
              setRefModal({ open: true, modo: "complemento", cte: row })
            }
            onSubstituir={(row) =>
              setRefModal({ open: true, modo: "substituto", cte: row })
            }
            onEmit={handleEmitirRascunho}
            onConsult={handleConsultar}
            onEditDraft={handleEditarRascunho}
            onDeleteDraft={handleExcluirRascunho}
            selectedIds={selecionados}
            onToggleRow={toggleSelecionado}
            onToggleAll={toggleTodos}
            onDownload={baixarIndividual}
          />
          {selecionados.size > 0 && <div className="h-16" aria-hidden />}
        </Card>
      )}

      {tab === "documentos" && (
        <FiscalDownloadBar
          quantidade={selecionados.size}
          baixando={baixando}
          onBaixar={() => baixarLote([...selecionados])}
          onLimpar={() => setSelecionados(new Set())}
        />
      )}

      <CteReferenciaModal
        isOpen={refModal.open}
        onClose={() =>
          setRefModal({ open: false, modo: "complemento", cte: null })
        }
        modo={refModal.modo}
        cte={refModal.cte}
        clientes={clientes}
        submitting={refSubmitting}
        onSubmit={handleEmitirReferencia}
      />

      <FiscalDocDetailModal
        isOpen={detalhe.open}
        onClose={() =>
          setDetalhe({ open: false, loading: false, doc: null, erro: null })
        }
        loading={detalhe.loading}
        doc={detalhe.doc}
        erro={detalhe.erro}
        tipo="cte"
      />

      <CancelarDocModal
        isOpen={cancelar.open}
        onClose={() => setCancelar({ open: false, row: null })}
        onConfirm={handleConfirmarCancelamento}
        loading={cancelando}
        titulo="Cancelar CT-e"
        descricao="O cancelamento é enviado ao provedor e não pode ser desfeito."
      />

      <FiscalSimulacaoModal
        isOpen={simulacao.open}
        onClose={() =>
          setSimulacao({
            open: false,
            loading: false,
            resultado: null,
            erro: null,
          })
        }
        loading={simulacao.loading}
        resultado={simulacao.resultado}
        erro={simulacao.erro}
      />
    </PageLayout>
  );
}
