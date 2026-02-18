// backend/src/models/pneusModel.js
import { supabase } from "../config/supabase.js";

export const pneusModel = {
  // Criar um novo pneu
  create: async (pneuData) => {
    const { data, error } = await supabase
      .from("pneus")
      .insert([pneuData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Criar múltiplos pneus
  createBulk: async (pneusData) => {
    const { data, error } = await supabase
      .from("pneus")
      .insert(pneusData)
      .select();

    if (error) {
      console.error("Erro no Supabase ao inserir em lote:", error);
      throw error;
    }
    return data;
  },

  // Listar todos os pneus
  getAll: async () => {
    const { data, error } = await supabase
      .from("pneus")
      .select(
        "*, caminhoes(placa), posicoes_pneus(nome_posicao), status_pneus(nome_status)",
      );
    if (error) throw error;
    return data;
  },

  // Buscar pneu por ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from("pneus")
      .select(
        "*, caminhoes(placa), posicoes_pneus(nome_posicao), status_pneus(nome_status)",
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  // Listar pneus em estoque (sem caminhão atribuído)
  getInStock: async () => {
    const { data, error } = await supabase
      .from("pneus")
      .select("*, posicoes_pneus(nome_posicao), status_pneus(nome_status)")
      .is("caminhao_id", null);
    if (error) throw error;
    return data;
  },

  // Listar pneus de um caminhão específico (por ID)
  getByCaminhaoId: async (caminhaoId) => {
    const { data, error } = await supabase
      .from("pneus")
      .select("*, posicoes_pneus(nome_posicao), status_pneus(nome_status)")
      .eq("caminhao_id", caminhaoId);
    if (error) throw error;
    return data;
  },

  // Atualizar um pneu
  update: async (id, pneuData) => {
    const { data, error } = await supabase
      .from("pneus")
      .update(pneuData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Deletar um pneu
  delete: async (id) => {
    const { data, error } = await supabase.from("pneus").delete().eq("id", id);
    if (error) throw error;
    return data;
  },

  // Atribuir um pneu do estoque a um caminhão
  assignFromStock: async (pneuId, updates) => {
    // Removemos campos que não devem ser atualizados na atribuição se vierem no objeto
    const { ...safeUpdates } = updates;
    delete safeUpdates.id;
    delete safeUpdates.stock_pneu_id; // Garantia

    const { data, error } = await supabase
      .from("pneus")
      .update(safeUpdates)
      .eq("id", pneuId)
      .select()
      .single();

    if (error) {
      console.error(
        "Erro ao atribuir pneu do estoque (assignFromStock). ID:",
        pneuId,
        "Update Data:",
        safeUpdates,
        "Error:",
        error,
      );
      throw error;
    }
    return data;
  },

  // Tentar encontrar um pneu compatível no estoque e atribuir
  findAndAssignStock: async (criteria, updates) => {
    // 1. Encontrar um pneu candidato (FIFO - mais antigo primeiro ou apenas o primeiro)
    const { data: candidates, error: searchError } = await supabase
      .from("pneus")
      .select("id")
      .is("caminhao_id", null)
      .eq("marca", criteria.marca) // Case sensitive? Idealmente normalizar
      .eq("modelo", criteria.modelo)
      .limit(1);

    if (searchError) throw searchError;

    if (!candidates || candidates.length === 0) {
      return null; // Nenhum pneu no estoque
    }

    const pneuId = candidates[0].id;

    // 2. Atualizar o pneu encontrado
    return await pneusModel.assignFromStock(pneuId, updates);
  },
};
