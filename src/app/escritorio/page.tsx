import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { Topo, dataBR, rotuloChamado, rotuloStatus } from "@/components";

export const dynamic = "force-dynamic";

export default async function PainelEscritorio() {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  if (perfil.papel === "cliente") redirect("/cliente");

  const hoje = new Date().toISOString().slice(0, 10);
  const em15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  const [{ data: prazos }, { data: envios }, { data: chamados }, { data: clientes }, { count: nProc }] = await Promise.all([
    sb.from("prazos").select("id,descricao,data_fatal,data_segura,processos(numero_cnj)").eq("concluido", false)
      .lte("data_fatal", em15).order("data_fatal").limit(20),
    sb.from("intimacoes_enviadas").select("id,observacao,status,criado_em,clientes(nome)").in("status", ["recebida", "em_triagem"])
      .order("criado_em").limit(20),
    sb.from("chamados").select("id,tipo,titulo,status,prazo_cliente,clientes(nome)").not("status", "in", "(concluido,cancelado)")
      .order("prazo_cliente", { nullsFirst: false }).limit(20),
    sb.from("clientes").select("id,nome,documento,plano").eq("ativo", true).order("nome"),
    sb.from("processos").select("id", { count: "exact", head: true }),
  ]);

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Topo nome={perfil.nome} area="Escritório" />
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
              <li key={p.id} className="py-2 flex justify-between gap-3">
                <span><span className="font-mono">{p.processos?.numero_cnj}</span> — {p.descricao}</span>
                <span className="whitespace-nowrap" style={{ color: p.data_fatal <= hoje ? "var(--bad)" : "inherit" }}>
                  {dataBR(p.data_fatal)}</span></li>)}</ul>}
        </section>

        <section className="card">
          <h2 className="font-semibold mb-3">Intimações enviadas por clientes</h2>
          {!envios?.length ? <p className="muted text-sm">Nada novo.</p> :
            <ul className="text-sm space-y-2">{envios.map((e: any) =>
              <li key={e.id}><span className="pill mr-2">{rotuloStatus[e.status]}</span>{e.clientes?.nome} · {dataBR(e.criado_em)}
                {e.observacao ? <span className="muted"> — {e.observacao}</span> : null}</li>)}</ul>}
        </section>

        <section className="card">
          <h2 className="font-semibold mb-3">Central jurídica</h2>
          {!chamados?.length ? <p className="muted text-sm">Nenhum chamado aberto.</p> :
            <ul className="text-sm space-y-2">{chamados.map((c: any) =>
              <li key={c.id} className="flex justify-between gap-3">
                <span>{c.clientes?.nome} · {rotuloChamado[c.tipo]} · {c.titulo}</span>
                <span className="muted whitespace-nowrap">{c.prazo_cliente ? dataBR(c.prazo_cliente) : rotuloStatus[c.status]}</span></li>)}</ul>}
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
