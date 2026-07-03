// src/pages/Pneus.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useApiMutation,
  useCaminhoesListQuery,
  usePneusEmUsoQuery,
  useDebouncedValue,
} from "../hooks";
import { API_CONFIG } from "../utils/constants.js";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination.jsx";
import EmptyState from "../components/EmptyState.jsx";
import {
  Card,
  LoadingSpinner,
  FormField,
  StatusBadge,
  Button,
  Alert,
  PageHeader,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  TableRowActions,
} from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import NovoPneuModal from "../components/NovoPneuModal.jsx";
import { usePneuAtribuirQueries } from "../hooks";

const PneuVidaUtilBar = ({ percentualVidaUtil }) => {
  if (percentualVidaUtil === null) {
    return <span className="text-xs text-gray-400">N/A</span>;
  }
  return (
    <div className="w-full max-w-xs">
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
        <div
          className={`h-1.5 rounded-full ${
            percentualVidaUtil > 50
              ? "bg-green-500"
              : percentualVidaUtil > 20
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
          style={{ width: `${Math.min(100, percentualVidaUtil)}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        {Math.round(percentualVidaUtil)}% restante
      </div>
    </div>
  );
};

const PneuMobileCard = ({ pneu, onDelete }) => (
  <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
    <div className="flex justify-between items-start gap-3">
      <div>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Caminhão
        </p>
        <p className="font-semibold text-text-primary">
          {pneu.caminhao?.placa || "N/A"}
        </p>
      </div>
      <div className="flex flex-col gap-1 items-end">
        <StatusBadge
          status={pneu.posicoes_pneus?.nome_posicao}
          type="position"
        />
        <StatusBadge status={pneu.status_pneus?.nome_status} />
      </div>
    </div>
    <div>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
        Pneu
      </p>
      <p className="font-medium text-text-primary">
        {pneu.marca} {pneu.modelo}
      </p>
      {pneu.dot && (
        <p className="text-xs text-text-secondary mt-0.5">DOT: {pneu.dot}</p>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-xs text-text-secondary">KM rodado</p>
        <p className="font-medium text-text-primary">
          {pneu.kmRodado !== null
            ? `${pneu.kmRodado.toLocaleString("pt-BR")} km`
            : "N/A"}
        </p>
      </div>
      <div>
        <p className="text-xs text-text-secondary mb-1">Vida útil</p>
        <PneuVidaUtilBar percentualVidaUtil={pneu.percentualVidaUtil} />
      </div>
    </div>
    <div className="flex gap-3 pt-2 border-t border-border">
      <Link
        to={`/pneu/editar/${pneu.id}`}
        className="flex-1 text-center py-2 text-sm font-medium text-primary hover:text-primary-dark rounded-lg hover:bg-primary/5 transition-colors"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={() => onDelete(pneu.id)}
        className="flex-1 text-center py-2 text-sm font-medium text-danger hover:bg-red-50 rounded-lg transition-colors"
      >
        Excluir
      </button>
    </div>
  </div>
);

const PneusTable = ({
  pneus,
  caminhoes,
  onDelete,
  loading,
  filtroPlaca,
  onFiltroChange,
}) => {
  const navigate = useNavigate();
  const pneusComCalculos = useMemo(() => {
    return pneus.map((pneu) => {
      const caminhao = caminhoes.find((c) => c.id === pneu.caminhao_id);
      const kmRodado =
        caminhao?.km_atual && pneu.km_instalacao
          ? caminhao.km_atual - pneu.km_instalacao
          : null;

      const vidaUtilRestante =
        pneu.vida_util_km && kmRodado ? pneu.vida_util_km - kmRodado : null;

      return {
        ...pneu,
        caminhao,
        kmRodado,
        vidaUtilRestante,
        percentualVidaUtil:
          vidaUtilRestante && pneu.vida_util_km
            ? Math.max(0, (vidaUtilRestante / pneu.vida_util_km) * 100)
            : null,
      };
    });
  }, [pneus, caminhoes]);

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="overflow-hidden" noPadding>
      <div className="px-4 sm:px-5 py-4 border-b border-border flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-text-primary">
            Pneus em uso na frota
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Visualize e gerencie pneus instalados nos caminhões
          </p>
        </div>

        <div className="flex gap-3 w-full xl:w-auto shrink-0">
          <div className="w-full xl:w-64">
            <FormField
              placeholder="Filtrar por placa..."
              value={filtroPlaca}
              onChange={onFiltroChange}
              className="mb-0"
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
            />
          </div>
          <Link to="/pneus/atribuir">
            <Button variant="primary">Atribuir Pneu</Button>
          </Link>
        </div>
      </div>

      {pneusComCalculos.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="Nenhum pneu em uso encontrado"
            description='Use o botão "Atribuir Pneu" para montar pneus do estoque nos caminhões.'
            action={
              <Link to="/pneus/atribuir">
                <Button variant="primary">Atribuir Pneu</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-border">
            {pneusComCalculos.map((pneu) => (
              <div key={pneu.id} className="p-4">
                <PneuMobileCard pneu={pneu} onDelete={onDelete} />
              </div>
            ))}
          </div>
          <DataTable className="hidden md:block">
            <DataTableHead>
              <tr>
                <DataTableTh width="10%">Caminhão</DataTableTh>
                <DataTableTh width="22%">Pneu</DataTableTh>
                <DataTableTh width="18%">Posição/Status</DataTableTh>
                <DataTableTh width="14%" align="right">
                  KM rodado
                </DataTableTh>
                <DataTableTh width="24%">Vida útil</DataTableTh>
                <DataTableTh width="12%" align="right">
                  Ações
                </DataTableTh>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {pneusComCalculos.map((pneu) => (
                <DataTableRow key={pneu.id}>
                  <DataTableTd className="font-semibold whitespace-nowrap">
                    {pneu.caminhao?.placa || "N/A"}
                  </DataTableTd>
                  <DataTableTd truncate title={`${pneu.marca} ${pneu.modelo}`}>
                    <div className="font-medium line-clamp-1">
                      {pneu.marca} {pneu.modelo}
                    </div>
                    {pneu.dot && (
                      <div className="text-xs text-text-secondary">
                        DOT: {pneu.dot}
                      </div>
                    )}
                  </DataTableTd>
                  <DataTableTd>
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge
                        status={pneu.posicoes_pneus?.nome_posicao}
                        type="position"
                      />
                      <StatusBadge status={pneu.status_pneus?.nome_status} />
                    </div>
                  </DataTableTd>
                  <DataTableTd align="right" className="text-text-secondary whitespace-nowrap tabular-nums">
                    {pneu.kmRodado !== null
                      ? `${pneu.kmRodado.toLocaleString("pt-BR")} km`
                      : "N/A"}
                  </DataTableTd>
                  <DataTableTd>
                    <PneuVidaUtilBar percentualVidaUtil={pneu.percentualVidaUtil} />
                  </DataTableTd>
                  <DataTableTd align="right">
                    <TableRowActions
                      onEdit={() => navigate(`/pneu/editar/${pneu.id}`)}
                      onDelete={() => onDelete(pneu.id)}
                    />
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </>
      )}
    </Card>
  );
};

const PNEUS_PAGE_SIZE = 20;

const Pneus = () => {
  const { delete: del } = useApiMutation();
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const placaDebounced = useDebouncedValue(filtroPlaca.trim(), 400);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [novoPneuOpen, setNovoPneuOpen] = useState(false);

  const modalData = usePneuAtribuirQueries();

  const { data: caminhoesPage } = useCaminhoesListQuery({
    page: 1,
    limit: API_CONFIG.LIST_MAX,
  });

  const {
    data: pneusPage,
    isLoading: loading,
    error: loadError,
  } = usePneusEmUsoQuery({
    page: currentPage,
    limit: PNEUS_PAGE_SIZE,
    placa: placaDebounced || undefined,
  });

  const caminhoes = caminhoesPage?.data ?? [];
  const pneus = pneusPage?.data ?? [];
  const pagination = pneusPage?.pagination ?? null;

  useEffect(() => {
    setCurrentPage(1);
  }, [placaDebounced]);
  const handleDeleteClick = (id) => {
    const pneu = pneus.find((p) => p.id === id);
    setDeleteTarget({
      id,
      label: pneu
        ? `${pneu.marca || ""} ${pneu.modelo || ""}`.trim() || `ID ${id}`
        : `ID ${id}`,
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await del(`/pneus/${deleteTarget.id}`);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err?.message || "Não foi possível excluir o pneu. Tente novamente.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageLayout className="space-y-6">
      <PageHeader
        title="Controle de Pneus"
        subtitle="Gerencie a atribuição de pneus aos caminhões da frota"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setNovoPneuOpen(true)}>
              + Novo pneu
            </Button>
            <Link to="/pneus/estoque">
              <Button variant="outline">Ir para Estoque de Pneus</Button>
            </Link>
          </div>
        }
      />

        {deleteError && (
          <Alert
            type="error"
            message={deleteError}
            dismissible
            onClose={() => setDeleteError("")}
          />
        )}

        {loadError ? (
          <Alert
            type="error"
            title="Erro ao carregar pneus"
            message={loadError.message || "Tente recarregar a página."}
          />
        ) : (
          <>
            <PneusTable
              pneus={pneus}
              caminhoes={caminhoes}
              onDelete={handleDeleteClick}
              loading={loading}
              filtroPlaca={filtroPlaca}
              onFiltroChange={(e) => setFiltroPlaca(e.target.value)}
            />

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir pneu"
        message={
          deleteTarget
            ? `Deseja excluir permanentemente o pneu "${deleteTarget.label}"? Para apenas remover do caminhão, edite o pneu em vez de excluir.`
            : ""
        }
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        warning
      />

      <NovoPneuModal
        isOpen={novoPneuOpen}
        onClose={() => setNovoPneuOpen(false)}
        caminhoes={modalData.caminhoes}
        posicoes={modalData.posicoes}
        statusOptions={modalData.statusOptions}
        stockPneus={modalData.pneus}
        onSuccess={() => setCurrentPage(1)}
      />
    </PageLayout>
  );
};

export default Pneus;
