import { redirect } from "next/navigation";
import Link from "next/link";
import { Bookmark, BellDot } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { AbasCliente } from "@/components/abas-cliente";
import { SubNavLicitacoes, STATUS_ACOMP, NOME_STATUS, prazoInfo, capitaliza, titulo, slugEdital } from "@/components/licitacoes";
import { SelectEnvia } from "@/components/interativos";
import { reais } from "@/components/util";
import { empresaAtual } from "@/lib/cliente";
import { atualizarAcompanhamento } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Acompanhando({ searchParams }: { searchParams: { c?: string; s?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  const { atual } = await empresaAtual(sb, searchParams.c);
  if (!atual) redirect("/cliente");
  const cid = atual.id;
  const { data: ac } = await sb.from("edital_acompanhamentos")
    .select("status,nota,visto_em,edital_id,editais(id,fonte,orgao_cnpj,ano,sequencial,objeto,orgao_nome,municipio,uf,valor_estimado,encerramento_em,situacao_id,situacao,modalidade)")
    .eq("cliente_id", cid);
  const ids = (ac ?? []).map((a) => a.edital_id);
  const { data: evs } = ids.length ? await sb.from("edital_eventos").select("edital_id,criado_em").in("edital_id", ids) : { data: [] as any[] };
  const novos = (a: any) => (evs ?? []).filter((v) => v.edital_id === a.edital_id && new Date(v.criado_em) > new Date(a.visto_em)).length;

  const todos = (ac ?? []).filter((a: any) => a.editais).sort((x: any, y: any) => (x.editais.encerramento_em ?? "9") < (y.editais.encerramento_em ?? "9") ? -1 : 1);
  const filtro = searchParams.s ?? "ativos";
  const visiveis = todos.filter((a) => filtro === "todos" ? true : filtro === "ativos" ? !["descartado", "ganhamos"].includes(a.status) : a.status === filtro);
  const contagem = (s: string) => todos.filter((a) => a.status === s).length;
  const ativos = todos.filter((a) => !["descartado", "ganhamos"].includes(a.status)).length;
  const comNovidade = todos.filter((a) => novos(a) > 0).length;
  const link = (s: string) => `/cliente/licitacoes/acompanhando?c=${cid}&s=${s}`;

  return (
    <Shell perfil={perfil} titulo={atual.nome} subtitulo="Licitações">
      <AbasCliente cid={cid} atual="licitacoes" />
      <SubNavLicitacoes cid={cid} atual="acompanhando" nAcomp={todos.length} />
      {!todos.length ? (
        <div className="folha p-8 max-w-2xl"><Bookmark size={26} style={{ color: "var(--ouro)" }} />
          <p className="titulo-secao mt-3">Nenhum edital acompanhado</p>
          <p className="apoio mt-1">Toque em &quot;Acompanhar&quot; em qualquer edital. Ele aparece aqui, e o sistema confere todo dia se houve errata, mudança de prazo ou suspensão.</p>
          <Link href={`/cliente/licitacoes?c=${cid}`} className="btn mt-4">Buscar editais</Link></div>
      ) : (<>
        {comNovidade > 0 && <p className="rounded-xl p-3.5 mb-4 text-sm flex items-center gap-2" style={{ background: "var(--alerta-fundo)", color: "var(--alerta)" }}>
          <BellDot size={16} />{comNovidade === 1 ? "1 edital teve alteração" : `${comNovidade} editais tiveram alterações`} desde a sua última visita.</p>}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
          {[["ativos", `Em andamento ${ativos}`], ...STATUS_ACOMP.map((s) => [s.id, `${s.nome} ${contagem(s.id)}`]), ["todos", `Todos ${todos.length}`]].map(([k, r]) =>
            <Link key={k} href={link(k)} className="etiqueta !py-1.5 !px-3 !text-[13px] whitespace-nowrap"
              style={filtro === k ? { background: "var(--tinta)", color: "var(--folha)" } : { background: "var(--folha)", border: "1px solid var(--fio)" }}>{r}</Link>)}
        </div>
        <ul className="space-y-3">{visiveis.map((a: any) => {
          const e = a.editais; const p = prazoInfo(e.encerramento_em); const n = novos(a);
          return (
            <li key={a.edital_id} className="folha p-4 sm:p-5 grid gap-3 md:grid-cols-[1fr_220px] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className={`etiqueta ${NOME_STATUS[a.status]?.classe ?? ""}`}>{NOME_STATUS[a.status]?.nome ?? a.status}</span>
                  {n > 0 && <span className="etiqueta etq-alerta"><BellDot size={12} />{n} alteraç{n === 1 ? "ão" : "ões"}</span>}
                  {e.situacao_id !== 1 && <span className="etiqueta etq-risco">{e.situacao}</span>}
                  <span className="text-[12px]" style={{ color: p.tom === "risco" ? "var(--risco)" : p.tom === "alerta" ? "var(--alerta)" : "var(--tinta-3)" }}>{p.texto}</span>
                </div>
                <Link href={`/cliente/licitacoes/${slugEdital(e)}?c=${cid}`} className="font-semibold text-[15px] leading-snug line-clamp-2 hover:underline">{capitaliza(e.objeto)}</Link>
                <p className="text-[13px] apoio mt-1 truncate">{titulo(e.orgao_nome)} · {e.municipio}/{e.uf}{e.valor_estimado ? ` · ${reais(Number(e.valor_estimado))}` : ""}</p>
                {a.nota && <p className="text-[13px] mt-1.5 line-clamp-1 discreto">“{a.nota}”</p>}
              </div>
              <form action={atualizarAcompanhamento}>
                <input type="hidden" name="cliente_id" value={cid} /><input type="hidden" name="edital_id" value={a.edital_id} /><input type="hidden" name="volta" value={link(filtro)} />
                <label className="sr-only" htmlFor={`s-${a.edital_id}`}>Situação</label>
                <SelectEnvia id={`s-${a.edital_id}`} name="status" defaultValue={a.status} className="campo text-sm">
                  {STATUS_ACOMP.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</SelectEnvia>
              </form>
            </li>);
        })}</ul>
        {!visiveis.length && <p className="folha p-6 apoio">Nenhum edital nesta situação.</p>}
      </>)}
    </Shell>
  );
}
