import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { executar, tokenInterno } from "@/lib/coleta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const ORCAMENTO_MS = 40_000;

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function autorizado(req: Request) {
  const tok = req.headers.get("x-coleta-token") ?? "";
  if (tok && process.env.SUPABASE_SECRET_KEY && igual(tok, tokenInterno())) return "interno";
  const cron = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cron && igual(auth, `Bearer ${cron}`)) return "cron";
  if (!cron && (req.headers.get("user-agent") ?? "").startsWith("vercel-cron")) return "cron";
  return null;
}

function proximaUrl(req: Request) {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (prod ? `https://${prod}` : new URL(req.url).origin) + "/api/coleta";
}

// Coleta parada no meio (sem sinal há mais de 3 minutos)? Qualquer chamada pode retomá-la; começar uma nova continua exigindo autorização.
async function parada(sb: NonNullable<ReturnType<typeof supabaseAdmin>>) {
  const { data } = await sb.from("coleta_execucoes").select("status,pulso_em").order("id", { ascending: false }).limit(1).maybeSingle();
  return data?.status === "rodando" && Date.now() - new Date(data.pulso_em).getTime() > 100_000;
}

async function iniciar(req: Request) {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ erro: "falta SUPABASE_SECRET_KEY" }, { status: 500 });
  const quem = autorizado(req) ?? ((await parada(sb)) ? "retomada" : null);
  if (!quem) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  // Cron e chamadas internas continuam uma coleta interrompida ou começam a do dia; ?nova=1 força recomeçar.
  const nova = quem !== "retomada" && new URL(req.url).searchParams.get("nova") === "1";
  const url = proximaUrl(req);
  waitUntil((async () => {
    const r = await executar(sb, Date.now() + ORCAMENTO_MS, { nova });
    if (!r.terminou && !r.ocupado) await fetch(url, { method: "POST", headers: { "x-coleta-token": tokenInterno() } }).catch(() => {});
  })());
  return NextResponse.json({ ok: true }, { status: 202 });
}

export const GET = iniciar;
export const POST = iniciar;
