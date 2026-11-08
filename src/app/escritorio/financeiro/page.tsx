import { redirect } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ExternalLink, Building2 } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Enviar } from "@/components/interativos";
import { dataBR, reais, hojeISO } from "@/components/util";
import { asaasConfigurado, rotuloFatura, pago, descricaoLegivel } from "@/lib/asaas";
import { sincronizar, sincronizarTodos, novaCobranca } from "./acoes";

export const dynamic = "force-dynamic";
const MSG: Record<string, [string, boolean]> = {
  "ok=sinc": ["Faturas atualizadas com o Asaas.", true], "ok=cobranca": ["Cobrança criada no Asaas.", true], "ok=mensal": ["Mensalidade criada no Asaas. As cobranças de cada mês são geradas por ele.", true],
  "erro=chave": ["Falta cadastrar ASAAS_API_KEY na Vercel.", false], "erro=doc": ["Cadastre o CPF/CNPJ do cliente antes.", false],
  "erro=nao-achado": ["Nenhum cliente com esse CPF/CNPJ no Asaas. Crie uma cobrança aqui que o cadastro é feito automaticamente.", false],
  "erro=asaas": ["O Asaas recusou a operação. Confira os dados e tente de novo.", false],
};

export default async function Financeiro({ searchParams }: { searchParams: { c?: string; ok?: string; erro?: string } }) {
  const { sb, perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/");
  const hoje = hojeISO(); const mes = hoje.slice(0, 7);
  const [{ data: clientes }, { data: faturas }] = await Promise.all([
    sb.from("clientes").select("id,nome,documento,asaas_customer_id").eq("ativo", true).order("nome"),
    sb.from("faturas").select("id,cliente_id,descricao,valor,vencimento,status,pago_em,link_pagamento,nf_pdf,clientes(nome)").neq("status", "DELETED").order("vencimento", { ascending: false }).limit(500),
  ]);
  const fs = faturas ?? [];
  const aReceber = fs.filter((f) => f.status === "PENDING").reduce((s, f) => s + Number(f.valor), 0);
  const vencido = fs.filter((f) => f.status === "OVERDUE").reduce((s, f) => s + Number(f.valor), 0);
  const recebidoMes = fs.filter((f) => pago(f.status) && (f.pago_em ?? "").startsWith(mes)).reduce((s, f) => s + Number(f.valor), 0);
  const atual = (clientes ?? []).find((c) => c.id === searchParams.c);
  const lista = atual ? fs.filter((f) => f.cliente_id === atual.id) : fs.filter((f) => !pago(f.status)).slice(0, 40);
  const chave = searchParams.ok ? `ok=${searchParams.ok}` : searchParams.erro ? `erro=${searchParams.erro}` : "";
  const aviso = MSG[chave];

  return (
    <Shell perfil={perfil} titulo="Financeiro" subtitulo="Cobranças e notas fiscais pelo Asaas"
      acoes={asaasConfigurado() && <form action={sincronizarTodos}><Enviar className="btn-sec" pendente="Atualizando…"><RefreshCw size={16} />Atualizar tudo</Enviar></form>}>
      {!asaasConfigurado() && <p className="rounded-xl p-4 mb-5" style={{ background: "var(--alerta-fundo)", color: "var(--alerta)" }}>
        Para ligar o financeiro, cadastre ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN na Vercel e faça um novo deploy.</p>}
      {aviso && <p className="rounded-xl p-4 mb-5" style={{ background: aviso[1] ? "var(--ok-fundo)" : "var(--risco-fundo)", color: aviso[1] ? "var(--ok)" : "var(--risco)" }}>{aviso[0]}</p>}

      <section className="folha grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--fio)" }}>
        <Total rotulo="A receber" valor={aReceber} /><Total rotulo="Vencido" valor={vencido} tom={vencido ? "var(--risco)" : undefined} />
        <Total rotulo="Recebido este mês" valor={recebidoMes} tom="var(--ok)" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] mt-6 items-start">
        <nav className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>
          <Link href="/escritorio/financeiro" className="block px-4 py-3 font-medium" style={!atual ? { background: "var(--bordo-claro)", color: "var(--bordo)" } : {}}>Em aberto, todos os clientes</Link>
          {(clientes ?? []).map((c) => <Link key={c.id} href={`/escritorio/financeiro?c=${c.id}`} className="flex items-center justify-between gap-2 px-4 py-3 text-[15px]"
            style={{ borderColor: "var(--fio-2)", ...(c.id === atual?.id ? { background: "var(--bordo-claro)", color: "var(--bordo)" } : {}) }}>
            <span className="truncate">{c.nome}</span>{c.asaas_customer_id && <span className="etiqueta etq-ok">Asaas</span>}</Link>)}
        </nav>

        <div className="space-y-6">
          {atual && <section className="folha p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="titulo-secao flex items-center gap-2"><Building2 size={18} />{atual.nome}</h2>
              <form action={sincronizar}><input type="hidden" name="cliente_id" value={atual.id} />
                <Enviar className="btn-sec" pendente="Buscando…"><RefreshCw size={15} />{atual.asaas_customer_id ? "Atualizar do Asaas" : "Buscar no Asaas"}</Enviar></form>
            </div>
            <form action={novaCobranca} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr] mt-5">
              <input type="hidden" name="cliente_id" value={atual.id} />
              <div><label className="rotulo">Valor (R$)</label><input name="valor" required inputMode="decimal" className="campo" placeholder="300,00" /></div>
              <div><label className="rotulo">Vencimento</label><input name="vencimento" type="date" required className="campo" /></div>
              <div><label className="rotulo">Descrição (vai na fatura e na nota)</label><input name="descricao" className="campo" defaultValue="Honorários advocatícios - assessoria mensal" /></div>
              <label className="text-sm flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="mensal" /> Repetir todo mês (mensalidade)</label>
              <Enviar pendente="Criando…">Criar cobrança</Enviar>
            </form>
            <p className="text-[13px] discreto mt-3">O cliente escolhe Pix, boleto ou cartão. A nota fiscal sai conforme a configuração de notas do Asaas.</p>
          </section>}

          <section className="folha">
            <h2 className="titulo-secao px-6 pt-5 pb-3">{atual ? "Faturas" : "Em aberto"}</h2>
            {!lista.length ? <p className="px-6 pb-6 apoio">Nenhuma fatura aqui.</p> :
              <ul className="divide-y" style={{ borderColor: "var(--fio-2)" }}>{lista.map((f: any) => {
                const r = rotuloFatura[f.status] ?? { t: f.status, c: "" };
                return <li key={f.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 items-center px-6 py-3.5" style={{ borderColor: "var(--fio-2)" }}>
                  <span className="min-w-0"><span className="block font-medium truncate">{atual ? descricaoLegivel(f.descricao) ?? "Cobrança" : f.clientes?.nome}</span>
                    <span className="text-[13px] discreto">vence {dataBR(f.vencimento)}{f.pago_em ? ` · paga em ${dataBR(f.pago_em)}` : ""}</span></span>
                  <span className="serif font-semibold text-right">{reais(Number(f.valor))}</span>
                  <span className={`etiqueta ${r.c}`}>{r.t}</span>
                  <span className="hidden sm:flex gap-2">{f.link_pagamento && <a className="discreto" href={f.link_pagamento} target="_blank" rel="noreferrer" aria-label="Abrir no Asaas"><ExternalLink size={16} /></a>}</span>
                </li>;
              })}</ul>}
          </section>
        </div>
      </div>
    </Shell>
  );
}
function Total({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return <div className="p-5" style={{ borderColor: "var(--fio)" }}><div className="text-[13px] apoio">{rotulo}</div>
    <div className="serif text-[28px] font-semibold mt-1" style={{ color: tom ?? "var(--tinta)" }}>{reais(valor)}</div></div>;
}
