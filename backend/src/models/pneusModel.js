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
        "*, caminhoes(placa), posicoes_pneus(nome_posicao), status_pneus(nome_status)"
      );
    if (error) throw error;
    return data;
  },

  // Buscar pneu por ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from("pneus")
      .select(
        "*, caminhoes(placa), posicoes_pneus(nome_posicao), status_pneus(nome_status)"
      )
      .eq("id", id)
      .single();
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
};
