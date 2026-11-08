import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { paraFatura } from "@/lib/asaas";

// Recebe avisos do Asaas (pagamento recebido, vencido, nota emitida) e atualiza as faturas.
export async function POST(req: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  const recebido = req.headers.get("asaas-access-token") ?? "";
  const ok = esperado.length > 0 && recebido.length === esperado.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  if (!ok) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ erro: "servidor sem chave" }, { status: 500 });
  const ev = await req.json().catch(() => null);
  if (!ev?.event) return NextResponse.json({ ok: true });

  if (ev.payment?.id && String(ev.event).startsWith("PAYMENT_")) {
    const { data: cli } = await admin.from("clientes").select("id").eq("asaas_customer_id", ev.payment.customer).maybeSingle();
    if (cli) {
      if (ev.event === "PAYMENT_DELETED") await admin.from("faturas").update({ status: "DELETED", atualizado_em: new Date().toISOString() }).eq("asaas_id", ev.payment.id);
      else await admin.from("faturas").upsert(paraFatura(ev.payment, cli.id), { onConflict: "asaas_id" });
    }
  }
  if (ev.invoice?.payment && String(ev.event).startsWith("INVOICE_")) {
    await admin.from("faturas").update({
      nf_status: ev.invoice.status ?? null, nf_pdf: ev.invoice.pdfUrl ?? null, nf_numero: ev.invoice.number ?? null, atualizado_em: new Date().toISOString(),
    }).eq("asaas_id", ev.invoice.payment);
  }
  return NextResponse.json({ ok: true });
}
