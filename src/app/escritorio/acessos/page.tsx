import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Search, KeyRound, Mail, Building2, AlertTriangle, ShieldCheck, Ban, X, UserPlus } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailAtivo } from "@/lib/email";
import { Shell } from "@/components/shell";
import { Enviar, Janela } from "@/components/interativos";
import { Copiar } from "@/components/copiar";
import { semAcento } from "@/lib/areas";
import { senhaProvisoria, linkNovaSenha, novoAcesso, liberarEmpresa, tirarEmpresa, mudarPapel, bloquear } from "./acoes";

export const dynamic = "force-dynamic";
const PAPEL: Record<string, string> = { socio: "Sócio", funcionario: "Equipe", cliente: "Cliente" };
const MOTIVO: Record<string, string> = {
  "email-existe": "o e-mail já tinha conta", criar: "o sistema não conseguiu criar a conta", invalido: "o convite estava vencido ou já usado",
  "senha-curta": "senha curta", "senha-diferente": "as senhas não bateram", documento: "CPF/CNPJ inválido", dados: "nome ou e-mail inválido",
  aceite: "não marcou o aceite da LGPD", servidor: "falta a chave secreta na Vercel",
};
const MSG: Record<string, [string, boolean]> = {
  "ok=link": ["Link para nova senha enviado por e-mail.", true], "ok=empresa": ["Empresa liberada.", true], "ok=papel": ["Papel alterado.", true], "ok=criado": ["Acesso criado. Veja a senha provisória abaixo.", true],
  "erro=ja-existe": ["Este e-mail já tem acesso. Ele está aberto abaixo: dá para mudar o papel ou gerar nova senha.", false],
  "erro=novo-dados": ["Confira o nome e o e-mail.", false], "erro=novo-falhou": ["Não foi possível criar o acesso. Confira o e-mail.", false],
  "erro=email": ["O e-mail não saiu. Confira o RESEND_API_KEY na Vercel, ou use a senha provisória.", false],
  "erro=senha": ["Não foi possível trocar a senha.", false], "erro=socio": ["Só um sócio pode fazer isso.", false],
  "erro=proprio": ["Você não pode tirar o seu próprio papel de sócio.", false], "erro=chave": ["Falta cadastrar SUPABASE_SECRET_KEY na Vercel.", false],
};
const quando = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca";

export default async function Acessos({ searchParams }: { searchParams: { q?: string; u?: string; ok?: string; erro?: string } }) {
  const { perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");
  const admin = supabaseAdmin();
  if (!admin) return <Shell perfil={perfil} titulo="Acessos e senhas"><p className="folha p-5">Falta cadastrar a chave SUPABASE_SECRET_KEY na Vercel. Sem ela esta tela não funciona.</p></Shell>;

  const [{ data: lista }, { data: perfis }, { data: membros }, { data: clientes }, { data: eventos }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("perfis").select("id,nome,email,papel,ativo,telefone"),
    admin.from("cliente_membros").select("usuario_id,cliente_id,clientes(nome,grupo)"),
    admin.from("clientes").select("id,nome,grupo").eq("ativo", true).order("nome"),
    admin.from("auditoria").select("acao,detalhe,criado_em,registro,usuario").in("acao", ["convite_erro", "senha_pedido"]).gte("criado_em", new Date(Date.now() - 15 * 864e5).toISOString()).order("criado_em", { ascending: false }).limit(40),
  ]);
  const pMap = new Map((perfis ?? []).map((p: any) => [p.id, p]));
  const usuarios = (lista?.users ?? []).map((u) => {
    const p: any = pMap.get(u.id) ?? {};
    return { id: u.id, email: u.email ?? p.email ?? "", nome: p.nome ?? u.email, papel: p.papel ?? "cliente", ativo: p.ativo !== false, telefone: p.telefone,
      criado: u.created_at, ultimo: u.last_sign_in_at, empresas: (membros ?? []).filter((m: any) => m.usuario_id === u.id) };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const q = semAcento(searchParams.q ?? "");
  const filtrados = usuarios.filter((u) => !q || semAcento(`${u.nome} ${u.email}`).includes(q));
  const sel = usuarios.find((u) => u.id === searchParams.u);
  let prov: { u: string; senha: string; enviado?: boolean } | null = null;
  try { const c = cookies().get("senha_prov")?.value; if (c) prov = JSON.parse(c); } catch {}

  // Só mostra problemas que ainda não foram resolvidos depois (ex.: errou o convite e depois entrou)
  const resolvidoDepois = (email: string, dt: string) => usuarios.some((u) => u.email.toLowerCase() === email && u.ultimo && u.ultimo > dt);
  const problemas = (eventos ?? []).filter((e: any) => e.detalhe?.email && !resolvidoDepois(String(e.detalhe.email).toLowerCase(), e.criado_em))
    .filter((e: any, i: number, arr: any[]) => arr.findIndex((x) => x.acao === e.acao && x.detalhe?.email === e.detalhe?.email) === i);
  const chave = searchParams.ok ? `ok=${searchParams.ok}` : searchParams.erro ? `erro=${searchParams.erro}` : "";
  const aviso = MSG[chave];
  const socio = perfil.papel === "socio";

  return (
    <Shell perfil={perfil} titulo="Acessos e senhas" subtitulo={`${usuarios.length} pessoas com acesso · ${usuarios.filter((u) => u.ultimo).length} já entraram`}
      acoes={<Janela rotulo="Novo acesso" icone={<UserPlus size={17} />} titulo="Criar acesso" descricao="Para sócio, alguém da equipe ou cliente. A pessoa recebe uma senha provisória e troca depois.">
        <form action={novoAcesso} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="rotulo" htmlFor="na-nome">Nome completo</label><input id="na-nome" name="nome" required className="campo" /></div>
          <div className="sm:col-span-2"><label className="rotulo" htmlFor="na-email">E-mail (é o usuário para entrar)</label><input id="na-email" name="email" type="email" required className="campo" /></div>
          <div><label className="rotulo" htmlFor="na-papel">Papel</label>
            <select id="na-papel" name="papel" className="campo" defaultValue={socio ? "socio" : "cliente"}>
              {socio && <option value="socio">Sócio (vê e faz tudo)</option>}
              {socio && <option value="funcionario">Equipe do escritório</option>}
              <option value="cliente">Cliente</option></select></div>
          <div><label className="rotulo" htmlFor="na-oab">OAB (se for advogado)</label><input id="na-oab" name="oab" className="campo" placeholder="OAB/SP 000.000" /></div>
          <div className="sm:col-span-2"><label className="rotulo" htmlFor="na-cli">Empresa (só para cliente)</label>
            <select id="na-cli" name="cliente_id" className="campo" defaultValue=""><option value="">Nenhuma</option>
              {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <div className="sm:col-span-2"><Enviar className="btn w-full !py-3" pendente="Criando…"><UserPlus size={17} />Criar acesso</Enviar></div>
        </form>
      </Janela>}>
      {aviso && <p role="status" className="rounded-lg p-3 mb-4 text-sm" style={{ background: aviso[1] ? "var(--ok-fundo)" : "var(--risco-fundo)", color: aviso[1] ? "var(--ok)" : "var(--risco)" }}>{aviso[0]}</p>}
      {!emailAtivo() && <p className="rounded-lg p-3 mb-4 text-sm" style={{ background: "var(--alerta-fundo)", color: "var(--alerta)" }}>O envio de e-mails ainda não está ligado. Enquanto isso, quem esquecer a senha aparece em &quot;Precisa de ajuda&quot; e você gera uma senha provisória aqui.</p>}

      {problemas.length > 0 && <section className="folha p-5 mb-5">
        <h2 className="font-semibold flex items-center gap-2"><AlertTriangle size={18} style={{ color: "var(--alerta)" }} />Precisa de ajuda</h2>
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--fio-2)" }}>
          {problemas.map((e: any, i: number) => {
            const dono = usuarios.find((u) => u.email.toLowerCase() === String(e.detalhe.email).toLowerCase());
            return <li key={i} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ borderColor: "var(--fio-2)" }}>
              <span className="font-medium">{e.detalhe.email}</span>
              <span className="apoio">{e.acao === "senha_pedido" ? "pediu nova senha" : `tentou se cadastrar e não conseguiu: ${MOTIVO[e.detalhe.motivo] ?? e.detalhe.motivo}`} · {quando(e.criado_em)}</span>
              {dono ? <Link href={`?u=${dono.id}`} className="underline ml-auto" style={{ color: "var(--bordo)" }}>Resolver</Link> : <span className="discreto ml-auto">sem conta no sistema</span>}
            </li>;
          })}
        </ul>
      </section>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 items-start">
        <section className="folha">
          <form className="p-3 border-b flex items-center gap-2" style={{ borderColor: "var(--fio-2)" }}>
            <Search size={17} className="discreto" /><input name="q" defaultValue={searchParams.q} placeholder="Buscar por nome ou e-mail" className="flex-1 bg-transparent outline-none py-1.5" />
          </form>
          <ul className="divide-y max-h-[70vh] overflow-auto" style={{ borderColor: "var(--fio-2)" }}>
            {filtrados.map((u) => <li key={u.id} style={{ borderColor: "var(--fio-2)" }}>
              <Link href={`?u=${u.id}${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ""}`} className="block px-4 py-3" style={{ background: u.id === sel?.id ? "var(--folha)" : undefined }}>
                <span className="flex items-center gap-2"><span className="font-medium truncate">{u.nome}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${u.papel === "cliente" ? "etq-ok" : "etq-bordo"}`}>{PAPEL[u.papel]}</span>{!u.ativo && <span className="rounded px-1.5 py-0.5 text-[11px] etq-risco">bloqueado</span>}</span>
                <span className="block text-sm apoio truncate">{u.email} · {u.ultimo ? `entrou ${quando(u.ultimo)}` : "nunca entrou"}</span>
              </Link></li>)}
            {!filtrados.length && <li className="p-5 apoio">Ninguém encontrado.</li>}
          </ul>
        </section>

        {sel ? <section className="folha p-5 space-y-5">
          <div className="flex items-start gap-3"><div className="flex-1 min-w-0"><h2 className="serif text-[22px] font-semibold">{sel.nome}</h2>
            <p className="apoio text-sm break-all">{sel.email}{sel.telefone ? ` · ${sel.telefone}` : ""}</p>
            <p className="text-sm discreto mt-1">Cadastro em {quando(sel.criado)} · último acesso: {quando(sel.ultimo)}</p></div>
            <Link href="?" aria-label="Fechar" className="discreto"><X size={18} /></Link></div>

          <div><h3 className="font-semibold mb-2 flex items-center gap-2"><KeyRound size={16} />Senha</h3>
            {prov?.u === sel.id ? <div className="rounded-lg p-3" style={{ background: "var(--ok-fundo)" }}>
              <p className="text-sm">Senha provisória (aparece só agora). Passe ao cliente e peça para trocar em &quot;Minha senha&quot;:</p>
              <p className="font-mono text-lg mt-1 flex items-center gap-2">{prov.senha} <Copiar texto={prov.senha} rotulo="Copiar" /></p>
              {prov.enviado && <p className="text-sm mt-1">Também mandamos para o e-mail dele um link para criar a própria senha.</p>}
              <p className="text-sm mt-1">Endereço para entrar: <b>jrb-sistema.vercel.app</b></p></div>
            : <div className="flex flex-wrap gap-2">
              <form action={senhaProvisoria}><input type="hidden" name="u" value={sel.id} /><Enviar className="btn" pendente="Gerando…"><KeyRound size={16} />Gerar senha provisória</Enviar></form>
              {emailAtivo() && <form action={linkNovaSenha}><input type="hidden" name="u" value={sel.id} /><Enviar className="btn-sec" pendente="Enviando…"><Mail size={16} />Enviar link por e-mail</Enviar></form>}
            </div>}
          </div>

          <div><h3 className="font-semibold mb-2 flex items-center gap-2"><Building2 size={16} />Empresas que vê</h3>
            {sel.papel !== "cliente" ? <p className="text-sm apoio">Por ser da equipe, vê todos os clientes.</p> : <>
              <ul className="space-y-1.5">{sel.empresas.map((m: any) => <li key={m.cliente_id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{m.clientes?.nome}</span>
                <form action={tirarEmpresa}><input type="hidden" name="u" value={sel.id} /><input type="hidden" name="cliente_id" value={m.cliente_id} /><button className="text-[13px] underline discreto">tirar</button></form></li>)}
                {!sel.empresas.length && <li className="text-sm" style={{ color: "var(--risco)" }}>Nenhuma empresa liberada: ao entrar, não vê nada.</li>}</ul>
              <form action={liberarEmpresa} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="u" value={sel.id} />
                <select name="cliente_id" className="campo !w-auto flex-1 min-w-[12rem]" defaultValue=""><option value="" disabled>Escolha a empresa…</option>
                  {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.grupo ? ` · grupo ${c.grupo}` : ""}</option>)}</select>
                <label className="text-sm flex items-center gap-1.5"><input type="checkbox" name="grupo_todo" />todo o grupo</label>
                <Enviar className="btn-sec" pendente="Liberando…">Liberar</Enviar></form></>}
          </div>

          {socio && <div><h3 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck size={16} />Papel no sistema</h3>
            <form action={mudarPapel} className="flex flex-wrap gap-2 items-center"><input type="hidden" name="u" value={sel.id} />
              <select name="papel" defaultValue={sel.papel} className="campo !w-auto"><option value="cliente">Cliente (vê só as empresas liberadas)</option><option value="funcionario">Equipe do escritório</option><option value="socio">Sócio</option></select>
              <Enviar className="btn-sec" pendente="Salvando…">Salvar</Enviar></form>
            {sel.id !== perfil.id && <form action={bloquear} className="mt-3"><input type="hidden" name="u" value={sel.id} /><input type="hidden" name="ativo" value={sel.ativo ? "0" : "1"} />
              <Enviar className="text-sm underline discreto" pendente="…"><Ban size={14} className="inline mr-1" />{sel.ativo ? "Bloquear acesso" : "Desbloquear acesso"}</Enviar></form>}
          </div>}
        </section> : <section className="folha p-6 apoio">Escolha uma pessoa na lista para trocar a senha, liberar empresas ou mudar o papel.</section>}
      </div>
    </Shell>
  );
}
