import { DetalheEdital } from "../detalhe";

export const dynamic = "force-dynamic";

export default function Edital({ params, searchParams }: { params: { slug: string }; searchParams: { c?: string } }) {
  return <DetalheEdital slug={decodeURIComponent(params.slug)} searchParams={searchParams} />;
}
