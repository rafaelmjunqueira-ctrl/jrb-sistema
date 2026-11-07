import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* chamado em Server Component: o middleware renova a sessão */ }
        },
      },
    }
  );
}

export type Papel = "socio" | "funcionario" | "cliente";

export async function usuarioAtual() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, perfil: null };
  const { data: perfil } = await sb.from("perfis").select("id,nome,papel,ativo").eq("id", user.id).single();
  return { sb, user, perfil: perfil as { id: string; nome: string; papel: Papel; ativo: boolean } | null };
}
