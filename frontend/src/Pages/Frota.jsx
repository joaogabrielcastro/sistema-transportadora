import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import Icon from "../components/ui/Icon.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";
import ConfirmModal from "../components/ConfirmModal";
import PlanQuotaBanner from "../components/PlanQuotaBanner.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
import FleetTable from "../components/frota/FleetTable.jsx";
import { useCaminhoesListQuery, useDebouncedValue } from "../hooks";
import { useCaminhaoDelete } from "../hooks/useCaminhaoDelete.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import { isVehicleQuotaReached } from "../utils/billing.js";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { queryKeys } from "../lib/queryKeys.js";
import { extractApiArray } from "../utils/extractApiArray.js";

const TIPO_FILTROS = [
  { id: "", label: "Todos" },
  { id: "cavalo", label: "Cavalos" },
  { id: "truck", label: "Trucks" },
  { id: "carreta", label: "Carretas" },
];

const PAGE_SIZE = 20;

/**
 * Lista completa da frota: busca por placa/motorista/modelo, filtro por tipo,
 * paginação no servidor e ações por linha. Estado refletido na URL para
 * permitir voltar, compartilhar e recarregar sem perder o contexto.
 */
export default function Frota() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.FROTA_WRITE);
  const quotaReached = isVehicleQuotaReached(user);

  const page = Math.max(1, Number(searchParams.get("pagina")) || 1);
  const tipo = TIPO_FILTROS.some((t) => t.id === searchParams.get("tipo"))
    ? searchParams.get("tipo") || ""
    : "";
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("busca") || "");
  const debounced = useDebouncedValue(searchTerm, 350);
  const isSearching = debounced.trim().length >= 2;

  const updateParams = (patch) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
        return next;
      },
      { replace: true },
    );
  };

  const listParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, ...(tipo ? { tipo_veiculo: tipo } : {}) }),
    [page, tipo],
  );
  const listQuery = useCaminhoesListQuery(listParams, { enabled: !isSearching });

  const searchQuery = useQuery({
    queryKey: queryKeys.caminhoes.search(debounced, tipo),
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ term: debounced.trim() });
        if (tipo) params.set("tipo_veiculo", tipo);
        return extractApiArray(
          await apiFetch({ method: "GET", url: `/caminhoes/search?${params}` }),
        );
      } catch (err) {
        throw await parseApiError(err);
      }
    },
    enabled: isSearching,
  });

  const active = isSearching ? searchQuery : listQuery;
  const caminhoes = isSearching ? searchQuery.data ?? [] : listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;
  const total = pagination?.totalItems;

  const del = useCaminhaoDelete();

  const handleSearch = (value) => {
    setSearchTerm(value);
    updateParams({ busca: value, pagina: "" });
  };

  return (
    <PageLayout className="space-y-5">
      <PageHeader
        eyebrow="Frota"
        title="Veículos"
        meta={
          !isSearching && total != null ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-text-secondary">
              {total} {total === 1 ? "veículo" : "veículos"}
            </span>
          ) : null
        }
        subtitle="Cavalos, trucks e carretas com motorista, composição e quilometragem."
        actions={
          canWrite ? (
            <Link to={quotaReached ? "/assinatura" : "/cadastro-caminhao"}>
              <Button icon={<Icon name={quotaReached ? "sparkles" : "plus"} className="h-4 w-4" strokeWidth={2.25} />}>
                {quotaReached ? "Fazer upgrade" : "Cadastrar veículo"}
              </Button>
            </Link>
          ) : null
        }
      />

      <PlanQuotaBanner user={user} resource="vehicles" />

      {del.blockedMessage ? (
        <Alert
          type="error"
          message={<span className="whitespace-pre-line">{del.blockedMessage}</span>}
          onClose={del.clearBlocked}
        />
      ) : null}

      <Card noPadding className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="relative w-full sm:max-w-sm">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
            <label htmlFor="frota-busca" className="sr-only">
              Buscar caminhão por placa, motorista ou modelo
            </label>
            <input
              id="frota-busca"
              type="search"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar placa, motorista ou modelo…"
              className="control w-full pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de veículo">
            {TIPO_FILTROS.map((f) => (
              <button
                key={f.id || "todos"}
                type="button"
                aria-pressed={tipo === f.id}
                onClick={() => updateParams({ tipo: f.id, pagina: "" })}
                className={`chip ${tipo === f.id ? "chip-active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {active.error ? (
          <div className="p-4">
            <Alert type="error" title="Erro ao carregar frota" message={active.error.message || "Não foi possível carregar a frota."}>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => active.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          </div>
        ) : active.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} columns={5} />
          </div>
        ) : caminhoes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Icon name="truck" className="h-5 w-5" />}
              title={isSearching || tipo ? "Nenhum veículo encontrado" : "Você ainda não possui veículos cadastrados."}
              description={
                isSearching
                  ? "Tente outro termo ou remova o filtro de tipo."
                  : tipo
                    ? "Não há veículos deste tipo cadastrados."
                    : "Cadastre o primeiro caminhão para acompanhar gastos, manutenção e documentos."
              }
              action={
                isSearching || tipo ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      updateParams({ busca: "", tipo: "", pagina: "" });
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : canWrite ? (
                  <Link to={quotaReached ? "/assinatura" : "/cadastro-caminhao"}>
                    <Button>{quotaReached ? "Fazer upgrade" : "Adicionar veículo"}</Button>
                  </Link>
                ) : null
              }
              dashed
            />
          </div>
        ) : (
          <>
            <FleetTable caminhoes={caminhoes} canWrite={canWrite} onDelete={del.requestDelete} />
            {isSearching ? (
              <p className="border-t border-border px-4 py-3 text-xs text-text-secondary">
                {caminhoes.length} resultado(s) para “{debounced.trim()}”.
              </p>
            ) : pagination?.totalPages > 1 ? (
              <div className="px-4 pb-4">
                <Pagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  onPageChange={(p) => updateParams({ pagina: p > 1 ? p : "" })}
                />
              </div>
            ) : null}
          </>
        )}
      </Card>

      <ConfirmModal
        isOpen={Boolean(del.target)}
        onClose={del.cancel}
        onConfirm={del.confirm}
        title="Excluir caminhão"
        message={del.confirmMessage}
        confirmText={del.deleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        warning
        loading={del.deleting}
      />
    </PageLayout>
  );
}
