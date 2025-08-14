// backend/src/models/gastosModel.js
import { supabase } from '../config/supabase.js';

export const gastosModel = {
  // Criar um novo gasto
  create: async (gastoData) => {
    const { data, error } = await supabase
      .from('gastos')
      .insert([gastoData]);
    if (error) throw error;
    return data;
  },

  // Listar todos os gastos
  getAll: async () => {
    const { data, error } = await supabase
      .from('gastos')
      .select('*, caminhoes(placa), tipos_gastos(nome_tipo)');
    if (error) throw error;
    return data;
  },

  // Buscar gasto por ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from('gastos')
      .select('*, caminhoes(placa), tipos_gastos(nome_tipo)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Listar gastos de um caminhão específico (por ID)
  getByCaminhaoId: async (caminhaoId) => {
    const { data, error } = await supabase
      .from('gastos')
      .select('*, tipos_gastos(nome_tipo)')
      .eq('caminhao_id', caminhaoId);
    if (error) throw error;
    return data;
  },

  // Atualizar um gasto
  update: async (id, gastoData) => {
    const { data, error } = await supabase
      .from('gastos')
      .update(gastoData)
      .eq('id', id);
    if (error) throw error;
    return data;
  },

  // Deletar um gasto
  delete: async (id) => {
    const { data, error } = await supabase
      .from('gastos')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return data;
  },
};