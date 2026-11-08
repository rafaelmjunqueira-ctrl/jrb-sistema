import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { Topo, dataBR } from "@/components";

export const dynamic = "force-dynamic";
const POR_PAG = 50;

export default async function Processos({ searchParams }: { searchParams: { q?: string; cliente?: string; sit?: string; p?: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");
  const pag = Math.max(1, Number(searchParams.p ?? 1));
  const { data: clientes } = await sb.from("clientes").select("id,nome").order("nome");

  let ids: string[] | null = null;
  if (searchParams.cliente) {
    const { data } = await sb.from("processo_clientes").select("processo_id").eq("cliente_id", searchParams.cliente);
    ids = (data ?? []).map((r) => r.processo_id);
  }
  let q = sb.from("processos").select("id,numero_cnj,tribunal,orgao_julgador,classe,situacao,risco,ultima_mov_em", { count: "exact" });
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (searchParams.sit) q = q.eq("situacao", searchParams.sit);
  if (searchParams.q) {
    const t = searchParams.q.replace(/[%,()]/g, " ").trim();
    q = q.or(`numero_cnj.ilike.%${t}%,classe.ilike.%${t}%,orgao_julgador.ilike.%${t}%,tribunal.ilike.%${t}%`);
  }
  const { data: procs, count } = await q.order("ultima_mov_em", { ascending: false, nullsFirst: false })
    .range((pag - 1) * POR_PAG, pag * POR_PAG - 1);
  const total = count ?? 0;
  const link = (p: number) => `/escritorio/processos?${new URLSearchParams({ ...searchParams, p: String(p) } as any)}`;

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Topo nome={perfil.nome} area="Processos" equipe />
      <form className="card grid gap-2 sm:grid-cols-[2fr_1.4fr_1fr_auto] mb-4">
        <input name="q" defaultValue={searchParams.q} className="input" placeholder="Número, classe, vara ou tribunal" />
        <select name="cliente" defaultValue={searchParams.cliente ?? ""} className="input">
          <option value="">Todos os clientes</option>
          {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select name="sit" defaultValue={searchParams.sit ?? ""} className="input">
          <option value="">Qualquer situação</option><option value="ativo">Ativo</option>
          <option value="parado">Parado</option><option value="arquivado">Arquivado</option>
        </select>
        <button className="btn">Filtrar</button>
      </form>
      <p className="text-sm muted mb-2">{total} processo(s)</p>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left muted text-xs uppercase">
            <th className="p-3">Processo</th><th className="p-3">Classe / vara</th><th className="p-3">Situação</th><th className="p-3">Últ. mov.</th></tr></thead>
          <tbody>{(procs ?? []).map((p) => (
            <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="p-3"><Link className="font-mono underline" href={`/escritorio/processos/${p.id}`}>{p.numero_cnj}</Link>
                <div className="muted text-xs">{p.tribunal}</div></td>
              <td className="p-3">{p.classe}<div className="muted text-xs">{p.orgao_julgador}</div></td>
              <td className="p-3"><span className="pill">{p.situacao}</span> {p.risco !== "indefinido" && <span className="pill">risco {p.risco}</span>}</td>
              <td className="p-3 whitespace-nowrap">{dataBR(p.ultima_mov_em)}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-3">
        {pag > 1 && <Link className="pill" href={link(pag - 1)}>← Anterior</Link>}
        {pag * POR_PAG < total && <Link className="pill" href={link(pag + 1)}>Próxima →</Link>}
      </div>
    </main>
  );
}
