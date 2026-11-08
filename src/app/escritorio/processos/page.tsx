import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { dataBR } from "@/components/util";

export const dynamic = "force-dynamic";
const POR_PAG = 40;
const SIT: Record<string, string> = { ativo: "etq-ok", parado: "etq-alerta", suspenso: "etq-alerta", arquivado: "", baixado: "" };

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
  let q = sb.from("processos").select("id,numero_cnj,tribunal,orgao_julgador,classe,situacao,risco,ultima_mov_em,processo_clientes(clientes(nome))", { count: "exact" });
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (searchParams.sit) q = q.eq("situacao", searchParams.sit);
  if (searchParams.q) {
    const t = searchParams.q.replace(/[%,()]/g, " ").trim();
    q = q.or(`numero_cnj.ilike.%${t}%,classe.ilike.%${t}%,orgao_julgador.ilike.%${t}%,tribunal.ilike.%${t}%`);
  }
  const { data: procs, count } = await q.order("ultima_mov_em", { ascending: false, nullsFirst: false }).range((pag - 1) * POR_PAG, pag * POR_PAG - 1);
  const total = count ?? 0;
  const link = (p: number) => `/escritorio/processos?${new URLSearchParams({ ...searchParams, p: String(p) } as any)}`;

  return (
    <Shell perfil={perfil} titulo="Processos" subtitulo={`${total} encontrado${total === 1 ? "" : "s"}`}>
      <form className="folha p-3 grid gap-2 md:grid-cols-[2fr_1.3fr_1fr_auto] mb-5">
        <div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 discreto" />
          <input name="q" defaultValue={searchParams.q} className="campo !pl-9" placeholder="Número, classe, vara ou tribunal" /></div>
        <select name="cliente" defaultValue={searchParams.cliente ?? ""} className="campo">
          <option value="">Todos os clientes</option>{(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select name="sit" defaultValue={searchParams.sit ?? ""} className="campo">
          <option value="">Qualquer situação</option><option value="ativo">Ativos</option><option value="parado">Parados</option><option value="arquivado">Encerrados</option></select>
        <button className="btn">Filtrar</button>
      </form>

      <ul className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>
        {(procs ?? []).map((p: any) => {
          const cli = (p.processo_clientes ?? []).map((v: any) => v.clientes?.nome).filter(Boolean);
          return (
            <li key={p.id} style={{ borderColor: "var(--fio-2)" }}>
              <Link href={`/escritorio/processos/${p.id}`} className="grid grid-cols-[1fr_auto] md:grid-cols-[1.1fr_1.4fr_auto_auto] gap-x-5 gap-y-1 items-center px-5 py-3.5 hover:bg-[var(--papel)]">
                <div className="min-w-0"><p className="numero-cnj font-semibold text-[15px]">{p.numero_cnj}</p>
                  <p className="text-[13px] discreto truncate">{p.tribunal}{cli.length ? ` · ${cli.join(", ")}` : ""}</p></div>
                <div className="min-w-0 hidden md:block"><p className="text-[15px] truncate">{p.classe}</p><p className="text-[13px] discreto truncate">{p.orgao_julgador}</p></div>
                <span className={`etiqueta ${SIT[p.situacao] ?? ""} hidden md:inline-flex`}>{p.situacao === "arquivado" ? "encerrado" : p.situacao}</span>
                <span className="flex items-center gap-2 text-[13px] discreto whitespace-nowrap">{dataBR(p.ultima_mov_em)}<ChevronRight size={16} /></span>
              </Link>
            </li>);
        })}
        {!procs?.length && <li className="p-6 apoio">Nenhum processo com esses filtros.</li>}
      </ul>
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="discreto">Página {pag} de {Math.max(1, Math.ceil(total / POR_PAG))}</span>
        <div className="flex gap-2">
          {pag > 1 && <Link className="btn-sec" href={link(pag - 1)}><ChevronLeft size={16} />Anterior</Link>}
          {pag * POR_PAG < total && <Link className="btn-sec" href={link(pag + 1)}>Próxima<ChevronRight size={16} /></Link>}
        </div>
      </div>
    </Shell>
  );
}
