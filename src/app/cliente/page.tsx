import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Landmark, BellDot, Gavel, ShieldCheck, CalendarDays, FileUp, MessageSquarePlus, Building2, ArrowUpRight, ArrowDownLeft, Circle } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { avaliar, cor, fundo } from "@/lib/saude";
import { Shell } from "@/components/shell";
import { Selo } from "@/components/selo";
import { AbasCliente } from "@/components/abas-cliente";
import { Janela, SoltarArquivo, Enviar } from "@/components/interativos";
import { dataBR, dataCurta, diasAte, reais, hojeISO, rotuloChamado, rotuloStatus, classeStatus, limparAndamento } from "@/components/util";
import { enviarIntimacao, abrirChamado } from "./acoes";
import { VisaoGrupo } from "./grupo";
import { semAcento } from "@/lib/areas";

export const dynamic = "force-dynamic";

export default async function PainelCliente({ searchParams }: { searchParams: { c?: string; grupo?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");

  const { data: empresas } = await sb.from("clientes").select("id,nome,documento,tipo").eq("ativo", true).order("nome");
  if (!empresas?.length) {
    return <Shell perfil={perfil} titulo="Sua empresa">
      <div className="folha p-8 max-w-xl"><p className="titulo-secao">Seu acesso está quase pronto</p>
        <p className="apoio mt-2">Ainda não vinculamos nenhuma empresa ao seu usuário. Fale com a JRB para concluir.</p></div></Shell>;
  }
  // Várias empresas e nenhuma escolhida: visão do grupo
  const equipe = perfil.papel !== "cliente";
  if (!searchParams.c && equipe && !searchParams.grupo) redirect("/escritorio/clientes");
  const doGrupo = equipe && searchParams.grupo ? (await sb.from("clientes").select("id").eq("grupo", searchParams.grupo)).data?.map((x) => x.id) ?? [] : null;
  const visiveis = doGrupo ? empresas.filter((e) => doGrupo.includes(e.id)) : empresas;
  if (!searchParams.c && visiveis.length > 1) return <VisaoGrupo sb={sb} perfil={perfil} empresas={visiveis} grupo={searchParams.grupo} />;
  const atual = empresas.find((e) => e.id === searchParams.c) ?? visiveis[0] ?? empresas[0];
  const cid = atual.id;
  const hoje = hojeISO();

  const [{ data: vinculos }, { data: certs0 }, { data: docsVal }, { data: vencs }, { data: chamados }, { data: envios }] = await Promise.all([
    sb.from("processo_clientes").select("polo, processo_id").eq("cliente_id", cid),
    sb.from("certidoes").select("tipo,orgao,situacao,validade").eq("cliente_id", cid).order("validade"),
    sb.from("documentos").select("nome,validade").eq("cliente_id", cid).not("validade", "is", null).order("validade"),
    sb.from("vencimentos").select("tipo,descricao,data").eq("cliente_id", cid).gte("data", hoje).order("data").limit(10),
    sb.from("chamados").select("id,tipo,titulo,status,criado_em").eq("cliente_id", cid).order("criado_em", { ascending: false }).limit(8),
    sb.from("intimacoes_enviadas").select("id,observacao,status,retorno_cliente,criado_em").eq("cliente_id", cid).order("criado_em", { ascending: false }).limit(6),
  ]);
  const certs = [...(certs0 ?? []), ...(docsVal ?? []).map((d) => ({ tipo: d.nome, orgao: null, situacao: null, validade: d.validade }))];
  const polo = new Map((vinculos ?? []).map((v) => [v.processo_id, v.polo]));
  const ids = Array.from(polo.keys());
  const { data: procs } = ids.length
    ? await sb.from("processos_cliente").select("*").in("id", ids).order("ultima_mov_em", { ascending: false, nullsFirst: false })
    : { data: [] as any[] };
  const { data: movs } = ids.length
    ? await sb.from("andamentos").select("processo_id,data,resumo_simples,texto_original").in("processo_id", ids).eq("visivel_cliente", true).order("data", { ascending: false }).limit(400)
    : { data: [] as any[] };
  type Mov = { processo_id: string; data: string; texto: string };
  const todos: Mov[] = (movs ?? []).map((m: any) => ({ processo_id: m.processo_id, data: m.data, texto: m.resumo_simples || limparAndamento(m.texto_original) })).filter((m) => m.texto);
  const linhaDoTempo = new Map<string, Mov[]>();
  for (const m of todos) { const l = linhaDoTempo.get(m.processo_id) ?? []; if (l.length < 5) l.push(m); linhaDoTempo.set(m.processo_id, l); }

  // Licitações: novidades nas preferências e alterações nos editais acompanhados
  const [{ data: pref }, { data: acs }] = await Promise.all([
    sb.from("licitacao_preferencias").select("*").eq("cliente_id", cid).maybeSingle(),
    sb.from("edital_acompanhamentos").select("edital_id,visto_em,status").eq("cliente_id", cid),
  ]);
  let novasLic = 0;
  if (pref && pref.areas.length + pref.palavras.length > 0) {
    const ou = (t: string[]) => (t.length ? t.map((x: string) => `"${semAcento(x).replace(/"/g, "")}"`).join(" or ") : null);
    const { data: r } = await sb.rpc("buscar_editais", { p_q: ou(pref.palavras), p_areas: pref.areas.length ? pref.areas : null, p_qualquer: true,
      p_ufs: pref.ufs.length ? pref.ufs : null, p_modalidades: pref.modalidades.length ? pref.modalidades : null, p_valor_min: pref.valor_min, p_valor_max: pref.valor_max,
      p_excluir: ou(pref.excluir), p_desde: pref.ultima_visita ?? new Date(Date.now() - 86400000).toISOString(), p_limite: 1 });
    novasLic = Number(r?.[0]?.total ?? 0);
  }
  let alteradas = 0;
  if (acs?.length) {
    const { data: evs } = await sb.from("edital_eventos").select("edital_id,criado_em").in("edital_id", acs.map((a) => a.edital_id));
    alteradas = new Set((evs ?? []).filter((v) => { const a = acs.find((x) => x.edital_id === v.edital_id); return a && new Date(v.criado_em) > new Date(a.visto_em); }).map((v) => v.edital_id)).size;
  }
  const acompAtivos = (acs ?? []).filter((a) => !["descartado", "ganhamos"].includes(a.status)).length;

  const { sinal, pendencias, ativos } = avaliar(certs ?? [], procs ?? [], vencs ?? [], chamados ?? [], envios ?? []);
  const exposicao = ativos.reduce((s, p) => s + Number(p.exposicao_estimada || 0), 0);
  const proximo = (vencs ?? [])[0];
  const encerrados = (procs ?? []).length - ativos.length;
  const nAcao = pendencias.filter((p) => p.sinal !== "verde").length;
  const frase = sinal === "verde" ? "Nenhuma pendência jurídica pede sua atenção agora."
    : sinal === "amarelo" ? `${nAcao === 1 ? "Há um ponto" : `Há ${nAcao} pontos`} para acompanhar nos próximos dias.`
    : `${nAcao === 1 ? "Um ponto precisa" : `${nAcao} pontos precisam`} de ação.`;

  return (
    <Shell perfil={perfil} titulo={atual.nome}
      subtitulo={<span className="inline-flex items-center gap-1.5"><Building2 size={15} />{atual.tipo === "PJ" ? "CNPJ" : "CPF"} {fmtDoc(atual.documento)}</span>}
      acoes={visiveis.length > 1 && (
        <nav aria-label="Empresas" className="flex flex-wrap gap-1.5">
          <Link href={`/cliente${searchParams.grupo ? `?grupo=${encodeURIComponent(searchParams.grupo)}` : ""}`} className="etiqueta !py-1.5 !px-3 !text-[13px]" style={{ background: "var(--folha)", border: "1px solid var(--fio)" }}>Todas</Link>
          {visiveis.map((e) => <Link key={e.id} href={`/cliente?c=${e.id}`} className="etiqueta !py-1.5 !px-3 !text-[13px]"
            style={e.id === cid ? { background: "var(--bordo)", color: "var(--sobre-bordo)" } : { background: "var(--folha)", border: "1px solid var(--fio)" }}>{curto(e.nome)}</Link>)}
        </nav>)}>

      <AbasCliente cid={cid} atual="geral" />

      {/* Situação */}
      <section className="folha-elevada p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-10 md:items-center">
        <Selo sinal={sinal} data={new Date().toLocaleDateString("pt-BR")} />
        <div className="flex-1 min-w-0">
          <p className="serif text-[24px] sm:text-[28px] leading-snug font-medium" style={{ color: "var(--tinta)" }}>{frase}</p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <Fato rotulo="Processos em andamento" valor={String(ativos.length)} nota={encerrados ? `${encerrados} encerrado${encerrados > 1 ? "s" : ""}` : undefined} />
            <Fato rotulo="Exposição estimada" valor={exposicao ? reais(exposicao) : "Em avaliação"} nota="Soma dos processos em que há risco de pagar" />
            <Fato rotulo="Próximo compromisso" valor={proximo ? dataCurta(proximo.data) : "Nenhum"} nota={proximo?.descricao} />
          </dl>
        </div>
      </section>

      {/* Licitações */}
      <Link href={`/cliente/licitacoes?c=${cid}${pref ? "&modo=pref" : ""}`} className="folha mt-6 p-5 flex flex-wrap items-center gap-4 hover:border-[var(--tinta-3)]">
        <span className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: "var(--bordo-claro)", color: "var(--bordo)" }}><Landmark size={20} /></span>
        <span className="flex-1 min-w-[200px]">
          <span className="block font-semibold text-[16px]">{!pref ? "Encontre licitações para a sua empresa" : novasLic ? `${novasLic} edita${novasLic === 1 ? "l novo" : "is novos"} para a sua empresa` : "Licitações para a sua empresa"}</span>
          <span className="block text-sm apoio">{!pref ? "Defina áreas e estados e receba os editais do país todos os dias." : `${acompAtivos} acompanhado${acompAtivos === 1 ? "" : "s"}${alteradas ? "" : " · nenhuma alteração nova"}`}</span>
        </span>
        {alteradas > 0 && <span className="etiqueta etq-alerta"><BellDot size={12} />{alteradas} com alteração</span>}
        <ChevronRight size={18} className="discreto" />
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] mt-6">
        {/* O que precisa de você */}
        <section className="folha p-6">
          <h2 className="titulo-secao">O que precisa de você</h2>
          {!pendencias.length ? (
            <div className="flex items-center gap-3 mt-4 p-4 rounded-xl" style={{ background: "var(--ok-fundo)", color: "var(--ok)" }}>
              <ShieldCheck size={22} /><p className="text-[15px] font-medium">Tudo em ordem. Avisaremos aqui quando algo depender de você.</p></div>
          ) : (
            <ul className="mt-4 space-y-2.5">{pendencias.slice(0, 6).map((p, i) => (
              <li key={i} className="flex gap-3 p-3.5 rounded-xl" style={{ background: fundo[p.sinal] }}>
                <Circle size={10} fill={cor[p.sinal]} stroke="none" className="mt-1.5 shrink-0" />
                <div className="min-w-0"><p className="font-semibold text-[15px]">{p.titulo}</p><p className="text-sm apoio">{p.detalhe}</p></div>
              </li>))}</ul>
          )}
          <div className="flex flex-wrap gap-2 mt-6">
            <Janela rotulo="Recebi uma intimação" icone={<FileUp size={17} />} titulo="Enviar intimação ou citação"
              descricao="Mande o documento como chegou. Respondemos por aqui, em geral no mesmo dia útil.">
              <form action={enviarIntimacao} className="space-y-4">
                <input type="hidden" name="cliente_id" value={cid} />
                <SoltarArquivo />
                <div><label className="rotulo" htmlFor="obs">Como chegou e quando</label>
                  <textarea id="obs" name="observacao" rows={3} className="campo" placeholder="Ex.: oficial de justiça entregou hoje à tarde na recepção" /></div>
                <Enviar pendente="Enviando…">Enviar ao escritório</Enviar>
              </form>
            </Janela>
            <Janela rotulo="Pedir ao escritório" classeBotao="btn-sec" icone={<MessageSquarePlus size={17} />} titulo="Novo pedido à JRB"
              descricao="Impugnação, recurso, mandado de segurança ou uma dúvida. Informe o prazo, se houver.">
              <form action={abrirChamado} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="cliente_id" value={cid} />
                <div><label className="rotulo" htmlFor="tipo">Tipo de pedido</label>
                  <select id="tipo" name="tipo" className="campo" defaultValue="consulta">
                    {Object.entries(rotuloChamado).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="rotulo" htmlFor="prazo">Prazo (se houver)</label><input id="prazo" name="prazo" type="date" className="campo" /></div>
                <div className="sm:col-span-2"><label className="rotulo" htmlFor="titulo">Assunto</label>
                  <input id="titulo" name="titulo" required className="campo" placeholder="Ex.: Pregão 90012/2026 exige atestado indevido" /></div>
                <div className="sm:col-span-2"><label className="rotulo" htmlFor="ref">Número do edital, processo ou contrato</label>
                  <input id="ref" name="referencia" className="campo" /></div>
                <div className="sm:col-span-2"><label className="rotulo" htmlFor="desc">Detalhes</label>
                  <textarea id="desc" name="descricao" rows={3} className="campo" /></div>
                <div className="sm:col-span-2"><Enviar pendente="Enviando…">Enviar pedido</Enviar></div>
              </form>
            </Janela>
          </div>
        </section>

        {/* Agenda */}
        <section className="folha p-6">
          <h2 className="titulo-secao flex items-center gap-2"><CalendarDays size={19} strokeWidth={1.8} />Agenda</h2>
          {!vencs?.length ? <p className="apoio mt-4 text-[15px]">Sem audiências ou vencimentos marcados.</p> :
            <ol className="mt-4 space-y-0">{vencs.map((v, i) => {
              const d = diasAte(v.data);
              return (
                <li key={i} className="grid grid-cols-[56px_1fr] gap-3 py-3 linha first:border-0">
                  <div className="text-center rounded-lg py-1.5" style={{ background: d <= 3 ? "var(--bordo-claro)" : "var(--papel)" }}>
                    <div className="serif text-[20px] font-semibold leading-none" style={{ color: d <= 3 ? "var(--bordo)" : "var(--tinta)" }}>{v.data.slice(8, 10)}</div>
                    <div className="text-[11px] discreto mt-0.5">{dataCurta(v.data).split(" ")[2] ?? dataCurta(v.data).slice(-3)}</div>
                  </div>
                  <div className="min-w-0"><p className="font-medium text-[15px]">{v.descricao}</p>
                    <p className="text-sm discreto">{d === 0 ? "Hoje" : d === 1 ? "Amanhã" : `Em ${d} dias`}</p></div>
                </li>);
            })}</ol>}
          <h3 className="font-semibold text-[15px] mt-7 mb-2">Certidões</h3>
          {!certs?.length ? <p className="text-sm apoio">Guarde as certidões em <Link className="underline" href={`/cliente/documentos?c=${cid}`}>Documentos</Link> com a data de validade para ser avisado antes de vencer.</p> :
            <ul className="space-y-2">{certs.map((c, i) => {
              const venc = c.validade ? diasAte(c.validade) : 99;
              const cls = (c.situacao ?? "").toLowerCase().startsWith("positiva") && !(c.situacao ?? "").includes("efeito") || venc < 0 ? "etq-risco" : venc <= 30 ? "etq-alerta" : "etq-ok";
              return <li key={i} className="flex items-center justify-between gap-3 text-sm"><span>{c.tipo}</span>
                <span className={`etiqueta ${cls}`}>{venc < 0 ? "vencida" : `válida até ${dataBR(c.validade)}`}</span></li>;
            })}</ul>}
        </section>
      </div>

      {/* Últimas movimentações */}
      {!!todos.length && (
        <section className="folha p-6 mt-6">
          <h2 className="titulo-secao">Últimas movimentações</h2>
          <p className="text-sm apoio mt-1">Publicações oficiais dos seus processos, na ordem em que saíram.</p>
          <ol className="mt-4">{todos.slice(0, 8).map((m, i) => {
            const p = (procs ?? []).find((x: any) => x.id === m.processo_id);
            return (
              <li key={i} className="grid grid-cols-[64px_1fr] gap-4 py-3.5 linha first:border-0">
                <div className="text-[13px] discreto pt-0.5">{dataCurta(m.data.slice(0, 10))}</div>
                <div className="min-w-0"><p className="text-[13px] font-semibold" style={{ color: "var(--bordo)" }}>{p?.classe ?? "Processo"} · <span className="numero-cnj font-normal discreto">{p?.numero_cnj}</span></p>
                  <p className="text-[15px] mt-0.5 max-w-[78ch]">{m.texto}</p></div>
              </li>);
          })}</ol>
        </section>)}

      {/* Processos */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="titulo-secao flex items-center gap-2"><Gavel size={19} strokeWidth={1.8} />Seus processos</h2>
          <span className="text-sm discreto">{(procs ?? []).length} no total</span>
        </div>
        {!procs?.length ? <div className="folha p-6 apoio">Nenhum processo vinculado à empresa.</div> :
          <div className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>
            {procs.map((p) => {
              const pl = polo.get(p.id); const hist = linhaDoTempo.get(p.id) ?? [];
              const enc = p.situacao === "arquivado" || p.situacao === "baixado";
              return (
                <details key={p.id} className="group" style={{ borderColor: "var(--fio-2)" }}>
                  <summary className="grid grid-cols-[auto_1fr_auto] gap-3 sm:gap-4 items-center px-4 sm:px-5 py-4 hover:bg-[var(--papel)]">
                    <span className="w-9 h-9 rounded-full grid place-items-center shrink-0" title={pl === "ativo" ? "Sua empresa é autora" : pl === "passivo" ? "Sua empresa é ré" : "Processo"}
                      style={{ background: enc ? "var(--fio-2)" : "var(--bordo-claro)", color: enc ? "var(--tinta-3)" : "var(--bordo)" }}>
                      {pl === "ativo" ? <ArrowUpRight size={17} /> : pl === "passivo" ? <ArrowDownLeft size={17} /> : <Gavel size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-[15px] truncate">{p.resumo_cliente ? p.resumo_cliente.split(".")[0] : p.classe ?? "Processo"}</span>
                      <span className="block text-[13px] discreto truncate numero-cnj">{p.numero_cnj} · {p.tribunal}{p.ultima_mov_em ? ` · movimentado em ${dataBR(p.ultima_mov_em)}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {enc ? <span className="etiqueta">Encerrado</span> : p.risco !== "indefinido" &&
                        <span className={`etiqueta hidden sm:inline-flex ${p.risco === "alto" ? "etq-risco" : p.risco === "medio" ? "etq-alerta" : "etq-ok"}`}>
                          Risco {p.risco === "medio" ? "médio" : p.risco}</span>}
                      <ChevronRight size={18} className="gira discreto" />
                    </span>
                  </summary>
                  <div className="px-4 sm:px-5 pb-5 sm:pl-[72px]">
                    {p.resumo_cliente && <p className="text-[15px] max-w-[68ch]">{p.resumo_cliente}</p>}
                    <p className="text-sm discreto mt-1">{p.orgao_julgador}</p>
                    {hist.length ? (
                      <ol className="mt-4 relative pl-5 space-y-3" style={{ borderLeft: "2px solid var(--fio)" }}>
                        {hist.map((m, i) => <li key={i} className="relative">
                          <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full" style={{ background: i === 0 ? "var(--bordo)" : "var(--fio)", border: "2px solid var(--folha)" }} />
                          <p className="text-[13px] discreto">{dataBR(m.data)}</p><p className="text-[15px] max-w-[72ch]">{m.texto}</p></li>)}
                      </ol>) : <p className="text-sm apoio mt-3">Sem movimentações publicadas recentemente.</p>}
                  </div>
                </details>);
            })}
          </div>}
      </section>

      {/* Pedidos e envios */}
      {(!!chamados?.length || !!envios?.length) && (
        <section className="grid gap-6 lg:grid-cols-2 mt-6">
          {!!chamados?.length && <div className="folha p-6"><h2 className="titulo-secao">Seus pedidos</h2>
            <ul className="mt-3">{chamados.map((c) => <li key={c.id} className="flex justify-between items-center gap-3 py-3 linha first:border-0">
              <span className="min-w-0"><span className="block font-medium truncate">{c.titulo}</span><span className="text-[13px] discreto">{rotuloChamado[c.tipo]} · {dataBR(c.criado_em)}</span></span>
              <span className={`etiqueta ${classeStatus[c.status]}`}>{rotuloStatus[c.status]}</span></li>)}</ul></div>}
          {!!envios?.length && <div className="folha p-6"><h2 className="titulo-secao">Documentos enviados</h2>
            <ul className="mt-3">{envios.map((e) => <li key={e.id} className="py-3 linha first:border-0">
              <div className="flex justify-between gap-3"><span className="font-medium">{dataBR(e.criado_em)}</span><span className={`etiqueta ${classeStatus[e.status]}`}>{rotuloStatus[e.status]}</span></div>
              {e.retorno_cliente && <p className="text-sm mt-1 apoio">{e.retorno_cliente}</p>}</li>)}</ul></div>}
        </section>)}
    </Shell>
  );
}

function Fato({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return <div className="min-w-0"><dt className="text-[13px] apoio">{rotulo}</dt>
    <dd className="serif text-[22px] font-semibold leading-tight mt-0.5">{valor}</dd>
    {nota && <dd className="text-[13px] discreto truncate">{nota}</dd>}</div>;
}
function fmtDoc(d?: string | null) {
  if (!d) return "não informado";
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d;
}
function curto(n: string) { return n.replace(/ (Ltda|LTDA|Eireli|S\/A|ME|EPP)\.?$/,"").replace(/ – .*$/, ""); }
