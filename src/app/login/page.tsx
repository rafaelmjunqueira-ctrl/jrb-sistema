"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(""); const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setEnviando(true); setErro("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: senha });
    if (error) { setEnviando(false); return setErro("E-mail ou senha não conferem."); }
    router.replace("/"); router.refresh();
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between p-14 text-white" style={{ background: "linear-gradient(160deg,#6E1F2E 0%,#3E1019 100%)" }}>
        <div className="flex items-center gap-3"><Scale size={28} strokeWidth={1.5} style={{ color: "#D9BE7E" }} />
          <span className="serif text-3xl font-semibold">JRB</span><span style={{ color: "rgba(255,255,255,.7)" }}>Advogados Associados</span></div>
        <div className="max-w-[30ch]">
          <p className="serif text-[40px] leading-[1.15] font-medium">A situação jurídica da sua empresa, à vista.</p>
          <p className="mt-5 text-[17px]" style={{ color: "rgba(255,255,255,.75)" }}>Processos, prazos, certidões e pedidos ao escritório, num só lugar.</p>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,.55)" }}>Ribeirão Preto · SP</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden flex items-center gap-2 mb-6"><Scale size={22} style={{ color: "var(--bordo)" }} /><span className="serif text-2xl font-semibold">JRB Advogados</span></div>
          <div><h1 className="serif text-[30px] font-semibold">Entrar</h1><p className="apoio mt-1">Use o e-mail cadastrado pelo escritório.</p></div>
          <div><label className="rotulo" htmlFor="email">E-mail</label>
            <input id="email" className="campo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="rotulo" htmlFor="senha">Senha</label>
            <input id="senha" className="campo" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
          {erro && <p role="alert" className="text-sm rounded-lg p-3" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>{erro}</p>}
          <button className="btn w-full !py-3" disabled={enviando}>{enviando ? <><Loader2 size={17} className="animate-spin" />Entrando…</> : "Entrar"}</button>
          <p className="text-[13px] discreto">Esqueceu a senha? Fale com a JRB pelo WhatsApp do escritório.</p>
        </form>
      </section>
    </main>
  );
}
