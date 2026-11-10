"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// O link do e-mail só é "gasto" aqui, quando a pessoa envia a nova senha (antivírus que abrem links não estragam o link)
export async function definirSenha(f: FormData) {
  const t = String(f.get("t") ?? ""), senha = String(f.get("senha") ?? ""), senha2 = String(f.get("senha2") ?? "");
  const volta = (erro: string) => redirect(`/login/redefinir?t=${encodeURIComponent(t)}&erro=${erro}`);
  if (senha.length < 10) volta("curta");
  if (senha !== senha2) volta("diferente");
  const sb = supabaseServer();
  const { error } = await sb.auth.verifyOtp({ token_hash: t, type: "recovery" });
  if (error) redirect("/login/redefinir?erro=vencido");
  const { data: { user } } = await sb.auth.getUser();
  const { error: e2 } = await sb.auth.updateUser({ password: senha });
  if (e2) volta(/different|same/i.test(e2.message) ? "igual" : "falhou");
  await supabaseAdmin()?.from("auditoria").insert({ usuario: user?.id ?? null, acao: "senha_redefinida", tabela: "perfis", registro: user?.id ?? null, detalhe: { email: user?.email } });
  redirect("/");
}
