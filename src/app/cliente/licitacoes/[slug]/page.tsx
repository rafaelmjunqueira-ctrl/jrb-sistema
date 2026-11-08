import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink, FileDown, Gavel, Star, History, Building2, MapPin } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { AbasCliente } from "@/components/abas-cliente";
import { Janela, Enviar, SelectEnvia } from "@/components/interativos";
import { capitaliza, titulo, prazoInfo, STATUS_ACOMP } from "@/components/licitacoes";
import { dataBR, reais } from "@/components/util";
import { NOME_AREA } from "@/lib/areas";
import { arquivos, itens, linkPncp } from "@/lib/pncp";
import { empresaAtual } from "@/lib/cliente";
import { alternarAcompanhamento, atualizarAcompanhamento } from "../acoes";
import { abrirChamado } from "../../acoes";

export const dynamic = "force-dynamic";
const dh = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function Edital({ params, searchParams }: { params: { slug: string }; searchParams: { c?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  const { atual } = await empresaAtual(sb, searchParams.c);
  if (!atual) redirect("/cliente");
  const m = /^(\d{14})-(\d{4})-(\d+)$/.exec(params.slug);
  if (!m) notFound();
  const { data: e } = await sb.from("editais").select("*").eq("orgao_cnpj", m[1]).eq("ano", +m[2]).eq("sequencial", +m[3]).maybeSingle();
  if (!e) notFound();

  const [docs, its, { data: eventos }, { data: acomp }] = await Promise.all([
    arquivos(e.orgao_cnpj, e.ano, e.sequencial), itens(e.orgao_cnpj, e.ano, e.sequencial),
    sb.from("edital_eventos").select("descricao,criado_em").eq("edital_id", e.id).order("criado_em", { ascending: false }),
    sb.from("edital_acompanhamentos").select("status,nota,visto_em").eq("cliente_id", atual.id).eq("edital_id", e.id).maybeSingle(),
  ]);
  if (acomp) await sb.from("edital_acompanhamentos").update({ visto_em: new Date().toISOString() }).eq("cliente_id", atual.id).eq("edital_id", e.id);
  const visto = acomp?.visto_em ? new Date(acomp.visto_em).getTime() : Infinity;
  const p = prazoInfo(e.encerramento_em);
  const aqui = `/cliente/licitacoes/${params.slug}?c=${atual.id}`;
  const encerrado = e.encerramento_em && new Date(e.encerramento_em).getTime() < Date.now();
  const somaItens = its.reduce((s, i) => s + Number(i.valorTotal || 0), 0);

  return (
    <Shell perfil={perfil} titulo={atual.nome} subtitulo="Licitações">
      <AbasCliente cid={atual.id} atual="licitacoes" />
      <Link href={`/cliente/licitacoes?c=${atual.id}`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "var(--bordo)" }}><ChevronLeft size={15} />Voltar aos editais</Link>

      <article className="folha-elevada p-6 sm:p-8">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="etiqueta etq-bordo">{e.modalidade}</span>
          {e.situacao_id !== 1 && <span className={`etiqueta ${e.situacao_id === 4 ? "etq-alerta" : "etq-risco"}`}>{e.situacao}</span>}
          {e.srp && <span className="etiqueta">Registro de preços</span>}
          {(e.areas ?? []).map((a: string) => <span key={a} className="etiqueta">{NOME_AREA[a] ?? a}</span>)}
        </div>
        <h2 className="serif text-[22px] sm:text-[26px] leading-snug font-semibold max-w-[70ch]">{capitaliza(e.objeto)}</h2>
        <p className="apoio mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
          <span className="inline-flex items-center gap-1.5"><Building2 size={15} />{titulo(e.orgao_nome)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{e.municipio}/{e.uf}</span>
        </p>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 linha">
          <Info rotulo="Encerramento das propostas" valor={dh(e.encerramento_em)} nota={p.texto} destaque={!encerrado} />
          <Info rotulo="Abertura das propostas" valor={dh(e.abertura_em)} />
          <Info rotulo="Valor estimado" valor={e.valor_estimado ? reais(Number(e.valor_estimado)) : "Sigiloso ou não informado"} />
          <Info rotulo="Número" valor={e.numero ?? "—"} nota={e.processo ? `Processo ${e.processo}` : undefined} />
        </dl>

        <div className="flex flex-wrap gap-2 mt-7">
          <form action={alternarAcompanhamento}>
            <input type="hidden" name="cliente_id" value={atual.id} /><input type="hidden" name="edital_id" value={e.id} /><input type="hidden" name="volta" value={aqui} />
            <Enviar className={acomp ? "btn-sec" : "btn"} pendente="…"><Star size={16} fill={acomp ? "var(--ouro)" : "none"} style={acomp ? { color: "var(--ouro)" } : {}} />{acomp ? "Acompanhando" : "Acompanhar edital"}</Enviar>
          </form>
          <a href={linkPncp(e.orgao_cnpj, e.ano, e.sequencial)} target="_blank" rel="noreferrer" className="btn-sec"><ExternalLink size={16} />Ver no PNCP</a>
          {e.link_origem && <a href={e.link_origem} target="_blank" rel="noreferrer" className="btn-sec"><ExternalLink size={16} />Portal da disputa</a>}
          {!encerrado && <Janela rotulo="Pedir impugnação ou análise" classeBotao="btn-sec" icone={<Gavel size={16} />} titulo="Pedir ao escritório"
            descricao="A JRB analisa o edital e, se for o caso, prepara impugnação ou pedido de esclarecimento dentro do prazo.">
            <form action={abrirChamado} className="grid gap-4">
              <input type="hidden" name="cliente_id" value={atual.id} /><input type="hidden" name="referencia" value={`${e.modalidade} ${e.numero ?? ""} · ${titulo(e.orgao_nome)} · ${linkPncp(e.orgao_cnpj, e.ano, e.sequencial)}`} />
              <div><label className="rotulo">Tipo</label><select name="tipo" className="campo" defaultValue="impugnacao">
                <option value="impugnacao">Impugnação do edital</option><option value="consulta">Análise do edital</option><option value="recurso_administrativo">Recurso administrativo</option></select></div>
              <input type="hidden" name="prazo" value={e.encerramento_em ? new Date(new Date(e.encerramento_em).getTime() - 3 * 86400000).toISOString().slice(0, 10) : ""} />
              <input type="hidden" name="titulo" value={capitaliza(e.objeto).slice(0, 140)} />
              <div><label className="rotulo">O que preocupa você neste edital?</label>
                <textarea name="descricao" rows={4} className="campo" placeholder="Ex.: exige atestado com quantidade acima do razoável; prazo de entrega impossível" /></div>
              <Enviar pendente="Enviando…">Enviar ao escritório</Enviar>
              <p className="text-[12px] discreto">A impugnação precisa ser protocolada até 3 dias úteis antes da abertura (Lei 14.133, art. 164).</p>
            </form>
          </Janela>}
        </div>
      </article>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr] mt-6 items-start">
        <div className="space-y-6 min-w-0">
          <section className="folha p-6">
            <h3 className="titulo-secao">Documentos</h3>
            {!docs.length ? <p className="apoio mt-2">O órgão não anexou documentos no PNCP. Veja no portal da disputa.</p> :
              <ul className="mt-3">{docs.map((d) => (
                <li key={d.sequencialDocumento} className="linha first:border-0">
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3 group">
                    <span className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--bordo-claro)", color: "var(--bordo)" }}><FileDown size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block font-medium truncate group-hover:underline">{d.titulo || d.tipoDocumentoNome}</span>
                      <span className="text-[13px] discreto">{d.tipoDocumentoNome} · publicado em {dataBR(d.dataPublicacaoPncp)}</span></span>
                  </a></li>))}</ul>}
          </section>

          {!!its.length && <section className="folha">
            <div className="flex items-baseline justify-between px-6 pt-5 pb-3"><h3 className="titulo-secao">Itens</h3>
              <span className="text-sm discreto">{its.length}{its.length === 100 ? "+" : ""} ite{its.length === 1 ? "m" : "ns"}{somaItens ? ` · ${reais(somaItens)}` : ""}</span></div>
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-[12px] discreto"><th className="px-6 py-2 font-medium">Item</th><th className="py-2 font-medium">Descrição</th>
                <th className="py-2 font-medium text-right">Qtd.</th><th className="py-2 px-6 font-medium text-right">Valor unit.</th></tr></thead>
              <tbody>{its.slice(0, 60).map((i) => <tr key={i.numeroItem} className="linha align-top">
                <td className="px-6 py-2.5 discreto">{i.numeroItem}</td>
                <td className="py-2.5 pr-3"><span className="line-clamp-2">{capitaliza(i.descricao)}</span>
                  {i.tipoBeneficioNome && /exclusiva|cota/i.test(i.tipoBeneficioNome) && <span className="text-[12px]" style={{ color: "var(--ok)" }}>{i.tipoBeneficioNome}</span>}</td>
                <td className="py-2.5 text-right whitespace-nowrap">{Number(i.quantidade).toLocaleString("pt-BR")} {i.unidadeMedida?.toLowerCase()}</td>
                <td className="py-2.5 px-6 text-right whitespace-nowrap">{i.orcamentoSigiloso ? "sigiloso" : i.valorUnitarioEstimado != null ? Number(i.valorUnitarioEstimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
              </tr>)}</tbody></table></div>
            {its.length > 60 && <p className="px-6 py-3 text-sm discreto">Mostrando 60 itens. A lista completa está no PNCP.</p>}
          </section>}
        </div>

        <div className="space-y-6">
          {acomp && <section className="folha p-6">
            <h3 className="titulo-secao">Seu acompanhamento</h3>
            <form action={atualizarAcompanhamento} className="mt-3 space-y-3">
              <input type="hidden" name="cliente_id" value={atual.id} /><input type="hidden" name="edital_id" value={e.id} /><input type="hidden" name="volta" value={aqui} />
              <div><label className="rotulo" htmlFor="st">Situação</label>
                <SelectEnvia id="st" name="status" defaultValue={acomp.status} className="campo">{STATUS_ACOMP.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</SelectEnvia></div>
              <div><label className="rotulo" htmlFor="nota">Anotações da equipe</label>
                <textarea id="nota" name="nota" rows={4} defaultValue={acomp.nota ?? ""} className="campo" placeholder="Documentos que faltam, preço-alvo, dúvidas…" /></div>
              <Enviar className="btn-sec">Salvar anotação</Enviar>
            </form>
          </section>}

          <section className="folha p-6">
            <h3 className="titulo-secao flex items-center gap-2"><History size={18} />Alterações</h3>
            {!eventos?.length ? <p className="apoio text-sm mt-2">{acomp ? "Nenhuma alteração desde que você começou a acompanhar. Conferimos o PNCP todos os dias." : "Acompanhe o edital para ser avisado de erratas, mudanças de prazo e suspensões."}</p> :
              <ol className="mt-3 space-y-3">{eventos.map((v, i) => {
                const novo = new Date(v.criado_em).getTime() > visto;
                return <li key={i} className="rounded-lg p-3" style={{ background: novo ? "var(--alerta-fundo)" : "var(--papel)" }}>
                  <p className="text-[12px] discreto">{dataBR(v.criado_em)}{novo && <b style={{ color: "var(--alerta)" }}> · novo</b>}</p><p className="text-[14px]">{v.descricao}</p></li>;
              })}</ol>}
          </section>

          <section className="folha p-6 text-sm space-y-2">
            <h3 className="titulo-secao mb-1">Dados do PNCP</h3>
            <p><span className="discreto">Unidade compradora</span><br />{titulo(e.unidade_nome)}</p>
            <p><span className="discreto">Modo de disputa</span><br />{e.modo_disputa ?? "—"}</p>
            <p><span className="discreto">Publicado em</span><br />{dh(e.publicado_em)}</p>
            <p><span className="discreto">Identificador</span><br /><span className="numero-cnj">{e.id}</span></p>
            {e.info_complementar && <p><span className="discreto">Informação complementar</span><br />{e.info_complementar}</p>}
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Info({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return <div className="min-w-0"><dt className="text-[13px] apoio">{rotulo}</dt>
    <dd className="serif text-[17px] font-semibold mt-0.5" style={destaque ? { color: "var(--bordo)" } : {}}>{valor}</dd>
    {nota && <dd className="text-[13px] discreto">{nota}</dd>}</div>;
}
