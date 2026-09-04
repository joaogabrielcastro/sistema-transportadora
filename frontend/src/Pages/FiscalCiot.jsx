import React, { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { Alert, Card, PageHeader, Tabs } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray, extractApiData } from "../utils/extractApiArray.js";
import {
  useApiMutation,
  useCiotListQuery,
  useFiscalEmpresasQuery,
  useMdfeListQuery,
} from "../hooks";
import CiotForm from "../components/fiscal/CiotForm.jsx";
import CiotList from "../components/fiscal/CiotList.jsx";
import FiscalDocDetailModal from "../components/fiscal/FiscalDocDetailModal.jsx";
import CancelarDocModal from "../components/fiscal/CancelarDocModal.jsx";
import FiscalSimulacaoModal from "../components/fiscal/FiscalSimulacaoModal.jsx";

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

export default function FiscalCiot() {
  const { post } = useApiMutation();
  const [tab, setTab] = useState("contrato");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [simulacao, setSimulacao] = useState({
    open: false,
    loading: false,
    resultado: null,
    erro: null,
  });
  const [caminhoes, setCaminhoes] = useState([]);
  const [motoristas, setMotoristas] = useState([]);

  const ciotsQuery = useCiotListQuery();
  const ciots = useMemo(() => ciotsQuery.data || [], [ciotsQuery.data]);
  const empresasQuery = useFiscalEmpresasQuery();
  const empresas = useMemo(
    () => empresasQuery.data || [],
    [empresasQuery.data],
  );
  const mdfesQuery = useMdfeListQuery();
  const mdfes = useMemo(() => mdfesQuery.data || [], [mdfesQuery.data]);

  const [detalhe, setDetalhe] = useState({
    open: false,
    loading: false,
    doc: null,
    erro: null,
  });
  const [cancelar, setCancelar] = useState({ open: false, row: null });
  const [cancelando, setCancelando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

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

  const handleDeclarar = async (payload) => {
    setEnviando(true);
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/ciot/declarar",
        data: payload,
      });
      const doc = extractApiData(res);
      setMsg(
        `Contrato de frete declarado. CIOT: ${
          doc?.codigo_identificacao_operacao ||
          doc?.id_operacao_transporte ||
          "—"
        }`,
      );
      ciotsQuery.refetch();
      setTab("declarados");
    } catch (err) {
      const parsed = await parseApiError(err);
      setDetalhe({
        open: true,
        loading: false,
        doc: null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha na declaração do CIOT",
      });
    } finally {
      setEnviando(false);
    }
  };

  const handleSimular = async (payload) => {
    setSimulando(true);
    setSimulacao({ open: true, loading: true, resultado: null, erro: null });
    setMsg("");
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/ciot/simular",
        data: payload,
      });
      const data = extractApiData(res);
      setSimulacao({
        open: true,
        loading: false,
        resultado: data,
        erro: null,
      });
      setMsg("Simulação concluída — nada foi enviado à ANTT.");
    } catch (err) {
      const parsed = await parseApiError(err);
      setSimulacao({
        open: true,
        loading: false,
        resultado: null,
        erro:
          textoErroProvedor(parsed, err?.response?.data) ||
          "Falha ao simular o CIOT",
      });
    } finally {
      setSimulando(false);
    }
  };

  const handleVerDetalhe = async (row) => {
    setDetalhe({ open: true, loading: true, doc: null, erro: null });
    try {
      const res = await apiFetch({ url: `/fiscal/ciot/${row.id}` });
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
        erro: parsed.message || "Falha ao carregar o CIOT",
      });
    }
  };

  const handleConfirmarCancelamento = async (justificativa) => {
    if (!cancelar.row) return;
    setCancelando(true);
    try {
      await post(`/fiscal/ciot/${cancelar.row.id}/cancelar`, { justificativa });
      setCancelar({ open: false, row: null });
      ciotsQuery.refetch();
    } catch {
      /* toast automático */
    } finally {
      setCancelando(false);
    }
  };

  const handleEncerrar = async (row) => {
    if (
      !window.confirm(
        `Encerrar o CIOT ${
          row.codigo_identificacao_operacao || row.id
        }? A ação é enviada ao provedor.`,
      )
    )
      return;
    setEncerrando(true);
    try {
      await post(`/fiscal/ciot/${row.id}/encerrar`);
      ciotsQuery.refetch();
    } catch {
      /* toast automático */
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "CIOT" },
        ]}
      />
      <PageHeader
        title="CIOT — Contrato de frete"
        subtitle="Declare a operação de transporte na ANTT e acompanhe cancelamento e encerramento."
      />

      {msg && (
        <Alert
          type="success"
          message={msg}
          dismissible
          onClose={() => setMsg("")}
        />
      )}
      {ciotsQuery.isError && (
        <Alert type="error" message="Falha ao carregar a lista de CIOT." />
      )}
      {empresasQuery.isError && (
        <Alert
          type="error"
          message="Falha ao carregar a empresa fiscal. Sem isso a declaração e a simulação ficam incompletas."
        />
      )}

      <Tabs
        tabs={[
          { id: "contrato", label: "Contrato de frete" },
          { id: "declarados", label: `Declarados (${ciots.length})` },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "contrato" && (
        <CiotForm
          empresas={empresas}
          caminhoes={caminhoes}
          motoristas={motoristas}
          mdfes={mdfes}
          submitting={enviando}
          simulating={simulando}
          onSubmit={handleDeclarar}
          onSimular={handleSimular}
        />
      )}

      {tab === "declarados" && (
        <Card className="p-6">
          <CiotList
            items={ciots}
            caminhoes={caminhoes}
            loading={ciotsQuery.isLoading || encerrando}
            onView={handleVerDetalhe}
            onCancel={(row) => setCancelar({ open: true, row })}
            onEncerrar={handleEncerrar}
          />
        </Card>
      )}

      <FiscalDocDetailModal
        isOpen={detalhe.open}
        onClose={() =>
          setDetalhe({ open: false, loading: false, doc: null, erro: null })
        }
        loading={detalhe.loading}
        doc={detalhe.doc}
        erro={detalhe.erro}
        tipo="ciot"
      />

      <CancelarDocModal
        isOpen={cancelar.open}
        onClose={() => setCancelar({ open: false, row: null })}
        onConfirm={handleConfirmarCancelamento}
        loading={cancelando}
        titulo="Cancelar contrato de frete"
        descricao="O cancelamento é enviado ao provedor (prazo de 24h após o início da viagem) e não pode ser desfeito."
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
