// backend/src/models/pneusModel.js
import { supabase } from "../config/supabase.js";

export const pneusModel = {
  // Criar um novo pneu
  create: async (pneuData) => {
    const { data, error } = await supabase.from("pneus").insert([pneuData]);
    if (error) throw error;
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
      .eq("id", id);
    if (error) throw error;
    return data;
  },

  // Deletar um pneu
  delete: async (id) => {
    const { data, error } = await supabase.from("pneus").delete().eq("id", id);
    if (error) throw error;
    return data;
  },
  
  getAlertaPneus: async () => {
    const { data, error } = await supabase
      .from("pneus")
      .select("id, vida_util_km, km_instalacao, caminhoes(placa, km_atual)");
    if (error) throw error;

    // Calcula o KM rodado e o percentual de vida útil
    const alertas = data.map((pneu) => {
      const kmRodado = pneu.caminhoes.km_atual - pneu.km_instalacao;
      const percentualUso = (kmRodado / pneu.vida_util_km) * 100;

      return {
        id: pneu.id,
        placa: pneu.caminhoes.placa,
        kmRodado,
        vidaUtilEstimada: pneu.vida_util_km,
        percentualUso: percentualUso.toFixed(2),
        alerta: percentualUso >= 80 ? "próximo da troca" : null,
      };
    });

    return alertas.filter((alerta) => alerta.alerta !== null);
  },
};
