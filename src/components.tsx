export function Topo({ nome, area }: { nome: string; area: string }) {
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <div>
        <p className="text-xs tracking-widest muted uppercase">JRB Advogados Associados</p>
        <h1 className="text-xl font-semibold">{area}</h1>
      </div>
      <form action="/sair" method="post" className="flex items-center gap-3">
        <span className="text-sm muted hidden sm:inline">{nome}</span>
        <button className="pill">Sair</button>
      </form>
    </header>
  );
}

export const dataBR = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "—";

export const rotuloChamado: Record<string, string> = {
  impugnacao: "Impugnação de edital", recurso_administrativo: "Recurso administrativo",
  mandado_seguranca: "Mandado de segurança", consulta: "Consulta", documento: "Documento", outro: "Outro",
};
export const rotuloStatus: Record<string, string> = {
  aberto: "Aberto", em_analise: "Em análise", em_execucao: "Em execução",
  aguardando_cliente: "Aguardando você", concluido: "Concluído", cancelado: "Cancelado",
  recebida: "Recebida", em_triagem: "Em triagem", triada: "Analisada", descartada: "Descartada",
};
