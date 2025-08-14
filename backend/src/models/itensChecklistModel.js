// backend/src/models/itensChecklistModel.js
import { supabase } from '../config/supabase.js';

export const itensChecklistModel = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('itens_checklist')
      .select('*');
    if (error) throw error;
    return data;
  },
};