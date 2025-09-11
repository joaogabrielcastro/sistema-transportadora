// backend/src/models/caminhoesModel.js
import { supabase } from "../config/supabase.js";

export const caminhoesModel = {
  // Lógica para criar um caminhão
  create: async (caminhaoData) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .insert([caminhaoData]);
    if (error) throw error;
    return data;
  },

  // Lógica para buscar todos os caminhões
  getAll: async () => {
    const { data, error } = await supabase.from("caminhoes").select("*");
    if (error) throw error;
    return data;
  },

  // Lógica para buscar um caminhão por placa
  getByPlaca: async (placa) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .select("*")
      .eq("placa", placa)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Lógica para atualizar um caminhão por placa
  update: async (placa, caminhaoData) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .update(caminhaoData)
      .eq("placa", placa);
    if (error) throw error;
    return data;
  },

  updateById: async (id, caminhaoData) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .update(caminhaoData)
      .eq("id", id);
    if (error) throw error;
    return data;
  },

  // Lógica para deletar um caminhão por placa
  delete: async (placa) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .delete()
      .eq("placa", placa);
    if (error) throw error;
    return data;
  },
};
