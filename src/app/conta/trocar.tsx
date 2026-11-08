"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function TrocarSenha() {
  const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    if (s1.length < 10) return setMsg({ ok: false, t: "Use pelo menos 10 caracteres." });
    if (s1 !== s2) return setMsg({ ok: false, t: "As duas senhas estão diferentes." });
    const { error } = await supabaseBrowser().auth.updateUser({ password: s1 });
    setMsg(error ? { ok: false, t: "A senha não foi alterada. Tente outra." } : { ok: true, t: "Senha alterada." });
    if (!error) { setS1(""); setS2(""); }
  }
  return (
    <form onSubmit={trocar} className="folha p-6 max-w-md space-y-4">
      <div><label className="rotulo" htmlFor="s1">Nova senha</label><input id="s1" className="campo" type="password" autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} /></div>
      <div><label className="rotulo" htmlFor="s2">Repita a nova senha</label><input id="s2" className="campo" type="password" autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} /></div>
      {msg && <p role="status" className="text-sm rounded-lg p-3" style={{ background: msg.ok ? "var(--ok-fundo)" : "var(--risco-fundo)", color: msg.ok ? "var(--ok)" : "var(--risco)" }}>{msg.t}</p>}
      <button className="btn">Trocar senha</button>
    </form>
  );
}
