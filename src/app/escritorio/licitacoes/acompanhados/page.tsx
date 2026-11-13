import { redirect } from "next/navigation";
import Link from "next/link";
import { RefreshCw, BellDot } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Enviar } from "@/components/interativos";
import { NOME_STATUS, prazoInfo, capitaliza, titulo, slugEdital, SubNavEscritorio } from "@/components/licitacoes";
import { dispararColeta } from "@/lib/cliente";
import { coletarAgora } from "../acoes";

export const dynamic = "force-dynamic";
const dh = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function LicitacoesEscritorio({ searchParams }: { searchParams: { ok?: string; erro?: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");
  const agora = new Date().toISOString();
  const [{ data: execs }, { count: total }, { count: abertas }, { data: ac }] = await Promise.all([
    sb.from("coleta_execucoes").select("*").order("id", { ascending: false }).limit(5),
    sb.from("editais").select("id", { count: "exact", head: true }),
    sb.from("editais").select("id", { count: "exact", head: true }).gte("encerramento_em", agora),
    sb.from("edital_acompanhamentos").select("status,visto_em,edital_id,cliente_id,clientes(nome),editais(id,fonte,orgao_cnpj,ano,sequencial,objeto,orgao_nome,uf,encerramento_em,situacao_id,situacao)").order("criado_em", { ascending: false }).limit(200),
  ]);
  if (!execs?.length && !total) await dispararColeta();
  // Coleta que ficou parada no meio: abrir esta tela já manda continuar
  else if (execs?.[0]?.status === "rodando" && Date.now() - new Date(execs[0].pulso_em).getTime() > 240_000) await dispararColeta();
  const ult = execs?.[0];
  const rodando = ult?.status === "rodando" && Date.now() - new Date(ult.pulso_em).getTime() < 3 * 60_000;
  const ativos = (ac ?? []).filter((a: any) => a.editais && !["descartado", "ganhamos"].includes(a.status))
    .sort((x: any, y: any) => (x.editais.encerramento_em ?? "9") < (y.editais.encerramento_em ?? "9") ? -1 : 1);

  return (
    <Shell perfil={perfil} titulo="Licitações" subtitulo="Coleta diária (PNCP e Diário Oficial da União) e editais acompanhados pelos clientes"
      acoes={<div className="flex gap-2">
        <form action={coletarAgora}><Enviar className="btn" pendente="Iniciando…"><RefreshCw size={16} />Coletar agora</Enviar></form></div>}>
      <SubNavEscritorio atual="acompanhados" />
      {searchParams.ok && <p className="rounded-xl p-3.5 mb-5 text-sm" style={{ background: "var(--ok-fundo)", color: "var(--ok)" }}>Coleta iniciada. Ela roda em etapas e termina em alguns minutos.</p>}
      {searchParams.erro && <p className="rounded-xl p-3.5 mb-5 text-sm" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>A coleta não foi iniciada. Confira se SUPABASE_SECRET_KEY está cadastrada na Vercel.</p>}

      <section className="folha grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--fio)" }}>
        <Num rotulo="Editais com propostas abertas" valor={(abertas ?? 0).toLocaleString("pt-BR")} />
        <Num rotulo="Editais na base" valor={(total ?? 0).toLocaleString("pt-BR")} />
        <div className="p-5"><div className="text-[13px] apoio">Última coleta</div>
          <div className="serif text-[22px] font-semibold mt-1 flex items-center gap-2">
            {rodando ? <><RefreshCw size={18} className="animate-spin" />Coletando…</> : ult ? dh(ult.terminada_em ?? ult.iniciada_em) : "Nunca"}</div>
          <div className="text-[13px] discreto">{ult ? `${ult.status === "ok" ? "concluída" : ult.status === "erro" ? "com erro" : "em andamento"} · ${Number(ult.registros).toLocaleString("pt-BR")} registros` : "a primeira coleta começa sozinha"}</div></div>
      </section>
      <p className="text-[13px] discreto mt-2">Coleta automática todo dia às 6h e às 18h (horário de Brasília), no PNCP e no Diário Oficial da União. Editais encerrados há mais de 45 dias saem da base, exceto os acompanhados.</p>

      <h2 className="titulo-secao mt-8 mb-3">Acompanhados pelos clientes</h2>
      {!ativos.length ? <div className="folha p-6 apoio">Nenhum cliente está acompanhando editais ainda.</div> :
        <ul className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>{ativos.map((a: any, i) => {
          const e = a.editais, p = prazoInfo(e.encerramento_em);
          return <li key={i} style={{ borderColor: "var(--fio-2)" }}>
            <Link href={`/cliente/licitacoes/${slugEdital(e)}?c=${a.cliente_id}`} className="grid gap-1 md:grid-cols-[180px_1fr_auto] md:gap-4 md:items-center px-5 py-3.5 hover:bg-[var(--papel)]">
              <span className="font-semibold text-[14px] truncate">{a.clientes?.nome}</span>
              <span className="min-w-0"><span className="block text-[15px] truncate">{capitaliza(e.objeto)}</span>
                <span className="text-[13px] discreto">{titulo(e.orgao_nome)} · {e.uf}{e.situacao_id !== 1 ? ` · ${e.situacao}` : ""}</span></span>
              <span className="flex items-center gap-2 md:justify-end"><span className={`etiqueta ${NOME_STATUS[a.status]?.classe ?? ""}`}>{NOME_STATUS[a.status]?.nome}</span>
                <span className="text-[12px] whitespace-nowrap" style={{ color: p.tom === "risco" ? "var(--risco)" : "var(--tinta-3)" }}>{p.texto}</span></span>
            </Link></li>;
        })}</ul>}
      <p className="text-[13px] discreto mt-3 flex items-center gap-1.5"><BellDot size={14} />Pedidos de impugnação feitos a partir de um edital chegam na caixa de entrada da tela Hoje.</p>
    </Shell>
  );
}
function Num({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="p-5"><div className="text-[13px] apoio">{rotulo}</div><div className="serif text-[28px] font-semibold mt-1">{valor}</div></div>;
}
