import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";

// Porta de entrada: manda cada perfil para sua área.
export default async function Inicio() {
  const { user, perfil } = await usuarioAtual();
  if (!user) redirect("/login");
  if (!perfil?.ativo) redirect("/login");
  redirect(perfil.papel === "cliente" ? "/cliente" : "/escritorio");
}
