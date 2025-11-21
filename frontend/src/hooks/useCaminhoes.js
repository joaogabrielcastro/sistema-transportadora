// frontend/src/hooks/useCaminhoes.js
import { useApiResource, api } from "./useApi";

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

  // Buscar caminhão por placa
  const getByPlaca = async (placa) => {
    try {
      const response = await api.get(`/caminhoes/${placa}`);
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Erro ao buscar caminhão");
    }
  };

  // Verificar dependências antes de deletar
  const checkDependencies = async (placa) => {
    try {
      const response = await api.get(`/caminhoes/${placa}/check-dependencies`);
      return response.data;
    } catch (err) {
      throw new Error(
        err.response?.data?.message || "Erro ao verificar dependências"
      );
    }
  };

  // Deletar com cascade
  const removeWithCascade = async (placa) => {
    try {
      const response = await api.delete(`/caminhoes/${placa}/cascade`);
      // 204 No Content means success
      if (response.status === 204 || response.data?.success) {
        setData((prev) => prev.filter((c) => c.placa !== placa));
      }
      return response.data;
    } catch (err) {
      throw new Error(
        err.response?.data?.message || "Erro ao deletar caminhão"
      );
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
