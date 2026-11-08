import { Scale } from "lucide-react";
import { Lateral, Inferior, type ItemNav } from "./nav";

export function Shell({ perfil, titulo, subtitulo, acoes, children }: {
  perfil: { nome: string; papel: string }; titulo: string; subtitulo?: React.ReactNode; acoes?: React.ReactNode; children: React.ReactNode;
}) {
  const equipe = perfil.papel !== "cliente";
  const itens: ItemNav[] = equipe
    ? [{ href: "/escritorio", rotulo: "Hoje", icone: "hoje" }, { href: "/escritorio/processos", rotulo: "Processos", icone: "processos" },
       { href: "/escritorio/clientes", rotulo: "Clientes", icone: "clientes" }, { href: "/cliente", rotulo: "Visão do cliente", icone: "cliente" }]
    : [{ href: "/cliente", rotulo: "Minha empresa", icone: "painel" }];
  return (
    <div className="min-h-screen">
      <Lateral itens={itens} nome={perfil.nome} papel={perfil.papel} />
      <div className="lg:pl-64">
        <div className="lg:hidden flex items-center gap-2 px-4 h-14 text-white" style={{ background: "#5E1A28" }}>
          <Scale size={18} style={{ color: "#D9BE7E" }} /><span className="serif text-lg font-semibold">JRB</span>
          <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,.7)" }}>Advogados Associados</span>
        </div>
        <header className="px-4 sm:px-8 pt-6 lg:pt-10 pb-5 max-w-[1240px] flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="serif text-[28px] sm:text-[34px] font-semibold leading-tight tracking-tight">{titulo}</h1>
            {subtitulo && <div className="apoio mt-1">{subtitulo}</div>}
          </div>
          {acoes}
        </header>
        <main className="px-4 sm:px-8 pb-28 lg:pb-14 max-w-[1240px]">{children}</main>
      </div>
      <Inferior itens={itens} />
    </div>
  );
}
