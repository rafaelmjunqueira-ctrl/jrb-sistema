import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { Topo } from "@/components";
import { novoCliente, criarAcesso, removerAcesso } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: { c?: string; erro?: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");

  const { data: clientes } = await sb.from("clientes").select("id,nome,tipo,documento,plano,ativo").order("nome");
  const atual = (clientes ?? []).find((c) => c.id === searchParams.c);
  let membros: any[] = [], nProc = 0;
  if (atual) {
    const { data } = await sb.from("cliente_membros").select("usuario_id, perfis(nome,email)").eq("cliente_id", atual.id);
    membros = data ?? [];
    const { count } = await sb.from("processo_clientes").select("processo_id", { count: "exact", head: true }).eq("cliente_id", atual.id);
    nProc = count ?? 0;
  }
  let novo: { email: string; senha: string | null } | null = null;
  try { const c = cookies().get("acesso_novo")?.value; if (c) novo = JSON.parse(c); } catch {}

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Topo nome={perfil.nome} area="Clientes" equipe />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="card">
          <h2 className="font-semibold mb-3">Clientes</h2>
          <ul className="text-sm divide-y" style={{ borderColor: "var(--line)" }}>
            {(clientes ?? []).map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-3">
                <Link href={`/escritorio/clientes?c=${c.id}`} className={c.id === atual?.id ? "font-semibold" : "underline"}>{c.nome}</Link>
                <span className="muted">{c.tipo} · {c.plano}</span>
              </li>))}
          </ul>
          <h3 className="font-semibold mt-6 mb-2">Novo cliente</h3>
          <form action={novoCliente} className="grid gap-2 sm:grid-cols-2">
            <select name="tipo" className="input" defaultValue="PJ"><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select>
            <input name="documento" className="input" placeholder="CNPJ ou CPF" />
            <input name="nome" className="input sm:col-span-2" required placeholder="Nome / razão social" />
            <input name="plano" className="input" placeholder="Plano (ex.: beta, mensal)" />
            <button className="btn">Cadastrar</button>
          </form>
        </section>

        <section className="card">
          {!atual ? <p className="muted text-sm">Escolha um cliente à esquerda para ver os acessos.</p> : (
            <>
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-semibold">{atual.nome}</h2>
                <Link className="pill" href={`/cliente?c=${atual.id}`}>Ver como o cliente vê</Link>
              </div>
              <p className="text-sm muted">{atual.documento ?? "sem documento"} · {nProc} processo(s) vinculado(s) ·{" "}
                <Link className="underline" href={`/escritorio/processos?cliente=${atual.id}`}>ver processos</Link></p>

              {novo && (
                <div className="card mt-4" style={{ borderColor: "var(--ok)" }}>
                  <p className="font-semibold">Acesso pronto para {novo.email}</p>
                  {novo.senha ? <>
                    <p className="text-sm mt-1">Senha provisória (aparece só agora): <code className="font-mono text-base">{novo.senha}</code></p>
                    <p className="text-xs muted mt-1">Envie ao cliente junto com o endereço do sistema e peça que troque em &quot;Minha senha&quot; no primeiro acesso.</p>
                  </> : <p className="text-sm mt-1">Esse e-mail já tinha acesso; foi só vinculado a esta empresa.</p>}
                </div>
              )}
              {searchParams.erro === "chave" && <p className="text-sm mt-3" style={{ color: "var(--bad)" }}>Falta cadastrar a chave SUPABASE_SECRET_KEY na Vercel para criar acessos.</p>}
              {searchParams.erro === "criar" && <p className="text-sm mt-3" style={{ color: "var(--bad)" }}>Não foi possível criar o acesso (e-mail inválido?).</p>}

              <h3 className="font-semibold mt-5 mb-2">Quem acessa</h3>
              {!membros.length ? <p className="text-sm muted">Ninguém ainda.</p> :
                <ul className="text-sm space-y-2">{membros.map((m) =>
                  <li key={m.usuario_id} className="flex justify-between gap-3 items-center">
                    <span>{m.perfis?.nome} <span className="muted">· {m.perfis?.email}</span></span>
                    <form action={removerAcesso}><input type="hidden" name="cliente_id" value={atual.id} />
                      <input type="hidden" name="usuario_id" value={m.usuario_id} /><button className="pill">Remover</button></form>
                  </li>)}</ul>}

              <h3 className="font-semibold mt-5 mb-2">Dar acesso a alguém desta empresa</h3>
              <form action={criarAcesso} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="cliente_id" value={atual.id} />
                <input name="nome" className="input" required placeholder="Nome" />
                <input name="email" type="email" className="input" required placeholder="E-mail" />
                <button className="btn">Criar acesso</button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
