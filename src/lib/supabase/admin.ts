import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a chave secreta: só no servidor, só para criar acessos e para a coleta automática.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
