"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarEmail, modelo, emailAtivo, escaparHtml } from "@/lib/email";
import { enderecoSite } from "@/lib/site";

// Pedido de nova senha. A resposta é sempre a mesma, exista ou não a conta (não revela quem é cliente).
export async function pedirNovaSenha(f: FormData) {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/login/esqueci?erro=email");
  const admin = supabaseAdmin();
  if (!admin) redirect("/login/esqueci?enviado=escritorio");
  const { data: perfil } = await admin!.from("perfis").select("id,nome").eq("email", email).maybeSingle();
  let enviado = false;
  if (perfil && emailAtivo()) {
    const { data } = await admin!.auth.admin.generateLink({ type: "recovery", email });
    const hash = data?.properties?.hashed_token;
    if (hash) {
      const url = `${enderecoSite()}/login/redefinir?t=${encodeURIComponent(hash)}`;
      enviado = await enviarEmail(email, "Criar nova senha do painel JRB", modelo(`Olá, ${escaparHtml((perfil.nome ?? "").split(" ")[0] || "tudo bem")}`, [
        "Recebemos um pedido para criar uma nova senha do seu acesso ao painel da JRB Advogados.",
        "Clique no botão abaixo e escolha a nova senha. O link vale por 1 hora e só funciona uma vez.",
        "Se você não pediu, pode ignorar este e-mail: sua senha atual continua valendo.",
      ], { texto: "Criar nova senha", url }));
    }
  }
  // Fica registrado para o escritório (em "Acessos e senhas"), inclusive quando o e-mail não saiu
  await admin!.from("auditoria").insert({ usuario: perfil?.id ?? null, acao: "senha_pedido", tabela: "perfis", detalhe: { email, enviado, conta: Boolean(perfil) } });
  redirect(`/login/esqueci?enviado=${emailAtivo() ? "email" : "escritorio"}`);
}
