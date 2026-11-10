"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";

// O banco confere que o documento é de uma empresa que o usuário pode ver.
export async function baixarDocumento(f: FormData) {
  const { sb, perfil } = await usuarioAtual(); if (!perfil) redirect("/login");
  const { data: d } = await sb.from("documentos").select("arquivo_path,cliente_id").eq("id", String(f.get("id"))).maybeSingle();
  if (!d?.arquivo_path) redirect("/cliente/documentos");
  const { data } = await sb.storage.from("documentos").createSignedUrl(d.arquivo_path, 300, { download: false });
  redirect(data?.signedUrl ?? `/cliente/documentos?c=${d.cliente_id}`);
}

export async function atualizarDocumento(f: FormData) {
  const { sb, perfil } = await usuarioAtual(); if (!perfil) redirect("/login");
  const id = String(f.get("id"));
  await sb.from("documentos").update({
    nome: String(f.get("nome") || "").slice(0, 200) || undefined, categoria: String(f.get("categoria")), validade: String(f.get("validade") || "") || null,
  }).eq("id", id);
  revalidatePath("/cliente/documentos");
}

export async function apagarDocumento(f: FormData) {
  const { sb, perfil } = await usuarioAtual(); if (!perfil) redirect("/login");
  const { data: d } = await sb.from("documentos").select("arquivo_path").eq("id", String(f.get("id"))).maybeSingle();
  const { error } = await sb.from("documentos").delete().eq("id", String(f.get("id")));
  if (!error && d?.arquivo_path) await sb.storage.from("documentos").remove([d.arquivo_path]);
  revalidatePath("/cliente/documentos");
}
