import { supabase } from "../config/supabase.js";

export const gastosModel = {
  // CORREÇÃO: Adicionado .select() para retornar o registo criado
  create: async (gastoData) => {
    const { data, error } = await supabase
      .from("gastos")
      .insert([gastoData])
      .select(); // <--- Esta linha resolve o erro

    if (error) throw error;
    return data;
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("gastos")
      .select("*, caminhoes(placa), tipos_gastos(nome_tipo)");
    if (error) throw error;
    return data;
  },

getById: async (id) => {
    const { data, error } = await supabase
      .from("gastos")
      // Adicionado para ir buscar os dados relacionados
      .select("*, caminhoes(placa), tipos_gastos(nome_tipo)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  
  getByCaminhaoId: async (caminhaoId) => {
    const { data, error } = await supabase
      .from("gastos")
      .select("*, tipos_gastos(nome_tipo)") // Também adicionei o join aqui para consistência
      .eq("caminhao_id", caminhaoId);
    if (error) throw error;
    return data;
  },

  update: async (id, gastoData) => {
    const { data, error } = await supabase
      .from("gastos")
      .update(gastoData)
      .eq("id", id)
      .select("*, caminhoes(placa), tipos_gastos(nome_tipo)");
    if (error) throw error;
    return data;
  },

delete: async (id) => {
    const { data, error } = await supabase
      .from("gastos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return data;
  },

  // FUNÇÃO CORRIGIDA
  getConsumoCombustivel: async (id) => {
    // IMPORTANTE: Confirme que '9' é o ID correto para "Combustível" na sua tabela 'tipos_gastos'
    const ID_TIPO_GASTO_COMBUSTIVEL = 9;

    const { data, error } = await supabase
      .from("gastos")
      .select("km_registro, quantidade_combustivel")
      .eq("caminhao_id", id)
      .eq("tipo_gasto_id", ID_TIPO_GASTO_COMBUSTIVEL) // Filtra apenas por combustível
      .not("km_registro", "is", null) // Garante que os registos têm KM
      .not("quantidade_combustivel", "is", null) // Garante que os registos têm litros
      .order("km_registro", { ascending: false }); // Ordena pelo KM (mais seguro)

    if (error) throw error;
    return data;
  },
};

