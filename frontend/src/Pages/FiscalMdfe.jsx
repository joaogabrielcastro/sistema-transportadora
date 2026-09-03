import React, { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { Alert, Card, PageHeader, Tabs } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray, extractApiData } from "../utils/extractApiArray.js";
import {
  useApiMutation,
  useCteListQuery,
  useFiscalDocDownload,
  useMdfeListQuery,
} from "../hooks";
import { idsDe } from "../utils/fiscalDownload.js";
import MdfeForm from "../components/fiscal/MdfeForm.jsx";
import MdfeList from "../components/fiscal/MdfeList.jsx";
import FiscalDocDetailModal from "../components/fiscal/FiscalDocDetailModal.jsx";
import FiscalDownloadBar from "../components/fiscal/FiscalDownloadBar.jsx";
import CancelarDocModal from "../components/fiscal/CancelarDocModal.jsx";

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

  const [caminhoes, setCaminhoes] = useState([]);
  const [motoristas, setMotoristas] = useState([]);

  const mdfesQuery = useMdfeListQuery();
  const mdfes = useMemo(() => mdfesQuery.data || [], [mdfesQuery.data]);

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
        data: payload,
      });
      const doc = extractApiData(res);
      setMsg(`MDF-e emitido. Chave: ${doc?.chave_acesso || "—"}`);
      mdfesQuery.refetch();
      ctesQuery.refetch();
      setTab("emitidos");
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
    } finally {
      setEmitindo(false);
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

  const handleEncerrar = async (row) => {
    if (
      !window.confirm(
        `Encerrar o MDF-e ${row.numero || row.id}? A ação é enviada ao provedor.`,
      )
    )
      return;
    setEncerrando(true);
    try {
      await post(`/fiscal/mdfe/${row.id}/encerrar`);
      mdfesQuery.refetch();
    } catch {
      /* toast automático */
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "MDF-e" }]}
      />
      <PageHeader
        title="MDF-e — Manifesto de Documentos Fiscais"
        subtitle="Emita o MDF-e e acompanhe encerramento e cancelamento."
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

      <Tabs
        tabs={[
          { id: "emitir", label: "Emitir" },
          { id: "emitidos", label: `Emitidos (${mdfes.length})` },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "emitir" && (
        <MdfeForm
          caminhoes={caminhoes}
          motoristas={motoristas}
          ctesVinculaveis={ctesVinculaveis}
          submitting={emitindo}
          onSubmit={handleEmitir}
        />
      )}

      {tab === "emitidos" && (
        <Card className="p-6">
          <MdfeList
            items={mdfes}
            caminhoes={caminhoes}
            loading={mdfesQuery.isLoading || encerrando}
            onView={handleVerDetalhe}
            onCancel={(row) => setCancelar({ open: true, row })}
            onEncerrar={handleEncerrar}
            selectedIds={selecionados}
            onToggleRow={toggleSelecionado}
            onToggleAll={toggleTodos}
            onDownload={baixarIndividual}
          />
          {selecionados.size > 0 && <div className="h-16" aria-hidden />}
        </Card>
      )}

      {tab === "emitidos" && (
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
    </PageLayout>
  );
}
