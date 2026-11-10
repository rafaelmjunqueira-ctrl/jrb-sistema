"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { docValido } from "@/lib/documentos";
import { enviarEmail, modelo, escaparHtml } from "@/lib/email";
import { enderecoSite } from "@/lib/site";

// Procura uma conta pelo e-mail (perfis guarda o e-mail de todo mundo que tem acesso)
async function contaPorEmail(admin: any, email: string) {
  const { data } = await admin.from("perfis").select("id,nome,papel").eq("email", email).maybeSingle();
  return data as { id: string; nome: string; papel: string } | null;
}

// Aceite do convite: cria o usuário (ou aproveita o que já existe), liga às empresas, completa o cadastro e entra
export async function aceitarConvite(f: FormData) {
  const token = String(f.get("token"));
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const admin = supabaseAdmin();
  // Toda falha fica registrada, para o escritório ver em "Acessos e senhas"
  const volta = async (erro: string): Promise<never> => {
    if (admin) await admin.from("auditoria").insert({ usuario: null, acao: "convite_erro", tabela: "convites", detalhe: { motivo: erro, email, token: token.slice(0, 6) } });
    redirect(`/convite/${encodeURIComponent(token)}?erro=${erro}`);
  };
  if (!admin) return volta("servidor");
  const { data: cv } = await admin.from("convites").select("*").eq("token", token).maybeSingle();
  if (!cv || cv.usado_em || new Date(cv.expira_em) < new Date()) return volta("invalido");

  const nome = String(f.get("nome") ?? "").trim();
  const telefone = String(f.get("telefone") ?? "").trim(), senha = String(f.get("senha") ?? ""), senha2 = String(f.get("senha2") ?? "");
  if (nome.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return volta("dados");
  if (senha.length < 10) return volta("senha-curta");
  if (senha !== senha2) return volta("senha-diferente");
  if (f.get("aceite") !== "on") return volta("aceite");

  const { data: cls } = await admin.from("clientes").select("id,documento,tipo").in("id", cv.cliente_ids);
  for (const c of cls ?? []) {
    const doc = String(f.get(`doc_${c.id}`) ?? "").replace(/\D/g, "");
    if (!c.documento && doc && !docValido(doc)) return volta("documento");
  }

  // E-mail que já tem conta: não troca a senha (seria uma brecha), só libera as empresas e manda entrar
  let uid: string, jaTinha = false;
  const existente = await contaPorEmail(admin, email);
  if (existente) { uid = existente.id; jaTinha = true; }
  else {
    const { data: criado, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
    if (error || !criado.user) {
      // Conta existe no login mas sem perfil (caso raro): trata como já existente
      if (/already|registered|exists/i.test(error?.message ?? "")) return volta("email-existe");
      await admin.from("auditoria").insert({ usuario: null, acao: "convite_erro", tabela: "convites", detalhe: { motivo: "criar", email, mensagem: error?.message ?? "" } });
      redirect(`/convite/${encodeURIComponent(token)}?erro=criar`);
    }
    uid = criado!.user!.id;
    await admin.from("perfis").update({ nome, telefone: telefone || null }).eq("id", uid);
  }

  if (!jaTinha || existente?.papel === "cliente")
    await admin.from("cliente_membros").upsert(cv.cliente_ids.map((cid: string) => ({ cliente_id: cid, usuario_id: uid })));
  for (const c of cls ?? []) {
    const doc = String(f.get(`doc_${c.id}`) ?? "").replace(/\D/g, "");
    const end = String(f.get(`end_${c.id}`) ?? "").trim();
    const dados: Record<string, unknown> = { cadastro_completo: true };
    if (!c.documento && doc) { dados.documento = doc; dados.tipo = doc.length === 11 ? "PF" : "PJ"; }
    if (end) dados.endereco = end;
    await admin.from("clientes").update(dados).eq("id", c.id);
  }
  await admin.from("convites").update({ usado_em: new Date().toISOString(), usado_por: uid }).eq("token", token);
  await admin.from("auditoria").insert({ usuario: uid, acao: "convite_aceito", tabela: "convites", detalhe: { empresas: cv.cliente_ids.length, email, ja_tinha_conta: jaTinha } });

  const site = enderecoSite();
  const primeiro = escaparHtml(nome.split(" ")[0]);
  if (jaTinha) {
    await enviarEmail(email, "Empresas liberadas no seu painel JRB", modelo(`Olá, ${primeiro}`, [
      "O seu e-mail já tinha acesso ao painel da JRB Advogados. As empresas do convite foram liberadas nesse mesmo acesso.",
      "Entre com a senha que você já usava. Se não lembrar, use <b>Esqueci minha senha</b> na tela de entrada.",
    ], { texto: "Entrar no painel", url: `${site}/login` }));
    redirect(`/login?aviso=ja-tinha&email=${encodeURIComponent(email)}`);
  }

  await enviarEmail(email, "Seu acesso ao painel JRB está pronto", modelo(`Bem-vindo, ${primeiro}`, [
    "O seu cadastro no painel da JRB Advogados foi concluído.",
    `Para entrar, use o e-mail <b>${escaparHtml(email)}</b> e a senha que você criou. Lá você acompanha processos, documentos, certidões, licitações e faturas de cada empresa.`,
    "Se esquecer a senha, clique em <b>Esqueci minha senha</b> na tela de entrada e você recebe um link para criar outra.",
    "Se não foi você que fez este cadastro, responda este e-mail.",
  ], { texto: "Abrir o painel", url: `${site}/login` }));

  const { error: e2 } = await supabaseServer().auth.signInWithPassword({ email, password: senha });
  redirect(e2 ? `/login?aviso=criado&email=${encodeURIComponent(email)}` : "/cliente?bemvindo=1");
}
