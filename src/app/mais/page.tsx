import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Eye, KeyRound, LogOut, ChevronRight } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";

// Menu extra da equipe no celular
export default async function Mais() {
  const { perfil } = await usuarioAtual();
  if (!perfil) redirect("/login");
  const itens = [
    ...(perfil.papel !== "cliente" ? [{ href: "/escritorio/clientes", rotulo: "Clientes", Icone: Users }, { href: "/cliente", rotulo: "Visão do cliente", Icone: Eye }] : []),
    { href: "/conta", rotulo: "Minha senha", Icone: KeyRound },
  ];
  return (
    <Shell perfil={perfil} titulo="Mais">
      <ul className="folha divide-y max-w-md" style={{ borderColor: "var(--fio-2)" }}>
        {itens.map(({ href, rotulo, Icone }) => <li key={href} style={{ borderColor: "var(--fio-2)" }}>
          <Link href={href} className="flex items-center gap-3 px-5 py-4"><Icone size={18} style={{ color: "var(--bordo)" }} /><span className="flex-1">{rotulo}</span><ChevronRight size={16} className="discreto" /></Link></li>)}
        <li style={{ borderColor: "var(--fio-2)" }}><form action="/sair" method="post"><button className="w-full flex items-center gap-3 px-5 py-4 text-left"><LogOut size={18} style={{ color: "var(--bordo)" }} />Sair</button></form></li>
      </ul>
      <p className="text-sm discreto mt-4">Conectado como {perfil.nome}</p>
    </Shell>
  );
}
