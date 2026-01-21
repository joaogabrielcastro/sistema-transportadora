// backend/src/models/caminhoesModel.js
import { supabase } from "../config/supabase.js";

export const caminhoesModel = {
  // Verificar se carreta/cavalo/placas já existem
  checkUniqueness: async (
    numero_carreta_1,
    placa_carreta_1,
    numero_carreta_2,
    placa_carreta_2,
    numero_cavalo,
  ) => {
    let conditions = [];

    // Apenas adicionar condições se o valor não for null ou undefined
    if (numero_carreta_1 != null && numero_carreta_1 !== "")
      conditions.push(
        `numero_carreta_1.eq.${numero_carreta_1}`,
        `numero_carreta_2.eq.${numero_carreta_1}`,
      );
    if (placa_carreta_1 != null && placa_carreta_1 !== "")
      conditions.push(
        `placa_carreta_1.eq.${placa_carreta_1}`,
        `placa_carreta_2.eq.${placa_carreta_1}`,
      );
    if (numero_carreta_2 != null && numero_carreta_2 !== "")
      conditions.push(
        `numero_carreta_1.eq.${numero_carreta_2}`,
        `numero_carreta_2.eq.${numero_carreta_2}`,
      );
    if (placa_carreta_2 != null && placa_carreta_2 !== "")
      conditions.push(
        `placa_carreta_1.eq.${placa_carreta_2}`,
        `placa_carreta_2.eq.${placa_carreta_2}`,
      );
    if (numero_cavalo != null && numero_cavalo !== "")
      conditions.push(`numero_cavalo.eq.${numero_cavalo}`);

    if (conditions.length === 0) return [];

    const { data, error } = await supabase
      .from("caminhoes")
      .select(
        "placa, numero_carreta_1, placa_carreta_1, numero_carreta_2, placa_carreta_2, numero_cavalo",
      )
      .or(conditions.join(","));

    if (error) throw error;
    return data || [];
  },

  // Lógica para criar um caminhão com validação de duplicação
  create: async (caminhaoData) => {
    const {
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    } = caminhaoData;

    const existentes = await caminhoesModel.checkUniqueness(
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    );

    if (existentes.length > 0) {
      const erros = new Set();
      existentes.forEach((item) => {
        // Validações cruzadas para numero_carreta_1
        if (numero_carreta_1) {
          if (item.numero_carreta_1 == numero_carreta_1)
            erros.add(
              `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
          if (item.numero_carreta_2 == numero_carreta_1)
            erros.add(
              `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validações cruzadas para placa_carreta_1
        if (placa_carreta_1) {
          if (item.placa_carreta_1 == placa_carreta_1)
            erros.add(
              `Placa de carreta ${placa_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
          if (item.placa_carreta_2 == placa_carreta_1)
            erros.add(
              `Placa de carreta ${placa_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validações cruzadas para numero_carreta_2
        if (numero_carreta_2) {
          if (item.numero_carreta_1 == numero_carreta_2)
            erros.add(
              `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
          if (item.numero_carreta_2 == numero_carreta_2)
            erros.add(
              `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validações cruzadas para placa_carreta_2
        if (placa_carreta_2) {
          if (item.placa_carreta_1 == placa_carreta_2)
            erros.add(
              `Placa de carreta ${placa_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
          if (item.placa_carreta_2 == placa_carreta_2)
            erros.add(
              `Placa de carreta ${placa_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validação para numero_cavalo
        if (numero_cavalo && item.numero_cavalo == numero_cavalo) {
          erros.add(
            `Cavalo ${numero_cavalo} já está em uso no caminhão ${item.placa}`,
          );
        }
      });

      if (erros.size > 0) {
        throw new Error(Array.from(erros).join("; "));
      }
    }

    // Campos que existem na tabela (após adicionar as colunas placa_carreta)
    const dadosParaInserir = {
      placa: caminhaoData.placa,
      km_atual: caminhaoData.km_atual,
      qtd_pneus: caminhaoData.qtd_pneus,
      motorista: caminhaoData.motorista,
      marca: caminhaoData.marca,
      modelo: caminhaoData.modelo,
      ano: caminhaoData.ano,
      numero_carreta_1: caminhaoData.numero_carreta_1,
      placa_carreta_1: caminhaoData.placa_carreta_1,
      numero_carreta_2: caminhaoData.numero_carreta_2,
      placa_carreta_2: caminhaoData.placa_carreta_2,
      numero_cavalo: caminhaoData.numero_cavalo,
    };

    console.log("📤 INSERINDO NO BANCO:", dadosParaInserir);

    const { data, error } = await supabase
      .from("caminhoes")
      .insert([dadosParaInserir])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Lógica para buscar todos os caminhões com paginação (ou sem paginação quando limit === null)
  getAll: async ({ page = 1, limit = 10, filtro = null, termo = null }) => {
    const noPagination = limit === null || limit === undefined;

    let query = supabase.from("caminhoes").select("*", { count: "exact" });

    // Lógica de filtro e busca combinada
    if (termo) {
      const termoUpper = termo.toUpperCase();
      if (filtro === "placa") {
        query = query.or(
          `placa.ilike.%${termoUpper}%`,
          `placa_carreta_1.ilike.%${termoUpper}%`,
          `placa_carreta_2.ilike.%${termoUpper}%`,
        );
      } else if (filtro === "motorista") {
        query = query.ilike("motorista", `%${termo}%`);
      } else {
        // Busca geral se nenhum filtro específico for selecionado
        query = query.or(
          `placa.ilike.%${termoUpper}%,motorista.ilike.%${termo}%,placa_carreta_1.ilike.%${termoUpper}%,placa_carreta_2.ilike.%${termoUpper}%`,
        );
      }
    }

    query = query.order("placa");

    if (!noPagination) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return { data, count };
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

  getById: async (id) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Lógica para atualizar um caminhão por placa com validação
  update: async (placa, caminhaoData) => {
    const {
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    } = caminhaoData;

    const existentes = await caminhoesModel.checkUniqueness(
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    );

    const conflitos = existentes.filter((item) => item.placa !== placa);

    if (conflitos.length > 0) {
      const erros = new Set();
      conflitos.forEach((item) => {
        // Validações cruzadas para numero_carreta_1
        if (numero_carreta_1) {
          if (item.numero_carreta_1 == numero_carreta_1)
            erros.add(
              `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
          if (item.numero_carreta_2 == numero_carreta_1)
            erros.add(
              `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validações cruzadas para placa_carreta_1
        if (placa_carreta_1) {
          if (item.placa_carreta_1 == placa_carreta_1)
            erros.add(
              `Placa de carreta ${placa_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
          if (item.placa_carreta_2 == placa_carreta_1)
            erros.add(
              `Placa de carreta ${placa_carreta_1} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validações cruzadas para numero_carreta_2
        if (numero_carreta_2) {
          if (item.numero_carreta_1 == numero_carreta_2)
            erros.add(
              `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
          if (item.numero_carreta_2 == numero_carreta_2)
            erros.add(
              `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validações cruzadas para placa_carreta_2
        if (placa_carreta_2) {
          if (item.placa_carreta_1 == placa_carreta_2)
            erros.add(
              `Placa de carreta ${placa_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
          if (item.placa_carreta_2 == placa_carreta_2)
            erros.add(
              `Placa de carreta ${placa_carreta_2} já está em uso no caminhão ${item.placa}`,
            );
        }
        // Validação para numero_cavalo
        if (numero_cavalo && item.numero_cavalo == numero_cavalo) {
          erros.add(
            `Cavalo ${numero_cavalo} já está em uso no caminhão ${item.placa}`,
          );
        }
      });

      if (erros.size > 0) {
        throw new Error(Array.from(erros).join("; "));
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
        supabase.from("pneus").select("id").eq("caminhao_id", caminhaoId),
      ]);

      const dependencias = {
        detalhes: {
          gastos: gastosResult.data?.length || 0,
          checklists: checklistsResult.data?.length || 0,
          pneus: pneusResult.data?.length || 0,
        },
        total:
          (gastosResult.data?.length || 0) +
          (checklistsResult.data?.length || 0) +
          (pneusResult.data?.length || 0),
      };

      return dependencias;
    } catch (error) {
      throw error;
    }
  },

  // Lógica para deletar um caminhão por placa
  delete: async (placa) => {
    try {
      // Iniciando processo de deleção

      // Verificar se o caminhão existe antes de tentar deletar
      const { data: caminhaoExistente, error: errorBusca } = await supabase
        .from("caminhoes")
        .select("*")
        .eq("placa", placa)
        .maybeSingle();

      if (errorBusca) {
        throw new Error("Erro ao buscar caminhão: " + errorBusca.message);
      }

      if (!caminhaoExistente) {
        throw new Error("Caminhão não encontrado");
      }

      // Tentar deletar
      const { data, error } = await supabase
        .from("caminhoes")
        .delete()
        .eq("placa", placa);

      if (error) {
        // Verificar se é erro de foreign key
        if (
          error.code === "23503" ||
          error.message.includes("foreign key") ||
          error.message.includes("violates")
        ) {
          throw new Error(
            "Não é possível excluir o caminhão pois existem registros vinculados (gastos, checklists ou pneus). " +
              "Exclua primeiro todos os registros relacionados ou use a opção de exclusão em cascata.",
          );
        }

        throw new Error("Erro ao deletar caminhão: " + error.message);
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  // Função para deletar caminhão com todos os registros relacionados (CASCADE)
  deleteWithCascade: async (placa) => {
    try {
      // Iniciando delete em cascata

      // Primeiro, buscar o ID do caminhão pela placa
      const { data: caminhao, error: caminhaoError } = await supabase
        .from("caminhoes")
        .select("id")
        .eq("placa", placa)
        .maybeSingle();

      if (caminhaoError) {
        throw new Error("Erro ao buscar caminhão: " + caminhaoError.message);
      }

      if (!caminhao) {
        throw new Error("Caminhão não encontrado");
      }

      const caminhaoId = caminhao.id;

      // Deletar registros relacionados um por vez para melhor controle de erro
      try {
        await supabase.from("gastos").delete().eq("caminhao_id", caminhaoId);
        await supabase.from("checklist").delete().eq("caminhao_id", caminhaoId);
        await supabase.from("pneus").delete().eq("caminhao_id", caminhaoId);
      } catch (relatedError) {
        // Continua mesmo com erro nos relacionados
      }

      // Finalmente, deletar o caminhão
      const { data, error } = await supabase
        .from("caminhoes")
        .delete()
        .eq("placa", placa);

      if (error) {
        throw new Error("Erro ao deletar caminhão: " + error.message);
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  // Buscar caminhões por placa ou motorista
  search: async (term) => {
    const { data, error } = await supabase
      .from("caminhoes")
      .select("*")
      .or(`placa.ilike.%${term}%,motorista.ilike.%${term}%`)
      .order("placa");

    if (error) throw error;
    return data;
  },
};
