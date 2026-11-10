import { FormLogin } from "./formulario";

const AVISOS: Record<string, string> = {
  "ja-tinha": "Seu e-mail já tinha acesso, e as empresas do convite foram liberadas nele. Entre com a senha que você já usava ou clique em \"Esqueci minha senha\".",
  criado: "Cadastro concluído. Entre com o e-mail e a senha que você criou.",
  "senha-nova": "Senha alterada. Entre com a nova senha.",
};

export default function Login({ searchParams }: { searchParams: { aviso?: string; email?: string } }) {
  return <FormLogin aviso={searchParams.aviso ? AVISOS[searchParams.aviso] : undefined} emailInicial={searchParams.email} />;
}
