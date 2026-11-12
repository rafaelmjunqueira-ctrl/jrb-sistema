"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";

// O banco (RLS) só aceita gravações para empresas às quais o usuário tem acesso.
const voltaSegura = (v: FormDataEntryValue | null, padrao: string) => { const s = String(v ?? ""); return s.startsWith("/") && !s.startsWith("//") ? s : padrao; };
const termos = (v: FormDataEntryValue | null) => String(v ?? "").split(/[\n,;]+/).map((t) => t.trim()).filter((t) => t.length > 1).slice(0, 30);

export async function alternarAcompanhamento(f: FormData) {
  const { sb, perfil } = await usuarioAtual(); if (!perfil) redirect("/login");
  const cid = String(f.get("cliente_id")), eid = String(f.get("edital_id"));
  const { data: ja } = await sb.from("edital_acompanhamentos").select("id").eq("cliente_id", cid).eq("edital_id", eid).maybeSingle();
  if (ja) await sb.from("edital_acompanhamentos").delete().eq("id", ja.id);
  else await sb.from("edital_acompanhamentos").insert({ cliente_id: cid, edital_id: eid });
  revalidatePath("/cliente/licitacoes", "layout"); revalidatePath("/escritorio/licitacoes", "layout");
  redirect(voltaSegura(f.get("volta"), `/cliente/licitacoes?c=${cid}`));
}

export async function atualizarAcompanhamento(f: FormData) {
  const { sb, perfil } = await usuarioAtual(); if (!perfil) redirect("/login");
  const cid = String(f.get("cliente_id")), eid = String(f.get("edital_id"));
  const dados: Record<string, string> = {};
  if (f.has("status")) dados.status = String(f.get("status"));
  if (f.has("nota")) dados.nota = String(f.get("nota")).slice(0, 4000);
  await sb.from("edital_acompanhamentos").upsert({ cliente_id: cid, edital_id: eid, ...dados }, { onConflict: "cliente_id,edital_id" });
  revalidatePath("/cliente/licitacoes", "layout");
  redirect(voltaSegura(f.get("volta"), `/cliente/licitacoes/acompanhando?c=${cid}`));
}

export async function salvarPreferencias(f: FormData) {
  const { sb, perfil } = await usuarioAtual(); if (!perfil) redirect("/login");
  const cid = String(f.get("cliente_id"));
  const num = (k: string) => { const v = String(f.get(k) ?? "").replace(/\./g, "").replace(",", "."); return v && !isNaN(+v) ? +v : null; };
  await sb.from("licitacao_preferencias").upsert({
    cliente_id: cid, areas: f.getAll("area").map(String), ufs: f.getAll("uf").map(String), modalidades: f.getAll("mod").map(Number),
    palavras: termos(f.get("palavras")), excluir: termos(f.get("excluir")), valor_min: num("vmin"), valor_max: num("vmax"),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "cliente_id" });
  revalidatePath("/cliente/licitacoes", "layout");
  redirect(`/cliente/licitacoes?c=${cid}&modo=pref&salvo=1`);
}
