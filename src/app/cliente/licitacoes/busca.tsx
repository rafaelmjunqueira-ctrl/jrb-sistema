import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { AbasCliente } from "@/components/abas-cliente";
import { CartaoEdital, SubNavLicitacoes, SubNavEscritorio } from "@/components/licitacoes";
import { PainelRecolhivel } from "@/components/interativos";
import { AREAS, MODALIDADES, UFS, semAcento } from "@/lib/areas";
import { empresaAtual, lista, dispararColeta } from "@/lib/cliente";
import { alternarAcompanhamento } from "./acoes";

const POR_PAG = 20;
type SP = Record<string, string | string[] | undefined>;

// Busca de editais. Na área do cliente fica presa a uma empresa (?c=); no escritório (escritorio=true) busca livre, sem cliente.
export async function BuscaEditais({ searchParams, escritorio = false }: { searchParams: SP; escritorio?: boolean }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  if (escritorio && perfil.papel === "cliente") redirect("/cliente/licitacoes");
  const one = (k: string) => (Array.isArray(searchParams[k]) ? (searchParams[k] as string[])[0] : (searchParams[k] as string | undefined)) ?? "";
  // Equipe sem empresa escolhida vai para a busca do escritório (não "empresta" o primeiro cliente da lista)
  if (!escritorio && perfil.papel !== "cliente" && !one("c")) {
    const u = new URLSearchParams(); for (const [k, v] of Object.entries(searchParams)) for (const x of lista(v as any)) if (k !== "modo") u.append(k, x);
    redirect(`/escritorio/licitacoes?${u}`);
  }
  const atual = escritorio ? null : (await empresaAtual(sb, searchParams.c as string)).atual;
  if (!escritorio && !atual) redirect("/cliente");
  const cid = atual?.id ?? "";
  const base = escritorio ? "/escritorio/licitacoes" : "/cliente/licitacoes";

  const [{ data: pref }, { data: seguidos }, { count: nEditais }] = await Promise.all([
    cid ? sb.from("licitacao_preferencias").select("*").eq("cliente_id", cid).maybeSingle() : Promise.resolve({ data: null as any }),
    cid ? sb.from("edital_acompanhamentos").select("edital_id").eq("cliente_id", cid) : Promise.resolve({ data: [] as any[] }),
    sb.from("editais").select("id", { count: "exact", head: true }),
  ]);
  if (!nEditais) await dispararColeta();
  const seg = new Set((seguidos ?? []).map((s: any) => s.edital_id as string));

  const f = { q: one("q"), areas: lista(searchParams.area), ufs: lista(searchParams.uf), mods: lista(searchParams.mod).map(Number), fontes: lista(searchParams.fonte), vmin: one("vmin"), vmax: one("vmax"), todas: one("todas") === "1", ordem: one("ordem") || "encerramento" };
  const temFiltro = !!(f.q || f.areas.length || f.ufs.length || f.mods.length || f.fontes.length || f.vmin || f.vmax);
  const temPref = !!pref && (pref.areas.length + pref.palavras.length + pref.ufs.length + pref.modalidades.length > 0);
  const modo = escritorio ? "livre" : one("modo") || (temFiltro ? "livre" : temPref ? "pref" : "livre");
  const pag = Math.max(1, Number(one("p") || 1));
  const num = (v: string) => (v ? Number(v.replace(/\./g, "").replace(",", ".")) || null : null);
  const ou = (t: string[]) => (t.length ? t.map((x) => `"${semAcento(x).replace(/"/g, "")}"`).join(" or ") : null);

  const args = modo === "pref" && pref ? {
    p_q: ou(pref.palavras), p_areas: pref.areas.length ? pref.areas : null, p_qualquer: true,
    p_ufs: pref.ufs.length ? pref.ufs : null, p_modalidades: pref.modalidades.length ? pref.modalidades : null,
    p_valor_min: pref.valor_min, p_valor_max: pref.valor_max, p_excluir: ou(pref.excluir),
  } : {
    p_q: f.q ? semAcento(f.q) : null, p_areas: f.areas.length ? f.areas : null, p_ufs: f.ufs.length ? f.ufs : null,
    p_modalidades: f.mods.length ? f.mods : null, p_valor_min: num(f.vmin), p_valor_max: num(f.vmax),
  };
  (args as any).p_fontes = f.fontes.length ? f.fontes : null;
  const { data: res, error } = await sb.rpc("buscar_editais", { ...args, p_abertas: !f.todas, p_ordem: f.ordem, p_limite: POR_PAG, p_offset: (pag - 1) * POR_PAG });
  const total = Number(res?.[0]?.total ?? 0);
  const desde = pref?.ultima_visita ? new Date(pref.ultima_visita).getTime() : 0;
  if (modo === "pref" && pref && pag === 1) await sb.from("licitacao_preferencias").update({ ultima_visita: new Date().toISOString() }).eq("cliente_id", cid);

  const qs = (extra: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) for (const x of lista(v as any)) u.append(k, x);
    for (const [k, v] of Object.entries(extra)) { u.delete(k); if (v != null) u.set(k, String(v)); }
    return `${base}?${u}`;
  };
  const volta = qs({});
  const nFiltros = f.areas.length + f.ufs.length + f.mods.length + f.fontes.length + (f.vmin ? 1 : 0) + (f.vmax ? 1 : 0) + (f.todas ? 1 : 0);

  return (
    <Shell perfil={perfil} titulo={atual?.nome ?? "Licitações"} subtitulo={escritorio ? "Busca livre em todo o Brasil, sem vincular a um cliente" : "Licitações abertas em todo o Brasil, atualizadas todo dia"}>
      {atual ? <><AbasCliente cid={cid} atual="licitacoes" /><SubNavLicitacoes cid={cid} atual="buscar" nAcomp={seg.size} /></> : <SubNavEscritorio atual="buscar" />}

      {/* Formulário de busca: os campos ficam espalhados na tela e apontam para ele (form="filtros"), sem aninhar formulários */}
      <form id="filtros" method="get" action={base}>{cid && <input type="hidden" name="c" value={cid} />}{!escritorio && <input type="hidden" name="modo" value="livre" />}</form>
      <div className="grid gap-6 lg:grid-cols-[272px_1fr] items-start">

        {/* Filtros */}
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:overscroll-contain rounded-xl">
          <PainelRecolhivel resumo={<>
            <span className="font-semibold flex items-center gap-2"><SlidersHorizontal size={16} />Filtros{nFiltros ? ` (${nFiltros})` : ""}</span>
            <span className="text-sm discreto lg:hidden">tocar para abrir</span></>}>
            <Filtros f={f} limpar={escritorio ? base : `${base}?c=${cid}&modo=livre`} />
          </PainelRecolhivel>
        </aside>

        {/* Resultados */}
        <section className="min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 discreto" />
              <input form="filtros" name="q" defaultValue={modo === "livre" ? f.q : ""} className="campo !pl-10 !py-3 !text-[16px]" placeholder="O que você vende? Ex.: treinamento, plantão médico, uniforme" /></div>
            <button form="filtros" className="btn !px-5">Buscar</button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {!escritorio && <>
            <Link href={`/cliente/licitacoes?c=${cid}&modo=pref`} className="etiqueta !py-1.5 !px-3 !text-[13px]"
              style={modo === "pref" ? { background: "var(--bordo)", color: "var(--sobre-bordo)" } : { background: "var(--folha)", border: "1px solid var(--fio)" }}>
              <Sparkles size={13} />Para minha empresa</Link>
            <Link href={`/cliente/licitacoes?c=${cid}&modo=livre`} className="etiqueta !py-1.5 !px-3 !text-[13px]"
              style={modo === "livre" ? { background: "var(--bordo)", color: "var(--sobre-bordo)" } : { background: "var(--folha)", border: "1px solid var(--fio)" }}>
              Todas as licitações</Link></>}
            <span className="text-sm discreto ml-auto">{nEditais ? `${total.toLocaleString("pt-BR")} edita${total === 1 ? "l" : "is"}` : ""}</span>
          </div>

          {one("salvo") && <p className="rounded-xl p-3.5 mt-4 text-sm" style={{ background: "var(--ok-fundo)", color: "var(--ok)" }}>Preferências salvas. Estes são os editais que combinam com elas.</p>}
          {modo === "pref" && !temPref && (
            <div className="folha-elevada p-6 mt-4"><p className="titulo-secao">Diga o que sua empresa vende</p>
              <p className="apoio mt-1 max-w-[60ch]">Escolha áreas, estados e palavras-chave. A cada dia, os editais que combinam aparecem aqui primeiro.</p>
              <Link href={`/cliente/licitacoes/preferencias?c=${cid}`} className="btn mt-4"><SlidersHorizontal size={16} />Definir preferências</Link></div>)}
          {modo === "pref" && temPref && <p className="text-sm apoio mt-3">Mostrando editais das suas preferências. <Link href={`/cliente/licitacoes/preferencias?c=${cid}`} className="underline" style={{ color: "var(--bordo)" }}>Ajustar</Link></p>}

          {!nEditais ? (
            <div className="folha p-8 mt-4 text-center"><RefreshCw size={26} className="mx-auto discreto animate-spin" style={{ animationDuration: "3s" }} />
              <p className="titulo-secao mt-3">Carregando os editais do país</p><p className="apoio mt-1">A primeira coleta leva alguns minutos. Atualize a página em instantes.</p></div>
          ) : error ? <p className="folha p-6 mt-4 apoio">A busca não entendeu esses termos. Tente palavras mais simples.</p>
          : !res?.length ? (modo === "pref" && !temPref ? null : <div className="folha p-8 mt-4"><p className="titulo-secao">Nenhum edital encontrado</p>
              <p className="apoio mt-1">Tente menos filtros, outros termos ou inclua as licitações encerradas.</p></div>)
          : (
            <ol className="space-y-3 mt-4">
              {res.map((e: any) => <CartaoEdital key={e.id} e={e} cid={cid} escritorio={escritorio} seguido={seg.has(e.id)} acao={alternarAcompanhamento} volta={volta}
                novo={modo === "pref" && !!desde && !!e.publicado_em && new Date(e.publicado_em).getTime() > desde} />)}
            </ol>)}

          {total > POR_PAG && <div className="flex items-center justify-between mt-5 text-sm">
            <span className="discreto">Página {pag} de {Math.ceil(total / POR_PAG)}</span>
            <div className="flex gap-2">
              {pag > 1 && <Link className="btn-sec" href={qs({ p: pag - 1 })}>Anterior</Link>}
              {pag * POR_PAG < total && <Link className="btn-sec" href={qs({ p: pag + 1 })}>Próxima</Link>}
            </div></div>}
          <p className="text-[12px] discreto mt-6">Fontes: Portal Nacional de Contratações Públicas (PNCP), Diário Oficial da União (seção 3) e diários oficiais municipais (DOSP), dados públicos. Confira sempre o edital oficial antes de participar.</p>
        </section>
      </div>
    </Shell>
  );
}

const FONTES = [{ id: "pncp", nome: "PNCP" }, { id: "dou", nome: "Diário Oficial da União" }, { id: "dosp", nome: "Diários municipais (DOSP)" }];

// Grupos curtos primeiro; a lista longa de áreas fica por último e recolhível, para não esconder modalidade e estado
function Filtros({ f, limpar }: { limpar: string; f: { areas: string[]; ufs: string[]; mods: number[]; fontes: string[]; vmin: string; vmax: string; todas: boolean; ordem: string } }) {
  return (
    <div className="px-5 pb-5 pt-1 space-y-5">
      <div className="flex gap-2"><button form="filtros" className="btn flex-1">Aplicar filtros</button><a href={limpar} className="btn-sec">Limpar</a></div>
      <div><label className="rotulo" htmlFor="ordem">Ordenar por</label>
        <select form="filtros" id="ordem" name="ordem" defaultValue={f.ordem} className="campo">
          <option value="encerramento">Prazo mais próximo</option><option value="recentes">Publicados por último</option><option value="valor">Maior valor</option></select></div>
      <fieldset><legend className="rotulo">Modalidade</legend>
        <div className="grid grid-cols-1 gap-1.5">{MODALIDADES.map((m) =>
          <label key={m.id} className="flex items-center gap-2 text-[14px] cursor-pointer"><input form="filtros" type="checkbox" name="mod" value={m.id} defaultChecked={f.mods.includes(m.id)} />{m.nome}</label>)}</div></fieldset>
      <fieldset><legend className="rotulo">Estado</legend>
        <div className="grid grid-cols-6 gap-1">{UFS.map((u) =>
          <label key={u} className="cursor-pointer"><input form="filtros" type="checkbox" name="uf" value={u} defaultChecked={f.ufs.includes(u)} className="peer sr-only" />
            <span className="block text-center text-[12px] font-medium rounded-md py-1.5 border peer-focus-visible:outline peer-focus-visible:outline-2"
              style={{ borderColor: "var(--fio)" }} data-uf>{u}</span></label>)}</div></fieldset>
      <fieldset><legend className="rotulo">Valor estimado (R$)</legend>
        <div className="grid grid-cols-2 gap-2"><input form="filtros" name="vmin" defaultValue={f.vmin} inputMode="numeric" className="campo" placeholder="mínimo" />
          <input form="filtros" name="vmax" defaultValue={f.vmax} inputMode="numeric" className="campo" placeholder="máximo" /></div></fieldset>
      <fieldset><legend className="rotulo">Onde foi publicado</legend>
        <div className="space-y-1.5">{FONTES.map((x) =>
          <label key={x.id} className="flex items-center gap-2 text-[14px] cursor-pointer"><input form="filtros" type="checkbox" name="fonte" value={x.id} defaultChecked={f.fontes.includes(x.id)} />{x.nome}</label>)}</div></fieldset>
      <label className="flex items-center gap-2 text-[14px] cursor-pointer"><input form="filtros" type="checkbox" name="todas" value="1" defaultChecked={f.todas} />Incluir propostas encerradas</label>
      <details open={f.areas.length > 0 || undefined} className="group">
        <summary className="rotulo flex items-center justify-between cursor-pointer list-none">Área{f.areas.length ? ` (${f.areas.length})` : ""}<ChevronDown size={16} className="transition-transform group-open:rotate-180" /></summary>
        <div className="space-y-1.5 mt-2">{AREAS.map((a) =>
          <label key={a.id} className="flex items-start gap-2 text-[14px] cursor-pointer"><input form="filtros" type="checkbox" name="area" value={a.id} defaultChecked={f.areas.includes(a.id)} className="mt-1" />{a.nome}</label>)}</div>
      </details>
      <button form="filtros" className="btn w-full">Aplicar filtros</button>
      <style>{`[data-uf]{background:var(--folha)} input:checked+[data-uf]{background:var(--bordo);border-color:var(--bordo);color:var(--sobre-bordo)}`}</style>
    </div>
  );
}
