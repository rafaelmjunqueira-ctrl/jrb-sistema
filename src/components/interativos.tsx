"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, UploadCloud, X, FileText } from "lucide-react";

export function Enviar({ children, className = "btn", pendente = "Salvando…" }: { children: React.ReactNode; className?: string; pendente?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? <><Loader2 size={16} className="animate-spin" />{pendente}</> : children}</button>;
}

// Janela modal nativa (<dialog>): foco preso, Esc fecha, acessível
export function Janela({ rotulo, titulo, descricao, children, classeBotao = "btn", icone }: {
  rotulo: string; titulo: string; descricao?: string; children: React.ReactNode; classeBotao?: string; icone?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={classeBotao} onClick={() => ref.current?.showModal()}>{icone}{rotulo}</button>
      <dialog ref={ref} className="folha-elevada w-[min(560px,calc(100vw-24px))] p-0 backdrop:bg-black/40"
        style={{ color: "var(--tinta)" }} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="titulo-secao">{titulo}</h2>{descricao && <p className="apoio text-sm mt-1">{descricao}</p>}</div>
            <button type="button" aria-label="Fechar" className="discreto p-1" onClick={() => ref.current?.close()}><X size={20} /></button>
          </div>
          <div className="mt-5" onSubmit={() => setTimeout(() => ref.current?.close(), 50)}>{children}</div>
        </div>
      </dialog>
    </>
  );
}

// Área para soltar o arquivo da intimação
export function SoltarArquivo({ nome = "arquivo" }: { nome?: string }) {
  const [arq, setArq] = useState<File | null>(null);
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files?.[0];
        if (f && input.current) { const dt = new DataTransfer(); dt.items.add(f); input.current.files = dt.files; setArq(f); } }}
      className="flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-7 text-center cursor-pointer transition-colors"
      style={{ border: `1.5px dashed ${sobre ? "var(--bordo-2)" : "var(--fio)"}`, background: sobre ? "var(--bordo-claro)" : "var(--papel)" }}>
      <input ref={input} type="file" name={nome} accept=".pdf,image/*,.doc,.docx" className="sr-only"
        onChange={(e) => setArq(e.target.files?.[0] ?? null)} />
      {arq ? <><FileText size={26} style={{ color: "var(--bordo)" }} /><span className="text-sm font-medium">{arq.name}</span>
          <span className="text-xs discreto">Clique para trocar</span></>
        : <><UploadCloud size={26} style={{ color: "var(--tinta-3)" }} /><span className="text-sm font-medium">Arraste o PDF ou a foto aqui</span>
          <span className="text-xs discreto">ou clique para escolher · até 15 MB</span></>}
    </label>
  );
}

// <details> que fica sempre aberto em telas largas (filtros na lateral) e recolhível no celular
export function PainelRecolhivel({ resumo, children, abertoNoCelular }: { resumo: React.ReactNode; children: React.ReactNode; abertoNoCelular?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const ajusta = () => { if (ref.current && mq.matches) ref.current.open = true; };
    ajusta(); mq.addEventListener("change", ajusta); return () => mq.removeEventListener("change", ajusta);
  }, []);
  return <details ref={ref} className="folha" open={abertoNoCelular || undefined}>
    <summary className="flex items-center justify-between px-5 py-4 lg:pointer-events-none">{resumo}</summary>{children}</details>;
}

// Envia o formulário assim que o valor do select muda
export function SelectEnvia(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
