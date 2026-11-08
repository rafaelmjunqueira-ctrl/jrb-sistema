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
