import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, Eye, EyeOff, X } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Enviar } from "@/components/interativos";
import { dataBR, diasAte } from "@/components/util";
import { salvarProcesso, vincularCliente, desvincularCliente, salvarAndamento, novoPrazo, baixarPrazo } from "../../acoes";

export const dynamic = "force-dynamic";

export default async function Processo({ params }: { params: { id: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");
  const id = params.id;
  const [{ data: p }, { data: nota }, { data: vinc }, { data: clientes }, { data: movs }, { data: prazos }] = await Promise.all([
    sb.from("processos").select("*").eq("id", id).maybeSingle(),
    sb.from("processo_notas").select("nota").eq("processo_id", id).maybeSingle(),
    sb.from("processo_clientes").select("cliente_id,polo,clientes(nome)").eq("processo_id", id),
    sb.from("clientes").select("id,nome").order("nome"),
    sb.from("andamentos").select("id,data,texto_original,resumo_simples,visivel_cliente").eq("processo_id", id).order("data", { ascending: false }).limit(40),
    sb.from("prazos").select("id,descricao,data_fatal,data_segura,concluido").eq("processo_id", id).order("data_fatal", { ascending: false }),
  ]);
  if (!p) notFound();
  const liberados = (movs ?? []).filter((m) => m.visivel_cliente).length;

  return (
    <Shell perfil={perfil} titulo={p.classe ?? "Processo"}
      subtitulo={<><Link href="/escritorio/processos" className="inline-flex items-center gap-1 text-sm mr-3" style={{ color: "var(--bordo)" }}><ChevronLeft size={15} />Processos</Link>
        <span className="numero-cnj">{p.numero_cnj}</span> · {p.tribunal} · {p.orgao_julgador}</>}>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr] items-start">
        <div className="space-y-6">
          <section className="folha p-6">
            <h2 className="titulo-secao">Ficha</h2>
            <form action={salvarProcesso} className="grid gap-4 sm:grid-cols-3 mt-4">
              <input type="hidden" name="id" value={p.id} />
              <div><label className="rotulo">Risco</label><select name="risco" defaultValue={p.risco} className="campo">
                <option value="indefinido">Não avaliado</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option></select></div>
              <div><label className="rotulo">Situação</label><select name="situacao" defaultValue={p.situacao ?? "ativo"} className="campo">
                {["ativo", "parado", "suspenso", "arquivado", "baixado"].map((r) => <option key={r} value={r}>{r === "arquivado" ? "encerrado" : r}</option>)}</select></div>
              <div><label className="rotulo">Exposição (R$)</label><input name="exposicao_estimada" defaultValue={p.exposicao_estimada ?? ""} className="campo" placeholder="0,00" /></div>
              <div className="sm:col-span-3"><label className="rotulo">O que o cliente lê sobre este processo</label>
                <textarea name="resumo_cliente" rows={3} defaultValue={p.resumo_cliente ?? ""} className="campo"
                  placeholder="Ex.: Ação trabalhista de ex-funcionária pedindo verbas rescisórias. Já há sentença; estamos recorrendo." /></div>
              <div className="sm:col-span-3"><label className="rotulo">Nota interna (só a equipe vê)</label>
                <textarea name="nota" rows={3} defaultValue={nota?.nota ?? ""} className="campo" /></div>
              <div className="sm:col-span-3"><Enviar>Salvar ficha</Enviar></div>
            </form>
          </section>

          <section className="folha p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="titulo-secao">Andamentos</h2>
              <span className="text-sm discreto">{liberados} de {(movs ?? []).length} liberados ao cliente</span></div>
            <p className="text-sm apoio mt-1">Nada chega ao cliente sem resumo e sem marcar &quot;Mostrar ao cliente&quot;.</p>
            <ol className="mt-4 space-y-4">{(movs ?? []).map((m) => (
              <li key={m.id} className="rounded-xl p-4" style={{ background: m.visivel_cliente ? "var(--ok-fundo)" : "var(--papel)" }}>
                <p className="text-[13px] font-semibold flex items-center gap-2">{dataBR(m.data)}
                  {m.visivel_cliente ? <span className="etiqueta etq-ok"><Eye size={12} />cliente vê</span> : <span className="etiqueta"><EyeOff size={12} />interno</span>}</p>
                <details className="mt-1"><summary className="text-sm apoio line-clamp-2">{m.texto_original}</summary>
                  <p className="text-sm apoio whitespace-pre-wrap break-words mt-1">{m.texto_original}</p></details>
                <form action={salvarAndamento} className="grid gap-2 md:grid-cols-[1fr_auto_auto] mt-3 items-center">
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="processo_id" value={p.id} />
                  <input name="resumo_simples" defaultValue={m.resumo_simples ?? ""} className="campo text-sm" placeholder="Resumo em linguagem simples para o cliente" />
                  <label className="text-sm flex items-center gap-2 whitespace-nowrap"><input type="checkbox" name="visivel_cliente" defaultChecked={m.visivel_cliente} />Mostrar ao cliente</label>
                  <Enviar className="btn-sec" pendente="…">Salvar</Enviar>
                </form>
              </li>))}</ol>
            {!movs?.length && <p className="apoio mt-4">Sem andamentos registrados.</p>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="folha p-6">
            <h2 className="titulo-secao">Prazos</h2>
            <ul className="mt-3">{(prazos ?? []).map((z) => {
              const d = diasAte(z.data_fatal);
              return <li key={z.id} className="flex justify-between items-start gap-3 py-3 linha first:border-0">
                <span className="min-w-0"><span className={`block text-[15px] ${z.concluido ? "line-through discreto" : "font-medium"}`}>{z.descricao.split(" — ")[0]}</span>
                  <span className="text-[13px]" style={{ color: !z.concluido && d < 0 ? "var(--risco)" : "var(--tinta-3)" }}>{dataBR(z.data_fatal)}{z.concluido ? " · cumprido" : d < 0 ? " · vencido" : d === 0 ? " · hoje" : ` · em ${d}d`}</span></span>
                {!z.concluido && <form action={baixarPrazo}><input type="hidden" name="id" value={z.id} /><Enviar className="btn-sec !px-2.5" pendente="…"><Check size={16} /></Enviar></form>}
              </li>;
            })}</ul>
            <form action={novoPrazo} className="grid gap-2 grid-cols-2 mt-4">
              <input type="hidden" name="processo_id" value={p.id} />
              <input name="descricao" className="campo col-span-2" required placeholder="Novo prazo (ex.: contrarrazões)" />
              <div><label className="rotulo">Data fatal</label><input name="data_fatal" type="date" className="campo" required /></div>
              <div><label className="rotulo">Protocolar até</label><input name="data_segura" type="date" className="campo" /></div>
              <div className="col-span-2"><Enviar className="btn-sec w-full">Incluir prazo</Enviar></div>
            </form>
          </section>

          <section className="folha p-6">
            <h2 className="titulo-secao">Clientes</h2>
            {!vinc?.length ? <p className="text-sm apoio mt-2">Vincule um cliente para o processo aparecer no painel dele.</p> :
              <ul className="mt-3">{vinc.map((v: any) =>
                <li key={v.cliente_id} className="flex justify-between items-center gap-2 py-2.5 linha first:border-0">
                  <span><span className="font-medium">{v.clientes?.nome}</span>{v.polo && <span className="text-[13px] discreto"> · {v.polo === "ativo" ? "autor" : v.polo === "passivo" ? "réu" : v.polo}</span>}</span>
                  <form action={desvincularCliente}><input type="hidden" name="processo_id" value={p.id} /><input type="hidden" name="cliente_id" value={v.cliente_id} />
                    <button aria-label="Remover vínculo" className="discreto p-1"><X size={16} /></button></form>
                </li>)}</ul>}
            <form action={vincularCliente} className="grid gap-2 grid-cols-2 mt-4">
              <input type="hidden" name="processo_id" value={p.id} />
              <select name="cliente_id" className="campo col-span-2" required>{(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <select name="polo" className="campo"><option value="">Polo</option><option value="ativo">Autor</option><option value="passivo">Réu</option><option value="terceiro">Terceiro</option></select>
              <Enviar className="btn-sec">Vincular</Enviar>
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}
