// backend/src/models/checklistModel.js
import { supabase } from "../config/supabase.js";

export const checklistModel = {
  // Criar um novo item de checklist
  create: async (checklistData) => {
    const { data, error } = await supabase
      .from("checklist")
      .insert([checklistData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Listar todos os itens de checklist com paginação
  getAll: async ({ page = 1, limit = 10, caminhaoId = null }) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("checklist")
      .select("*, caminhoes(placa), itens_checklist(nome_item)", {
        count: "exact",
      })
      .order("data_manutencao", { ascending: false })
      .range(from, to);

    if (caminhaoId) {
      query = query.eq("caminhao_id", caminhaoId);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count };
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
      .eq("id", id)
      .select()
      .single();
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
