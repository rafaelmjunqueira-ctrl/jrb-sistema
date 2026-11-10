"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, X, Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CATEGORIAS, sugerirCategoria, validadeNoNome, tituloDoArquivo } from "@/lib/documentos";

type Item = { arquivo: File; nome: string; categoria: string; validade: string; estado: "pronto" | "enviando" | "ok" | "erro"; erro?: string };
const MAX = 50 * 1024 * 1024;

// Envio direto do navegador para o armazenamento (sem limite de tamanho do servidor).
// As regras do banco garantem que só se grava na pasta da própria empresa.
export function EnviarDocumentos({ cid, categoriaInicial }: { cid: string; categoriaInicial?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [sobre, setSobre] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const adicionar = (lista: FileList | null) => {
    if (!lista) return;
    const novos = Array.from(lista).map((f) => ({
      arquivo: f, nome: tituloDoArquivo(f.name), categoria: categoriaInicial ?? sugerirCategoria(f.name),
      validade: validadeNoNome(f.name) ?? "", estado: (f.size > MAX ? "erro" : "pronto") as Item["estado"], erro: f.size > MAX ? "acima de 50 MB" : undefined,
    }));
    setItens((v) => [...v, ...novos]);
  };
  const muda = (i: number, p: Partial<Item>) => setItens((v) => v.map((x, k) => (k === i ? { ...x, ...p } : x)));

  async function enviar() {
    setEnviando(true);
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]; if (it.estado !== "pronto") continue;
      muda(i, { estado: "enviando" });
      const seguro = it.arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
      const path = `${cid}/docs/${Date.now()}_${seguro}`;
      const up = await sb.storage.from("documentos").upload(path, it.arquivo, { contentType: it.arquivo.type || "application/octet-stream" });
      if (up.error) { muda(i, { estado: "erro", erro: "falha no envio" }); continue; }
      const { error } = await sb.from("documentos").insert({ cliente_id: cid, categoria: it.categoria, nome: it.nome || it.arquivo.name, tipo: it.nome,
        validade: it.validade || null, arquivo_path: path, tamanho: it.arquivo.size, enviado_por: user?.id });
      muda(i, error ? { estado: "erro", erro: "falha ao registrar" } : { estado: "ok" });
    }
    setEnviando(false);
    router.refresh();
    setTimeout(() => setItens((v) => v.filter((x) => x.estado !== "ok")), 1500);
  }

  const prontos = itens.filter((x) => x.estado === "pronto").length;
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); adicionar(e.dataTransfer.files); }}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-4 py-7 text-center cursor-pointer"
        style={{ border: `1.5px dashed ${sobre ? "var(--bordo-2)" : "var(--fio)"}`, background: sobre ? "var(--bordo-claro)" : "var(--papel)" }}>
        <UploadCloud size={26} style={{ color: "var(--tinta-3)" }} />
        <span className="text-sm font-medium">Arraste os arquivos aqui, ou clique para escolher</span>
        <span className="text-xs discreto">Pode enviar vários de uma vez · PDF, imagens, Word ou Excel · até 50 MB cada</span>
        <input ref={input} type="file" multiple className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
      </div>

      {!!itens.length && (
        <div className="mt-4 space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1.6fr_1.2fr_150px_auto] items-center rounded-lg p-2.5" style={{ background: "var(--papel)" }}>
              <input value={it.nome} onChange={(e) => muda(i, { nome: e.target.value })} className="campo text-sm" aria-label="Nome do documento" disabled={it.estado !== "pronto"} />
              <select value={it.categoria} onChange={(e) => muda(i, { categoria: e.target.value })} className="campo text-sm" aria-label="Categoria" disabled={it.estado !== "pronto"}>
                {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <input type="date" value={it.validade} onChange={(e) => muda(i, { validade: e.target.value })} className="campo text-sm" aria-label="Validade" title="Validade (se houver)" disabled={it.estado !== "pronto"} />
              <span className="flex items-center justify-end gap-2 text-sm min-w-[90px]">
                {it.estado === "enviando" && <Loader2 size={16} className="animate-spin" />}
                {it.estado === "ok" && <Check size={16} style={{ color: "var(--ok)" }} />}
                {it.estado === "erro" && <span style={{ color: "var(--risco)" }}>{it.erro}</span>}
                {it.estado === "pronto" && <button type="button" aria-label="Tirar da lista" className="discreto p-1" onClick={() => setItens((v) => v.filter((_, k) => k !== i))}><X size={16} /></button>}
              </span>
            </div>))}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" className="btn" disabled={!prontos || enviando} onClick={enviar}>
              {enviando ? <><Loader2 size={16} className="animate-spin" />Enviando…</> : `Guardar ${prontos} arquivo${prontos === 1 ? "" : "s"}`}</button>
            <span className="text-xs discreto">Confira a categoria e a validade. A data de validade das certidões gera o aviso de vencimento.</span>
          </div>
        </div>)}
    </div>
  );
}
