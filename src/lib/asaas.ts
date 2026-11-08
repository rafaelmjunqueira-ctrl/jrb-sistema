import "server-only";

// Cliente da API do Asaas (banco do escritório). Chave só no servidor.
const BASE = process.env.ASAAS_AMBIENTE === "sandbox" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";

export function asaasConfigurado() { return !!process.env.ASAAS_API_KEY; }

async function chamar<T = any>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(BASE + caminho, {
    ...init, cache: "no-store",
    headers: { "Content-Type": "application/json", "User-Agent": "jrb-sistema", access_token: process.env.ASAAS_API_KEY ?? "", ...(init.headers ?? {}) },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = corpo?.errors?.map((e: any) => e.description).join("; ") || `Asaas respondeu ${r.status}`;
    throw new Error(msg);
  }
  return corpo as T;
}

export type CobrancaAsaas = {
  id: string; customer: string; subscription?: string | null; value: number; dueDate: string; status: string;
  billingType: string; invoiceUrl?: string; bankSlipUrl?: string | null; description?: string | null;
  paymentDate?: string | null; clientPaymentDate?: string | null;
};

export async function buscarCliente(doc: string) {
  const r = await chamar<{ data: { id: string; name: string }[] }>(`/customers?cpfCnpj=${encodeURIComponent(doc)}`);
  return r.data?.[0] ?? null;
}
export async function criarCliente(nome: string, doc: string, email?: string | null) {
  return chamar<{ id: string }>("/customers", { method: "POST", body: JSON.stringify({ name: nome, cpfCnpj: doc, email: email || undefined, notificationDisabled: false }) });
}
export async function listarCobrancas(customer: string) {
  const todas: CobrancaAsaas[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const r = await chamar<{ data: CobrancaAsaas[]; hasMore: boolean }>(`/payments?customer=${customer}&limit=100&offset=${offset}`);
    todas.push(...(r.data ?? []));
    if (!r.hasMore) break;
  }
  return todas;
}
export async function criarCobranca(customer: string, valor: number, vencimento: string, descricao: string) {
  return chamar<CobrancaAsaas>("/payments", { method: "POST", body: JSON.stringify({ customer, billingType: "UNDEFINED", value: valor, dueDate: vencimento, description: descricao }) });
}
export async function criarMensalidade(customer: string, valor: number, primeiroVencimento: string, descricao: string) {
  return chamar<{ id: string }>("/subscriptions", { method: "POST", body: JSON.stringify({ customer, billingType: "UNDEFINED", value: valor, nextDueDate: primeiroVencimento, cycle: "MONTHLY", description: descricao }) });
}
export async function pixDaCobranca(id: string) {
  return chamar<{ encodedImage: string; payload: string; expirationDate: string }>(`/payments/${id}/pixQrCode`);
}
export async function linhaDigitavel(id: string) {
  return chamar<{ identificationField: string }>(`/payments/${id}/identificationField`);
}
export async function notaDaCobranca(id: string) {
  const r = await chamar<{ data: { status: string; pdfUrl?: string | null; number?: string | null }[] }>(`/invoices?payment=${id}`);
  return r.data?.[0] ?? null;
}

// Converte a cobrança do Asaas na linha da tabela "faturas"
export function paraFatura(c: CobrancaAsaas, clienteId: string) {
  return {
    cliente_id: clienteId, asaas_id: c.id, assinatura_id: c.subscription ?? null, descricao: c.description ?? null,
    valor: c.value, vencimento: c.dueDate, status: c.status, forma: c.billingType,
    link_pagamento: c.invoiceUrl ?? null, link_boleto: c.bankSlipUrl ?? null,
    pago_em: c.clientPaymentDate ?? c.paymentDate ?? null, atualizado_em: new Date().toISOString(),
  };
}

export const rotuloFatura: Record<string, { t: string; c: string }> = {
  PENDING: { t: "A vencer", c: "etq-bordo" }, AWAITING_RISK_ANALYSIS: { t: "Em análise", c: "" },
  OVERDUE: { t: "Vencida", c: "etq-risco" }, RECEIVED: { t: "Paga", c: "etq-ok" }, CONFIRMED: { t: "Paga", c: "etq-ok" },
  RECEIVED_IN_CASH: { t: "Paga", c: "etq-ok" }, REFUNDED: { t: "Estornada", c: "" }, REFUND_REQUESTED: { t: "Estorno pedido", c: "" },
  DELETED: { t: "Cancelada", c: "" },
};
export const pago = (s: string) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s);
