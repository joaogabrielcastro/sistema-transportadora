// backend/src/models/posicoesPneusModel.js
import { supabase } from '../config/supabase.js';

export const posicoesPneusModel = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('posicoes_pneus')
      .select('*');
    if (error) throw error;
    return data;
  },
};