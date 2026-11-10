"use client";
import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";

export function CompartilharLink({ url, nome }: { url: string; nome?: string | null }) {
  const [ok, setOk] = useState(false);
  const texto = `Olá${nome ? `, ${nome.split(" ")[0]}` : ""}! Aqui é da JRB Advogados. Criamos o seu acesso ao painel jurídico, onde você acompanha seus processos, documentos, certidões e faturas. Para ativar, é só abrir o link e criar sua senha: ${url}`;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-sec" onClick={async () => { try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2500); } catch {} }}>
        {ok ? <><Check size={16} />Copiado</> : <><Copy size={16} />Copiar link</>}</button>
      <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />Enviar no WhatsApp</a>
    </div>
  );
}
