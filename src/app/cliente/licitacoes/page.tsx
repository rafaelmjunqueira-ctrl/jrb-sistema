import { BuscaEditais } from "./busca";

export const dynamic = "force-dynamic";

export default function Licitacoes({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <BuscaEditais searchParams={searchParams} />;
}
