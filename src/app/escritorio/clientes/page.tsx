import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Building2, User, Eye, UserPlus, Copy } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Enviar, Janela } from "@/components/interativos";
import { novoCliente, criarAcesso, removerAcesso } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: { c?: string; erro?: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");

  const { data: clientes } = await sb.from("clientes").select("id,nome,tipo,documento,plano,processo_clientes(count),cliente_membros(count)").order("nome");
  const atual = (clientes ?? []).find((c) => c.id === searchParams.c);
  let membros: any[] = [];
  if (atual) { const { data } = await sb.from("cliente_membros").select("usuario_id, perfis(nome,email)").eq("cliente_id", atual.id); membros = data ?? []; }
  let novo: { email: string; senha: string | null } | null = null;
  try { const c = cookies().get("acesso_novo")?.value; if (c) novo = JSON.parse(c); } catch {}
  const conta = (x: any) => (Array.isArray(x) ? x[0]?.count : 0) ?? 0;

  return (
    <Shell perfil={perfil} titulo="Clientes" subtitulo={`${clientes?.length ?? 0} cadastrado${clientes?.length === 1 ? "" : "s"}`}
      acoes={<Janela rotulo="Novo cliente" icone={<UserPlus size={17} />} titulo="Cadastrar cliente">
        <form action={novoCliente} className="grid gap-4 sm:grid-cols-2">
          <div><label className="rotulo">Tipo</label><select name="tipo" className="campo" defaultValue="PJ"><option value="PJ">Empresa</option><option value="PF">Pessoa física</option></select></div>
          <div><label className="rotulo">CNPJ ou CPF</label><input name="documento" className="campo" inputMode="numeric" /></div>
          <div className="sm:col-span-2"><label className="rotulo">Nome ou razão social</label><input name="nome" className="campo" required /></div>
          <div><label className="rotulo">Plano</label><input name="plano" className="campo" defaultValue="beta" /></div>
          <div className="sm:col-span-2"><Enviar>Cadastrar</Enviar></div>
        </form></Janela>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] items-start">
        <ul className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>
          {(clientes ?? []).map((c: any) => (
            <li key={c.id} style={{ borderColor: "var(--fio-2)" }}>
              <Link href={`/escritorio/clientes?c=${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--papel)]"
                style={c.id === atual?.id ? { background: "var(--bordo-claro)" } : {}}>
                <span className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: "var(--papel)", color: "var(--bordo)" }}>
                  {c.tipo === "PJ" ? <Building2 size={18} /> : <User size={18} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{c.nome}</span>
                  <span className="text-[13px] discreto">{conta(c.processo_clientes)} processo(s) · {conta(c.cliente_membros)} acesso(s)</span></span>
                <span className="etiqueta">{c.plano}</span>
              </Link></li>))}
        </ul>

        <section className="folha p-6">
          {!atual ? <p className="apoio">Escolha um cliente para ver quem tem acesso e liberar novos usuários.</p> : (<>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="titulo-secao">{atual.nome}</h2><p className="text-sm discreto mt-0.5">{atual.documento ?? "documento não informado"}</p></div>
              <Link className="btn-sec" href={`/cliente?c=${atual.id}`}><Eye size={16} />Ver como o cliente</Link>
            </div>
            <Link href={`/escritorio/processos?cliente=${atual.id}`} className="text-sm font-medium inline-block mt-3" style={{ color: "var(--bordo)" }}>Ver processos deste cliente</Link>

            {novo && <div className="rounded-xl p-4 mt-5" style={{ background: "var(--ok-fundo)" }}>
              <p className="font-semibold" style={{ color: "var(--ok)" }}>Acesso criado para {novo.email}</p>
              {novo.senha ? <><p className="text-sm mt-2">Senha provisória, mostrada só agora:</p>
                <p className="mt-1 inline-flex items-center gap-2 font-mono text-lg px-3 py-1.5 rounded-lg" style={{ background: "var(--folha)" }}><Copy size={15} className="discreto" />{novo.senha}</p>
                <p className="text-[13px] apoio mt-2">Envie ao cliente com o endereço jrb-sistema.vercel.app e peça que troque a senha no primeiro acesso.</p></>
                : <p className="text-sm mt-1">Esse e-mail já tinha acesso e agora também vê esta empresa.</p>}
            </div>}
            {searchParams.erro === "chave" && <p className="text-sm mt-4 rounded-lg p-3" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>
              Para criar acessos, cadastre a variável SUPABASE_SECRET_KEY na Vercel e faça um novo deploy.</p>}
            {searchParams.erro === "criar" && <p className="text-sm mt-4 rounded-lg p-3" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>
              O acesso não foi criado. Confira se o e-mail está correto.</p>}

            <h3 className="font-semibold mt-6">Quem acessa</h3>
            {!membros.length ? <p className="text-sm apoio mt-1">Ninguém desta empresa tem acesso ainda.</p> :
              <ul className="mt-2">{membros.map((m) => <li key={m.usuario_id} className="flex justify-between items-center gap-3 py-2.5 linha first:border-0">
                <span className="min-w-0"><span className="block font-medium">{m.perfis?.nome}</span><span className="text-[13px] discreto">{m.perfis?.email}</span></span>
                <form action={removerAcesso}><input type="hidden" name="cliente_id" value={atual.id} /><input type="hidden" name="usuario_id" value={m.usuario_id} />
                  <Enviar className="btn-sec !py-1.5" pendente="…">Remover</Enviar></form></li>)}</ul>}

            <h3 className="font-semibold mt-6 mb-2">Liberar acesso</h3>
            <form action={criarAcesso} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
              <input type="hidden" name="cliente_id" value={atual.id} />
              <input name="nome" className="campo" required placeholder="Nome" />
              <input name="email" type="email" className="campo" required placeholder="E-mail" />
              <Enviar pendente="Criando…">Criar acesso</Enviar>
            </form>
          </>)}
        </section>
      </div>
    </Shell>
  );
}
