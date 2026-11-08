"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { usuarioAtual } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Todas as ações exigem equipe; o banco (RLS) confere de novo.
async function equipe() {
  const ctx = await usuarioAtual();
  if (!ctx.perfil || ctx.perfil.papel === "cliente") redirect("/login");
  return ctx;
}
const s = (f: FormData, k: string) => { const v = f.get(k); return v === null || v === "" ? null : String(v); };

async function auditar(sb: any, acao: string, tabela: string, registro: string | null, detalhe?: object) {
  await sb.from("auditoria").insert({ acao, tabela, registro, detalhe: detalhe ?? null });
}

// ---------- Prazos ----------
export async function baixarPrazo(f: FormData) {
  const { sb, user } = await equipe();
  const id = String(f.get("id"));
  await sb.from("prazos").update({ concluido: true, concluido_por: user!.id, concluido_em: new Date().toISOString() }).eq("id", id);
  await auditar(sb, "prazo_baixado", "prazos", id);
  revalidatePath("/escritorio", "layout");
}

export async function novoPrazo(f: FormData) {
  const { sb } = await equipe();
  await sb.from("prazos").insert({ processo_id: s(f, "processo_id"), descricao: s(f, "descricao"), data_fatal: s(f, "data_fatal"), data_segura: s(f, "data_segura") });
  revalidatePath("/escritorio", "layout");
}

// ---------- Processos ----------
export async function salvarProcesso(f: FormData) {
  const { sb } = await equipe();
  const id = String(f.get("id"));
  const exp = s(f, "exposicao_estimada");
  await sb.from("processos").update({
    risco: s(f, "risco") ?? "indefinido",
    situacao: s(f, "situacao"),
    resumo_cliente: s(f, "resumo_cliente"),
    exposicao_estimada: exp ? Number(exp.replace(/\./g, "").replace(",", ".")) : null,
  }).eq("id", id);
  await sb.from("processo_notas").upsert({ processo_id: id, nota: s(f, "nota"), atualizado_em: new Date().toISOString() });
  revalidatePath(`/escritorio/processos/${id}`);
}

export async function vincularCliente(f: FormData) {
  const { sb } = await equipe();
  const pid = String(f.get("processo_id"));
  await sb.from("processo_clientes").upsert({ processo_id: pid, cliente_id: s(f, "cliente_id"), polo: s(f, "polo") });
  revalidatePath(`/escritorio/processos/${pid}`);
}

export async function desvincularCliente(f: FormData) {
  const { sb } = await equipe();
  const pid = String(f.get("processo_id"));
  await sb.from("processo_clientes").delete().eq("processo_id", pid).eq("cliente_id", String(f.get("cliente_id")));
  revalidatePath(`/escritorio/processos/${pid}`);
}

// Libera (ou oculta) um andamento para o cliente, com o resumo em linguagem simples
export async function salvarAndamento(f: FormData) {
  const { sb } = await equipe();
  const id = String(f.get("id"));
  const visivel = f.get("visivel_cliente") === "on";
  const resumo = s(f, "resumo_simples");
  await sb.from("andamentos").update({ resumo_simples: resumo, visivel_cliente: visivel }).eq("id", id);
  await auditar(sb, visivel ? "andamento_liberado" : "andamento_ocultado", "andamentos", id);
  revalidatePath(`/escritorio/processos/${String(f.get("processo_id"))}`);
}

// ---------- Intimações enviadas pelo cliente ----------
export async function triarIntimacao(f: FormData) {
  const { sb } = await equipe();
  const id = String(f.get("id"));
  await sb.from("intimacoes_enviadas").update({
    status: s(f, "status"), retorno_cliente: s(f, "retorno_cliente"),
  }).eq("id", id);
  revalidatePath("/escritorio");
}

export async function linkArquivo(f: FormData) {
  const { sb } = await equipe();
  const { data } = await sb.storage.from("documentos").createSignedUrl(String(f.get("path")), 300);
  if (data?.signedUrl) redirect(data.signedUrl);
}

// ---------- Chamados ----------
export async function atualizarChamado(f: FormData) {
  const { sb } = await equipe();
  const id = String(f.get("id"));
  await sb.from("chamados").update({ status: s(f, "status"), atualizado_em: new Date().toISOString() }).eq("id", id);
  const msg = s(f, "mensagem");
  if (msg) await sb.from("chamado_mensagens").insert({ chamado_id: id, texto: msg, interna: f.get("interna") === "on" });
  revalidatePath("/escritorio");
}

// ---------- Clientes e acessos ----------
export async function novoCliente(f: FormData) {
  const { sb } = await equipe();
  const doc = (s(f, "documento") ?? "").replace(/\D/g, "") || null;
  const { data, error } = await sb.from("clientes").insert({
    tipo: s(f, "tipo"), nome: s(f, "nome"), documento: doc, plano: s(f, "plano") ?? "beta",
  }).select("id").single();
  if (error) throw new Error(error.code === "23505" ? "Já existe cliente com esse CPF/CNPJ." : "Não foi possível cadastrar.");
  revalidatePath("/escritorio/clientes");
  redirect(`/escritorio/clientes?c=${data.id}`);
}

// Cria o acesso do cliente com senha provisória (mostrada uma única vez ao escritório)
export async function criarAcesso(f: FormData) {
  const { sb } = await equipe();
  const admin = supabaseAdmin();
  const cid = String(f.get("cliente_id"));
  if (!admin) redirect(`/escritorio/clientes?c=${cid}&erro=chave`);
  const email = String(f.get("email")).trim().toLowerCase();
  const nome = String(f.get("nome")).trim();

  // Se o e-mail já tem acesso, só vincula a esta empresa
  const { data: existente } = await sb.from("perfis").select("id").eq("email", email).maybeSingle();
  let uid = existente?.id as string | undefined;
  let senha: string | null = null;
  if (!uid) {
    senha = randomBytes(9).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
    if (error || !data.user) redirect(`/escritorio/clientes?c=${cid}&erro=criar`);
    uid = data.user.id;
  }
  await sb.from("cliente_membros").upsert({ cliente_id: cid, usuario_id: uid });
  await auditar(sb, "acesso_cliente", "cliente_membros", cid, { email });
  revalidatePath("/escritorio/clientes");
  // senha provisória vai num cookie de 2 minutos (não fica no histórico nem nos logs)
  cookies().set("acesso_novo", JSON.stringify({ email, senha }), {
    httpOnly: true, secure: true, sameSite: "strict", maxAge: 120, path: "/escritorio/clientes",
  });
  redirect(`/escritorio/clientes?c=${cid}`);
}

export async function removerAcesso(f: FormData) {
  const { sb } = await equipe();
  const cid = String(f.get("cliente_id"));
  await sb.from("cliente_membros").delete().eq("cliente_id", cid).eq("usuario_id", String(f.get("usuario_id")));
  revalidatePath("/escritorio/clientes");
  redirect(`/escritorio/clientes?c=${cid}`);
}
