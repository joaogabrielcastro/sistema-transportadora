// backend/src/models/checklistModel.js
import { supabase } from "../config/supabase.js";

export const checklistModel = {
  // Criar um novo item de checklist
  create: async (checklistData) => {
    const { data, error } = await supabase
      .from("checklist")
      .insert([checklistData]);
    if (error) throw error;
    return data;
  },

  // Listar todos os itens de checklist - REMOVA ESTA DUPLICAÇÃO
  getAll: async () => {
    const { data, error } = await supabase
      .from("checklist")
      .select("*, caminhoes(placa), itens_checklist(nome_item)");
    if (error) throw error;
    return data;
  },

  // Buscar item de checklist por ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from("checklist")
      .select("*, caminhoes(placa), itens_checklist(nome_item)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  // Listar itens de checklist de um caminhão específico
  getByCaminhaoId: async (caminhaoId) => {
    const { data, error } = await supabase
      .from("checklist")
      .select("*, itens_checklist(nome_item)")
      .eq("caminhao_id", caminhaoId);
    if (error) throw error;
    return data;
  },

  // Atualizar um item de checklist
  update: async (id, checklistData) => {
    const { data, error } = await supabase
      .from("checklist")
      .update(checklistData)
      .eq("id", id);
    if (error) throw error;
    return data;
  },

  // Deletar um item de checklist
  delete: async (id) => {
    const { data, error } = await supabase
      .from("checklist")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return data;
  },
};
