import { diasAte, dataBR } from "@/components/util";

// Situação jurídica do cliente: regras simples e explicáveis.
export type Sinal = "verde" | "amarelo" | "vermelho";
export type Pendencia = { sinal: Sinal; titulo: string; detalhe: string; quando?: string };

type Cert = { tipo: string; situacao: string | null; validade: string | null };
type Proc = { numero_cnj: string; risco: string; situacao: string | null; classe: string | null; exposicao_estimada?: number | null };
type Venc = { descricao: string; data: string };
type Cham = { titulo: string; status: string };
type Envio = { status: string; retorno_cliente: string | null; criado_em: string };

export function avaliar<P extends Proc>(certs: Cert[], procs: P[], vencs: Venc[], chams: Cham[], envios: Envio[]) {
  const p: Pendencia[] = [];
  for (const c of certs) {
    const pos = (c.situacao ?? "").toLowerCase().startsWith("positiva") && !(c.situacao ?? "").toLowerCase().includes("efeito");
    if (pos) p.push({ sinal: "vermelho", titulo: `Certidão ${c.tipo} positiva`, detalhe: "Impede participar de licitações e pode travar crédito. O escritório já pode atuar na regularização." });
    else if (c.validade) {
      const d = diasAte(c.validade);
      if (d < 0) p.push({ sinal: "vermelho", titulo: `Certidão ${c.tipo} vencida`, detalhe: `Venceu em ${dataBR(c.validade)}. Precisa ser reemitida.`, quando: c.validade });
      else if (d <= 30) p.push({ sinal: "amarelo", titulo: `Certidão ${c.tipo} vence em ${d} dia${d === 1 ? "" : "s"}`, detalhe: "Vale reemitir antes de qualquer licitação.", quando: c.validade });
    }
  }
  for (const c of chams.filter((c) => c.status === "aguardando_cliente"))
    p.push({ sinal: "amarelo", titulo: "O escritório aguarda você", detalhe: c.titulo });
  for (const e of envios.filter((e) => e.status === "triada" && e.retorno_cliente))
    p.push({ sinal: "verde", titulo: "Resposta sobre o documento que você enviou", detalhe: e.retorno_cliente! });
  for (const v of vencs) {
    const d = diasAte(v.data);
    if (d >= 0 && d <= 7) p.push({ sinal: "amarelo", titulo: v.descricao, detalhe: d === 0 ? "Hoje" : `Em ${d} dia${d === 1 ? "" : "s"}, ${dataBR(v.data)}`, quando: v.data });
  }
  const ativos = procs.filter((x) => x.situacao !== "arquivado" && x.situacao !== "baixado");
  for (const x of ativos.filter((x) => x.risco === "alto"))
    p.push({ sinal: "vermelho", titulo: "Processo com risco alto", detalhe: `${x.classe ?? "Processo"} · ${x.numero_cnj}` });

  const ordem = { vermelho: 0, amarelo: 1, verde: 2 };
  p.sort((a, b) => ordem[a.sinal] - ordem[b.sinal]);
  const sinal: Sinal = p.some((x) => x.sinal === "vermelho") ? "vermelho" : p.some((x) => x.sinal === "amarelo") ? "amarelo" : "verde";
  return { sinal, pendencias: p, ativos };
}

export const cor: Record<Sinal, string> = { verde: "var(--ok)", amarelo: "var(--alerta)", vermelho: "var(--risco)" };
export const fundo: Record<Sinal, string> = { verde: "var(--ok-fundo)", amarelo: "var(--alerta-fundo)", vermelho: "var(--risco-fundo)" };
export const rotulo: Record<Sinal, string> = { verde: "Em dia", amarelo: "Atenção", vermelho: "Ação necessária" };
