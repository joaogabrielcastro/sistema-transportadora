// backend/src/config/supabase.js
import { createClient } from "@supabase/supabase-js";
import { config } from "./index.js";

if (!config.database.url || !config.database.key) {
  throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios");
}

export const supabase = createClient(config.database.url, config.database.key);
