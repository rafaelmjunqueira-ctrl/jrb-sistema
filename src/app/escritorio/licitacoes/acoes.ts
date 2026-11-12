"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { dispararColeta } from "@/lib/cliente";

export async function coletarAgora() {
  const { perfil } = await usuarioAtual();
  if (!perfil || perfil.papel === "cliente") redirect("/login");
  const ok = await dispararColeta();
  revalidatePath("/escritorio/licitacoes", "layout");
  redirect(`/escritorio/licitacoes/acompanhados?${ok ? "ok=1" : "erro=1"}`);
}
