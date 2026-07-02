import React, { useCallback, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import {
  useApi,
  useApiMutation,
  useCaminhoesListQuery,
  useOrdemColetaHistoricoQuery,
} from "../hooks";
import { extractApiData } from "../utils/extractApiArray.js";
import Pagination from "../components/Pagination.jsx";
import { Card, Button, Alert, FormField } from "../components/ui";
import { useToast } from "../components/ui/useToast.js";
import {
  buildEmptyDadosVariaveis,
  camposFormularioPorTipo,
} from "../utils/ordemColetaFields.js";

/** `CANOINHAS` mantém o id na API/BD por compatibilidade; na interface é “autorização compacta”, um exemplo de layout, não a regra para todos. */
const tipos = [
  { id: "PADRAO", label: "Ordem de coleta" },
  {
    id: "CANOINHAS",
    label: "Autorização compacta",
    hint: "Modelo baseado num formulário enviado por um cliente (ex.: Canoinhas). Ajuste o HTML em backend/src/templates/html para outros tomadores.",
  },
];

const labelTipoHistorico = (tipoApi) => {
  if (tipoApi === "CANOINHAS") return "Autorização compacta";
  if (tipoApi === "PADRAO") return "Ordem de coleta";
  return tipoApi || "—";
};

const OrdensColeta = () => {
  const { get, request } = useApi();
  const { post } = useApiMutation();
  const toast = useToast();

  const {
    data: caminhoesPage,
    isLoading: loadingCaminhoes,
    error: erroCaminhoes,
  } = useCaminhoesListQuery({ page: 1, limit: 200 });

  const caminhoes = useMemo(
    () => caminhoesPage?.data ?? [],
    [caminhoesPage?.data],
  );

  const [tipo, setTipo] = useState("PADRAO");
  const [placa, setPlaca] = useState("");
  const [dadosVariaveis, setDadosVariaveis] = useState(buildEmptyDadosVariaveis);
  const [emailDestinatario, setEmailDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [historicoPage, setHistoricoPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [localError, setLocalError] = useState("");

  const {
    data: historicoData,
    refetch: refetchHistorico,
  } = useOrdemColetaHistoricoQuery(historicoPage);

  const historico = historicoData?.rows ?? [];
  const pagination = historicoData?.pagination ?? null;

  const camposFormulario = useMemo(
    () => camposFormularioPorTipo(tipo),
    [tipo],
  );

  const hintTipoSelecionado = useMemo(
    () => tipos.find((t) => t.id === tipo)?.hint,
    [tipo],
  );

  const buildPayload = useCallback(() => {
    const dv = {};
    camposFormulario.forEach((c) => {
      dv[c.key] = dadosVariaveis[c.key] ?? "";
    });
    return {
      tipo,
      placa: placa || null,
      dadosVariaveis: dv,
    };
  }, [tipo, placa, dadosVariaveis, camposFormulario]);

  const handleCampoChange = (key, value) => {
    setDadosVariaveis((prev) => ({ ...prev, [key]: value }));
  };

  const handlePreview = async () => {
    setLocalError("");
    setActionLoading("preview");
    try {
      const res = await request({
        method: "POST",
        url: "/ordem-coleta/preview",
        data: buildPayload(),
        skipSuccessToast: true,
        skipErrorToast: true,
      });
      setPreviewHtml(res?.data?.html || "");
    } catch (e) {
      setLocalError(e.message || "Não foi possível gerar a pré-visualização.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePdf = async () => {
    setLocalError("");
    setActionLoading("pdf");
    try {
      const res = await request({
        method: "POST",
        url: "/ordem-coleta/pdf",
        data: buildPayload(),
        responseType: "blob",
        skipSuccessToast: true,
        skipErrorToast: true,
        timeout: 120_000,
      });
      const blob = res?.data;
      if (!(blob instanceof Blob)) {
        throw new Error("Resposta inválida do servidor.");
      }
      const prefix =
        tipo === "CANOINHAS" ? "autorizacao_coleta_compacta" : "ordem_coleta";
      saveAs(blob, `${prefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      setLocalError(e.message || "Falha ao gerar o PDF.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnviar = async () => {
    setLocalError("");
    if (!emailDestinatario.trim()) {
      setLocalError("Informe o e-mail do destinatário.");
      return;
    }
    setActionLoading("enviar");
    try {
      const res = await post(
        "/ordem-coleta/enviar",
        {
          ...buildPayload(),
          emailDestinatario: emailDestinatario.trim(),
          assunto: assunto.trim() || undefined,
        },
        { timeout: 30_000, skipSuccessToast: true },
      );

      const jobId = extractApiData(res)?.id;
      if (!jobId) {
        throw new Error("Resposta inválida ao enfileirar o envio.");
      }

      toast.info(
        "Gerando PDF e enviando e-mail em segundo plano. Aguarde alguns instantes…",
      );

      const maxAttempts = 90;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusRes = await get(`/ordem-coleta/envio/${jobId}`, {
          skipLoading: true,
          skipSuccessToast: true,
        });
        const status = extractApiData(statusRes);

        if (status?.status === "sent") {
          toast.success("E-mail enviado com sucesso.");
          setHistoricoPage(1);
          await refetchHistorico();
          return;
        }

        if (status?.status === "failed") {
          throw new Error(
            status.error ||
              "Falha ao enviar o e-mail. Verifique SMTP no servidor.",
          );
        }
      }

      throw new Error(
        "O envio ainda está em processamento. Confira o histórico em alguns minutos.",
      );
    } catch (e) {
      setLocalError(e.message || "Falha ao enviar o e-mail.");
      if (!e?.response) {
        toast.error(e.message || "Falha ao enviar o e-mail.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const opcoesCaminhao = useMemo(
    () =>
      caminhoes.map((c) => ({
        value: c.placa,
        label: `${c.placa}${c.motorista ? ` — ${c.motorista}` : ""}`,
      })),
    [caminhoes],
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Ordens de coleta e autorizações
          </h1>
        </div>

        {localError && (
          <Alert
            type="error"
            message={localError}
            onClose={() => setLocalError("")}
          />
        )}

        <Card>
          <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-4">
            {tipos.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tipo === t.id
                    ? "bg-secondary text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {hintTipoSelecionado && (
            <p className="text-sm text-text-secondary mb-4 -mt-2">
              {hintTipoSelecionado}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Caminhão (opcional)
              </label>
              <select
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                disabled={loadingCaminhoes}
                className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-gray-50 disabled:text-text-light"
              >
                <option value="">
                  Não vincular — preencher frota manualmente nos campos
                </option>
                {opcoesCaminhao.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-light">
                Se escolher uma placa, motorista e carretas vêm do cadastro de
                caminhões.
                {loadingCaminhoes && " Carregando frota…"}
                {!loadingCaminhoes &&
                  !erroCaminhoes &&
                  caminhoes.length === 0 &&
                  " Nenhum caminhão cadastrado no sistema."}
                {erroCaminhoes && (
                  <span className="text-danger block mt-1">
                    Não foi possível carregar a frota:{" "}
                    {erroCaminhoes.message || String(erroCaminhoes)}
                  </span>
                )}
              </p>
            </div>
            <FormField
              label="E-mail do destinatário"
              type="email"
              name="emailDestinatario"
              value={emailDestinatario}
              onChange={(e) => setEmailDestinatario(e.target.value)}
              placeholder="cliente@exemplo.com"
              helperText="Obrigatório apenas para enviar por e-mail."
            />
            <div className="md:col-span-2">
              <FormField
                label="Assunto do e-mail (opcional)"
                name="assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Deixe em branco para usar o assunto padrão do sistema"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {camposFormulario.map((campo) => (
              <FormField
                key={campo.key}
                name={campo.key}
                label={campo.label}
                type={campo.type || "text"}
                rows={campo.rows}
                value={dadosVariaveis[campo.key] ?? ""}
                onChange={(e) => handleCampoChange(campo.key, e.target.value)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePreview}
              loading={actionLoading === "preview"}
              disabled={Boolean(actionLoading)}
            >
              Pré-visualizar HTML
            </Button>
            <Button
              type="button"
              onClick={handlePdf}
              loading={actionLoading === "pdf"}
              disabled={Boolean(actionLoading)}
            >
              Baixar PDF
            </Button>
            <Button
              type="button"
              onClick={handleEnviar}
              loading={actionLoading === "enviar"}
              disabled={Boolean(actionLoading)}
            >
              Gerar PDF e enviar por e-mail
            </Button>
          </div>
        </Card>

        {previewHtml && (
          <Card title="Pré-visualização">
            <iframe
              title="Pré-visualização ordem de coleta"
              className="w-full min-h-[480px] rounded-lg border border-border bg-white"
              sandbox="allow-same-origin"
              srcDoc={previewHtml}
            />
          </Card>
        )}

        <Card title="Últimos envios registrados">
          {historico.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum registro ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">E-mail</th>
                    <th className="py-2 pr-4">Placa</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.criado_em
                          ? new Date(row.criado_em).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">{labelTipoHistorico(row.tipo)}</td>
                      <td className="py-2 pr-4">{row.email_destinatario}</td>
                      <td className="py-2 pr-4">{row.caminhao_placa || "—"}</td>
                      <td className="py-2 pr-4">
                        {row.status === "sent" || row.enviado_em ? (
                          <span className="text-green-700">Enviado</span>
                        ) : row.status === "failed" || row.erro_envio ? (
                          <span
                            className="text-red-600"
                            title={row.erro_envio || ""}
                          >
                            Falha
                          </span>
                        ) : (
                          <span className="text-amber-700">Processando…</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pagination && (
                <>
                  <p className="mt-3 text-xs text-text-light">
                    Total: {pagination.totalItems} registro(s).
                  </p>
                  <Pagination
                    currentPage={pagination.currentPage || historicoPage}
                    totalPages={pagination.totalPages || 1}
                    onPageChange={(page) => setHistoricoPage(page)}
                  />
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default OrdensColeta;
