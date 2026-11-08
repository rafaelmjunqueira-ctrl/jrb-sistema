import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { Topo, dataBR } from "@/components";
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
    sb.from("prazos").select("id,descricao,data_fatal,data_segura,concluido,concluido_em").eq("processo_id", id).order("data_fatal", { ascending: false }),
  ]);
  if (!p) notFound();
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Topo nome={perfil.nome} area="Processo" equipe />
      <div className="mb-4">
        <Link href="/escritorio/processos" className="text-sm underline">← Processos</Link>
        <h2 className="font-mono text-lg mt-1">{p.numero_cnj}</h2>
        <p className="text-sm muted">{p.tribunal} · {p.orgao_julgador} · {p.classe}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="font-semibold mb-3">Ficha</h3>
          <form action={salvarProcesso} className="grid gap-2 sm:grid-cols-3">
            <input type="hidden" name="id" value={p.id} />
            <label className="text-sm">Risco<select name="risco" defaultValue={p.risco} className="input mt-1">
              {["indefinido", "baixo", "medio", "alto"].map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="text-sm">Situação<select name="situacao" defaultValue={p.situacao ?? "ativo"} className="input mt-1">
              {["ativo", "parado", "suspenso", "arquivado", "baixado"].map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="text-sm">Exposição (R$)<input name="exposicao_estimada" defaultValue={p.exposicao_estimada ?? ""} className="input mt-1" placeholder="0,00" /></label>
            <label className="text-sm sm:col-span-3">Resumo para o cliente (linguagem simples)
              <textarea name="resumo_cliente" rows={3} defaultValue={p.resumo_cliente ?? ""} className="input mt-1" /></label>
            <label className="text-sm sm:col-span-3">Nota interna (só equipe)
              <textarea name="nota" rows={3} defaultValue={nota?.nota ?? ""} className="input mt-1" /></label>
            <button className="btn sm:col-span-3">Salvar ficha</button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-3">Clientes vinculados</h3>
            {!vinc?.length ? <p className="text-sm muted">Nenhum. Vincule para o processo aparecer no painel do cliente.</p> :
              <ul className="text-sm space-y-2">{vinc.map((v: any) =>
                <li key={v.cliente_id} className="flex justify-between items-center gap-2">
                  <span>{v.clientes?.nome} {v.polo && <span className="muted">· {v.polo}</span>}</span>
                  <form action={desvincularCliente}><input type="hidden" name="processo_id" value={p.id} />
                    <input type="hidden" name="cliente_id" value={v.cliente_id} /><button className="pill">Remover</button></form>
                </li>)}</ul>}
            <form action={vincularCliente} className="grid gap-2 sm:grid-cols-[1.5fr_1fr_auto] mt-3">
              <input type="hidden" name="processo_id" value={p.id} />
              <select name="cliente_id" className="input" required>{(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <select name="polo" className="input"><option value="">Polo</option><option value="ativo">Ativo (autor)</option>
                <option value="passivo">Passivo (réu)</option><option value="terceiro">Terceiro</option></select>
              <button className="btn">Vincular</button>
            </form>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Prazos</h3>
            <ul className="text-sm space-y-2">{(prazos ?? []).map((z) =>
              <li key={z.id} className="flex justify-between items-start gap-3">
                <span className={z.concluido ? "muted line-through" : ""}>{z.descricao}</span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span style={{ color: !z.concluido && z.data_fatal < hoje ? "var(--bad)" : "inherit" }}>{dataBR(z.data_fatal)}</span>
                  {!z.concluido && <form action={baixarPrazo}><input type="hidden" name="id" value={z.id} /><button className="pill">Cumprido</button></form>}
                </span>
              </li>)}</ul>
            <form action={novoPrazo} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] mt-3">
              <input type="hidden" name="processo_id" value={p.id} />
              <input name="descricao" className="input" required placeholder="Novo prazo" />
              <input name="data_fatal" type="date" className="input" required title="Data fatal" />
              <input name="data_segura" type="date" className="input" title="Data segura" />
              <button className="btn">Incluir</button>
            </form>
          </div>
        </section>
      </div>

      <section className="card mt-4">
        <h3 className="font-semibold">Andamentos</h3>
        <p className="text-sm muted mb-3">Nada chega ao cliente sem resumo e sem marcar &quot;Liberar ao cliente&quot;.</p>
        <ul className="space-y-4">{(movs ?? []).map((m) =>
          <li key={m.id} className="border-t pt-3" style={{ borderColor: "var(--line)" }}>
            <p className="text-xs muted">{dataBR(m.data)} {m.visivel_cliente && <span className="pill ml-2" style={{ color: "var(--ok)" }}>visível ao cliente</span>}</p>
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">{(m.texto_original ?? "").slice(0, 1200)}</p>
            <form action={salvarAndamento} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] mt-2 items-center">
              <input type="hidden" name="id" value={m.id} /><input type="hidden" name="processo_id" value={p.id} />
              <input name="resumo_simples" defaultValue={m.resumo_simples ?? ""} className="input" placeholder="Resumo para o cliente" />
              <label className="text-sm flex items-center gap-2"><input type="checkbox" name="visivel_cliente" defaultChecked={m.visivel_cliente} /> Liberar ao cliente</label>
              <button className="pill">Salvar</button>
            </form>
          </li>)}</ul>
      </section>
    </main>
  );
}
