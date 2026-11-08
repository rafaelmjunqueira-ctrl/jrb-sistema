"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn-sec" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2500); } catch {} }}>
    {ok ? <><Check size={16} />Copiado</> : <><Copy size={16} />{rotulo}</>}</button>;
}
