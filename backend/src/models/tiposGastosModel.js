// backend/src/models/tiposGastosModel.js
import { supabase } from '../config/supabase.js';

export const tiposGastosModel = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('tipos_gastos')
      .select('*');
    if (error) throw error;
    return data;
  },
};