"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { usuarioAtual } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarEmail, modelo, escaparHtml } from "@/lib/email";
import { enderecoSite } from "@/lib/site";

const AQUI = "/escritorio/acessos";
async function equipe() {
  const ctx = await usuarioAtual();
  if (!ctx.perfil || ctx.perfil.papel === "cliente") redirect("/login");
  const admin = supabaseAdmin();
  if (!admin) redirect(`${AQUI}?erro=chave`);
  return { ...ctx, admin: admin! };
}
const volta = (u: string, extra = "") => { revalidatePath(AQUI); redirect(`${AQUI}?u=${u}${extra}`); };
async function log(admin: any, quem: string, acao: string, alvo: string, detalhe?: object) {
  await admin.from("auditoria").insert({ usuario: quem, acao, tabela: "perfis", registro: alvo, detalhe: detalhe ?? null });
}

// Senha provisória: aparece uma vez na tela (cookie de 2 minutos) para o escritório repassar ao cliente
export async function senhaProvisoria(f: FormData) {
  const { admin, user } = await equipe();
  const u = String(f.get("u"));
  const senha = randomBytes(9).toString("base64url");
  const { error } = await admin.auth.admin.updateUserById(u, { password: senha, email_confirm: true, ban_duration: "none" });
  if (error) volta(u, "&erro=senha");
  await log(admin, user!.id, "senha_provisoria", u);
  cookies().set("senha_prov", JSON.stringify({ u, senha }), { httpOnly: true, secure: true, sameSite: "strict", maxAge: 120, path: AQUI });
  volta(u);
}

export async function linkNovaSenha(f: FormData) {
  const { admin, user } = await equipe();
  const u = String(f.get("u"));
  const { data: p } = await admin.from("perfis").select("nome,email").eq("id", u).single();
  const { data } = await admin.auth.admin.generateLink({ type: "recovery", email: p!.email });
  const hash = data?.properties?.hashed_token;
  const ok = hash ? await enviarEmail(p!.email, "Criar nova senha do painel JRB", modelo(`Olá, ${escaparHtml((p!.nome ?? "").split(" ")[0])}`, [
    "A JRB Advogados liberou para você a criação de uma nova senha do painel.",
    "Clique no botão e escolha a senha. O link vale por 1 hora e só funciona uma vez.",
  ], { texto: "Criar nova senha", url: `${enderecoSite()}/login/redefinir?t=${encodeURIComponent(hash)}` })) : false;
  await log(admin, user!.id, "senha_link_enviado", u, { ok });
  volta(u, ok ? "&ok=link" : "&erro=email");
}

export async function liberarEmpresa(f: FormData) {
  const { admin, user } = await equipe();
  const u = String(f.get("u")), cid = String(f.get("cliente_id") ?? "");
  if (!cid) volta(u);
  const ids = f.get("grupo_todo") === "on"
    ? await (async () => {
        const { data: c } = await admin.from("clientes").select("grupo").eq("id", cid).single();
        if (!c?.grupo) return [cid];
        return ((await admin.from("clientes").select("id").eq("grupo", c.grupo).eq("ativo", true)).data ?? []).map((x: any) => x.id as string);
      })()
    : [cid];
  await admin.from("cliente_membros").upsert(ids.map((id) => ({ cliente_id: id, usuario_id: u })));
  await log(admin, user!.id, "empresa_liberada", u, { empresas: ids.length });
  volta(u, "&ok=empresa");
}

export async function tirarEmpresa(f: FormData) {
  const { admin } = await equipe();
  const u = String(f.get("u"));
  await admin.from("cliente_membros").delete().eq("usuario_id", u).eq("cliente_id", String(f.get("cliente_id")));
  volta(u);
}

// Só sócio muda o papel (cliente, funcionário, sócio) e bloqueia/desbloqueia
export async function mudarPapel(f: FormData) {
  const { admin, user, perfil } = await equipe();
  const u = String(f.get("u")), papel = String(f.get("papel"));
  if (perfil!.papel !== "socio" || !["cliente", "funcionario", "socio"].includes(papel)) volta(u, "&erro=socio");
  if (u === user!.id && papel !== "socio") volta(u, "&erro=proprio");
  await admin.from("perfis").update({ papel }).eq("id", u);
  await log(admin, user!.id, "papel_alterado", u, { papel });
  volta(u, "&ok=papel");
}

export async function bloquear(f: FormData) {
  const { admin, user, perfil } = await equipe();
  const u = String(f.get("u")), ativo = f.get("ativo") === "1";
  if (perfil!.papel !== "socio" || u === user!.id) volta(u, "&erro=socio");
  await admin.auth.admin.updateUserById(u, { ban_duration: ativo ? "none" : "876000h" });
  await admin.from("perfis").update({ ativo }).eq("id", u);
  await log(admin, user!.id, ativo ? "acesso_liberado" : "acesso_bloqueado", u);
  volta(u);
}
