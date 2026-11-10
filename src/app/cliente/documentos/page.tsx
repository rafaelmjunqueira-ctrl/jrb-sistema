import { redirect } from "next/navigation";
import { FileText, Download, Trash2, CheckCircle2, AlertTriangle, CircleDashed, Pencil } from "lucide-react";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { AbasCliente } from "@/components/abas-cliente";
import { EnviarDocumentos } from "@/components/cofre";
import { Enviar } from "@/components/interativos";
import { empresaAtual } from "@/lib/cliente";
import { CATEGORIAS, CHECKLIST, situacaoValidade } from "@/lib/documentos";
import { semAcento } from "@/lib/areas";
import { dataBR } from "@/components/util";
import { baixarDocumento, atualizarDocumento, apagarDocumento } from "./acoes";

export const dynamic = "force-dynamic";
const tam = (b?: number | null) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function Documentos({ searchParams }: { searchParams: { c?: string; editar?: string } }) {
  const { sb, user, perfil } = await usuarioAtual();
  if (!user || !perfil) redirect("/login");
  const { atual } = await empresaAtual(sb, searchParams.c);
  if (!atual) redirect("/cliente");
  const cid = atual.id;
  const { data: docs } = await sb.from("documentos").select("id,categoria,nome,tipo,validade,arquivo_path,tamanho,criado_em").eq("cliente_id", cid).order("criado_em", { ascending: false });
  const lista = docs ?? [];

  // Checklist de habilitação: o documento mais recente que corresponde a cada item
  const check = CHECKLIST.map((c) => {
    const achados = lista.filter((d) => d.categoria === c.categoria && c.termos.test(semAcento(`${d.nome} ${d.tipo ?? ""}`)));
    const melhor = achados.sort((a, b) => (b.validade ?? "").localeCompare(a.validade ?? ""))[0];
    const s = situacaoValidade(melhor?.validade);
    const estado = !melhor ? "falta" : c.validade && (!melhor.validade || (s.dias ?? 0) < 0) ? (melhor.validade ? "vencido" : "sem-data") : c.validade && (s.dias ?? 99) <= 15 ? "vencendo" : "ok";
    return { ...c, doc: melhor, estado, s };
  });
  const okN = check.filter((c) => c.estado === "ok").length;
  const vencidos = lista.filter((d) => d.validade && (situacaoValidade(d.validade).dias ?? 0) < 0).length;
  const vencendo = lista.filter((d) => { const x = situacaoValidade(d.validade).dias; return x != null && x >= 0 && x <= 15; }).length;
  const editar = searchParams.editar;
  const aqui = `/cliente/documentos?c=${cid}`;

  return (
    <Shell perfil={perfil} titulo={atual.nome} subtitulo="Documentos, certidões e balanços da empresa">
      <AbasCliente cid={cid} atual="documentos" />

      <section className="folha-elevada p-6 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="titulo-secao">Pronto para licitar?</h2>
          <span className="text-sm apoio">{okN} de {check.length} documentos em dia{vencidos ? ` · ${vencidos} vencido${vencidos > 1 ? "s" : ""}` : ""}{vencendo ? ` · ${vencendo} vencendo` : ""}</span>
        </div>
        <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ background: "var(--fio-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${(okN / check.length) * 100}%`, background: okN === check.length ? "var(--ok)" : "var(--bordo)" }} /></div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-5">
          {check.map((c) => {
            const Ic = c.estado === "ok" ? CheckCircle2 : c.estado === "falta" ? CircleDashed : AlertTriangle;
            const cor = c.estado === "ok" ? "var(--ok)" : c.estado === "falta" ? "var(--tinta-3)" : c.estado === "vencendo" ? "var(--alerta)" : "var(--risco)";
            return <li key={c.tipo} className="flex items-start gap-2.5 rounded-lg p-3" style={{ background: "var(--papel)" }}>
              <Ic size={18} style={{ color: cor }} className="shrink-0 mt-0.5" />
              <span className="min-w-0"><span className="block text-[14px] font-medium">{c.tipo}</span>
                <span className="block text-[12px]" style={{ color: cor }}>{c.estado === "falta" ? "não enviado" : c.estado === "sem-data" ? "informe a validade" : c.validade ? c.s.texto : "enviado"}</span></span>
            </li>;
          })}
        </ul>
      </section>

      <section className="folha p-6 mt-6">
        <h2 className="titulo-secao">Guardar documentos</h2>
        <p className="text-sm apoio mt-1 mb-4">Os arquivos ficam disponíveis aqui para a empresa e para o escritório, a qualquer hora. Avisamos antes de uma certidão vencer.</p>
        <EnviarDocumentos cid={cid} />
      </section>

      <div className="space-y-6 mt-6">
        {CATEGORIAS.map((cat) => {
          const docsCat = lista.filter((d) => d.categoria === cat.id);
          if (!docsCat.length) return null;
          return (
            <section key={cat.id}>
              <div className="flex items-baseline justify-between mb-2"><h3 className="font-semibold">{cat.nome}</h3><span className="text-[13px] discreto">{docsCat.length}</span></div>
              <ul className="folha divide-y" style={{ borderColor: "var(--fio-2)" }}>
                {docsCat.map((d) => {
                  const s = situacaoValidade(d.validade);
                  return (
                    <li key={d.id} className="px-4 sm:px-5 py-3.5" style={{ borderColor: "var(--fio-2)" }}>
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--bordo-claro)", color: "var(--bordo)" }}><FileText size={17} /></span>
                        <span className="min-w-0 flex-1"><span className="block font-medium truncate">{d.nome}</span>
                          <span className="text-[12px] discreto">guardado em {dataBR(d.criado_em)}{d.tamanho ? ` · ${tam(d.tamanho)}` : ""}</span></span>
                        {d.validade && <span className={`etiqueta hidden sm:inline-flex ${s.classe}`}>{s.texto}</span>}
                        <form action={baixarDocumento}><input type="hidden" name="id" value={d.id} />
                          <button className="btn-sec !px-2.5 !py-1.5" title="Abrir ou baixar" aria-label={`Baixar ${d.nome}`}><Download size={16} /></button></form>
                        <a href={editar === d.id ? aqui : `${aqui}&editar=${d.id}`} className="btn-sec !px-2.5 !py-1.5" title="Editar" aria-label={`Editar ${d.nome}`}><Pencil size={15} /></a>
                      </div>
                      {d.validade && <span className={`etiqueta sm:hidden mt-2 ${s.classe}`}>{s.texto}</span>}
                      {editar === d.id && (
                        <div className="mt-3 rounded-lg p-3 grid gap-2 md:grid-cols-[1.5fr_1.2fr_150px_auto_auto] items-end" style={{ background: "var(--papel)" }}>
                          <form action={atualizarDocumento} className="contents">
                            <input type="hidden" name="id" value={d.id} />
                            <label className="text-[12px] apoio">Nome<input name="nome" defaultValue={d.nome} className="campo text-sm mt-1" /></label>
                            <label className="text-[12px] apoio">Categoria<select name="categoria" defaultValue={d.categoria} className="campo text-sm mt-1">
                              {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
                            <label className="text-[12px] apoio">Validade<input type="date" name="validade" defaultValue={d.validade ?? ""} className="campo text-sm mt-1" /></label>
                            <Enviar className="btn !py-2">Salvar</Enviar>
                          </form>
                          <form action={apagarDocumento}><input type="hidden" name="id" value={d.id} />
                            <Enviar className="btn-sec !py-2" pendente="…"><Trash2 size={15} />Apagar</Enviar></form>
                        </div>)}
                    </li>);
                })}
              </ul>
            </section>);
        })}
        {!lista.length && <p className="apoio">Nenhum documento guardado ainda.</p>}
      </div>
    </Shell>
  );
}
