// src/pages/Pneus.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useApi,
  useCaminhoesListQuery,
  usePneusEmUsoQuery,
  useDebouncedValue,
} from "../hooks";
import { API_CONFIG } from "../utils/constants.js";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination.jsx";
import {
  Card,
  LoadingSpinner,
  FormField,
  StatusBadge,
  Button,
} from "../components/ui";

const PneusTable = ({
  pneus,
  caminhoes,
  onDelete,
  loading,
  filtroPlaca,
  onFiltroChange,
}) => {
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
    <Card className="overflow-hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Controle de Frota - Pneus em Uso
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Visualize e gerencie os pneus instalados nos caminhões
          </p>
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <div className="w-full lg:w-64">
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
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {" "}
            Nenhum pneu em uso encontrado{" "}
          </h3>
          <p className="text-gray-500 text-sm">
            Use o botão "Atribuir Pneu" para montar pneus do estoque nos
            caminhões.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caminhão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pneu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posição/Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KM Rodado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vida Útil
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pneusComCalculos.map((pneu) => (
                <tr
                  key={pneu.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {pneu.caminhao?.placa || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {pneu.marca} {pneu.modelo}
                    </div>
                    {pneu.dot && (
                      <div className="text-xs text-gray-500">
                        DOT: {pneu.dot}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge
                        status={pneu.posicoes_pneus?.nome_posicao}
                        type="position"
                      />
                      <StatusBadge status={pneu.status_pneus?.nome_status} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {pneu.kmRodado !== null
                      ? `${pneu.kmRodado.toLocaleString("pt-BR")} km`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    {pneu.percentualVidaUtil !== null ? (
                      <div className="w-32">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              pneu.percentualVidaUtil > 50
                                ? "bg-green-500"
                                : pneu.percentualVidaUtil > 20
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                pneu.percentualVidaUtil,
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round(pneu.percentualVidaUtil)}% restante
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/pneu/editar/${pneu.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-4 text-xs uppercase tracking-wide"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => onDelete(pneu.id)}
                      className="text-red-600 hover:text-red-900 text-xs uppercase tracking-wide"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const PNEUS_PAGE_SIZE = 20;

const Pneus = () => {
  const { delete: del } = useApi();
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const placaDebounced = useDebouncedValue(filtroPlaca.trim(), 400);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: caminhoesPage } = useCaminhoesListQuery({
    page: 1,
    limit: API_CONFIG.LIST_MAX,
  });

  const {
    data: pneusPage,
    isLoading: loading,
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
    try {
      await del(`/pneus/${deleteTarget.id}`);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Controle de Pneus
            </h1>
            <p className="text-gray-600 mt-1">
              Gerencie a atribuição de pneus aos caminhões da frota
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/pneus/estoque">
              <Button variant="outline">Ir para Estoque de Pneus</Button>
            </Link>
          </div>
        </div>

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
      </div>

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
    </div>
  );
};

export default Pneus;
