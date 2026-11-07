import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { saudeJuridica, corSinal, rotuloSinal } from "@/lib/saude";
import { Topo, dataBR, rotuloChamado, rotuloStatus } from "@/components";
import { enviarIntimacao, abrirChamado } from "./acoes";

export const dynamic = "force-dynamic";

export default async function PainelCliente({ searchParams }: { searchParams: { c?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");

  // Empresas que este usuário acompanha (equipe vê todas — útil para conferir a visão do cliente)
  const { data: empresas } = await sb.from("clientes").select("id,nome,documento").eq("ativo", true).order("nome");
  if (!empresas?.length) {
    return <main className="max-w-3xl mx-auto px-4"><Topo nome={perfil.nome} area="Painel do cliente" />
      <div className="card">Seu acesso ainda não foi vinculado a nenhuma empresa. Fale com a JRB.</div></main>;
  }
  const atual = empresas.find((e) => e.id === searchParams.c) ?? empresas[0];
  const cid = atual.id;

  const [{ data: vinculos }, { data: certs }, { data: vencs }, { data: chamados }, { data: envios }] = await Promise.all([
    sb.from("processo_clientes").select("polo, processo_id").eq("cliente_id", cid),
    sb.from("certidoes").select("tipo,orgao,situacao,validade").eq("cliente_id", cid).order("validade"),
    sb.from("vencimentos").select("tipo,descricao,data").eq("cliente_id", cid)
      .gte("data", new Date().toISOString().slice(0, 10)).order("data").limit(8),
    sb.from("chamados").select("id,tipo,titulo,status,criado_em").eq("cliente_id", cid).order("criado_em", { ascending: false }).limit(6),
    sb.from("intimacoes_enviadas").select("id,observacao,status,retorno_cliente,criado_em").eq("cliente_id", cid)
      .order("criado_em", { ascending: false }).limit(5),
  ]);

  const ids = (vinculos ?? []).map((v) => v.processo_id);
  const { data: procs } = ids.length
    ? await sb.from("processos_cliente").select("*").in("id", ids).order("ultima_mov_em", { ascending: false, nullsFirst: false })
    : { data: [] as any[] };
  const { data: movs } = ids.length
    ? await sb.from("andamentos").select("processo_id,data,resumo_simples").in("processo_id", ids)
        .eq("visivel_cliente", true).order("data", { ascending: false }).limit(60)
    : { data: [] as any[] };
  const ultimo = new Map<string, { data: string; resumo_simples: string }>();
  for (const m of movs ?? []) if (!ultimo.has(m.processo_id)) ultimo.set(m.processo_id, m);

  const saude = saudeJuridica(certs ?? [], procs ?? [], vencs ?? []);
  const ativos = (procs ?? []).filter((p) => p.situacao !== "arquivado" && p.situacao !== "baixado");
  const exposicao = ativos.reduce((s, p) => s + Number(p.exposicao_estimada || 0), 0);

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Topo nome={perfil.nome} area="Painel do cliente" />

      {empresas.length > 1 && (
        <nav className="flex flex-wrap gap-2 mb-4">
          {empresas.map((e) => (
            <Link key={e.id} href={`/cliente?c=${e.id}`} className="pill"
              style={e.id === cid ? { background: "var(--brand)", color: "var(--bg)" } : {}}>{e.nome}</Link>
          ))}
        </nav>
      )}

      {/* Saúde jurídica */}
      <section className="card grid gap-4 md:grid-cols-[auto_1fr_auto_auto] items-center">
        <div className="w-16 h-16 rounded-full grid place-items-center text-white font-bold"
          style={{ background: corSinal[saude.sinal] }} aria-label={rotuloSinal[saude.sinal]}>●</div>
        <div>
          <p className="text-xs muted uppercase tracking-wider">Saúde jurídica · {atual.nome}</p>
          <p className="text-2xl font-semibold" style={{ color: corSinal[saude.sinal] }}>{rotuloSinal[saude.sinal]}</p>
          <ul className="text-sm muted mt-1">
            {saude.motivos.length ? saude.motivos.slice(0, 4).map((m, i) => <li key={i}>• {m.texto}</li>)
              : <li>Nenhuma pendência identificada.</li>}
          </ul>
        </div>
        <Kpi rotulo="Processos ativos" valor={String(ativos.length)} />
        <Kpi rotulo="Exposição estimada" valor={exposicao ? exposicao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        {/* Processos */}
        <section className="card lg:col-span-2">
          <h2 className="font-semibold mb-3">Seus processos</h2>
          {!procs?.length && <p className="muted text-sm">Nenhum processo vinculado ainda.</p>}
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {(procs ?? []).map((p) => {
              const u = ultimo.get(p.id);
              return (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{p.numero_cnj}</span>
                    <span className="pill">{p.tribunal ?? "—"}</span>
                    <span className="pill" style={{ color: p.risco === "alto" ? "var(--bad)" : p.risco === "medio" ? "var(--warn)" : "var(--muted)" }}>
                      risco {p.risco}</span>
                  </div>
                  <p className="text-sm mt-1">{p.resumo_cliente ?? p.classe ?? ""}</p>
                  {u && <p className="text-sm muted mt-1">Último andamento ({dataBR(u.data)}): {u.resumo_simples}</p>}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Agenda e certidões */}
        <section className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-3">Próximos compromissos</h2>
            {!vencs?.length ? <p className="muted text-sm">Nada nos próximos dias.</p> :
              <ul className="space-y-2 text-sm">{vencs.map((v, i) =>
                <li key={i} className="flex justify-between gap-3"><span>{v.descricao}</span><span className="muted whitespace-nowrap">{dataBR(v.data)}</span></li>)}</ul>}
          </div>
          <div className="card">
            <h2 className="font-semibold mb-3">Certidões</h2>
            {!certs?.length ? <p className="muted text-sm">Monitoramento de certidões em implantação.</p> :
              <ul className="space-y-2 text-sm">{certs.map((c, i) =>
                <li key={i} className="flex justify-between gap-3"><span>{c.tipo}</span>
                  <span className="muted whitespace-nowrap">{c.situacao ?? "—"} · até {dataBR(c.validade)}</span></li>)}</ul>}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        {/* Recebi uma intimação */}
        <section className="card">
          <h2 className="font-semibold">Recebi uma intimação ou citação</h2>
          <p className="text-sm muted mb-3">Envie o documento ou uma foto. O escritório é avisado e responde por aqui.</p>
          <form action={enviarIntimacao} className="space-y-3">
            <input type="hidden" name="cliente_id" value={cid} />
            <input className="input" type="file" name="arquivo" accept=".pdf,image/*,.doc,.docx" />
            <textarea className="input" name="observacao" rows={2} placeholder="Como chegou (correio, oficial de justiça, e-mail) e quando" />
            <button className="btn">Enviar ao escritório</button>
          </form>
          {!!envios?.length && <ul className="text-sm mt-4 space-y-2">{envios.map((e) =>
            <li key={e.id}><span className="pill mr-2">{rotuloStatus[e.status]}</span>{dataBR(e.criado_em)} {e.retorno_cliente ? `— ${e.retorno_cliente}` : ""}</li>)}</ul>}
        </section>

        {/* Central jurídica */}
        <section className="card">
          <h2 className="font-semibold">Central jurídica</h2>
          <p className="text-sm muted mb-3">Peça uma impugnação, recurso, mandado de segurança ou consulta.</p>
          <form action={abrirChamado} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="cliente_id" value={cid} />
            <select className="input" name="tipo" required defaultValue="consulta">
              {Object.entries(rotuloChamado).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input" name="prazo" type="date" title="Prazo, se houver" />
            <input className="input sm:col-span-2" name="titulo" required placeholder="Assunto" />
            <input className="input sm:col-span-2" name="referencia" placeholder="Nº do edital, processo ou contrato (opcional)" />
            <textarea className="input sm:col-span-2" name="descricao" rows={2} placeholder="Descreva o que precisa" />
            <button className="btn sm:col-span-2">Abrir chamado</button>
          </form>
          {!!chamados?.length && <ul className="text-sm mt-4 space-y-2">{chamados.map((c) =>
            <li key={c.id} className="flex justify-between gap-3"><span>{rotuloChamado[c.tipo]} · {c.titulo}</span>
              <span className="pill">{rotuloStatus[c.status]}</span></li>)}</ul>}
        </section>
      </div>

      <section className="card mt-4">
        <h2 className="font-semibold">Oportunidades</h2>
        <p className="text-sm muted">Em breve: editais compatíveis com a sua empresa e possíveis créditos tributários.</p>
      </section>
    </main>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="text-right"><p className="text-xs muted uppercase tracking-wider">{rotulo}</p><p className="text-xl font-semibold">{valor}</p></div>;
}
