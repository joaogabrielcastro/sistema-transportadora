import React, { useEffect, useState } from "react";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { extractApiArray } from "../utils/extractApiArray.js";
import { formatCaminhaoOptions } from "../utils/caminhaoOptions.js";
import { Button, Card, SearchableSelect } from "./ui";

/**
 * Vincula/desvincula carretas a um cavalo (troca opcional).
 */
export default function VinculosComposicao({ caminhao, onChanged }) {
  const [carretas, setCarretas] = useState([]);
  const [carretaId, setCarretaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLista, setLoadingLista] = useState(false);
  const [erro, setErro] = useState("");
  const [erroLista, setErroLista] = useState("");

  const isCavalo =
    caminhao?.tipo_veiculo === "cavalo" || caminhao?.tipo_veiculo === "truck";
  const vinculos = caminhao?.composicao?.vinculos || [];

  useEffect(() => {
    if (!isCavalo) return;
    let cancelled = false;
    (async () => {
      setLoadingLista(true);
      setErroLista("");
      try {
        const res = await apiFetch({
          method: "GET",
          url: "/caminhoes",
          params: { page: 1, limit: 200, tipo_veiculo: "carreta" },
        });
        const all = extractApiArray(res);
        if (!cancelled) {
          setCarretas(all);
        }
      } catch (e) {
        if (!cancelled) {
          setCarretas([]);
          const parsed = await parseApiError(e);
          setErroLista(
            parsed.message || "Não foi possível carregar as carretas.",
          );
        }
      } finally {
        if (!cancelled) setLoadingLista(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCavalo, caminhao?.id]);

  if (!isCavalo || !caminhao?.id) return null;

  const vincular = async () => {
    if (!carretaId) return;
    setLoading(true);
    setErro("");
    try {
      await apiFetch({
        method: "POST",
        url: `/caminhoes/id/${caminhao.id}/vinculos`,
        data: { carreta_id: Number(carretaId), ordem: vinculos.length + 1 },
      });
      setCarretaId("");
      onChanged?.();
    } catch (e) {
      const parsed = await parseApiError(e);
      setErro(parsed.message || "Falha ao vincular");
    } finally {
      setLoading(false);
    }
  };

  const desvincular = async (vinculoId) => {
    setLoading(true);
    setErro("");
    try {
      await apiFetch({
        method: "DELETE",
        url: `/caminhoes/id/${caminhao.id}/vinculos/${vinculoId}`,
      });
      onChanged?.();
    } catch (e) {
      const parsed = await parseApiError(e);
      setErro(parsed.message || "Falha ao desvincular");
    } finally {
      setLoading(false);
    }
  };

  const vinculadasIds = new Set(
    vinculos.map((v) => v.carreta_id || v.carreta?.id),
  );
  const disponiveis = carretas.filter((c) => !vinculadasIds.has(c.id));

  return (
    <Card title="Composição (cavalo + carreta)" className="mt-6">
      <p className="text-sm text-text-secondary mb-4">
        Vincule carretas cadastradas separadamente. A troca não fica fixa no
        cadastro.
      </p>
      {erro && (
        <div className="text-sm text-red-700 bg-red-50 rounded px-3 py-2 mb-3">
          {erro}
        </div>
      )}
      {erroLista && (
        <div className="text-sm text-red-700 bg-red-50 rounded px-3 py-2 mb-3">
          {erroLista}
        </div>
      )}
      <ul className="space-y-2 mb-4">
        {vinculos.map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between gap-2 text-sm border border-border rounded-lg px-3 py-2"
          >
            <span>
              {v.ordem}ª — {v.carreta?.placa || "Carreta"}{" "}
              <span className="text-text-secondary">
                {v.carreta?.modelo || ""}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => desvincular(v.id)}
            >
              Desvincular
            </Button>
          </li>
        ))}
        {!vinculos.length && (
          <li className="text-sm text-text-secondary">
            Nenhuma carreta vinculada
          </li>
        )}
      </ul>
      {vinculos.length < 2 && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[12rem]">
            <SearchableSelect
              label="Carreta disponível"
              value={carretaId}
              onChange={setCarretaId}
              options={formatCaminhaoOptions(disponiveis)}
              placeholder={
                loadingLista
                  ? "Carregando carretas..."
                  : "Digite a placa da carreta..."
              }
              disabled={loadingLista}
              noResultsText={
                loadingLista
                  ? "Carregando..."
                  : disponiveis.length === 0
                    ? "Nenhuma carreta cadastrada (tipo Carreta)"
                    : "Nenhum resultado encontrado"
              }
              className="mb-0"
            />
          </div>
          <Button
            type="button"
            disabled={!carretaId || loading || loadingLista}
            loading={loading}
            onClick={vincular}
          >
            Vincular
          </Button>
        </div>
      )}
    </Card>
  );
}
