import { BuscaEditais } from "@/app/cliente/licitacoes/busca";

export const dynamic = "force-dynamic";

// Busca livre do escritório: não fica presa a nenhum cliente
export default function LicitacoesEscritorio({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BuscaEditais searchParams={searchParams} escritorio />;
}
