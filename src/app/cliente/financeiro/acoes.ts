"use server";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { notaDaCobranca } from "@/lib/asaas";

// Abre a nota fiscal da fatura (o banco confirma que a fatura é do cliente logado)
export async function verNota(f: FormData) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil) redirect("/login");
  const { data: fat } = await sb.from("faturas").select("asaas_id,nf_pdf,cliente_id").eq("id", String(f.get("id"))).maybeSingle();
  if (!fat) redirect("/cliente/financeiro");
  if (fat.nf_pdf) redirect(fat.nf_pdf);
  let url: string | null = null;
  try { url = (await notaDaCobranca(fat.asaas_id))?.pdfUrl ?? null; } catch {}
  redirect(url ?? `/cliente/financeiro?c=${fat.cliente_id}&nf=pendente`);
}
