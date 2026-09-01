import React, { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { Alert, Card, PageHeader, Tabs } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray, extractApiData } from "../utils/extractApiArray.js";
import {
  useApiMutation,
  useCteListQuery,
  useFiscalClientesQuery,
} from "../hooks";
import CteForm from "../components/fiscal/CteForm.jsx";
import CteList from "../components/fiscal/CteList.jsx";
import CteReferenciaModal from "../components/fiscal/CteReferenciaModal.jsx";
import FiscalDocDetailModal from "../components/fiscal/FiscalDocDetailModal.jsx";
import CancelarDocModal from "../components/fiscal/CancelarDocModal.jsx";

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

  const [caminhoes, setCaminhoes] = useState([]);

  const clientesQuery = useFiscalClientesQuery();
  const ctesQuery = useCteListQuery();
  const clientes = useMemo(
    () => clientesQuery.data || [],
    [clientesQuery.data],
  );
  const ctes = useMemo(() => ctesQuery.data || [], [ctesQuery.data]);

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
        data: payload,
      });
      const doc = extractApiData(res);
      setMsg(`CT-e emitido. Chave: ${doc?.chave_acesso || "—"}`);
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
          "Falha na emissão do CT-e",
      });
    } finally {
      setEmitindo(false);
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

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "CT-e" }]}
      />
      <PageHeader
        title="CT-e — Conhecimento de Transporte"
        subtitle="Emita o CT-e e acompanhe os documentos já enviados ao provedor."
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

      <Tabs
        tabs={[
          { id: "emitir", label: "Emitir" },
          { id: "emitidos", label: `Emitidos (${ctes.length})` },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "emitir" && (
        <CteForm
          clientes={clientes}
          caminhoes={caminhoes}
          submitting={emitindo}
          onSubmit={handleEmitir}
        />
      )}

      {tab === "emitidos" && (
        <Card className="p-6">
          <CteList
            items={ctes}
            clientes={clientes}
            loading={ctesQuery.isLoading}
            onView={handleVerDetalhe}
            onCancel={(row) => setCancelar({ open: true, row })}
            onComplemento={(row) =>
              setRefModal({ open: true, modo: "complemento", cte: row })
            }
            onSubstituir={(row) =>
              setRefModal({ open: true, modo: "substituto", cte: row })
            }
          />
        </Card>
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
    </PageLayout>
  );
}
