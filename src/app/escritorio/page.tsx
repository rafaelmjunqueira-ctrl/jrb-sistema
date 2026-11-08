import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, FileText, Inbox, MessageSquare, Paperclip } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Enviar } from "@/components/interativos";
import { dataBR, diaSemana, diasAte, hojeISO, rotuloChamado, rotuloStatus } from "@/components/util";
import { baixarPrazo, triarIntimacao, atualizarChamado, linkArquivo } from "./acoes";

export const dynamic = "force-dynamic";

type Prazo = { id: string; descricao: string; data_fatal: string; data_segura: string | null; processo_id: string; processos: { numero_cnj: string; tribunal: string } | null };

export default async function Hoje() {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  if (perfil.papel === "cliente") redirect("/cliente");
  const hoje = hojeISO();
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: prazos }, { data: envios }, { data: chamados }, { count: nProc }, { count: nCli }] = await Promise.all([
    sb.from("prazos").select("id,descricao,data_fatal,data_segura,processo_id,processos(numero_cnj,tribunal)").eq("concluido", false).lte("data_fatal", em30).order("data_fatal"),
    sb.from("intimacoes_enviadas").select("id,observacao,status,arquivo_path,retorno_cliente,criado_em,clientes(nome)").in("status", ["recebida", "em_triagem"]).order("criado_em"),
    sb.from("chamados").select("id,tipo,titulo,descricao,referencia,status,prazo_cliente,criado_em,clientes(nome)").not("status", "in", "(concluido,cancelado)").order("prazo_cliente", { nullsFirst: false }),
    sb.from("processos").select("id", { count: "exact", head: true }).neq("situacao", "arquivado"),
    sb.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true),
  ]);
  const lista = (prazos ?? []) as unknown as Prazo[];
  const grupos: { nome: string; tom: "risco" | "bordo" | "alerta" | "neutro"; itens: Prazo[] }[] = [
    { nome: "Vencidos sem baixa", tom: "risco", itens: lista.filter((p) => p.data_fatal < hoje) },
    { nome: "Vencem hoje", tom: "bordo", itens: lista.filter((p) => p.data_fatal === hoje) },
    { nome: "Próximos 7 dias", tom: "alerta", itens: lista.filter((p) => { const d = diasAte(p.data_fatal); return d >= 1 && d <= 7; }) },
    { nome: "Até 30 dias", tom: "neutro", itens: lista.filter((p) => diasAte(p.data_fatal) > 7) },
  ];
  const entrada = (envios?.length ?? 0) + (chamados?.length ?? 0);
  const saudacao = new Date(Date.now() - 3 * 3600000).getUTCHours() < 12 ? "Bom dia" : new Date(Date.now() - 3 * 3600000).getUTCHours() < 18 ? "Boa tarde" : "Boa noite";
  const vencidos = grupos[0].itens.length, hojeN = grupos[1].itens.length;

  return (
    <Shell perfil={perfil} titulo={`${saudacao}, ${perfil.nome.split(" ")[0]}`}
      subtitulo={<span className="capitalize">{diaSemana(hoje)}, {dataBR(hoje)}</span>}>
      <section className="folha grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: "var(--fio)" }}>
        <Num valor={vencidos} rotulo="prazos vencidos sem baixa" tom={vencidos ? "var(--risco)" : undefined} />
        <Num valor={hojeN} rotulo="prazos vencem hoje" tom={hojeN ? "var(--bordo)" : undefined} />
        <Num valor={entrada} rotulo="pedidos de clientes" tom={entrada ? "var(--alerta)" : undefined} />
        <Num valor={nProc ?? 0} rotulo={`processos ativos · ${nCli ?? 0} clientes`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] mt-6 items-start">
        <section>
          <h2 className="titulo-secao mb-3">Prazos</h2>
          {!lista.length && <div className="folha p-6 apoio">Nenhum prazo em aberto nos próximos 30 dias.</div>}
          <div className="space-y-6">
            {grupos.filter((g) => g.itens.length).map((g) => (
              <div key={g.nome}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: g.tom === "risco" ? "var(--risco)" : g.tom === "bordo" ? "var(--bordo)" : "var(--tinta-2)" }}>
                  {g.nome}<span className="etiqueta">{g.itens.length}</span></h3>
                <ul className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>
                  {g.itens.map((p) => {
                    const d = diasAte(p.data_fatal);
                    return (
                      <li key={p.id} className="grid grid-cols-[58px_1fr_auto] gap-3 sm:gap-4 items-center px-4 py-3.5" style={{ borderColor: "var(--fio-2)" }}>
                        <div className="text-center rounded-lg py-1.5" style={{ background: g.tom === "risco" ? "var(--risco-fundo)" : g.tom === "bordo" ? "var(--bordo-claro)" : "var(--papel)" }}>
                          <div className="serif text-[20px] font-semibold leading-none" style={{ color: g.tom === "risco" ? "var(--risco)" : g.tom === "bordo" ? "var(--bordo)" : "var(--tinta)" }}>{p.data_fatal.slice(8, 10)}/{p.data_fatal.slice(5, 7)}</div>
                          <div className="text-[11px] discreto mt-1">{d < 0 ? `há ${-d}d` : d === 0 ? "hoje" : `em ${d}d`}</div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[15px] leading-snug line-clamp-2">{p.descricao.split(" — ")[0]}</p>
                          {p.descricao.includes(" — ") && <p className="text-[13px] apoio line-clamp-2 mt-0.5">{p.descricao.split(" — ").slice(1).join(" — ")}</p>}
                          <Link href={`/escritorio/processos/${p.processo_id}`} className="text-[13px] numero-cnj underline decoration-[var(--fio)] underline-offset-2 discreto">
                            {p.processos?.numero_cnj} · {p.processos?.tribunal}</Link>
                          {p.data_segura && p.data_segura !== p.data_fatal && <span className="text-[12px] discreto"> · protocolar até {dataBR(p.data_segura)}</span>}
                        </div>
                        <form action={baixarPrazo}><input type="hidden" name="id" value={p.id} />
                          <Enviar className="btn-sec" pendente="…"><Check size={16} /><span className="hidden sm:inline">Cumprido</span></Enviar></form>
                      </li>);
                  })}
                </ul>
              </div>))}
          </div>
        </section>

        <section>
          <h2 className="titulo-secao mb-3 flex items-center gap-2"><Inbox size={19} strokeWidth={1.8} />Pedidos dos clientes</h2>
          {!entrada && <div className="folha p-6 apoio">Nenhum pedido aguardando. Intimações e pedidos enviados pelos clientes aparecem aqui.</div>}
          <div className="space-y-3">
            {(envios ?? []).map((e: any) => (
              <article key={e.id} className="folha p-4">
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-semibold text-[15px]"><FileText size={16} style={{ color: "var(--bordo)" }} />Intimação enviada</span>
                  <span className="text-[13px] discreto">{dataBR(e.criado_em)}</span></div>
                <p className="text-sm mt-1">{e.clientes?.nome}</p>
                {e.observacao && <p className="text-sm apoio mt-1">{e.observacao}</p>}
                {e.arquivo_path && <form action={linkArquivo} className="mt-2"><input type="hidden" name="path" value={e.arquivo_path} />
                  <button className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: "var(--bordo)" }}><Paperclip size={14} />Abrir documento</button></form>}
                <form action={triarIntimacao} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={e.id} />
                  <textarea name="retorno_cliente" rows={2} defaultValue={e.retorno_cliente ?? ""} className="campo text-sm" placeholder="Resposta que o cliente vai ler" />
                  <div className="flex gap-2"><select name="status" defaultValue="triada" className="campo text-sm !w-auto">
                    <option value="em_triagem">Em análise</option><option value="triada">Responder</option><option value="descartada">Arquivar</option></select>
                    <Enviar className="btn !py-2" pendente="…">Salvar</Enviar></div>
                </form>
              </article>))}
            {(chamados ?? []).map((c: any) => (
              <article key={c.id} className="folha p-4">
                <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-semibold text-[15px]"><MessageSquare size={16} style={{ color: "var(--bordo)" }} />{rotuloChamado[c.tipo]}</span>
                  {c.prazo_cliente ? <span className={`etiqueta ${diasAte(c.prazo_cliente) <= 3 ? "etq-risco" : "etq-alerta"}`}>prazo {dataBR(c.prazo_cliente)}</span> : <span className="text-[13px] discreto">{dataBR(c.criado_em)}</span>}</div>
                <p className="text-sm mt-1"><b>{c.clientes?.nome}</b> · {c.titulo}</p>
                {(c.referencia || c.descricao) && <p className="text-sm apoio mt-1">{c.referencia ? `${c.referencia}. ` : ""}{c.descricao}</p>}
                <form action={atualizarChamado} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <textarea name="mensagem" rows={2} className="campo text-sm" placeholder="Mensagem ao cliente (opcional)" />
                  <div className="flex flex-wrap gap-2 items-center">
                    <select name="status" defaultValue={c.status} className="campo text-sm !w-auto">
                      {["aberto", "em_analise", "em_execucao", "aguardando_cliente", "concluido", "cancelado"].map((k) => <option key={k} value={k}>{rotuloStatus[k]}</option>)}</select>
                    <label className="text-[13px] apoio flex items-center gap-1.5"><input type="checkbox" name="interna" />nota interna</label>
                    <Enviar className="btn !py-2 ml-auto" pendente="…">Salvar</Enviar></div>
                </form>
              </article>))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Num({ valor, rotulo, tom }: { valor: number; rotulo: string; tom?: string }) {
  return <div className="p-5" style={{ borderColor: "var(--fio)" }}>
    <div className="serif text-[34px] font-semibold leading-none" style={{ color: tom ?? "var(--tinta)" }}>{valor}</div>
    <div className="text-[13px] apoio mt-2">{rotulo}</div></div>;
}
