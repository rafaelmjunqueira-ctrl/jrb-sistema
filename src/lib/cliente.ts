import "server-only";

import { tokenInterno } from "./coleta";

// Empresa em foco na área do cliente (?c=), entre as que o usuário pode ver
export async function empresaAtual(sb: any, c?: string) {
  const { data: empresas } = await sb.from("clientes").select("id,nome,tipo,documento").eq("ativo", true).order("nome");
  const atual = (empresas ?? []).find((e: any) => e.id === c) ?? empresas?.[0] ?? null;
  return { empresas: (empresas ?? []) as { id: string; nome: string; tipo: string; documento: string | null }[], atual };
}

export const lista = (v?: string | string[]) => (v == null ? [] : (Array.isArray(v) ? v : [v]).filter(Boolean));

// Dispara a coleta de editais (rota protegida por token interno)
export async function dispararColeta(nova = false) {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!prod || !process.env.SUPABASE_SECRET_KEY) return false;
  try {
    const r = await fetch(`https://${prod}/api/coleta${nova ? "?nova=1" : ""}`, { method: "POST", headers: { "x-coleta-token": tokenInterno() }, cache: "no-store" });
    return r.ok;
  } catch { return false; }
}
