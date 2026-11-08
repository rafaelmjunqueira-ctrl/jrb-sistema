export const dataBR = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "—";
export const dataCurta = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "—";
export const diaSemana = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" });
export const diasAte = (iso: string) => Math.round((new Date(iso + "T12:00:00").getTime() - new Date(new Date().toISOString().slice(0, 10) + "T12:00:00").getTime()) / 86400000);
export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const hojeISO = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

export const rotuloChamado: Record<string, string> = {
  impugnacao: "Impugnação de edital", recurso_administrativo: "Recurso administrativo",
  mandado_seguranca: "Mandado de segurança", consulta: "Consulta", documento: "Documento", outro: "Outro",
};
export const rotuloStatus: Record<string, string> = {
  aberto: "Aberto", em_analise: "Em análise", em_execucao: "Em execução",
  aguardando_cliente: "Aguardando você", concluido: "Concluído", cancelado: "Cancelado",
  recebida: "Recebida", em_triagem: "Em análise", triada: "Respondida", descartada: "Arquivada",
};
export const classeStatus: Record<string, string> = {
  aberto: "etq-bordo", em_analise: "", em_execucao: "", aguardando_cliente: "etq-alerta", concluido: "etq-ok", cancelado: "",
  recebida: "etq-bordo", em_triagem: "", triada: "etq-ok", descartada: "",
};

// Limpa o texto bruto da publicação (DJEN) para leitura do cliente:
// tira o cabeçalho "Processo nº - Classe - Assunto - Partes -", a linha de advogados e marcações HTML.
export function limparAndamento(t?: string | null) {
  if (!t) return "";
  let s = t.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*-\s*ADV(OGADO)?S?:.*$/i, "").replace(/\s*Advogad[oa]s?:.*$/i, "");
  s = s.replace(/^Processo\s+[\d.\-]+\s*-\s*/i, "");
  // Começa no conteúdo do ato quando há cabeçalho (eproc, PJe, tribunais superiores)
  const ato = s.search(/\b(Vistos|DESPACHO|DECIS[ÃA]O|SENTEN[ÇC]A|ACÓRDÃO|ATO ORDINAT[ÓO]RIO|Intime-se|Intimem-se|Intimação|Intimo|Manifeste-se|Manifestem-se|Ciência|Defiro|Indefiro|Certifico|Fica[m]? intimad|PAUTADO|Pautado|Diante|Trata-se|Recebo|Cite-se|Designo|Redesign)/);
  if (ato > 0) s = s.slice(ato);
  else {
    const partes = s.split(" - ");
    if (partes.length >= 4 && partes.slice(0, 3).every((p) => p.length < 90)) s = partes.slice(3).join(" - ");
  }
  s = s.replace(/Intimado\(s\)\s*\/\s*Citado\(s\).*$/i, "").trim();
  return s.length > 420 ? s.slice(0, 417).replace(/\s+\S*$/, "") + "…" : s;
}
