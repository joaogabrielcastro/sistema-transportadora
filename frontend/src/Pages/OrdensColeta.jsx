import React, { useCallback, useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import { useApi, useCaminhoes } from "../hooks";
import { Card, Button, Alert, FormField } from "../components/ui";
import {
  ORDEM_COLETA_CAMPOS_PADRAO,
  ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA,
  buildEmptyDadosVariaveis,
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
  const { get, post, request, loading } = useApi();
  const {
    caminhoes,
    loading: loadingCaminhoes,
    error: erroCaminhoes,
    fetchAll: fetchCaminhoes,
  } = useCaminhoes();
  const [tipo, setTipo] = useState("PADRAO");
  const [placa, setPlaca] = useState("");
  const [dadosVariaveis, setDadosVariaveis] = useState(buildEmptyDadosVariaveis);
  const [emailDestinatario, setEmailDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [historico, setHistorico] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [localError, setLocalError] = useState("");

  const camposFormulario = useMemo(() => {
    if (tipo === "CANOINHAS") {
      return [
        ...ORDEM_COLETA_CAMPOS_PADRAO,
        ...ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA,
      ];
    }
    return ORDEM_COLETA_CAMPOS_PADRAO;
  }, [tipo]);

  const hintTipoSelecionado = useMemo(
    () => tipos.find((t) => t.id === tipo)?.hint,
    [tipo],
  );

  const carregarHistorico = useCallback(async () => {
    try {
      const res = await get("/ordem-coleta/historico?page=1&limit=15");
      setHistorico(Array.isArray(res.data) ? res.data : []);
      setPagination(res.pagination || null);
    } catch {
      setHistorico([]);
    }
  }, [get]);

  useEffect(() => {
    void fetchCaminhoes().catch(() => {
      /* erro já tratado pelo useApi (toast) */
    });
  }, [fetchCaminhoes]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const buildPayload = useCallback(() => {
    const dv = { ...dadosVariaveis };
    camposFormulario.forEach((c) => {
      if (dv[c.key] == null) dv[c.key] = "";
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
    try {
      const res = await request({
        method: "POST",
        url: "/ordem-coleta/preview",
        data: buildPayload(),
        skipSuccessToast: true,
      });
      setPreviewHtml(res?.data?.html || "");
    } catch (e) {
      setLocalError(e.message || "Não foi possível gerar a pré-visualização.");
    }
  };

  const handlePdf = async () => {
    setLocalError("");
    try {
      const res = await request({
        method: "POST",
        url: "/ordem-coleta/pdf",
        data: buildPayload(),
        responseType: "blob",
        skipSuccessToast: true,
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
    }
  };

  const handleEnviar = async () => {
    setLocalError("");
    if (!emailDestinatario.trim()) {
      setLocalError("Informe o e-mail do destinatário.");
      return;
    }
    try {
      await post("/ordem-coleta/enviar", {
        ...buildPayload(),
        emailDestinatario: emailDestinatario.trim(),
        assunto: assunto.trim() || undefined,
      });
      await carregarHistorico();
    } catch {
      /* toast já exibido pelo useApi */
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
          <p className="text-gray-600 mt-1">
            O fluxo principal é a ordem de coleta (modelo genérico). A autorização compacta
            veio de um exemplo real de cliente (Canoinhas) e serve só de referência — não define
            regra para os demais; adapte o HTML por tomador. Substitua ou duplique os layouts em{" "}
            <code className="text-sm bg-gray-200 px-1 rounded">
              backend/src/templates/html
            </code>
            , com placeholders{" "}
            <code className="text-sm bg-gray-200 px-1 rounded">{"{{campo}}"}</code>.
          </p>
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
                    Não foi possível carregar a frota: {erroCaminhoes}
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
              loading={loading}
            >
              Pré-visualizar HTML
            </Button>
            <Button type="button" onClick={handlePdf} loading={loading}>
              Baixar PDF
            </Button>
            <Button type="button" onClick={handleEnviar} loading={loading}>
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
                        {row.enviado_em ? (
                          <span className="text-green-700">Enviado</span>
                        ) : (
                          <span
                            className="text-red-600"
                            title={row.erro_envio || ""}
                          >
                            Falha
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pagination && (
                <p className="mt-3 text-xs text-text-light">
                  Total: {pagination.totalItems} registro(s).
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default OrdensColeta;
