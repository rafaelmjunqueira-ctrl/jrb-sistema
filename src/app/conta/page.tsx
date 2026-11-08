import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import { TrocarSenha } from "./trocar";

export default async function Conta() {
  const { perfil } = await usuarioAtual();
  if (!perfil) redirect("/login");
  return <Shell perfil={perfil} titulo="Minha senha" subtitulo="Troque a senha provisória no primeiro acesso."><TrocarSenha /></Shell>;
}
