import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { Topo, dataBR, rotuloChamado, rotuloStatus } from "@/components";
import { baixarPrazo, triarIntimacao, atualizarChamado, linkArquivo } from "./acoes";

export const dynamic = "force-dynamic";

export default async function PainelEscritorio() {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  if (perfil.papel === "cliente") redirect("/cliente");

  const hoje = new Date().toISOString().slice(0, 10);
  const em15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  const [{ data: prazos }, { data: envios }, { data: chamados }, { data: clientes }, { count: nProc }] = await Promise.all([
    sb.from("prazos").select("id,descricao,data_fatal,data_segura,processo_id,processos(numero_cnj)").eq("concluido", false)
      .lte("data_fatal", em15).order("data_fatal").limit(20),
    sb.from("intimacoes_enviadas").select("id,observacao,status,arquivo_path,retorno_cliente,criado_em,clientes(nome)").in("status", ["recebida", "em_triagem"])
      .order("criado_em").limit(20),
    sb.from("chamados").select("id,tipo,titulo,descricao,referencia,status,prazo_cliente,clientes(nome)").not("status", "in", "(concluido,cancelado)")
      .order("prazo_cliente", { nullsFirst: false }).limit(20),
    sb.from("clientes").select("id,nome,documento,plano").eq("ativo", true).order("nome"),
    sb.from("processos").select("id", { count: "exact", head: true }),
  ]);

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Topo nome={perfil.nome} area="Escritório" equipe />
      <div className="grid gap-4 sm:grid-cols-4 mb-4">
        <Num rotulo="Prazos em 15 dias" valor={prazos?.length ?? 0} alerta={(prazos ?? []).some((p) => p.data_fatal <= hoje)} />
        <Num rotulo="Envios de clientes" valor={envios?.length ?? 0} alerta={!!envios?.length} />
        <Num rotulo="Chamados abertos" valor={chamados?.length ?? 0} />
        <Num rotulo="Processos no acervo" valor={nProc ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold mb-3">Prazos</h2>
          {!prazos?.length ? <p className="muted text-sm">Nenhum prazo nos próximos 15 dias.</p> :
            <ul className="text-sm divide-y" style={{ borderColor: "var(--line)" }}>{prazos.map((p: any) =>
              <li key={p.id} className="py-2 flex justify-between gap-3 items-start">
                <span><Link className="font-mono underline" href={`/escritorio/processos/${p.processo_id}`}>{p.processos?.numero_cnj}</Link> — {p.descricao}</span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span style={{ color: p.data_fatal <= hoje ? "var(--bad)" : "inherit" }}>{dataBR(p.data_fatal)}</span>
                  <form action={baixarPrazo}><input type="hidden" name="id" value={p.id} /><button className="pill">Cumprido</button></form>
                </span></li>)}</ul>}
        </section>

        <section className="card">
          <h2 className="font-semibold mb-3">Intimações enviadas por clientes</h2>
          {!envios?.length ? <p className="muted text-sm">Nada novo.</p> :
            <ul className="text-sm space-y-4">{envios.map((e: any) =>
              <li key={e.id}>
                <p><span className="pill mr-2">{rotuloStatus[e.status]}</span>{e.clientes?.nome} · {dataBR(e.criado_em)}</p>
                {e.observacao && <p className="muted mt-1">{e.observacao}</p>}
                {e.arquivo_path && <form action={linkArquivo} className="mt-1"><input type="hidden" name="path" value={e.arquivo_path} />
                  <button className="underline">Abrir documento enviado</button></form>}
                <form action={triarIntimacao} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] mt-2">
                  <input type="hidden" name="id" value={e.id} />
                  <select name="status" defaultValue={e.status} className="input">
                    <option value="em_triagem">Em triagem</option><option value="triada">Analisada</option><option value="descartada">Descartada</option></select>
                  <input name="retorno_cliente" defaultValue={e.retorno_cliente ?? ""} className="input" placeholder="Resposta que o cliente verá" />
                  <button className="pill">Salvar</button>
                </form>
              </li>)}</ul>}
        </section>

        <section className="card">
          <h2 className="font-semibold mb-3">Central jurídica</h2>
          {!chamados?.length ? <p className="muted text-sm">Nenhum chamado aberto.</p> :
            <ul className="text-sm space-y-4">{chamados.map((c: any) =>
              <li key={c.id}>
                <p className="flex justify-between gap-3"><span><b>{c.clientes?.nome}</b> · {rotuloChamado[c.tipo]} · {c.titulo}</span>
                  <span className="muted whitespace-nowrap">{c.prazo_cliente ? "prazo " + dataBR(c.prazo_cliente) : ""}</span></p>
                {(c.descricao || c.referencia) && <p className="muted mt-1">{c.referencia ? `[${c.referencia}] ` : ""}{c.descricao}</p>}
                <form action={atualizarChamado} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto] mt-2 items-center">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="status" defaultValue={c.status} className="input">
                    {["aberto","em_analise","em_execucao","aguardando_cliente","concluido","cancelado"].map((k) => <option key={k} value={k}>{rotuloStatus[k]}</option>)}</select>
                  <input name="mensagem" className="input" placeholder="Mensagem ao cliente (opcional)" />
                  <label className="text-xs flex items-center gap-1"><input type="checkbox" name="interna" /> interna</label>
                  <button className="pill">Salvar</button>
                </form>
              </li>)}</ul>}
        </section>

        <section className="card">
          <h2 className="font-semibold mb-3">Clientes do painel</h2>
          {!clientes?.length ? <p className="muted text-sm">Nenhum cliente cadastrado.</p> :
            <ul className="text-sm space-y-2">{clientes.map((c) =>
              <li key={c.id} className="flex justify-between gap-3">
                <Link href={`/cliente?c=${c.id}`} className="underline">{c.nome}</Link>
                <span className="muted">{c.plano}</span></li>)}</ul>}
        </section>
      </div>
    </main>
  );
}

function Num({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return <div className="card"><p className="text-xs muted uppercase tracking-wider">{rotulo}</p>
    <p className="text-3xl font-semibold" style={{ color: alerta ? "var(--bad)" : "inherit" }}>{valor}</p></div>;
}
