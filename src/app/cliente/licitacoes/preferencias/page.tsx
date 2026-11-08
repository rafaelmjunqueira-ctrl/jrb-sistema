import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { AbasCliente } from "@/components/abas-cliente";
import { SubNavLicitacoes } from "@/components/licitacoes";
import { Enviar } from "@/components/interativos";
import { AREAS, MODALIDADES, UFS } from "@/lib/areas";
import { empresaAtual } from "@/lib/cliente";
import { salvarPreferencias } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Preferencias({ searchParams }: { searchParams: { c?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  const { atual } = await empresaAtual(sb, searchParams.c);
  if (!atual) redirect("/cliente");
  const [{ data: p }, { count: nAcomp }] = await Promise.all([
    sb.from("licitacao_preferencias").select("*").eq("cliente_id", atual.id).maybeSingle(),
    sb.from("edital_acompanhamentos").select("id", { count: "exact", head: true }).eq("cliente_id", atual.id),
  ]);
  const pref = p ?? { areas: [], ufs: [], palavras: [], excluir: [], modalidades: [], valor_min: null, valor_max: null };

  return (
    <Shell perfil={perfil} titulo={atual.nome} subtitulo="Licitações">
      <AbasCliente cid={atual.id} atual="licitacoes" />
      <SubNavLicitacoes cid={atual.id} atual="preferencias" nAcomp={nAcomp ?? 0} />
      <form action={salvarPreferencias} className="space-y-6 max-w-3xl">
        <input type="hidden" name="cliente_id" value={atual.id} />
        <div><h2 className="titulo-secao">O que sua empresa quer encontrar</h2>
          <p className="apoio mt-1 max-w-[62ch]">Os editais que combinam com qualquer área ou palavra-chave abaixo aparecem em &quot;Para minha empresa&quot;. Você continua podendo buscar em todas as áreas quando quiser.</p></div>

        <section className="folha p-6">
          <h3 className="font-semibold">Áreas de atuação</h3>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">{AREAS.map((a) => (
            <label key={a.id} className="cursor-pointer">
              <input type="checkbox" name="area" value={a.id} defaultChecked={pref.areas.includes(a.id)} className="peer sr-only" />
              <span data-opcao className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] border peer-focus-visible:outline peer-focus-visible:outline-2">{a.nome}</span>
            </label>))}</div>
        </section>

        <section className="folha p-6">
          <h3 className="font-semibold">Palavras-chave</h3>
          <p className="text-sm apoio mt-1">Uma por linha ou separadas por vírgula. Use o que aparece no objeto dos editais que você disputa.</p>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div><label className="rotulo" htmlFor="palavras">Buscar editais com</label>
              <textarea id="palavras" name="palavras" rows={5} className="campo" defaultValue={pref.palavras.join("\n")} placeholder={"suporte avançado de vida\nsimulação realística\nplantões médicos"} /></div>
            <div><label className="rotulo" htmlFor="excluir">Esconder editais com</label>
              <textarea id="excluir" name="excluir" rows={5} className="campo" defaultValue={pref.excluir.join("\n")} placeholder={"veterinário\nobra"} /></div>
          </div>
        </section>

        <section className="folha p-6">
          <h3 className="font-semibold">Onde você atende</h3>
          <p className="text-sm apoio mt-1">Deixe tudo desmarcado para receber editais de todo o Brasil.</p>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5 mt-3">{UFS.map((u) => (
            <label key={u} className="cursor-pointer"><input type="checkbox" name="uf" value={u} defaultChecked={pref.ufs.includes(u)} className="peer sr-only" />
              <span data-opcao className="block text-center text-[13px] font-medium rounded-md py-2 border peer-focus-visible:outline peer-focus-visible:outline-2">{u}</span></label>))}</div>
        </section>

        <section className="folha p-6 grid sm:grid-cols-2 gap-6">
          <fieldset><legend className="font-semibold">Modalidades</legend>
            <p className="text-sm apoio mt-1 mb-2">Nenhuma marcada = todas.</p>
            <div className="space-y-1.5">{MODALIDADES.map((m) => <label key={m.id} className="flex items-center gap-2 text-[14px] cursor-pointer">
              <input type="checkbox" name="mod" value={m.id} defaultChecked={pref.modalidades.includes(m.id)} />{m.nome}</label>)}</div></fieldset>
          <fieldset><legend className="font-semibold">Valor estimado (R$)</legend>
            <p className="text-sm apoio mt-1 mb-2">Para ignorar editais pequenos ou grandes demais.</p>
            <div className="grid grid-cols-2 gap-2"><input name="vmin" className="campo" inputMode="numeric" placeholder="mínimo" defaultValue={pref.valor_min ?? ""} />
              <input name="vmax" className="campo" inputMode="numeric" placeholder="máximo" defaultValue={pref.valor_max ?? ""} /></div></fieldset>
        </section>

        <div className="flex flex-wrap gap-3 items-center"><Enviar pendente="Salvando…">Salvar e ver editais</Enviar>
          <span className="text-sm discreto">Os editais são atualizados todos os dias às 6h e às 18h.</span></div>
        <style>{`[data-opcao]{background:var(--folha);border-color:var(--fio)} input:checked+[data-opcao]{background:var(--bordo);border-color:var(--bordo);color:var(--sobre-bordo)}`}</style>
      </form>
    </Shell>
  );
}
