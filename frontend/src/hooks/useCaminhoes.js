// frontend/src/hooks/useCaminhoes.js
import { useApi, useApiResource } from "./useApi";

export const useCaminhoes = () => {
  const {
    data: caminhoes,
    loading,
    error,
    pagination,
    fetchAll,
    create,
    update,
    remove,
    search,
    clearError,
    setData,
  } = useApiResource("/caminhoes");
  const { get, delete: del } = useApi();

  // Buscar caminhão por placa
  const getByPlaca = async (placa) => {
    try {
      const response = await get(`/caminhoes/${placa}`);
      return response.data;
    } catch (err) {
      throw new Error(err.message || "Erro ao buscar caminhão");
    }
  };

  // Verificar dependências antes de deletar
  const checkDependencies = async (placa) => {
    try {
      const response = await get(`/caminhoes/${placa}/check-dependencies`);
      return response.data;
    } catch (err) {
      throw new Error(err.message || "Erro ao verificar dependências");
    }
  };

  // Deletar com cascade
  const removeWithCascade = async (placa) => {
    try {
      const response = await del(`/caminhoes/${placa}/cascade`);
      if (response.success) {
        setData((prev) => prev.filter((c) => c.placa !== placa));
      }
      return response;
    } catch (err) {
      throw new Error(err.message || "Erro ao deletar caminhão");
    }
  };

  return {
    caminhoes,
    loading,
    error,
    pagination,
    fetchAll,
    create,
    update,
    remove,
    removeWithCascade,
    search,
    getByPlaca,
    checkDependencies,
    clearError,
  };
};
