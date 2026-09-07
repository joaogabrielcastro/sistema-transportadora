import React, { useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, FormField } from "../ui";
import NfeXmlDrop from "../fiscal/NfeXmlDrop.jsx";
import { useApiMutation } from "../../hooks";
import { parseApiError } from "../../lib/apiClient.js";
import { formatCaminhaoOptions } from "../../utils/caminhaoOptions.js";
import { matchCaminhaoPorPlacas } from "../../utils/cteFromNfe.js";

function formatBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataIso(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function CombustivelXmlImport({
  caminhoes = [],
  defaultCaminhaoId = "",
  disabled = false,
  onImported,
}) {
  const { post } = useApiMutation();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caminhaoId, setCaminhaoId] = useState(defaultCaminhaoId || "");
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);

  const caminhoesList = Array.isArray(caminhoes) ? caminhoes : [];
  const caminhaoOptions = formatCaminhaoOptions(caminhoesList);

  const handleFiles = async (files) => {
    const xml = files?.[0];
    if (!xml) return;
    setErro("");
    setPreview(null);
    setFile(xml);
    setLendo(true);
    try {
      const fd = new FormData();
      fd.append("xml", xml);
      const res = await post("/gastos/preview-xml-combustivel", fd, {
        skipSuccessToast: true,
        skipErrorToast: true,
      });
      const data = res?.data;
      setPreview(data);
      const hit = matchCaminhaoPorPlacas(caminhoesList, [
        data?.placa_sugerida,
        ...(Array.isArray(data?.placas_sugeridas) ? data.placas_sugeridas : []),
      ]);
      setCaminhaoId(
        hit ? String(hit.id) : defaultCaminhaoId || "",
      );
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(
        parsed.message ||
          err?.message ||
          "Falha ao ler o XML do posto.",
      );
      setFile(null);
    } finally {
      setLendo(false);
    }
  };

  const handleImportar = async () => {
    if (!file) return;
    setErro("");
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("xml", file);
      if (caminhaoId) fd.append("caminhao_id", String(caminhaoId));
      await post("/gastos/importar-xml-combustivel", fd, {
        skipSuccessToast: true,
        skipErrorToast: true,
      });
      setFile(null);
      setPreview(null);
      setCaminhaoId(defaultCaminhaoId || "");
      onImported?.();
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(
        parsed.message ||
          err?.message ||
          "Não foi possível lançar o abastecimento.",
      );
    } finally {
      setImportando(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-white p-4 sm:col-span-2 lg:col-span-3">
      <h3 className="mb-1 text-sm font-semibold text-text-primary">
        Importar XML do posto
      </h3>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          XML da NF-e de combustível (diesel, gasolina, etanol). Lança litros,
          R$/L, posto e valor no caminhão — não mistura com peças do estoque.
        </p>
        <NfeXmlDrop
          label="XML da NF-e do posto"
          hint="Arquivo .xml da SEFAZ / posto. Não use o DANFE em PDF."
          disabled={disabled || lendo || importando}
          onFiles={handleFiles}
        />
        {lendo ? (
          <p className="text-sm text-text-secondary">Lendo XML do posto…</p>
        ) : null}
        {erro ? <Alert type="error" message={erro} /> : null}
        {preview ? (
          <div className="space-y-4 rounded-lg border border-border bg-gray-50 p-4">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-text-secondary">Posto</dt>
                <dd className="font-medium text-text-primary">
                  {preview.emitente || preview.remetente?.razao_social || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">NF-e</dt>
                <dd className="font-medium text-text-primary">
                  {preview.numero}
                  {preview.serie ? `/${preview.serie}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Data</dt>
                <dd className="font-medium text-text-primary">
                  {preview.data_emissao_ymd || dataIso(preview.data_emissao)}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Litros</dt>
                <dd className="font-medium text-text-primary">
                  {preview.quantidade_litros ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">R$/L</dt>
                <dd className="font-medium text-text-primary">
                  {preview.preco_litro != null
                    ? formatBRL(preview.preco_litro)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Total</dt>
                <dd className="font-medium text-text-primary">
                  {formatBRL(preview.valor_total)}
                </dd>
              </div>
              {preview.placa_sugerida ? (
                <div>
                  <dt className="text-text-secondary">Placa no XML</dt>
                  <dd className="font-medium text-text-primary">
                    {preview.placa_sugerida}
                  </dd>
                </div>
              ) : null}
            </dl>
            <FormField
              label="Caminhão abastecido"
              type="typeahead"
              name="caminhao_id"
              value={caminhaoId}
              onChange={(e) => setCaminhaoId(e.target.value)}
              required
              placeholder="Placa do veículo abastecido…"
              options={caminhaoOptions}
              helperText={
                preview.placa_sugerida && !caminhaoId
                  ? `Placa ${preview.placa_sugerida} não está na frota. Selecione o caminhão.`
                  : undefined
              }
              className="mb-0"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleImportar}
                loading={importando}
                disabled={disabled || importando || !caminhaoId}
              >
                Lançar abastecimento
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

CombustivelXmlImport.propTypes = {
  caminhoes: PropTypes.array,
  defaultCaminhaoId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  disabled: PropTypes.bool,
  onImported: PropTypes.func,
};
