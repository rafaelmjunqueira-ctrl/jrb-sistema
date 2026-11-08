"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { asaasConfigurado, buscarCliente, criarCliente, listarCobrancas, criarCobranca, criarMensalidade, paraFatura } from "@/lib/asaas";

async function equipe() {
  const ctx = await usuarioAtual();
  if (!ctx.perfil || ctx.perfil.papel === "cliente") redirect("/login");
  if (!asaasConfigurado()) redirect("/escritorio/financeiro?erro=chave");
  return ctx;
}
const voltar = (cid: string, extra = "") => redirect(`/escritorio/financeiro?c=${cid}${extra}`);

// Liga o cliente ao cadastro dele no Asaas (pelo CPF/CNPJ) e traz as cobranças
async function vincular(sb: any, cid: string, criarSeFaltar: boolean) {
  const { data: c } = await sb.from("clientes").select("id,nome,documento,asaas_customer_id,email_cobranca").eq("id", cid).single();
  let custId = c.asaas_customer_id as string | null;
  if (!custId) {
    if (!c.documento) throw new Error("sem-documento");
    const achado = await buscarCliente(c.documento);
    custId = achado?.id ?? (criarSeFaltar ? (await criarCliente(c.nome, c.documento, c.email_cobranca)).id : null);
    if (!custId) return null;
    await sb.from("clientes").update({ asaas_customer_id: custId }).eq("id", cid);
  }
  const cobr = await listarCobrancas(custId);
  if (cobr.length) await sb.from("faturas").upsert(cobr.map((x) => paraFatura(x, cid)), { onConflict: "asaas_id" });
  return custId;
}

export async function sincronizar(f: FormData) {
  const { sb } = await equipe();
  const cid = String(f.get("cliente_id"));
  try { const id = await vincular(sb, cid, false); if (!id) voltar(cid, "&erro=nao-achado"); }
  catch (e: any) { if (e?.digest) throw e; voltar(cid, e.message === "sem-documento" ? "&erro=doc" : "&erro=asaas"); }
  revalidatePath("/escritorio/financeiro"); voltar(cid, "&ok=sinc");
}

export async function sincronizarTodos() {
  const { sb } = await equipe();
  const { data } = await sb.from("clientes").select("id").not("asaas_customer_id", "is", null);
  for (const c of data ?? []) { try { await vincular(sb, c.id, false); } catch {} }
  revalidatePath("/escritorio/financeiro"); redirect("/escritorio/financeiro?ok=sinc");
}

export async function novaCobranca(f: FormData) {
  const { sb } = await equipe();
  const cid = String(f.get("cliente_id"));
  const valor = Number(String(f.get("valor")).replace(/\./g, "").replace(",", "."));
  const venc = String(f.get("vencimento")); const desc = String(f.get("descricao") || "Honorários advocatícios");
  const mensal = f.get("mensal") === "on";
  try {
    const cust = await vincular(sb, cid, true);
    if (mensal) await criarMensalidade(cust!, valor, venc, desc); else await criarCobranca(cust!, valor, venc, desc);
    await vincular(sb, cid, false);
  } catch (e: any) { if (e?.digest) throw e; voltar(cid, e.message === "sem-documento" ? "&erro=doc" : "&erro=asaas"); }
  revalidatePath("/escritorio/financeiro"); voltar(cid, mensal ? "&ok=mensal" : "&ok=cobranca");
}
