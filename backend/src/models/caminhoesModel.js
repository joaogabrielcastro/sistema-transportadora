// backend/src/models/caminhoesModel.js
import { supabase } from "../config/supabase.js";

export const caminhoesModel = {
  // Lógica para criar um caminhão
  create: async (caminhaoData) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .insert([caminhaoData])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Lógica para buscar todos os caminhões
  getAll: async () => {
    const { data, error } = await supabase.from("caminhoes").select("*").order("placa");
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
      .eq("placa", placa)
      .select();

    if (error) throw error;
    return data[0];
  },

  updateById: async (id, caminhaoData) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .update(caminhaoData)
      .eq("id", id)
      .select();
      
    if (error) throw error;
    return data[0];
  },

  // Lógica para deletar um caminhão por placa
  delete: async (placa) => {
    try {
      // Primeiro, buscar o ID do caminhão pela placa
      const { data: caminhao, error: caminhaoError } = await supabase
        .from("caminhoes")
        .select("id")
        .eq("placa", placa)
        .single();

      if (caminhaoError || !caminhao) {
        throw new Error("Caminhão não encontrado");
      }

      const caminhaoId = caminhao.id;

      // Verificar se existem registros relacionados
      const [gastosResult, checklistResult, pneusResult] = await Promise.all([
        supabase.from("gastos").select("id").eq("caminhao_id", caminhaoId),
        supabase.from("checklist").select("id").eq("caminhao_id", caminhaoId),
        supabase.from("pneus").select("id").eq("caminhao_id", caminhaoId)
      ]);

      const temGastos = gastosResult.data && gastosResult.data.length > 0;
      const temChecklist = checklistResult.data && checklistResult.data.length > 0;
      const temPneus = pneusResult.data && pneusResult.data.length > 0;

      if (temGastos || temChecklist || temPneus) {
        const registrosVinculados = [];
        if (temGastos) registrosVinculados.push(`${gastosResult.data.length} gastos`);
        if (temChecklist) registrosVinculados.push(`${checklistResult.data.length} checklists`);
        if (temPneus) registrosVinculados.push(`${pneusResult.data.length} pneus`);
        
        throw new Error(
          `Não é possível excluir o caminhão pois existem registros vinculados: ${registrosVinculados.join(", ")}. ` +
          "Exclua primeiro todos os registros relacionados ou use a opção de exclusão em cascata."
        );
      }

      // Se não há registros relacionados, pode deletar
      const { data, error } = await supabase
        .from("caminhoes")
        .delete()
        .eq("placa", placa);
        
      if (error) throw error;
      return data;
      
    } catch (error) {
      throw error;
    }
  },

  // Função para deletar caminhão com todos os registros relacionados (CASCADE)
  deleteWithCascade: async (placa) => {
    try {
      // Primeiro, buscar o ID do caminhão pela placa
      const { data: caminhao, error: caminhaoError } = await supabase
        .from("caminhoes")
        .select("id")
        .eq("placa", placa)
        .single();

      if (caminhaoError || !caminhao) {
        throw new Error("Caminhão não encontrado");
      }

      const caminhaoId = caminhao.id;

      // Deletar registros relacionados em ordem
      await Promise.all([
        supabase.from("gastos").delete().eq("caminhao_id", caminhaoId),
        supabase.from("checklist").delete().eq("caminhao_id", caminhaoId),
        supabase.from("pneus").delete().eq("caminhao_id", caminhaoId)
      ]);

      // Finalmente, deletar o caminhão
      const { data, error } = await supabase
        .from("caminhoes")
        .delete()
        .eq("placa", placa);
        
      if (error) throw error;
      return data;
      
    } catch (error) {
      throw error;
    }
  },
};