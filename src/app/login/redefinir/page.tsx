import { KeyRound } from "lucide-react";
import { Enviar } from "@/components/interativos";
import { Moldura } from "../moldura";
import { definirSenha } from "./acoes";

export const dynamic = "force-dynamic";
const ERROS: Record<string, string> = {
  curta: "A senha precisa ter pelo menos 10 caracteres.", diferente: "As duas senhas estão diferentes.",
  igual: "Escolha uma senha diferente da anterior.", falhou: "Não foi possível salvar a senha. Tente de novo.",
};

export default function Redefinir({ searchParams }: { searchParams: { t?: string; erro?: string } }) {
  if (!searchParams.t || searchParams.erro === "vencido") return (
    <Moldura>
      <h1 className="serif text-[28px] font-semibold">Link vencido</h1>
      <p className="apoio mt-2">Este link já foi usado ou passou de 1 hora. Peça outro, é rápido.</p>
      <a href="/login/esqueci" className="btn mt-6 w-full !py-3">Pedir novo link</a>
    </Moldura>);
  return (
    <Moldura>
      <form action={definirSenha} className="space-y-5">
        <input type="hidden" name="t" value={searchParams.t} />
        <div><KeyRound size={30} style={{ color: "var(--bordo)" }} /><h1 className="serif text-[28px] font-semibold mt-2">Crie a nova senha</h1>
          <p className="apoio mt-1.5">Pelo menos 10 caracteres. Depois disso você já entra no painel.</p></div>
        {searchParams.erro && <p role="alert" className="text-sm rounded-lg p-3" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>{ERROS[searchParams.erro] ?? "Algo deu errado."}</p>}
        <div><label className="rotulo" htmlFor="s1">Nova senha</label><input id="s1" name="senha" type="password" required minLength={10} autoComplete="new-password" className="campo" /></div>
        <div><label className="rotulo" htmlFor="s2">Repita a nova senha</label><input id="s2" name="senha2" type="password" required minLength={10} autoComplete="new-password" className="campo" /></div>
        <Enviar className="btn w-full !py-3" pendente="Salvando…">Salvar e entrar</Enviar>
      </form>
    </Moldura>);
}
