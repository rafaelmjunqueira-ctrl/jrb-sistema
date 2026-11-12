import { DetalheEdital } from "@/app/cliente/licitacoes/detalhe";

export const dynamic = "force-dynamic";

export default function EditalEscritorio({ params }: { params: { slug: string } }) {
  return <DetalheEdital slug={decodeURIComponent(params.slug)} searchParams={{}} escritorio />;
}
