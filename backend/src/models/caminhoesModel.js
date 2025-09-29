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
    const { data, error } = await supabase
      .from("caminhoes")
      .select("*")
      .order("placa");
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

  // Lógica para deletar um caminhão por placa (versão simplificada para debug)
  delete: async (placa) => {
    try {
      console.log("=== INICIANDO DELETE ===");
      console.log("Placa recebida:", placa);
      
      // Verificar se o caminhão existe antes de tentar deletar
      const { data: caminhaoExistente, error: errorBusca } = await supabase
        .from("caminhoes")
        .select("*")
        .eq("placa", placa)
        .maybeSingle();

      console.log("Resultado da busca:", { caminhaoExistente, errorBusca });

      if (errorBusca) {
        console.error("Erro ao buscar caminhão:", errorBusca);
        throw new Error("Erro ao buscar caminhão: " + errorBusca.message);
      }

      if (!caminhaoExistente) {
        console.log("Caminhão não encontrado");
        throw new Error("Caminhão não encontrado");
      }

      console.log("Caminhão encontrado, tentando deletar...");
      
      // Tentar deletar
      const { data, error } = await supabase
        .from("caminhoes")
        .delete()
        .eq("placa", placa);

      console.log("Resultado do delete:", { data, error });

      if (error) {
        console.error("Erro detalhado do Supabase:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Verificar se é erro de foreign key
        if (error.code === "23503" || error.message.includes("foreign key") || error.message.includes("violates")) {
          throw new Error(
            "Não é possível excluir o caminhão pois existem registros vinculados (gastos, checklists ou pneus). " +
            "Exclua primeiro todos os registros relacionados ou use a opção de exclusão em cascata."
          );
        }
        
        throw new Error("Erro ao deletar caminhão: " + error.message);
      }

      console.log("=== DELETE CONCLUÍDO COM SUCESSO ===");
      return data;
    } catch (error) {
      console.error("=== ERRO NA FUNÇÃO DELETE ===");
      console.error("Tipo do erro:", typeof error);
      console.error("Nome do erro:", error.name);
      console.error("Mensagem do erro:", error.message);
      console.error("Stack trace:", error.stack);
      throw error;
    }
  },

  // Função para deletar caminhão com todos os registros relacionados (CASCADE)
  deleteWithCascade: async (placa) => {
    try {
      console.log("Iniciando delete com cascata para placa:", placa);

      // Primeiro, buscar o ID do caminhão pela placa
      const { data: caminhao, error: caminhaoError } = await supabase
        .from("caminhoes")
        .select("id")
        .eq("placa", placa)
        .maybeSingle();

      if (caminhaoError) {
        console.error("Erro ao buscar caminhão:", caminhaoError);
        throw new Error("Erro ao buscar caminhão: " + caminhaoError.message);
      }

      if (!caminhao) {
        throw new Error("Caminhão não encontrado");
      }

      const caminhaoId = caminhao.id;
      console.log("ID do caminhão encontrado:", caminhaoId);

      // Deletar registros relacionados um por vez para melhor controle de erro
      try {
        console.log("Deletando gastos...");
        await supabase.from("gastos").delete().eq("caminhao_id", caminhaoId);

        console.log("Deletando checklists...");
        await supabase.from("checklist").delete().eq("caminhao_id", caminhaoId);

        console.log("Deletando pneus...");
        await supabase.from("pneus").delete().eq("caminhao_id", caminhaoId);
      } catch (relatedError) {
        console.error("Erro ao deletar registros relacionados:", relatedError);
        // Continua mesmo com erro nos relacionados
      }

      // Finalmente, deletar o caminhão
      console.log("Deletando caminhão...");
      const { data, error } = await supabase
        .from("caminhoes")
        .delete()
        .eq("placa", placa);

      if (error) {
        console.error("Erro ao deletar caminhão:", error);
        throw new Error("Erro ao deletar caminhão: " + error.message);
      }

      console.log("Caminhão e registros relacionados deletados com sucesso");
      return data;
    } catch (error) {
      console.error("Erro na função deleteWithCascade:", error);
      throw error;
    }
  },
};
