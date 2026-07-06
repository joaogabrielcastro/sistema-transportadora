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
import {
  Card,
  Button,
  Alert,
  FormField,
  PageHeader,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
} from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
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
  const { post, delete: del } = useApiMutation();
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
  const [sendProgress, setSendProgress] = useState("");
  const [localError, setLocalError] = useState("");
  const [confirmClearFalhas, setConfirmClearFalhas] = useState(false);
  const [clearingFalhas, setClearingFalhas] = useState(false);

  const {
    data: historicoData,
    refetch: refetchHistorico,
  } = useOrdemColetaHistoricoQuery(historicoPage);

  const historico = historicoData?.rows ?? [];
  const pagination = historicoData?.pagination ?? null;
  const totalFalhas = historicoData?.totalFalhas ?? 0;

  const handleClearFalhas = async () => {
    setClearingFalhas(true);
    try {
      const res = await del("/ordem-coleta/historico/falhas", {
        skipSuccessToast: true,
      });
      toast.success(
        res?.message || "Registros com falha removidos com sucesso.",
      );
      setConfirmClearFalhas(false);
      setHistoricoPage(1);
      refetchHistorico();
    } catch (err) {
      toast.error(err?.message || "Não foi possível remover os registros.");
    } finally {
      setClearingFalhas(false);
    }
  };

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

  const handleTipoChange = (nextTipo) => {
    if (nextTipo === tipo) return;
    setDadosVariaveis(buildEmptyDadosVariaveis());
    setPreviewHtml("");
    setTipo(nextTipo);
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
        setSendProgress(`Processando envio… (${attempt + 1}/${maxAttempts})`);
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
      setSendProgress("");
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
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "Ordem de coleta" }]}
      />
      <PageHeader
        title="Ordens de coleta e autorizações"
        subtitle="Gere PDFs, envie por e-mail e consulte o histórico de envios"
      />

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
                aria-pressed={tipo === t.id}
                onClick={() => handleTipoChange(t.id)}
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
              {actionLoading === "enviar" && sendProgress
                ? sendProgress
                : "Gerar PDF e enviar por e-mail"}
            </Button>
          </div>
          {sendProgress && actionLoading === "enviar" && (
            <p className="text-sm text-text-secondary mt-3">{sendProgress}</p>
          )}
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

        <Card title="Últimos envios registrados" noPadding>
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              {totalFalhas > 0
                ? `${totalFalhas} envio(s) com falha no total`
                : "Histórico de envios por e-mail"}
            </p>
            {totalFalhas > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearFalhas(true)}
                className="text-danger border-danger/30 hover:bg-red-50"
              >
                Apagar todas com falha ({totalFalhas})
              </Button>
            )}
          </div>
          {historico.length === 0 ? (
            <p className="text-sm text-text-secondary p-5">Nenhum registro ainda.</p>
          ) : (
            <>
              <div className="md:hidden divide-y divide-border">
                {historico.map((row) => (
                  <div key={`${row.id}-m`} className="px-4 py-3 space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-text-primary">
                        {labelTipoHistorico(row.tipo)}
                      </span>
                      <span className="text-xs text-text-secondary whitespace-nowrap">
                        {row.criado_em
                          ? new Date(row.criado_em).toLocaleString("pt-BR")
                          : "—"}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary truncate">
                      {row.email_destinatario}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span>{row.caminhao_placa || "—"}</span>
                      {row.status === "sent" || row.enviado_em ? (
                        <span className="text-success font-medium">Enviado</span>
                      ) : row.status === "failed" || row.erro_envio ? (
                        <span className="text-danger font-medium">Falha</span>
                      ) : (
                        <span className="text-warning font-medium">Processando…</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <DataTable className="hidden md:table">
                <DataTableHead>
                  <tr>
                    <DataTableTh width="16%">Data</DataTableTh>
                    <DataTableTh width="18%">Tipo</DataTableTh>
                    <DataTableTh width="32%">E-mail</DataTableTh>
                    <DataTableTh width="12%">Placa</DataTableTh>
                    <DataTableTh width="22%">Status</DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {historico.map((row) => (
                    <DataTableRow key={row.id}>
                      <DataTableTd className="whitespace-nowrap text-text-secondary">
                        {row.criado_em
                          ? new Date(row.criado_em).toLocaleString("pt-BR")
                          : "—"}
                      </DataTableTd>
                      <DataTableTd className="whitespace-nowrap">
                        {labelTipoHistorico(row.tipo)}
                      </DataTableTd>
                      <DataTableTd truncate title={row.email_destinatario}>
                        {row.email_destinatario}
                      </DataTableTd>
                      <DataTableTd className="font-medium whitespace-nowrap">
                        {row.caminhao_placa || "—"}
                      </DataTableTd>
                      <DataTableTd>
                        {row.status === "sent" || row.enviado_em ? (
                          <span className="text-success font-medium">Enviado</span>
                        ) : row.status === "failed" || row.erro_envio ? (
                          <span
                            className="text-danger font-medium line-clamp-1"
                            title={row.erro_envio || ""}
                          >
                            Falha
                          </span>
                        ) : (
                          <span className="text-warning font-medium">Processando…</span>
                        )}
                      </DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
              {pagination && (
                <div className="px-5 py-3 border-t border-border">
                  <p className="text-xs text-text-light mb-2">
                    Total: {pagination.totalItems} registro(s).
                  </p>
                  <Pagination
                    currentPage={pagination.currentPage || historicoPage}
                    totalPages={pagination.totalPages || 1}
                    onPageChange={(page) => setHistoricoPage(page)}
                  />
                </div>
              )}
            </>
          )}
        </Card>

      <ConfirmModal
        isOpen={confirmClearFalhas}
        onClose={() => !clearingFalhas && setConfirmClearFalhas(false)}
        onConfirm={handleClearFalhas}
        title="Apagar envios com falha"
        message="Remove todos os registros de ordem de coleta que falharam no envio (testes em produção). Esta ação não pode ser desfeita."
        confirmText={clearingFalhas ? "Apagando..." : "Apagar falhas"}
        cancelText="Cancelar"
        warning
      />
    </PageLayout>
  );
};

export default OrdensColeta;
