import { Scale, Building2, User, ShieldCheck } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Enviar } from "@/components/interativos";
import { aceitarConvite } from "./acoes";

export const dynamic = "force-dynamic";
const ERROS: Record<string, string> = {
  invalido: "Este convite não vale mais. Peça um novo link ao escritório.",
  dados: "Confira o nome e o e-mail.", "senha-curta": "A senha precisa ter pelo menos 10 caracteres.",
  "senha-diferente": "As duas senhas estão diferentes.", aceite: "Para continuar, marque que leu e concorda com o uso dos dados.",
  documento: "Um dos CPF/CNPJ informados não é válido. Confira os números.",
  "email-existe": "Este e-mail já tem acesso ao painel. Entre pela página de login, ou use outro e-mail.",
  criar: "Não conseguimos criar o acesso agora. Tente de novo em instantes.", servidor: "O sistema está em manutenção. Tente mais tarde.",
};

export default async function Convite({ params, searchParams }: { params: { token: string }; searchParams: { erro?: string } }) {
  const admin = supabaseAdmin();
  const { data: cv } = admin ? await admin.from("convites").select("*").eq("token", params.token).maybeSingle() : { data: null };
  const valido = cv && !cv.usado_em && new Date(cv.expira_em) > new Date();
  const { data: empresas } = valido ? await admin!.from("clientes").select("id,nome,tipo,documento,endereco").in("id", cv.cliente_ids).order("nome") : { data: [] as any[] };

  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_1.2fr]">
      <section className="hidden lg:flex flex-col justify-between p-14 text-white" style={{ background: "linear-gradient(160deg,#6E1F2E 0%,#3E1019 100%)" }}>
        <div className="flex items-center gap-3"><Scale size={28} strokeWidth={1.5} style={{ color: "#D9BE7E" }} /><span className="serif text-3xl font-semibold">JRB</span>
          <span style={{ color: "rgba(255,255,255,.7)" }}>Advogados Associados</span></div>
        <div className="max-w-[32ch]"><p className="serif text-[36px] leading-[1.15] font-medium">Seu painel jurídico, a qualquer hora.</p>
          <ul className="mt-6 space-y-2 text-[16px]" style={{ color: "rgba(255,255,255,.8)" }}>
            <li>Processos e andamentos de cada empresa</li><li>Documentos, certidões e balanços guardados</li>
            <li>Licitações abertas para o seu ramo</li><li>Faturas, boletos e notas fiscais</li></ul></div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,.55)" }}>Ribeirão Preto · SP</p>
      </section>

      <section className="flex justify-center p-5 sm:p-10">
        <div className="w-full max-w-lg py-4">
          <div className="lg:hidden flex items-center gap-2 mb-6"><Scale size={22} style={{ color: "var(--bordo)" }} /><span className="serif text-2xl font-semibold">JRB Advogados</span></div>
          {!valido ? (
            <div><h1 className="serif text-[28px] font-semibold">Convite indisponível</h1>
              <p className="apoio mt-2">{cv?.usado_em ? "Este convite já foi usado. Entre com seu e-mail e senha." : "Este link expirou ou não existe. Peça um novo ao escritório."}</p>
              <a href="/login" className="btn mt-5">Ir para o login</a></div>
          ) : (
            <form action={aceitarConvite} className="space-y-5">
              <input type="hidden" name="token" value={params.token} />
              <div><h1 className="serif text-[30px] font-semibold leading-tight">{cv.nome ? `Olá, ${cv.nome.split(" ")[0]}` : "Bem-vindo"}</h1>
                <p className="apoio mt-1.5">A JRB liberou o seu acesso. Confirme os dados e crie a sua senha. Leva um minuto.</p></div>
              {searchParams.erro && <p role="alert" className="rounded-lg p-3 text-sm" style={{ background: "var(--risco-fundo)", color: "var(--risco)" }}>{ERROS[searchParams.erro] ?? "Algo deu errado. Tente de novo."}</p>}

              <fieldset className="folha p-5 space-y-4"><legend className="font-semibold px-1">Seus dados</legend>
                <div><label className="rotulo" htmlFor="nome">Nome completo</label><input id="nome" name="nome" defaultValue={cv.nome ?? ""} required className="campo" autoComplete="name" /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="rotulo" htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={cv.email ?? ""} required className="campo" autoComplete="email" /></div>
                  <div><label className="rotulo" htmlFor="tel">Celular (WhatsApp)</label><input id="tel" name="telefone" className="campo" inputMode="tel" autoComplete="tel" /></div>
                </div>
              </fieldset>

              <fieldset className="folha p-5 space-y-4"><legend className="font-semibold px-1">{empresas!.length > 1 ? `Suas empresas (${empresas!.length})` : "Cadastro"}</legend>
                {empresas!.map((e: any) => (
                  <div key={e.id} className="space-y-2">
                    <p className="flex items-center gap-2 font-medium">{e.tipo === "PJ" ? <Building2 size={16} /> : <User size={16} />}{e.nome}</p>
                    <div className="grid sm:grid-cols-[1fr_1.4fr] gap-2">
                      {e.documento ? <p className="text-sm apoio self-center">{e.tipo === "PJ" ? "CNPJ" : "CPF"} já cadastrado</p>
                        : <input name={`doc_${e.id}`} className="campo" inputMode="numeric" placeholder={e.tipo === "PJ" ? "CNPJ" : "CPF"} aria-label={`CPF ou CNPJ de ${e.nome}`} />}
                      {!e.endereco && <input name={`end_${e.id}`} className="campo" placeholder="Endereço (opcional)" aria-label={`Endereço de ${e.nome}`} />}
                    </div>
                  </div>))}
              </fieldset>

              <fieldset className="folha p-5 space-y-4"><legend className="font-semibold px-1">Crie sua senha</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="rotulo" htmlFor="s1">Senha</label><input id="s1" name="senha" type="password" required minLength={10} className="campo" autoComplete="new-password" /></div>
                  <div><label className="rotulo" htmlFor="s2">Repita a senha</label><input id="s2" name="senha2" type="password" required minLength={10} className="campo" autoComplete="new-password" /></div>
                </div>
                <p className="text-[12px] discreto">Pelo menos 10 caracteres. Você entra com este e-mail e esta senha.</p>
              </fieldset>

              <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="aceite" required className="mt-1" />
                <span>Autorizo a JRB Advogados a tratar estes dados e os documentos que eu guardar no painel para prestar os serviços jurídicos contratados, conforme a LGPD.</span></label>
              <Enviar className="btn w-full !py-3" pendente="Criando seu acesso…"><ShieldCheck size={17} />Criar acesso e entrar</Enviar>
              <p className="text-[12px] discreto text-center">Já tem acesso? <a href="/login" className="underline">Entrar</a></p>
            </form>)}
        </div>
      </section>
    </main>
  );
}
