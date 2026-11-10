import Link from "next/link";
import { Building2, User, ChevronRight, Gavel, FileWarning, Receipt } from "lucide-react";
import { Shell } from "@/components/shell";
import { reais } from "@/components/util";
import { situacaoValidade } from "@/lib/documentos";

// Visão de quem tem várias empresas: uma linha por empresa com o essencial
export async function VisaoGrupo({ sb, perfil, empresas, grupo }: { sb: any; perfil: { nome: string; papel: string }; empresas: { id: string; nome: string; tipo: string; documento: string | null }[]; grupo?: string }) {
  const ids = empresas.map((e) => e.id);
  const [{ data: vinc }, { data: docs }, { data: fats }] = await Promise.all([
    sb.from("processo_clientes").select("cliente_id,processos(situacao)").in("cliente_id", ids),
    sb.from("documentos").select("cliente_id,validade").in("cliente_id", ids).not("validade", "is", null),
    sb.from("faturas").select("cliente_id,status,valor").in("cliente_id", ids).in("status", ["PENDING", "OVERDUE"]),
  ]);
  const linhas = empresas.map((e) => {
    const procs = (vinc ?? []).filter((v: any) => v.cliente_id === e.id && !["arquivado", "baixado"].includes(v.processos?.situacao)).length;
    const dd = (docs ?? []).filter((d: any) => d.cliente_id === e.id).map((d: any) => situacaoValidade(d.validade).dias ?? 99);
    const vencidos = dd.filter((x: number) => x < 0).length, vencendo = dd.filter((x: number) => x >= 0 && x <= 15).length;
    const ff = (fats ?? []).filter((f: any) => f.cliente_id === e.id);
    const atraso = ff.some((f: any) => f.status === "OVERDUE");
    const sinal = vencidos || atraso ? "var(--risco)" : vencendo || ff.length ? "var(--alerta)" : "var(--ok)";
    return { e, procs, vencidos, vencendo, aberto: ff.reduce((s: number, f: any) => s + Number(f.valor), 0), atraso, sinal };
  });
  const titulo = grupo ?? (perfil.papel === "cliente" ? "Suas empresas" : "Empresas");
  return (
    <Shell perfil={perfil} titulo={titulo} subtitulo={`${empresas.length} empresas e cadastros acompanhados pela JRB`}>
      <ul className="grid gap-3 md:grid-cols-2">
        {linhas.map(({ e, procs, vencidos, vencendo, aberto, atraso, sinal }) => (
          <li key={e.id}>
            <Link href={`/cliente?c=${e.id}`} className="folha p-5 flex gap-4 items-start hover:border-[var(--tinta-3)] h-full">
              <span className="relative w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: "var(--bordo-claro)", color: "var(--bordo)" }}>
                {e.tipo === "PJ" ? <Building2 size={19} /> : <User size={19} />}
                <span className="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ background: sinal, borderColor: "var(--folha)" }} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[16px] leading-snug">{e.nome}</span>
                <span className="block text-[13px] discreto">{e.documento ? (e.tipo === "PJ" ? "CNPJ " : "CPF ") + e.documento : "documento não informado"}</span>
                <span className="flex flex-wrap gap-1.5 mt-3">
                  <span className="etiqueta"><Gavel size={12} />{procs} processo{procs === 1 ? "" : "s"}</span>
                  {vencidos > 0 && <span className="etiqueta etq-risco"><FileWarning size={12} />{vencidos} documento{vencidos > 1 ? "s" : ""} vencido{vencidos > 1 ? "s" : ""}</span>}
                  {vencendo > 0 && <span className="etiqueta etq-alerta"><FileWarning size={12} />{vencendo} vencendo</span>}
                  {aberto > 0 && <span className={`etiqueta ${atraso ? "etq-risco" : ""}`}><Receipt size={12} />{reais(aberto)} em aberto</span>}
                </span>
              </span>
              <ChevronRight size={18} className="discreto mt-3" />
            </Link>
          </li>))}
      </ul>
    </Shell>
  );
}
