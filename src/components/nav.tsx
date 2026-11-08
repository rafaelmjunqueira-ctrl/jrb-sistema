"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, CalendarClock, FolderOpen, Users, Eye, KeyRound, LogOut, LayoutDashboard, Wallet } from "lucide-react";

const ICONES = { hoje: CalendarClock, processos: FolderOpen, clientes: Users, cliente: Eye, painel: LayoutDashboard, financeiro: Wallet } as const;
export type ItemNav = { href: string; rotulo: string; icone: keyof typeof ICONES };

function ativo(path: string, href: string) {
  return href === "/escritorio" || href === "/cliente" ? path === href : path.startsWith(href);
}

export function Lateral({ itens, nome, papel }: { itens: ItemNav[]; nome: string; papel: string }) {
  const path = usePathname();
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col text-white" style={{ background: "linear-gradient(180deg,#5E1A28 0%,#3E1019 100%)" }}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center gap-2.5">
          <Scale size={22} strokeWidth={1.6} style={{ color: "#D9BE7E" }} />
          <span className="serif text-[22px] font-semibold tracking-tight">JRB</span>
        </div>
        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,.65)" }}>Advogados Associados</p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {itens.map((i) => {
          const Icone = ICONES[i.icone]; const on = ativo(path, i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors"
              style={{ background: on ? "rgba(255,255,255,.12)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,.75)" }}>
              <Icone size={18} strokeWidth={1.8} />{i.rotulo}
            </Link>);
        })}
      </nav>
      <div className="px-3 pb-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}>
        <p className="px-3 text-sm font-medium truncate">{nome}</p>
        <p className="px-3 text-xs mb-2" style={{ color: "rgba(255,255,255,.6)" }}>{papel === "cliente" ? "Cliente" : papel === "socio" ? "Sócio" : "Equipe"}</p>
        <Link href="/conta" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm" style={{ color: "rgba(255,255,255,.75)" }}><KeyRound size={16} />Minha senha</Link>
        <form action="/sair" method="post"><button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm" style={{ color: "rgba(255,255,255,.75)" }}><LogOut size={16} />Sair</button></form>
      </div>
    </aside>
  );
}

export function Inferior({ itens }: { itens: ItemNav[] }) {
  const path = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 grid border-t" style={{ gridTemplateColumns: `repeat(${itens.length + 1},1fr)`, background: "var(--folha)", borderColor: "var(--fio)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {[...itens, { href: "/conta", rotulo: "Conta", icone: "painel" as const }].map((i) => {
        const Icone = i.href === "/conta" ? KeyRound : ICONES[i.icone]; const on = ativo(path, i.href);
        return (
          <Link key={i.href} href={i.href} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
            style={{ color: on ? "var(--bordo)" : "var(--tinta-3)" }}>
            <Icone size={20} strokeWidth={on ? 2.2 : 1.8} />{i.rotulo}
          </Link>);
      })}
    </nav>
  );
}
