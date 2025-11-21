// backend/src/models/statusPneusModel.js
import { supabase } from '../config/supabase.js';

export const statusPneusModel = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('status_pneus')
      .select('*');
    if (error) throw error;
    return data;
  },
};