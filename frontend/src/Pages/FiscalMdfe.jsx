import React, { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { Alert, Card, FormField, PageHeader, Tabs } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray, extractApiData } from "../utils/extractApiArray.js";
import {
  useApiMutation,
  useCteListQuery,
  useFiscalDocDownload,
  useFiscalEmpresasQuery,
  useMdfeListQuery,
} from "../hooks";
import { idsDe } from "../utils/fiscalDownload.js";
import { resolverEmpresaFiscalAtiva } from "../utils/fiscalForms.js";
import MdfeForm from "../components/fiscal/MdfeForm.jsx";
import MdfeList from "../components/fiscal/MdfeList.jsx";
import FiscalDocDetailModal from "../components/fiscal/FiscalDocDetailModal.jsx";
import FiscalDownloadBar from "../components/fiscal/FiscalDownloadBar.jsx";
import CancelarDocModal from "../components/fiscal/CancelarDocModal.jsx";
import EncerrarMdfeModal from "../components/fiscal/EncerrarMdfeModal.jsx";
import FiscalSimulacaoModal from "../components/fiscal/FiscalSimulacaoModal.jsx";

/** Junta o texto cru do provedor/back para exibir sem resumir. */
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

export default function FiscalMdfe() {
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
  const [motoristas, setMotoristas] = useState([]);

  const mdfesQuery = useMdfeListQuery({ status: filtroStatus || undefined });
  const mdfes = useMemo(() => mdfesQuery.data || [], [mdfesQuery.data]);
  const empresasQuery = useFiscalEmpresasQuery();
  const empresaFiscal = useMemo(
    () => resolverEmpresaFiscalAtiva(empresasQuery.data),
    [empresasQuery.data],
  );

  // CT-e emitidos e ainda não vinculados a um MDF-e — candidatos a "Documentos vinculados".
  const ctesQuery = useCteListQuery({ status: "processado" });
  const ctesVinculaveis = useMemo(
    () =>
      (ctesQuery.data || []).filter(
        (c) => c.status === "processado" && c.manifesto_id == null,
      ),
    [ctesQuery.data],
  );

  const [detalhe, setDetalhe] = useState({
    open: false,
    loading: false,
    doc: null,
    erro: null,
  });
  const [cancelar, setCancelar] = useState({ open: false, row: null });
  const [cancelando, setCancelando] = useState(false);
  const [encerrar, setEncerrar] = useState({ open: false, row: null });
  const [encerrando, setEncerrando] = useState(false);

  // Seleção para download em lote (zip). A lista não é paginada no servidor,
  // então "selecionar todos" cobre todos os MDF-e do filtro atual.
  const [selecionados, setSelecionados] = useState(() => new Set());
  const { baixarIndividual, baixarLote, baixando } = useFiscalDocDownload("mdfe");

  useEffect(() => {
    setSelecionados((prev) => {
      if (prev.size === 0) return prev;
      const atuais = new Set(idsDe(mdfes));
      const next = new Set([...prev].filter((id) => atuais.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [mdfes]);

  const toggleSelecionado = (id) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleTodos = () =>
    setSelecionados((prev) => {
      const todos = idsDe(mdfes);
      const marcadosTodos =
        todos.length > 0 && todos.every((id) => prev.has(id));
      return marcadosTodos ? new Set() : new Set(todos);
    });

  useEffect(() => {
    let ativo = true;
    Promise.all([
      apiFetch({ url: "/caminhoes", params: { page: 1, limit: 500 } }),
      apiFetch({ url: "/motoristas" }),
    ])
      .then(([cRes, mRes]) => {
        if (!ativo) return;
        setCaminhoes(extractApiArray(cRes));
        setMotoristas(extractApiArray(mRes));
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
        url: "/fiscal/mdfe/emitir",
        data: draftId ? { id: draftId, ...payload } : payload,
      });
      const doc = extractApiData(res);
      setMsg(
        doc?.status === "processado"
          ? `MDF-e autorizado. Chave: ${doc?.chave_acesso || "—"}`
          : `MDF-e enviado. Status: ${doc?.status || "—"}`,
      );
      setDraftId(null);
      setDraftPayload(null);
      mdfesQuery.refetch();
      ctesQuery.refetch();
      setTab("documentos");
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha na emissão do MDF-e",
      });
      mdfesQuery.refetch();
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
        url: draftId ? `/fiscal/mdfe/${draftId}` : "/fiscal/mdfe",
        data: payload,
      });
      const doc = extractApiData(res);
      setDraftId(doc?.id || draftId);
      setDraftPayload(doc?.payload_json || payload);
      setMsg("Rascunho de MDF-e salvo.");
      mdfesQuery.refetch();
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
        url: "/fiscal/mdfe/simular",
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
      mdfesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setSimulacao({
        open: true,
        loading: false,
        resultado: null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha ao simular o MDF-e",
      });
    } finally {
      setSimulando(false);
    }
  };

  const handleVerDetalhe = async (row) => {
    setDetalhe({ open: true, loading: true, doc: null, erro: null });
    try {
      const res = await apiFetch({ url: `/fiscal/mdfe/${row.id}` });
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
        erro: parsed.message || "Falha ao carregar o MDF-e",
      });
    }
  };

  const handleConfirmarCancelamento = async (justificativa) => {
    if (!cancelar.row) return;
    setCancelando(true);
    try {
      await post(`/fiscal/mdfe/${cancelar.row.id}/cancelar`, { justificativa });
      setCancelar({ open: false, row: null });
      mdfesQuery.refetch();
    } catch {
      /* toast automático */
    } finally {
      setCancelando(false);
    }
  };

  const handleEncerrar = (row) => setEncerrar({ open: true, row });

  const handleConfirmarEncerramento = async (body) => {
    if (!encerrar.row) return;
    setEncerrando(true);
    try {
      await post(`/fiscal/mdfe/${encerrar.row.id}/encerrar`, body);
      setEncerrar({ open: false, row: null });
      mdfesQuery.refetch();
    } catch {
      /* toast automático */
    } finally {
      setEncerrando(false);
    }
  };

  const handleEmitirRascunho = async (row) => {
    setEmitindo(true);
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: `/fiscal/mdfe/${row.id}/emitir`,
      });
      const doc = extractApiData(res);
      setMsg(
        doc?.status === "processado"
          ? `MDF-e autorizado. Chave: ${doc?.chave_acesso || "—"}`
          : `MDF-e enviado. Status: ${doc?.status || "—"}`,
      );
      mdfesQuery.refetch();
      ctesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha na emissão do MDF-e",
      });
      mdfesQuery.refetch();
    } finally {
      setEmitindo(false);
    }
  };

  const handleConsultar = async (row) => {
    setDetalhe({ open: true, loading: true, doc: null, erro: null });
    try {
      const res = await apiFetch({ url: `/fiscal/mdfe/${row.id}/status` });
      setDetalhe({
        open: true,
        loading: false,
        doc: extractApiData(res),
        erro: null,
      });
      mdfesQuery.refetch();
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: row,
        erro: parsed.message || "Falha ao consultar o MDF-e",
      });
    }
  };

  const handleEditarRascunho = async (row) => {
    try {
      const res = await apiFetch({ url: `/fiscal/mdfe/${row.id}` });
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
    if (!window.confirm(`Excluir o rascunho de MDF-e #${row.id}?`)) return;
    try {
      await apiFetch({ method: "DELETE", url: `/fiscal/mdfe/${row.id}` });
      if (draftId === row.id) {
        setDraftId(null);
        setDraftPayload(null);
      }
      mdfesQuery.refetch();
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
        items={[{ label: "Início", to: "/" }, { label: "MDF-e" }]}
      />
      <PageHeader
        title="MDF-e — Manifesto de Documentos Fiscais"
        subtitle="Rascunho, emissão via Brasil NFe, consulta, cancelamento e encerramento."
      />

      {msg && (
        <Alert
          type="success"
          message={msg}
          dismissible
          onClose={() => setMsg("")}
        />
      )}
      {mdfesQuery.isError && (
        <Alert type="error" message="Falha ao carregar a lista de MDF-e." />
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
          { id: "documentos", label: `Documentos (${mdfes.length})` },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "emitir" && (
        <MdfeForm
          key={draftId || "novo"}
          caminhoes={caminhoes}
          motoristas={motoristas}
          ctesVinculaveis={ctesVinculaveis}
          submitting={emitindo}
          savingDraft={savingDraft}
          simulating={simulando}
          onSubmit={handleEmitir}
          onSaveDraft={handleSaveDraft}
          onSimular={handleSimular}
          initialPayload={draftPayload}
          empresaFiscal={empresaFiscal}
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
              { value: "encerrado", label: "Encerrado" },
              { value: "erro", label: "Erro" },
            ]}
            className="mb-0 max-w-xs"
          />
          <MdfeList
            items={mdfes}
            caminhoes={caminhoes}
            loading={mdfesQuery.isLoading || encerrando || emitindo}
            onView={handleVerDetalhe}
            onCancel={(row) => setCancelar({ open: true, row })}
            onEncerrar={handleEncerrar}
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

      <FiscalDocDetailModal
        isOpen={detalhe.open}
        onClose={() =>
          setDetalhe({ open: false, loading: false, doc: null, erro: null })
        }
        loading={detalhe.loading}
        doc={detalhe.doc}
        erro={detalhe.erro}
        tipo="mdfe"
      />

      <CancelarDocModal
        isOpen={cancelar.open}
        onClose={() => setCancelar({ open: false, row: null })}
        onConfirm={handleConfirmarCancelamento}
        loading={cancelando}
        titulo="Cancelar MDF-e"
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

      <EncerrarMdfeModal
        isOpen={encerrar.open}
        onClose={() => setEncerrar({ open: false, row: null })}
        onConfirm={handleConfirmarEncerramento}
        loading={encerrando}
      />
    </PageLayout>
  );
}
