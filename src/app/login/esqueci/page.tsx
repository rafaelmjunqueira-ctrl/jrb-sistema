import { MailCheck } from "lucide-react";
import { Enviar } from "@/components/interativos";
import { Moldura } from "../moldura";
import { pedirNovaSenha } from "./acoes";

export const dynamic = "force-dynamic";

export default function Esqueci({ searchParams }: { searchParams: { email?: string; enviado?: string; erro?: string } }) {
  if (searchParams.enviado) return (
    <Moldura>
      <MailCheck size={34} style={{ color: "var(--bordo)" }} />
      <h1 className="serif text-[28px] font-semibold mt-3">Pedido recebido</h1>
      {searchParams.enviado === "email"
        ? <p className="apoio mt-2">Se este e-mail tiver acesso ao painel, você vai receber em alguns minutos um link para criar a nova senha. Confira também a caixa de spam.</p>
        : <p className="apoio mt-2">O escritório foi avisado e vai liberar uma nova senha para você. Se tiver pressa, chame a JRB no WhatsApp (16) 99406-3738.</p>}
      <a href="/login" className="btn mt-6 w-full !py-3">Voltar para o login</a>
    </Moldura>);
  return (
    <Moldura>
      <form action={pedirNovaSenha} className="space-y-5">
        <div><h1 className="serif text-[28px] font-semibold">Esqueci minha senha</h1>
          <p className="apoio mt-1.5">Digite o e-mail que você usa para entrar. Vamos mandar um link para você criar uma senha nova.</p></div>
        {searchParams.erro && <p role="alert" className="text-sm rounded-lg p-3" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>Confira o e-mail digitado.</p>}
        <div><label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={searchParams.email ?? ""} className="campo" /></div>
        <Enviar className="btn w-full !py-3" pendente="Enviando…">Enviar link</Enviar>
        <p className="text-[13px] text-center"><a href="/login" className="underline">Voltar</a></p>
      </form>
    </Moldura>);
}
