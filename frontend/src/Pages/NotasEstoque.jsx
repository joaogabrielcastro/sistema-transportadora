import React, { useCallback, useEffect, useId, useState } from "react";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import {
  Card,
  Button,
  FormField,
  PageHeader,
  LoadingSpinner,
  Tabs,
  Alert,
  SearchableSelect,
} from "../components/ui";
import { useApiMutation } from "../hooks";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import {
  extractApiArray,
  extractApiData,
} from "../utils/extractApiArray.js";
import { formatCaminhaoOptions } from "../utils/caminhaoOptions.js";

function formatMoney(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function FileDropField({
  label,
  hint,
  accept,
  file,
  onFile,
  required = false,
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const pick = (list) => {
    const next = list?.[0] || null;
    onFile(next);
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-text-secondary"
      >
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-secondary bg-secondary/5"
            : file
              ? "border-secondary/40 bg-secondary/5"
              : "border-border bg-gray-50 hover:border-secondary/40 hover:bg-white"
        }`}
      >
        <svg
          className={`mb-2 h-8 w-8 ${
            file ? "text-secondary" : "text-text-light"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {file ? (
          <>
            <p className="text-sm font-medium text-text-primary break-all">
              {file.name}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {(file.size / 1024).toFixed(1)} KB · clique para trocar
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">
              Arraste o arquivo ou clique para escolher
            </p>
            <p className="mt-1 text-xs text-text-secondary">{hint}</p>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => pick(e.target.files)}
        />
      </label>
      {file && (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-danger hover:underline"
          onClick={() => onFile(null)}
        >
          Remover arquivo
        </button>
      )}
    </div>
  );
}

const NotasEstoque = () => {
  const { post } = useApiMutation();
  const [tab, setTab] = useState("importar");
  const [xmlFile, setXmlFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notas, setNotas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [baixa, setBaixa] = useState({
    produto_id: "",
    quantidade: "",
    motivo: "",
    caminhao_id: "",
  });
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [caminhoes, setCaminhoes] = useState([]);
  const [previewCaminhaoId, setPreviewCaminhaoId] = useState("");

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [nRes, pRes, cRes] = await Promise.all([
        apiFetch({ url: "/notas-fiscais?limit=30" }),
        apiFetch({ url: "/notas-fiscais/produtos?limit=100" }),
        apiFetch({ url: "/caminhoes?limit=500" }),
      ]);
      setNotas(extractApiArray(nRes));
      setProdutos(extractApiArray(pRes));
      setCaminhoes(extractApiArray(cRes));
    } catch (e) {
      const parsed = await parseApiError(e);
      setErro(parsed.message || "Falha ao carregar listas");
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handlePreview = async () => {
    setErro("");
    setMsg("");
    if (!xmlFile) {
      setErro("Selecione o XML da NF-e (não o PDF).");
      return;
    }
    if (/\.pdf$/i.test(xmlFile.name) || xmlFile.type === "application/pdf") {
      setErro(
        "Você selecionou um PDF no campo XML. Baixe o XML da NF-e e use o PDF só no campo DANFE.",
      );
      return;
    }
    setLoadingPreview(true);
    try {
      const fd = new FormData();
      fd.append("xml", xmlFile);
      const res = await apiFetch({
        method: "POST",
        url: "/notas-fiscais/preview",
        data: fd,
      });
      const data = extractApiData(res);
      setPreview(data);
      // tenta pré-selecionar caminhão pela placa sugerida no XML
      const placa = String(data?.placa_sugerida || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (placa && caminhoes.length) {
        const hit = caminhoes.find(
          (c) =>
            String(c.placa || "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "") === placa,
        );
        setPreviewCaminhaoId(hit ? String(hit.id) : "");
      } else {
        setPreviewCaminhaoId("");
      }
      setMsg(
        `XML lido: NF-e ${data?.numero || ""}${
          data?.serie ? `/${data.serie}` : ""
        } com ${data?.itens?.length || 0} item(ns)${
          data?.placa_sugerida
            ? ` · placa detectada: ${data.placa_sugerida}`
            : ""
        }. Revise e confirme.`,
      );
    } catch (e) {
      const parsed = await parseApiError(e);
      setErro(parsed.message || "Falha ao ler XML");
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const updateItem = (index, field, value) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const itens = [...prev.itens];
      itens[index] = { ...itens[index], [field]: value };
      return { ...prev, itens };
    });
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setErro("");
    setMsg("");
    try {
      const fd = new FormData();
      const payload = {
        ...preview,
        caminhao_id: previewCaminhaoId
          ? Number(previewCaminhaoId)
          : null,
      };
      fd.append("payload", JSON.stringify(payload));
      if (xmlFile) fd.append("xml", xmlFile);
      if (pdfFile) fd.append("pdf", pdfFile);
      await apiFetch({
        method: "POST",
        url: "/notas-fiscais/importar",
        data: fd,
      });
      setMsg("Nota importada e estoque atualizado.");
      setPreview(null);
      setPreviewCaminhaoId("");
      setXmlFile(null);
      setPdfFile(null);
      await loadLists();
      setTab("estoque");
    } catch (e) {
      const parsed = await parseApiError(e);
      setErro(parsed.message || "Falha na importação");
    } finally {
      setImporting(false);
    }
  };

  const handleBaixa = async (e) => {
    e.preventDefault();
    setErro("");
    setMsg("");
    try {
      await post(
        "/notas-fiscais/estoque/baixa",
        {
          produto_id: Number(baixa.produto_id),
          quantidade: Number(baixa.quantidade),
          motivo: baixa.motivo || "Baixa de estoque",
          caminhao_id: baixa.caminhao_id
            ? Number(baixa.caminhao_id)
            : null,
        },
        { skipErrorToast: true },
      );
      setMsg("Baixa registrada.");
      setBaixa({ produto_id: "", quantidade: "", motivo: "", caminhao_id: "" });
      await loadLists();
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Falha na baixa");
    }
  };

  const produtoOptions = produtos.map((p) => ({
    value: String(p.id),
    label: `${p.descricao} — saldo ${Number(p.saldo)} ${p.unidade || ""}`,
    searchText: [p.codigo, p.descricao, p.unidade].filter(Boolean).join(" "),
  }));

  const caminhaoOptions = formatCaminhaoOptions(caminhoes);

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Notas e estoque" },
        ]}
      />
      <PageHeader
        title="Notas fiscais e estoque"
        subtitle="Importe o XML da NF-e (e o PDF DANFE se quiser) e controle o estoque"
      />

      {msg && (
        <Alert
          type="success"
          message={msg}
          dismissible
          onClose={() => setMsg("")}
        />
      )}
      {erro && (
        <Alert
          type="error"
          title="Não foi possível concluir"
          message={erro}
          dismissible
          onClose={() => setErro("")}
        />
      )}

      <Tabs
        tabs={[
          { id: "importar", label: "Importar NF-e" },
          { id: "estoque", label: `Estoque (${produtos.length})` },
          { id: "notas", label: `Notas (${notas.length})` },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "importar" && (
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Arquivos da nota
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                O XML é obrigatório para ler os produtos. O PDF é só arquivo
                anexo (DANFE) e não substitui o XML.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FileDropField
                label="XML da NF-e"
                required
                accept=".xml,application/xml,text/xml"
                hint="Arquivo .xml da SEFAZ / emissor"
                file={xmlFile}
                onFile={(f) => {
                  setXmlFile(f);
                  setPreview(null);
                  setErro("");
                }}
              />
              <FileDropField
                label="PDF DANFE"
                accept=".pdf,application/pdf"
                hint="Opcional — visualização da nota"
                file={pdfFile}
                onFile={setPdfFile}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handlePreview}
                loading={loadingPreview}
                disabled={!xmlFile}
              >
                Ler XML
              </Button>
              {preview && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setMsg("");
                  }}
                >
                  Limpar leitura
                </Button>
              )}
            </div>
          </Card>

          {preview && (
            <Card className="p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    Pré-visualização
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Ajuste código ou descrição se precisar antes de importar.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleImport}
                  loading={importing}
                >
                  Confirmar importação
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Número", value: preview.numero },
                  { label: "Série", value: preview.serie || "—" },
                  { label: "Emitente", value: preview.emitente || "—" },
                  { label: "Total", value: formatMoney(preview.valor_total) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border bg-gray-50 px-3 py-3"
                  >
                    <p className="text-xs text-text-secondary">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary truncate">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <SearchableSelect
                label="Caminhão de destino (opcional)"
                value={previewCaminhaoId}
                onChange={setPreviewCaminhaoId}
                options={caminhaoOptions}
                placeholder="Placa detectada no XML ou escolha manualmente…"
                helperText={
                  preview.placa_sugerida
                    ? `Placa lida do XML: ${preview.placa_sugerida}. A peça entra no estoque; use na manutenção depois.`
                    : "Se a peça for para um veículo específico, selecione a placa. Continua entrando no estoque."
                }
                className="mb-0 max-w-xl"
              />

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-text-secondary">
                      <th className="px-3 py-2.5 font-medium">Código</th>
                      <th className="px-3 py-2.5 font-medium">Descrição</th>
                      <th className="px-3 py-2.5 font-medium">Qtd</th>
                      <th className="px-3 py-2.5 font-medium">Un</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.itens?.map((item, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input
                            className="w-28 rounded-md border border-border px-2 py-1.5"
                            value={item.codigo || ""}
                            onChange={(e) =>
                              updateItem(idx, "codigo", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full min-w-[14rem] rounded-md border border-border px-2 py-1.5"
                            value={item.descricao || ""}
                            onChange={(e) =>
                              updateItem(idx, "descricao", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.001"
                            className="w-24 rounded-md border border-border px-2 py-1.5"
                            value={item.quantidade}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                "quantidade",
                                Number(e.target.value),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-16 rounded-md border border-border px-2 py-1.5"
                            value={item.unidade || "UN"}
                            onChange={(e) =>
                              updateItem(idx, "unidade", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "estoque" && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Baixa de estoque
              </h3>
              <p className="text-sm text-text-secondary">
                Retire quantidade de um produto já importado.
              </p>
            </div>
            <form
              onSubmit={handleBaixa}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end"
            >
              <SearchableSelect
                label="Produto"
                value={baixa.produto_id}
                onChange={(value) =>
                  setBaixa((p) => ({ ...p, produto_id: value }))
                }
                options={produtoOptions}
                placeholder="Digite o produto..."
                required
                className="mb-0"
              />
              <SearchableSelect
                label="Caminhão (opcional)"
                value={baixa.caminhao_id}
                onChange={(value) =>
                  setBaixa((p) => ({ ...p, caminhao_id: value }))
                }
                options={caminhaoOptions}
                placeholder="Placa do veículo..."
                className="mb-0"
              />
              <FormField
                label="Quantidade"
                type="number"
                step="0.001"
                value={baixa.quantidade}
                onChange={(e) =>
                  setBaixa((p) => ({ ...p, quantidade: e.target.value }))
                }
                required
                className="mb-0"
              />
              <FormField
                label="Motivo"
                value={baixa.motivo}
                onChange={(e) =>
                  setBaixa((p) => ({ ...p, motivo: e.target.value }))
                }
                placeholder="Uso / aplicação"
                className="mb-0"
              />
              <Button type="submit" disabled={!baixa.produto_id}>
                Registrar baixa
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-base font-semibold text-text-primary">
              Produtos em estoque
            </h3>
            {loadingLists ? (
              <LoadingSpinner />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-text-secondary">
                      <th className="px-3 py-2.5 font-medium">Código</th>
                      <th className="px-3 py-2.5 font-medium">Descrição</th>
                      <th className="px-3 py-2.5 font-medium">Un</th>
                      <th className="px-3 py-2.5 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2.5">{p.codigo || "—"}</td>
                        <td className="px-3 py-2.5">{p.descricao}</td>
                        <td className="px-3 py-2.5">{p.unidade}</td>
                        <td className="px-3 py-2.5 font-semibold">
                          {Number(p.saldo)}
                        </td>
                      </tr>
                    ))}
                    {!produtos.length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-8 text-center text-text-secondary"
                        >
                          Nenhum produto ainda. Importe uma NF-e na aba
                          Importar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "notas" && (
        <Card className="p-6">
          <h3 className="mb-4 text-base font-semibold text-text-primary">
            Notas importadas
          </h3>
          {loadingLists ? (
            <LoadingSpinner />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-text-secondary">
                    <th className="px-3 py-2.5 font-medium">Número</th>
                    <th className="px-3 py-2.5 font-medium">Emitente</th>
                    <th className="px-3 py-2.5 font-medium">Itens</th>
                    <th className="px-3 py-2.5 font-medium">Total</th>
                    <th className="px-3 py-2.5 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map((n) => (
                    <tr key={n.id} className="border-t border-border">
                      <td className="px-3 py-2.5 font-medium">
                        {n.numero}
                        {n.serie ? `/${n.serie}` : ""}
                      </td>
                      <td className="px-3 py-2.5">{n.emitente || "—"}</td>
                      <td className="px-3 py-2.5">{n.itens?.length || 0}</td>
                      <td className="px-3 py-2.5">
                        {formatMoney(n.valor_total)}
                      </td>
                      <td className="px-3 py-2.5">
                        {n.criado_em
                          ? new Date(n.criado_em).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {!notas.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-text-secondary"
                      >
                        Nenhuma nota importada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </PageLayout>
  );
};

export default NotasEstoque;
