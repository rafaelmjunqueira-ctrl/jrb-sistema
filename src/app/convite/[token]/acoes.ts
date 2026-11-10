"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { docValido } from "@/lib/documentos";

// Aceite do convite: cria o usuário, liga às empresas, completa o cadastro e já entra no sistema
export async function aceitarConvite(f: FormData) {
  const token = String(f.get("token"));
  const volta = (erro: string) => redirect(`/convite/${encodeURIComponent(token)}?erro=${erro}`);
  const admin = supabaseAdmin(); if (!admin) volta("servidor");
  const { data: cv } = await admin!.from("convites").select("*").eq("token", token).maybeSingle();
  if (!cv || cv.usado_em || new Date(cv.expira_em) < new Date()) volta("invalido");

  const nome = String(f.get("nome") ?? "").trim(), email = String(f.get("email") ?? "").trim().toLowerCase();
  const telefone = String(f.get("telefone") ?? "").trim(), senha = String(f.get("senha") ?? ""), senha2 = String(f.get("senha2") ?? "");
  if (nome.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) volta("dados");
  if (senha.length < 10) volta("senha-curta");
  if (senha !== senha2) volta("senha-diferente");
  if (f.get("aceite") !== "on") volta("aceite");

  // Dados das empresas que estavam faltando
  const { data: cls } = await admin!.from("clientes").select("id,documento,tipo").in("id", cv!.cliente_ids);
  for (const c of cls ?? []) {
    const doc = String(f.get(`doc_${c.id}`) ?? "").replace(/\D/g, "");
    if (!c.documento && doc && !docValido(doc)) volta("documento");
  }

  const { data: criado, error } = await admin!.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
  if (error || !criado.user) volta(/already|registered|exists/i.test(error?.message ?? "") ? "email-existe" : "criar");
  const uid = criado!.user!.id;

  await admin!.from("perfis").update({ nome, telefone: telefone || null }).eq("id", uid);
  await admin!.from("cliente_membros").upsert(cv!.cliente_ids.map((cid: string) => ({ cliente_id: cid, usuario_id: uid })));
  for (const c of cls ?? []) {
    const doc = String(f.get(`doc_${c.id}`) ?? "").replace(/\D/g, "");
    const end = String(f.get(`end_${c.id}`) ?? "").trim();
    const dados: Record<string, unknown> = { cadastro_completo: true };
    if (!c.documento && doc) { dados.documento = doc; dados.tipo = doc.length === 11 ? "PF" : "PJ"; }
    if (end) dados.endereco = end;
    await admin!.from("clientes").update(dados).eq("id", c.id);
  }
  await admin!.from("convites").update({ usado_em: new Date().toISOString(), usado_por: uid }).eq("token", token);
  await admin!.from("auditoria").insert({ usuario: uid, acao: "convite_aceito", tabela: "convites", detalhe: { empresas: cv!.cliente_ids.length } });

  await supabaseServer().auth.signInWithPassword({ email, password: senha });
  redirect("/cliente?bemvindo=1");
}
