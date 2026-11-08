import { redirect } from "next/navigation";
import Link from "next/link";
import { QrCode, FileText, Receipt, CreditCard, X } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { Copiar } from "@/components/copiar";
import { AbasCliente } from "@/components/abas-cliente";
import { Enviar } from "@/components/interativos";
import { dataBR, reais, diasAte } from "@/components/util";
import { rotuloFatura, pago, pixDaCobranca, linhaDigitavel, descricaoLegivel } from "@/lib/asaas";
import { verNota } from "./acoes";

export const dynamic = "force-dynamic";

export default async function FinanceiroCliente({ searchParams }: { searchParams: { c?: string; pix?: string; boleto?: string; nf?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  const { data: empresas } = await sb.from("clientes").select("id,nome").eq("ativo", true).order("nome");
  const atual = (empresas ?? []).find((e) => e.id === searchParams.c) ?? empresas?.[0];
  if (!atual) redirect("/cliente");
  const { data: faturas } = await sb.from("faturas").select("*").eq("cliente_id", atual.id).neq("status", "DELETED").order("vencimento", { ascending: false });
  const fs = faturas ?? [];
  const abertas = fs.filter((f) => !pago(f.status) && !["REFUNDED", "REFUND_REQUESTED"].includes(f.status)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = fs.filter((f) => pago(f.status));
  const devido = abertas.reduce((s, f) => s + Number(f.valor), 0);

  // Pix ou linha do boleto sob demanda — só para fatura que o banco confirmou ser deste cliente
  let pix: { img: string; codigo: string } | null = null, linha: string | null = null;
  const alvo = fs.find((f) => f.id === (searchParams.pix ?? searchParams.boleto));
  if (alvo && searchParams.pix) { try { const p = await pixDaCobranca(alvo.asaas_id); pix = { img: p.encodedImage, codigo: p.payload }; } catch {} }
  if (alvo && searchParams.boleto) { try { linha = (await linhaDigitavel(alvo.asaas_id)).identificationField; } catch {} }
  const base = `/cliente/financeiro?c=${atual.id}`;

  return (
    <Shell perfil={perfil} titulo={atual.nome} subtitulo="Faturas, boletos e notas fiscais">
      <AbasCliente cid={atual.id} atual="financeiro" />
      {searchParams.nf === "sem" && <p className="rounded-xl p-4 mb-5" style={{ background: "var(--alerta-fundo)", color: "var(--alerta)" }}>Ainda não há nota fiscal emitida para este pagamento. Se precisar dela, peça ao escritório.</p>}

      <section className="folha-elevada p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div><p className="apoio">{abertas.length ? "Em aberto" : "Situação"}</p>
          <p className="serif text-[34px] font-semibold leading-tight">{abertas.length ? reais(devido) : "Tudo pago"}</p>
          {abertas[0] && <p className="text-sm apoio mt-1">Próximo vencimento em {dataBR(abertas[0].vencimento)}</p>}</div>
        {abertas[0]?.link_pagamento && <a href={abertas[0].link_pagamento} target="_blank" rel="noreferrer" className="btn !py-3 !px-5"><CreditCard size={18} />Pagar agora</a>}
      </section>

      {alvo && (pix || linha) && (
        <section className="folha p-6 mt-6 relative">
          <Link href={base} aria-label="Fechar" className="absolute right-4 top-4 discreto"><X size={20} /></Link>
          <h2 className="titulo-secao">{pix ? "Pagar com Pix" : "Linha digitável do boleto"}</h2>
          <p className="apoio text-sm mt-1">{alvo.descricao ?? "Fatura"} · {reais(Number(alvo.valor))} · vence {dataBR(alvo.vencimento)}</p>
          {pix && <div className="flex flex-col sm:flex-row gap-6 items-center mt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${pix.img}`} alt="QR code do Pix" width={190} height={190} className="rounded-lg bg-white p-2" />
            <div className="min-w-0 flex-1"><p className="text-sm apoio">Abra o app do banco, escolha Pix e leia o QR code, ou use o Pix copia e cola:</p>
              <p className="font-mono text-[12px] break-all mt-2 p-3 rounded-lg" style={{ background: "var(--papel)" }}>{pix.codigo}</p>
              <div className="mt-3"><Copiar texto={pix.codigo} rotulo="Copiar código Pix" /></div></div></div>}
          {linha && <div className="mt-4"><p className="font-mono text-[15px] break-all p-3 rounded-lg" style={{ background: "var(--papel)" }}>{linha}</p>
            <div className="mt-3"><Copiar texto={linha.replace(/\D/g, "")} rotulo="Copiar linha digitável" /></div></div>}
        </section>)}

      <section className="mt-6">
        <h2 className="titulo-secao mb-3">Faturas em aberto</h2>
        {!abertas.length ? <div className="folha p-6 apoio">Nenhuma fatura em aberto.</div> :
          <ul className="space-y-3">{abertas.map((f) => {
            const r = rotuloFatura[f.status] ?? { t: f.status, c: "" }; const d = diasAte(f.vencimento);
            return <li key={f.id} className="folha p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold text-[15px]">{descricaoLegivel(f.descricao) ?? "Honorários"}</p>
                  <p className="text-[13px] discreto">{f.status === "OVERDUE" ? `venceu em ${dataBR(f.vencimento)}` : d === 0 ? "vence hoje" : `vence em ${dataBR(f.vencimento)}`}</p></div>
                <div className="text-right"><p className="serif text-[22px] font-semibold leading-none">{reais(Number(f.valor))}</p><span className={`etiqueta mt-1.5 ${r.c}`}>{r.t}</span></div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Link href={`${base}&pix=${f.id}`} className="btn"><QrCode size={16} />Pix</Link>
                <Link href={`${base}&boleto=${f.id}`} className="btn-sec"><Receipt size={16} />Código do boleto</Link>
                {f.link_boleto && <a href={f.link_boleto} target="_blank" rel="noreferrer" className="btn-sec"><FileText size={16} />{f.status === "OVERDUE" ? "2ª via do boleto" : "Boleto em PDF"}</a>}
                {f.link_pagamento && <a href={f.link_pagamento} target="_blank" rel="noreferrer" className="btn-sec"><CreditCard size={16} />Cartão</a>}
              </div>
            </li>;
          })}</ul>}
      </section>

      <section className="mt-8">
        <h2 className="titulo-secao mb-3">Pagas</h2>
        {!pagas.length ? <div className="folha p-6 apoio">Nenhum pagamento registrado ainda.</div> :
          <ul className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>{pagas.map((f) =>
            <li key={f.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 items-center px-5 py-3.5" style={{ borderColor: "var(--fio-2)" }}>
              <span className="min-w-0"><span className="block font-medium truncate">{descricaoLegivel(f.descricao) ?? "Honorários"}</span>
                <span className="text-[13px] discreto">paga em {dataBR(f.pago_em ?? f.vencimento)}</span></span>
              <span className="serif font-semibold">{reais(Number(f.valor))}</span>
              <form action={verNota} className="col-span-2 sm:col-span-1"><input type="hidden" name="id" value={f.id} />
                <Enviar className="btn-sec !py-1.5" pendente="Abrindo…"><FileText size={15} />Nota fiscal</Enviar></form>
            </li>)}</ul>}
      </section>
      <p className="text-[13px] discreto mt-6 max-w-[70ch]">Os pagamentos são processados pelo Asaas, o banco do escritório. Os dados do cartão são digitados na página segura do Asaas e não passam por este sistema.</p>
    </Shell>
  );
}
