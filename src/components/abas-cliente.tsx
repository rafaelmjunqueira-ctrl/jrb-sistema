import Link from "next/link";
import { LayoutDashboard, Wallet, Landmark } from "lucide-react";

// Abas da área do cliente (também aparecem quando a equipe usa "Visão do cliente")
export function AbasCliente({ cid, atual }: { cid: string; atual: "geral" | "licitacoes" | "financeiro" }) {
  const abas = [
    { k: "geral", href: `/cliente?c=${cid}`, rotulo: "Visão geral", Icone: LayoutDashboard },
    { k: "licitacoes", href: `/cliente/licitacoes?c=${cid}`, rotulo: "Licitações", Icone: Landmark },
    { k: "financeiro", href: `/cliente/financeiro?c=${cid}`, rotulo: "Financeiro", Icone: Wallet },
  ] as const;
  return (
    <nav aria-label="Seções" className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--fio)" }}>
      {abas.map(({ k, href, rotulo, Icone }) => {
        const on = k === atual;
        return <Link key={k} href={href} aria-current={on ? "page" : undefined}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[15px] font-medium -mb-px whitespace-nowrap"
          style={{ borderBottom: `2px solid ${on ? "var(--bordo)" : "transparent"}`, color: on ? "var(--tinta)" : "var(--tinta-3)" }}>
          <Icone size={16} />{rotulo}</Link>;
      })}
    </nav>
  );
}
