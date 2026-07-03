// src/pages/Home.jsx
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useApi,
  useApiMutation,
  useCaminhoesListQuery,
  useReportsOverviewQuery,
} from "../hooks";
import { Card, Button, LoadingSpinner, Alert, PageHeader } from "../components/ui";
import { formatCurrency, formatNumber } from "../utils";
import { extractApiArray, extractApiData } from "../utils/extractApiArray.js";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination.jsx";
import EmptyState from "../components/EmptyState.jsx";

const Home = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: caminhoesPage,
    isLoading: loadingCaminhoes,
    error: errorCaminhoes,
  } = useCaminhoesListQuery({ page: currentPage, limit: 10 });

  const caminhoes = caminhoesPage?.data ?? [];
  const pagination = caminhoesPage?.pagination;

  const { data: overview } = useReportsOverviewQuery();

  const { get: apiGet } = useApi();
  const { delete: apiDelete } = useApiMutation();

  const stats = useMemo(
    () => ({
      totalCaminhoes:
        overview?.totalCaminhoes ||
        pagination?.totalItems ||
        caminhoes?.length ||
        0,
      totalGastos: overview?.totalGastos || 0,
      totalManutencoes: overview?.totalManutencoes || 0,
      mediaGastos: overview?.mediaGastos || 0,
    }),
    [overview, pagination?.totalItems, caminhoes?.length],
  );

  // Estados da aplicação
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Estados para o modal de confirmação
  const [modalOpen, setModalOpen] = useState(false);
  const [caminhaoParaExcluir, setCaminhaoParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // Função de busca
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearchLoading(true);
    setErrorMessage("");
    setHasSearched(true);

    try {
      const results = await apiGet(
        `/caminhoes/search?term=${encodeURIComponent(searchTerm.trim())}`,
        { skipLoading: true },
      );
      setSearchResults(extractApiArray(results));
    } catch (err) {
      setErrorMessage("Erro ao buscar caminhões. Tente novamente.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Função para verificar dependências ANTES de excluir
  const handleOpenDeleteModal = async (caminhao) => {
    try {
      const dependenciasResponse = await apiGet(
        `/caminhoes/${caminhao.placa}/check-dependencies`,
      );

      const responseData = extractApiData(dependenciasResponse);
      const { temDependencias, detalhes } = responseData;

      if (temDependencias) {
        let mensagemDependencias = `Não é possível excluir o caminhão ${caminhao.placa}. Existem registros vinculados:\n`;
        if (detalhes.gastos > 0)
          mensagemDependencias += `• ${detalhes.gastos} gastos\n`;
        if (detalhes.checklists > 0)
          mensagemDependencias += `• ${detalhes.checklists} manutenções\n`;
        if (detalhes.pneus > 0)
          mensagemDependencias += `• ${detalhes.pneus} pneus\n`;
        if (detalhes.documentos > 0)
          mensagemDependencias += `• ${detalhes.documentos} documentos\n`;
        if (detalhes.ordens_envio > 0)
          mensagemDependencias += `• ${detalhes.ordens_envio} ordens de coleta\n`;
        mensagemDependencias +=
          "\nDelete primeiro esses registros antes de excluir o caminhão.";
        setErrorMessage(mensagemDependencias);
        return;
      }

      setCaminhaoParaExcluir(caminhao);
      setModalOpen(true);
    } catch (err) {
      console.error("Erro ao verificar dependências:", err);
      setCaminhaoParaExcluir(caminhao);
      setModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCaminhaoParaExcluir(null);
  };

  const handleDeleteCaminhao = async () => {
    if (!caminhaoParaExcluir) return;

    setExcluindo(true);
    try {
      await apiDelete(`/caminhoes/${caminhaoParaExcluir.placa}/cascade`);
      setSuccessMessage(
        `Caminhão ${caminhaoParaExcluir.placa} excluído com sucesso!`,
      );
      handleCloseModal();
    } catch (err) {
      console.error("Erro ao excluir caminhão:", err);
      let errorMessage = "Erro ao excluir caminhão. ";
      if (err.message.includes("registros vinculados")) {
        errorMessage = `Não é possível excluir o caminhão ${caminhaoParaExcluir.placa}. Existem registros vinculados.`;
      }
      setErrorMessage(errorMessage);
    } finally {
      setExcluindo(false);
      handleCloseModal();
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Componente de Card de Estatística
  const StatCard = ({ title, value, icon, trend, color }) => (
    <div className="bg-white rounded-xl p-6 shadow-card border border-border hover:shadow-soft transition-all duration-300 group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-text-secondary mb-1">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
        </div>
        <div
          className={`p-3 rounded-lg ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}
        >
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className="text-success font-medium flex items-center">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            {trend}
          </span>
          <span className="text-text-light ml-2">vs. mês anterior</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader
          title="Dashboard"
          subtitle="Bem-vindo ao sistema de gestão ABroto."
          actions={
            <Link to="/cadastro-caminhao">
              <Button
                variant="primary"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                Novo Caminhão
              </Button>
            </Link>
          }
        />

        {(successMessage || errorMessage) && (
          <div className="space-y-3">
            {successMessage && (
              <Alert
                type="success"
                message={successMessage}
                dismissible
                autoClose
                onClose={() => setSuccessMessage("")}
              />
            )}
            {errorMessage && (
              <Alert
                type="error"
                message={
                  <span className="whitespace-pre-line">{errorMessage}</span>
                }
                dismissible
                onClose={() => setErrorMessage("")}
              />
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
          <StatCard
            title="Total de Caminhões"
            value={formatNumber(stats.totalCaminhoes)}
            color="bg-blue-500 text-blue-600"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
            }
          />
          <StatCard
            title="Gastos Totais"
            value={formatCurrency(stats.totalGastos)}
            color="bg-emerald-500 text-emerald-600"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            title="Manutenções"
            value={formatNumber(stats.totalManutencoes)}
            color="bg-amber-500 text-amber-600"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
          />
          <StatCard
            title="Média de Gastos"
            value={formatCurrency(stats.mediaGastos)}
            color="bg-purple-500 text-purple-600"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            }
          />
        </div>

        {/* Search Section */}
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:block gap-3 max-w-2xl mx-auto w-full"
        >
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
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
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 sm:pr-28 py-4 bg-white border border-border rounded-xl text-text-primary placeholder-text-light focus:ring-2 focus:ring-secondary focus:border-transparent shadow-sm transition-all"
              placeholder="Buscar por placa, motorista ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="hidden sm:flex absolute inset-y-0 right-0 pr-2 items-center">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={searchLoading}
                className="rounded-lg"
              >
                Buscar
              </Button>
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={searchLoading}
            className="sm:hidden w-full"
          >
            Buscar
          </Button>
        </form>

        {/* Content Area */}
        {errorCaminhoes ? (
          <Alert
            type="error"
            title="Erro ao carregar frota"
            message={errorCaminhoes.message || "Tente recarregar a página."}
          />
        ) : loadingCaminhoes ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" text="Carregando frota..." />
          </div>
        ) : (
          <>
            {/* Search Results */}
            {hasSearched && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-text-primary">
                    Resultados da Busca
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHasSearched(false);
                      setSearchTerm("");
                      setSearchResults([]);
                    }}
                  >
                    Limpar busca
                  </Button>
                </div>

                {searchResults.length === 0 ? (
                  <EmptyState
                    title="Nenhum resultado encontrado"
                    description="Tente buscar por outro termo ou limpe o filtro."
                    icon={
                      <svg
                        className="w-7 h-7"
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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.map((caminhao) => (
                      <TruckCard
                        key={caminhao.id}
                        caminhao={caminhao}
                        onDelete={() => handleOpenDeleteModal(caminhao)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Main Fleet List */}
            {!hasSearched && (
              <div className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <h2 className="text-xl font-bold text-text-primary">
                    Frota Recente
                  </h2>
                  {pagination?.totalPages > 1 && (
                    <p className="text-sm text-text-secondary">
                      Página {currentPage} de {pagination.totalPages}
                    </p>
                  )}
                </div>

                {!caminhoes || caminhoes.length === 0 ? (
                  <EmptyState
                    title="Nenhum caminhão cadastrado"
                    description="Comece cadastrando seu primeiro veículo para gerenciar sua frota."
                    icon={
                      <svg
                        className="w-7 h-7"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    }
                    action={
                      <Link to="/cadastro-caminhao">
                        <Button variant="primary">Cadastrar Caminhão</Button>
                      </Link>
                    }
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {caminhoes.map((caminhao) => (
                        <TruckCard
                          key={caminhao.id}
                          caminhao={caminhao}
                          onDelete={() => handleOpenDeleteModal(caminhao)}
                        />
                      ))}
                    </div>
                    {pagination?.totalPages > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={pagination.totalPages}
                        onPageChange={handlePageChange}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <ConfirmModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onConfirm={handleDeleteCaminhao}
          title="Excluir Caminhão"
          message={`Tem certeza que deseja excluir o caminhão ${caminhaoParaExcluir?.placa}? Esta ação não pode ser desfeita.`}
          confirmText={excluindo ? "Excluindo..." : "Excluir"}
          cancelText="Cancelar"
          warning={true}
        />
      </div>
    </div>
  );
};

// Sub-component for Truck Card to keep main file cleaner
const TruckCard = ({ caminhao, onDelete }) => (
  <div className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group flex flex-col">
    <div className="p-5 flex-1">
      <div className="flex justify-between items-start mb-4">
        <div className="bg-gray-100 p-2 rounded-lg">
          <svg
            className="w-6 h-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
          </svg>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
          {caminhao.status || "Ativo"}
        </span>
      </div>

      <h3 className="text-lg font-bold text-text-primary mb-1">
        {caminhao.placa}
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        {caminhao.modelo || "Modelo não informado"} •{" "}
        {caminhao.marca || "Marca não informada"}
      </p>

      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <svg
            className="w-4 h-4 mr-2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {caminhao.motorista || "Sem motorista"}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <svg
            className="w-4 h-4 mr-2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {caminhao.ano || "Ano N/A"}
        </div>
      </div>
    </div>

    <div className="px-5 py-4 bg-gray-50 border-t border-border flex justify-between items-center">
      <Link
        to={`/caminhao/${caminhao.placa}`}
        className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
      >
        Ver detalhes
      </Link>
      <div className="flex gap-2">
        <Link to={`/caminhao/editar/${caminhao.placa}`}>
          <button className="p-1.5 text-gray-400 hover:text-secondary transition-colors rounded-md hover:bg-blue-50">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </Link>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-danger transition-colors rounded-md hover:bg-red-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
);

export default Home;
