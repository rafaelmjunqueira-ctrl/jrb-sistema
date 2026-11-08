"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Conta() {
  const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    if (s1.length < 10) return setMsg({ ok: false, t: "Use pelo menos 10 caracteres." });
    if (s1 !== s2) return setMsg({ ok: false, t: "As senhas não conferem." });
    const { error } = await supabaseBrowser().auth.updateUser({ password: s1 });
    setMsg(error ? { ok: false, t: "Não foi possível trocar a senha." } : { ok: true, t: "Senha alterada." });
    if (!error) { setS1(""); setS2(""); }
  }
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={trocar} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Minha senha</h1>
        <input className="input" type="password" placeholder="Nova senha" value={s1} onChange={(e) => setS1(e.target.value)} />
        <input className="input" type="password" placeholder="Repita a nova senha" value={s2} onChange={(e) => setS2(e.target.value)} />
        {msg && <p className="text-sm" style={{ color: msg.ok ? "var(--ok)" : "var(--bad)" }}>{msg.t}</p>}
        <button className="btn w-full">Trocar senha</button>
        <Link href="/" className="text-sm underline block text-center">Voltar</Link>
      </form>
    </main>
  );
}
