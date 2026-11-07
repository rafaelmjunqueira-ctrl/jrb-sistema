// Semáforo de "saúde jurídica" do cliente. Regras simples e explicáveis:
// vermelho = algo exige ação já; amarelo = atenção nos próximos 30 dias; verde = em dia.
export type Sinal = "verde" | "amarelo" | "vermelho";

type Cert = { situacao: string | null; validade: string | null };
type Proc = { risco: string; situacao: string | null };
type Venc = { data: string };

const dias = (iso: string) => Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86400000);

export function saudeJuridica(certs: Cert[], procs: Proc[], vencs: Venc[]) {
  const motivos: { sinal: Sinal; texto: string }[] = [];
  for (const c of certs) {
    if (c.situacao?.toLowerCase().startsWith("positiva") && !c.situacao.toLowerCase().includes("efeito"))
      motivos.push({ sinal: "vermelho", texto: "Certidão positiva (impede licitações e crédito)" });
    if (c.validade) {
      const d = dias(c.validade);
      if (d < 0) motivos.push({ sinal: "vermelho", texto: "Certidão vencida" });
      else if (d <= 30) motivos.push({ sinal: "amarelo", texto: `Certidão vence em ${d} dia(s)` });
    }
  }
  const ativos = procs.filter((p) => p.situacao !== "arquivado" && p.situacao !== "baixado");
  const altos = ativos.filter((p) => p.risco === "alto").length;
  const medios = ativos.filter((p) => p.risco === "medio").length;
  if (altos) motivos.push({ sinal: "vermelho", texto: `${altos} processo(s) de risco alto` });
  if (medios) motivos.push({ sinal: "amarelo", texto: `${medios} processo(s) de risco médio` });
  const prox = vencs.filter((v) => { const d = dias(v.data); return d >= 0 && d <= 7; }).length;
  if (prox) motivos.push({ sinal: "amarelo", texto: `${prox} compromisso(s) nos próximos 7 dias` });

  const sinal: Sinal = motivos.some((m) => m.sinal === "vermelho") ? "vermelho"
    : motivos.some((m) => m.sinal === "amarelo") ? "amarelo" : "verde";
  return { sinal, motivos };
}

export const corSinal: Record<Sinal, string> = { verde: "var(--ok)", amarelo: "var(--warn)", vermelho: "var(--bad)" };
export const rotuloSinal: Record<Sinal, string> = { verde: "Em dia", amarelo: "Atenção", vermelho: "Ação necessária" };
