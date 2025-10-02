// backend/src/models/caminhoesModel.js
import { supabase } from "../config/supabase.js";

export const caminhoesModel = {
  // Verificar se carreta/cavalo já existem
  checkCarretaCavaloExists: async (numero_carreta_1, numero_carreta_2, numero_cavalo) => {
    console.log('🔎 EXECUTANDO VALIDAÇÃO - Parâmetros:', {
      numero_carreta_1,
      numero_carreta_2, 
      numero_cavalo
    });

    let conditions = [];
    
    if (numero_carreta_1 && numero_carreta_1 !== '') {
      conditions.push(`numero_carreta_1.eq.${numero_carreta_1}`);
      conditions.push(`numero_carreta_2.eq.${numero_carreta_1}`);
    }

    if (numero_carreta_2 && numero_carreta_2 !== '') {
      conditions.push(`numero_carreta_1.eq.${numero_carreta_2}`);
      conditions.push(`numero_carreta_2.eq.${numero_carreta_2}`);
    }

    if (numero_cavalo && numero_cavalo !== '') {
      conditions.push(`numero_cavalo.eq.${numero_cavalo}`);
    }

    console.log('🔄 Condições da query:', conditions);

    if (conditions.length === 0) {
      console.log('➡️ Nenhuma condição - retornando array vazio');
      return [];
    }

    const query = supabase
      .from("caminhoes")
      .select("placa, numero_carreta_1, numero_carreta_2, numero_cavalo")
      .or(conditions.join(','));

    console.log('📡 Executando query no Supabase...');
    const { data, error } = await query;

    if (error) {
      console.log('❌ Erro na query:', error);
      throw error;
    }

    console.log('✅ Resultado da query:', data);
    return data || [];
  },

  // Lógica para criar um caminhão com validação de duplicação
  create: async (caminhaoData) => {
    console.log('🚨 INICIANDO CREATE - Dados recebidos:', caminhaoData);
    
    const { numero_carreta_1, numero_carreta_2, numero_cavalo } = caminhaoData;
    console.log('🔍 Valores para validação:', { 
      numero_carreta_1, 
      numero_carreta_2, 
      numero_cavalo 
    });

    // Verificar se já existem carretas/cavalo com esses números
    console.log('📞 Chamando checkCarretaCavaloExists...');
    const existentes = await caminhoesModel.checkCarretaCavaloExists(
      numero_carreta_1, 
      numero_carreta_2, 
      numero_cavalo
    );

    console.log('📊 Registros existentes encontrados:', existentes);

    if (existentes.length > 0) {
      console.log('❌ CONFLITO ENCONTRADO - Gerando erros...');
      const erros = [];
      
      existentes.forEach(item => {
        if (item.numero_carreta_1 == numero_carreta_1 && numero_carreta_1 && numero_carreta_1 !== '') {
          erros.push(`Carreta 1 (${numero_carreta_1}) já está em uso no caminhão ${item.placa}`);
        }
        if (item.numero_carreta_2 == numero_carreta_1 && numero_carreta_1 && numero_carreta_1 !== '') {
          erros.push(`Carreta 1 (${numero_carreta_1}) já está cadastrada como Carreta 2 no caminhão ${item.placa}`);
        }
        if (item.numero_carreta_1 == numero_carreta_2 && numero_carreta_2 && numero_carreta_2 !== '') {
          erros.push(`Carreta 2 (${numero_carreta_2}) já está cadastrada como Carreta 1 no caminhão ${item.placa}`);
        }
        if (item.numero_carreta_2 == numero_carreta_2 && numero_carreta_2 && numero_carreta_2 !== '') {
          erros.push(`Carreta 2 (${numero_carreta_2}) já está em uso no caminhão ${item.placa}`);
        }
        if (item.numero_cavalo == numero_cavalo && numero_cavalo && numero_cavalo !== '') {
          erros.push(`Cavalo (${numero_cavalo}) já está em uso no caminhão ${item.placa}`);
        }
      });

      console.log('🚫 Erros gerados:', erros);
      
      if (erros.length > 0) {
        throw new Error(erros.join('; '));
      }
    } else {
      console.log('✅ Nenhum conflito encontrado - Prosseguindo com inserção...');
    }

    // Se não houver conflitos, inserir normalmente
    console.log('💾 Inserindo no banco...');
    const { data, error } = await supabase
      .from("caminhoes")
      .insert([caminhaoData])
      .select();

    if (error) {
      console.log('💥 Erro na inserção:', error);
      throw error;
    }

    console.log('🎉 Inserção realizada com sucesso:', data[0]);
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

  // Lógica para atualizar um caminhão por placa com validação
  update: async (placa, caminhaoData) => {
    console.log('🔄 INICIANDO UPDATE - Placa:', placa, 'Dados:', caminhaoData);
    
    const { numero_carreta_1, numero_carreta_2, numero_cavalo } = caminhaoData;

    // Verificar conflitos (excluindo o próprio registro)
    const existentes = await caminhoesModel.checkCarretaCavaloExists(
      numero_carreta_1, 
      numero_carreta_2, 
      numero_cavalo
    );

    // Filtrar para remover o próprio caminhão da verificação
    const conflitos = existentes.filter(item => item.placa !== placa);

    if (conflitos.length > 0) {
      console.log('❌ CONFLITO ENCONTRADO NO UPDATE');
      const erros = [];
      
      conflitos.forEach(item => {
        if (item.numero_carreta_1 == numero_carreta_1 && numero_carreta_1 && numero_carreta_1 !== '') {
          erros.push(`Carreta 1 (${numero_carreta_1}) já está em uso no caminhão ${item.placa}`);
        }
        if (item.numero_carreta_2 == numero_carreta_1 && numero_carreta_1 && numero_carreta_1 !== '') {
          erros.push(`Carreta 1 (${numero_carreta_1}) já está cadastrada como Carreta 2 no caminhão ${item.placa}`);
        }
        if (item.numero_carreta_1 == numero_carreta_2 && numero_carreta_2 && numero_carreta_2 !== '') {
          erros.push(`Carreta 2 (${numero_carreta_2}) já está cadastrada como Carreta 1 no caminhão ${item.placa}`);
        }
        if (item.numero_carreta_2 == numero_carreta_2 && numero_carreta_2 && numero_carreta_2 !== '') {
          erros.push(`Carreta 2 (${numero_carreta_2}) já está em uso no caminhão ${item.placa}`);
        }
        if (item.numero_cavalo == numero_cavalo && numero_cavalo && numero_cavalo !== '') {
          erros.push(`Cavalo (${numero_cavalo}) já está em uso no caminhão ${item.placa}`);
        }
      });

      if (erros.length > 0) {
        throw new Error(erros.join('; '));
      }
    }

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

  // Verificar dependências antes de excluir
  checkDependencies: async (placa) => {
    try {
      // Buscar o caminhão pelo ID (precisamos do ID para as relações)
      const { data: caminhao, error: caminhaoError } = await supabase
        .from("caminhoes")
        .select("id")
        .eq("placa", placa)
        .maybeSingle();

      if (caminhaoError) throw caminhaoError;
      if (!caminhao) throw new Error("Caminhão não encontrado");

      const caminhaoId = caminhao.id;

      // Verificar em cada tabela relacionada
      const [gastosResult, checklistsResult, pneusResult] = await Promise.all([
        supabase.from("gastos").select("id").eq("caminhao_id", caminhaoId),
        supabase.from("checklist").select("id").eq("caminhao_id", caminhaoId),
        supabase.from("pneus").select("id").eq("caminhao_id", caminhaoId)
      ]);

      const dependencias = {
        detalhes: {
          gastos: gastosResult.data?.length || 0,
          checklists: checklistsResult.data?.length || 0,
          pneus: pneusResult.data?.length || 0
        },
        total: (gastosResult.data?.length || 0) + 
               (checklistsResult.data?.length || 0) + 
               (pneusResult.data?.length || 0)
      };

      return dependencias;
    } catch (error) {
      console.error("Erro ao verificar dependências:", error);
      throw error;
    }
  },

  // Lógica para deletar um caminhão por placa
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
          code: error.code,
        });

        // Verificar se é erro de foreign key
        if (
          error.code === "23503" ||
          error.message.includes("foreign key") ||
          error.message.includes("violates")
        ) {
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