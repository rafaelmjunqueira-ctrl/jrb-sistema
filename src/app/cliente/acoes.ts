"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

// O banco (RLS) garante que o cliente só grava para empresas às quais tem acesso.

export async function enviarIntimacao(form: FormData) {
  const sb = supabaseServer();
  const cid = String(form.get("cliente_id"));
  const obs = String(form.get("observacao") || "");
  const arq = form.get("arquivo") as File | null;
  let path: string | null = null;
  if (arq && arq.size > 0) {
    if (arq.size > 15 * 1024 * 1024) throw new Error("Arquivo acima de 15 MB.");
    const nome = arq.name.normalize("NFD").replace(/[^\w.\-]/g, "_");
    path = `${cid}/intimacoes/${Date.now()}_${nome}`;
    const { error } = await sb.storage.from("documentos").upload(path, arq, { contentType: arq.type });
    if (error) throw new Error("Falha no envio do arquivo.");
  }
  const { error } = await sb.from("intimacoes_enviadas").insert({ cliente_id: cid, observacao: obs, arquivo_path: path });
  if (error) throw new Error("Não foi possível registrar o envio.");
  revalidatePath("/cliente");
}

export async function abrirChamado(form: FormData) {
  const sb = supabaseServer();
  const { error } = await sb.from("chamados").insert({
    cliente_id: String(form.get("cliente_id")),
    tipo: String(form.get("tipo")),
    titulo: String(form.get("titulo")),
    descricao: String(form.get("descricao") || ""),
    referencia: String(form.get("referencia") || "") || null,
    prazo_cliente: String(form.get("prazo") || "") || null,
  });
  if (error) throw new Error("Não foi possível abrir o chamado.");
  revalidatePath("/cliente");
}
