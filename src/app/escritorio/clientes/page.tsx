import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { Building2, User, Eye, UserPlus, Copy, Search, Link2, Users, X } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Enviar, Janela } from "@/components/interativos";
import { CompartilharLink } from "@/components/copiar-link";
import { dataBR } from "@/components/util";
import { semAcento } from "@/lib/areas";
import { novoCliente, criarAcesso, removerAcesso, salvarCliente, gerarConvite, cancelarConvite } from "../acoes";

export const dynamic = "force-dynamic";
const MSG: Record<string, [string, boolean]> = {
  "ok=salvo": ["Cadastro salvo.", true], "erro=doc-repetido": ["Já existe outro cliente com esse CPF/CNPJ.", false],
  "erro=salvar": ["Não foi possível salvar.", false], "erro=convite": ["Não foi possível gerar o convite. Confira se a atualização do banco (0005) foi aplicada.", false],
  "erro=chave": ["Falta cadastrar SUPABASE_SECRET_KEY na Vercel.", false], "erro=criar": ["O acesso não foi criado. Confira o e-mail.", false],
};

export default async function Clientes({ searchParams }: { searchParams: { c?: string; q?: string; erro?: string; ok?: string; convite?: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");
  const h = headers(); const base = `https://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const { data: todos } = await sb.from("clientes").select("id,nome,tipo,documento,plano,grupo,email,telefone,cadastro_completo,processo_clientes(count),cliente_membros(count)").eq("ativo", true).order("nome");
  const conta = (x: any) => (Array.isArray(x) ? x[0]?.count : 0) ?? 0;
  const q = semAcento(searchParams.q ?? "");
  const clientes = (todos ?? []).filter((c: any) => !q || semAcento(`${c.nome} ${c.grupo ?? ""} ${c.documento ?? ""}`).includes(q));
  // Agrupa: empresas do mesmo grupo ficam juntas, sob o nome do grupo
  const grupos = new Map<string, any[]>();
  for (const c of clientes) { const k = c.grupo || `__${c.id}`; grupos.set(k, [...(grupos.get(k) ?? []), c]); }
  const ordem = Array.from(grupos.entries()).sort((a, b) => (a[0].startsWith("__") ? a[1][0].nome : a[0]).localeCompare(b[0].startsWith("__") ? b[1][0].nome : b[0], "pt-BR"));
  const nomesGrupo = Array.from(new Set((todos ?? []).map((c: any) => c.grupo).filter(Boolean))) as string[];

  const atual: any = (todos ?? []).find((c: any) => c.id === searchParams.c);
  let membros: any[] = [], convites: any[] = [], irmas: any[] = [];
  if (atual) {
    const [m, cv] = await Promise.all([
      sb.from("cliente_membros").select("usuario_id, perfis(nome,email)").eq("cliente_id", atual.id),
      sb.from("convites").select("token,nome,email,criado_em,expira_em,usado_em,cliente_ids").contains("cliente_ids", [atual.id]).order("criado_em", { ascending: false }).limit(5),
    ]);
    membros = m.data ?? []; convites = cv.data ?? [];
    irmas = atual.grupo ? (todos ?? []).filter((c: any) => c.grupo === atual.grupo) : [atual];
  }
  let novo: { email: string; senha: string | null } | null = null;
  try { const c = cookies().get("acesso_novo")?.value; if (c) novo = JSON.parse(c); } catch {}
  const chave = searchParams.ok ? `ok=${searchParams.ok}` : searchParams.erro ? `erro=${searchParams.erro}` : "";
  const aviso = MSG[chave];
  const pre = (todos ?? []).filter((c: any) => !conta(c.cliente_membros)).length;

  return (
    <Shell perfil={perfil} titulo="Clientes" subtitulo={`${todos?.length ?? 0} cadastrados · ${pre} ainda sem acesso ao painel`}
      acoes={<Janela rotulo="Novo cliente" icone={<UserPlus size={17} />} titulo="Cadastrar cliente">
        <form action={novoCliente} className="grid gap-4 sm:grid-cols-2">
          <div><label className="rotulo">Tipo</label><select name="tipo" className="campo" defaultValue="PJ"><option value="PJ">Empresa</option><option value="PF">Pessoa física</option></select></div>
          <div><label className="rotulo">CNPJ ou CPF</label><input name="documento" className="campo" inputMode="numeric" /></div>
          <div className="sm:col-span-2"><label className="rotulo">Nome ou razão social</label><input name="nome" className="campo" required /></div>
          <div><label className="rotulo">Plano</label><input name="plano" className="campo" defaultValue="beta" /></div>
          <div className="sm:col-span-2"><Enviar>Cadastrar</Enviar></div>
        </form></Janela>}>
      {aviso && <p className="rounded-xl p-3.5 mb-5 text-sm" style={{ background: aviso[1] ? "var(--ok-fundo)" : "var(--risco-fundo)", color: aviso[1] ? "var(--ok)" : "var(--risco)" }}>{aviso[0]}</p>}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
        <div>
          <form className="relative mb-3"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 discreto" />
            <input name="q" defaultValue={searchParams.q} className="campo !pl-9" placeholder="Buscar cliente, grupo ou CNPJ" /></form>
          <div className="folha divide-y max-h-[75vh] overflow-y-auto" style={{ borderColor: "var(--fio-2)" }}>
            {ordem.map(([k, lista]) => {
              const grupo = !k.startsWith("__");
              return (
                <div key={k} style={{ borderColor: "var(--fio-2)" }}>
                  {grupo && <div className="px-4 pt-3 pb-1 text-[13px] font-semibold flex items-center gap-1.5" style={{ color: "var(--bordo)" }}><Users size={14} />{k}
                    <Link href={`/cliente?grupo=${encodeURIComponent(k)}`} className="ml-auto text-[12px] font-normal underline discreto">ver como o cliente</Link></div>}
                  {lista.map((c: any) => (
                    <Link key={c.id} href={`/escritorio/clientes?c=${c.id}${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ""}`}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--papel)] ${grupo ? "pl-7" : ""}`} style={c.id === atual?.id ? { background: "var(--bordo-claro)" } : {}}>
                      <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: "var(--papel)", color: "var(--bordo)" }}>{c.tipo === "PJ" ? <Building2 size={15} /> : <User size={15} />}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium truncate">{c.nome}</span>
                        <span className="text-[12px] discreto">{conta(c.processo_clientes)} processo(s) · {conta(c.cliente_membros) ? `${conta(c.cliente_membros)} acesso(s)` : "sem acesso"}</span></span>
                      {!c.cadastro_completo && <span className="etiqueta">pré-cadastro</span>}
                    </Link>))}
                </div>);
            })}
            {!ordem.length && <p className="p-5 apoio">Nenhum cliente encontrado.</p>}
          </div>
        </div>

        {!atual ? <section className="folha p-6 apoio">Escolha um cliente para ver o cadastro, quem tem acesso e enviar o convite.</section> : (
          <div className="space-y-6">
            <section className="folha p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="titulo-secao">{atual.nome}</h2>
                  <p className="text-sm discreto mt-0.5">{atual.cadastro_completo ? "Cadastro completo" : "Pré-cadastro: o cliente completa ao aceitar o convite"}</p></div>
                <div className="flex gap-2"><Link className="btn-sec" href={`/cliente?c=${atual.id}`}><Eye size={16} />Ver como o cliente</Link>
                  <Link className="btn-sec" href={`/escritorio/processos?cliente=${atual.id}`}>Processos</Link></div>
              </div>
              <form action={salvarCliente} className="grid gap-3 sm:grid-cols-2 mt-5">
                <input type="hidden" name="cliente_id" value={atual.id} />
                <div className="sm:col-span-2"><label className="rotulo">Nome ou razão social</label><input name="nome" defaultValue={atual.nome} className="campo" required /></div>
                <div><label className="rotulo">Tipo</label><select name="tipo" defaultValue={atual.tipo} className="campo"><option value="PJ">Empresa</option><option value="PF">Pessoa física</option></select></div>
                <div><label className="rotulo">CNPJ ou CPF</label><input name="documento" defaultValue={atual.documento ?? ""} className="campo" inputMode="numeric" /></div>
                <div className="sm:col-span-2"><label className="rotulo">Grupo (cliente dono das empresas)</label>
                  <input name="grupo" defaultValue={atual.grupo ?? ""} list="grupos" className="campo" placeholder="Ex.: Marcio Martins Gonçalves" />
                  <datalist id="grupos">{nomesGrupo.map((g) => <option key={g} value={g} />)}</datalist>
                  <p className="text-[12px] discreto mt-1">Empresas do mesmo grupo aparecem juntas, e um convite pode liberar todas de uma vez.</p></div>
                <div><label className="rotulo">E-mail</label><input name="email" type="email" defaultValue={atual.email ?? ""} className="campo" /></div>
                <div><label className="rotulo">Telefone</label><input name="telefone" defaultValue={atual.telefone ?? ""} className="campo" /></div>
                <div><label className="rotulo">Plano</label><input name="plano" defaultValue={atual.plano ?? "beta"} className="campo" /></div>
                <div className="flex items-end"><Enviar>Salvar cadastro</Enviar></div>
              </form>
            </section>

            <section className="folha p-6">
              <h2 className="titulo-secao flex items-center gap-2"><Link2 size={18} />Convidar para o painel</h2>
              <p className="text-sm apoio mt-1">Gere o link e mande pelo WhatsApp. O cliente confirma os dados, cria a senha e já entra.</p>
              {searchParams.convite && <div className="rounded-xl p-4 mt-4" style={{ background: "var(--ok-fundo)" }}>
                <p className="font-semibold" style={{ color: "var(--ok)" }}>Convite pronto, válido por 30 dias</p>
                <p className="font-mono text-[13px] break-all mt-2 p-2.5 rounded-lg" style={{ background: "var(--folha)" }}>{base}/convite/{searchParams.convite}</p>
                <div className="mt-3"><CompartilharLink url={`${base}/convite/${searchParams.convite}`} nome={convites.find((c) => c.token === searchParams.convite)?.nome} /></div>
              </div>}
              <form action={gerarConvite} className="grid gap-3 sm:grid-cols-2 mt-4">
                <input type="hidden" name="cliente_id" value={atual.id} />
                <div><label className="rotulo">Nome de quem vai acessar</label><input name="nome" className="campo" placeholder="Ex.: Márcio" /></div>
                <div><label className="rotulo">E-mail (opcional)</label><input name="email" type="email" defaultValue={atual.email ?? ""} className="campo" /></div>
                {atual.grupo && irmas.length > 1 && <label className="sm:col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" name="grupo_todo" defaultChecked className="mt-1" />
                  <span>Liberar todas as {irmas.length} empresas do grupo {atual.grupo}<span className="block text-[12px] discreto">{irmas.map((i: any) => i.nome).join(" · ")}</span></span></label>}
                <div className="sm:col-span-2"><Enviar pendente="Gerando…"><Link2 size={16} />Gerar link de convite</Enviar></div>
              </form>
              {!!convites.length && <ul className="mt-5">{convites.map((c) => {
                const vivo = !c.usado_em && new Date(c.expira_em) > new Date();
                return <li key={c.token} className="flex flex-wrap items-center gap-2 py-2.5 linha first:border-0 text-sm">
                  <span className="flex-1 min-w-0">{c.nome || c.email || "Convite"} · criado em {dataBR(c.criado_em)}{c.cliente_ids.length > 1 ? ` · ${c.cliente_ids.length} empresas` : ""}</span>
                  <span className={`etiqueta ${c.usado_em ? "etq-ok" : vivo ? "etq-bordo" : ""}`}>{c.usado_em ? `aceito em ${dataBR(c.usado_em)}` : vivo ? "aguardando" : "expirado"}</span>
                  {vivo && <><Link href={`/escritorio/clientes?c=${atual.id}&convite=${c.token}`} className="btn-sec !py-1 !px-2.5 text-[13px]"><Copy size={14} />Link</Link>
                    <form action={cancelarConvite}><input type="hidden" name="token" value={c.token} /><input type="hidden" name="cliente_id" value={atual.id} />
                      <button className="btn-sec !py-1 !px-2.5 text-[13px]" aria-label="Cancelar convite"><X size={14} /></button></form></>}
                </li>;
              })}</ul>}
            </section>

            <section className="folha p-6">
              <h2 className="titulo-secao">Quem acessa</h2>
              {novo && <div className="rounded-xl p-4 mt-3" style={{ background: "var(--ok-fundo)" }}>
                <p className="font-semibold" style={{ color: "var(--ok)" }}>Acesso criado para {novo.email}</p>
                {novo.senha && <p className="text-sm mt-1">Senha provisória (aparece só agora): <span className="font-mono">{novo.senha}</span></p>}</div>}
              {!membros.length ? <p className="text-sm apoio mt-2">Ninguém desta empresa tem acesso ainda.</p> :
                <ul className="mt-2">{membros.map((m) => <li key={m.usuario_id} className="flex justify-between items-center gap-3 py-2.5 linha first:border-0">
                  <span className="min-w-0"><span className="block font-medium">{m.perfis?.nome}</span><span className="text-[13px] discreto">{m.perfis?.email}</span></span>
                  <Link href={`/escritorio/acessos?u=${m.usuario_id}`} className="text-[13px] underline ml-auto" style={{ color: "var(--bordo)" }}>Senha</Link>
                  <form action={removerAcesso}><input type="hidden" name="cliente_id" value={atual.id} /><input type="hidden" name="usuario_id" value={m.usuario_id} />
                    <Enviar className="btn-sec !py-1.5" pendente="…">Remover</Enviar></form></li>)}</ul>}
              <details className="mt-4"><summary className="text-sm" style={{ color: "var(--bordo)" }}>Criar acesso com senha provisória (sem convite)</summary>
                <form action={criarAcesso} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto] mt-3">
                  <input type="hidden" name="cliente_id" value={atual.id} />
                  <input name="nome" className="campo" required placeholder="Nome" /><input name="email" type="email" className="campo" required placeholder="E-mail" />
                  <Enviar pendente="Criando…">Criar acesso</Enviar></form></details>
            </section>
          </div>)}
      </div>
    </Shell>
  );
}
