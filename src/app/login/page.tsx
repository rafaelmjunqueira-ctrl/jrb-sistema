"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) return setErro("E-mail ou senha incorretos.");
    router.replace("/"); router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={entrar} className="card w-full max-w-sm space-y-4">
        <div>
          <p className="text-xs tracking-widest muted uppercase">JRB Advogados Associados</p>
          <h1 className="text-2xl font-semibold mt-1">Acesso ao sistema</h1>
        </div>
        <label className="block text-sm">E-mail
          <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">Senha
          <input className="input mt-1" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="text-sm" style={{ color: "var(--bad)" }}>{erro}</p>}
        <button className="btn w-full" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        <p className="text-xs muted">O acesso é criado pelo escritório. Esqueceu a senha? Fale com a JRB.</p>
      </form>
    </main>
  );
}
