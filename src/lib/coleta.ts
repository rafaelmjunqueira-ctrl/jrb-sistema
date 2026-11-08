import "server-only";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizar, relevante, paginaPublicacao, paginaPropostaAberta, detalhe, arquivos } from "./pncp";

// Coleta diária de editais no PNCP, em etapas curtas e retomáveis (cada chamada roda ~45s e passa o bastão).
type Tarefa = { tipo: "pub" | "prop"; data: string; mod: number };
type Cursor = { fase: "lista" | "acomp" | "limpeza"; tarefas: Tarefa[]; i: number; pagina: number; acomp: number; erros: number };

const MODS = [6, 4, 7, 5, 8, 12, 3, 2];
const ymd = (d: Date) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10).replace(/-/g, "");

export function tokenInterno() {
  return createHash("sha256").update("coleta:" + (process.env.SUPABASE_SECRET_KEY ?? "")).digest("hex");
}

async function novoCursor(sb: SupabaseClient): Promise<Cursor> {
  const { count } = await sb.from("editais").select("id", { count: "exact", head: true });
  const hoje = new Date(), ontem = new Date(Date.now() - 86400000);
  const tarefas: Tarefa[] = [];
  if (!count) {
    // Primeira carga: tudo que está com propostas abertas hoje
    const ate = ymd(new Date(Date.now() + 365 * 86400000));
    for (const mod of MODS) tarefas.push({ tipo: "prop", data: ate, mod });
  }
  for (const d of [ontem, hoje]) for (const mod of MODS) tarefas.push({ tipo: "pub", data: ymd(d), mod });
  return { fase: "lista", tarefas, i: 0, pagina: 1, acomp: 0, erros: 0 };
}

const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "sem data";
const brl = (v?: number | null) => v == null ? "não informado" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function executar(sb: SupabaseClient, prazo: number, { nova = false } = {}) {
  const { data: ultima } = await sb.from("coleta_execucoes").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
  if (ultima?.status === "rodando" && Date.now() - new Date(ultima.pulso_em).getTime() < 90_000) return { ocupado: true, terminou: false };

  let exec = ultima;
  if (!ultima || ultima.status !== "rodando" || nova) {
    if (ultima?.status === "rodando") await sb.from("coleta_execucoes").update({ status: "erro", mensagem: "substituída", terminada_em: new Date().toISOString() }).eq("id", ultima.id);
    const { data } = await sb.from("coleta_execucoes").insert({ cursor: await novoCursor(sb) }).select("*").single();
    exec = data;
  }
  const c: Cursor = exec.cursor;
  let registros: number = exec.registros ?? 0;
  const salvar = (extra: object = {}) => sb.from("coleta_execucoes").update({ cursor: c, registros, pulso_em: new Date().toISOString(), ...extra }).eq("id", exec.id);

  while (Date.now() < prazo) {
    if (c.fase === "lista") {
      const t = c.tarefas[c.i];
      if (!t) { c.fase = "acomp"; continue; }
      let r: any = null;
      try {
        r = t.tipo === "pub" ? await paginaPublicacao(t.data, t.mod, c.pagina) : await paginaPropostaAberta(t.data, t.mod, c.pagina);
      } catch { c.erros++; if (c.erros > 30) { await salvar({ status: "erro", mensagem: "PNCP fora do ar", terminada_em: new Date().toISOString() }); return { terminou: true }; } }
      const lista: any[] = r?.data ?? [];
      const linhas = Array.from(new Map(lista.filter(relevante).map((x) => { const n = normalizar(x); return [n.id, n] as const; })).values());
      if (linhas.length) {
        const { error } = await sb.from("editais").upsert(linhas, { onConflict: "id" });
        if (!error) registros += linhas.length;
      }
      if (!r || !lista.length || c.pagina >= (r.totalPaginas ?? 1)) { c.i++; c.pagina = 1; } else c.pagina++;
      await salvar();
      continue;
    }

    if (c.fase === "acomp") {
      // Editais acompanhados por algum cliente: confere alterações no PNCP
      const corte = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: ac } = await sb.from("edital_acompanhamentos").select("edital_id, editais!inner(*)")
        .or(`encerramento_em.gte.${corte},encerramento_em.is.null`, { referencedTable: "editais" })
        .order("edital_id").range(c.acomp, c.acomp + 9);
      const vistos = new Set<string>();
      for (const a of ac ?? []) {
        if (vistos.has(a.edital_id)) continue; vistos.add(a.edital_id);
        await conferir(sb, (a as any).editais).catch(() => {});
      }
      if (!ac?.length || ac.length < 10) c.fase = "limpeza"; else c.acomp += 10;
      await salvar();
      continue;
    }

    // Limpeza: editais encerrados há mais de 45 dias e que ninguém acompanha
    const corte = new Date(Date.now() - 45 * 86400000).toISOString();
    const { data: seguidos } = await sb.from("edital_acompanhamentos").select("edital_id");
    const manter = Array.from(new Set((seguidos ?? []).map((s) => s.edital_id)));
    let q = sb.from("editais").delete().lt("encerramento_em", corte);
    if (manter.length) q = q.not("id", "in", `(${manter.map((m) => `"${m}"`).join(",")})`);
    await q;
    await sb.from("coleta_execucoes").delete().lt("iniciada_em", new Date(Date.now() - 30 * 86400000).toISOString());
    await salvar({ status: "ok", terminada_em: new Date().toISOString(), mensagem: `${registros} editais coletados` });
    return { terminou: true };
  }
  return { terminou: false };
}

// Compara o edital salvo com o PNCP e registra o que mudou
export async function conferir(sb: SupabaseClient, e: any) {
  const d = await detalhe(e.orgao_cnpj, e.ano, e.sequencial);
  if (!d) return;
  const n = normalizar(d);
  const docs = await arquivos(e.orgao_cnpj, e.ano, e.sequencial);
  const ev: { edital_id: string; tipo: string; descricao: string }[] = [];
  const add = (tipo: string, descricao: string) => ev.push({ edital_id: e.id, tipo, descricao });
  if (e.situacao_id != null && n.situacao_id !== e.situacao_id) add("situacao", `Situação mudou de "${e.situacao}" para "${n.situacao}".`);
  if (e.encerramento_em && n.encerramento_em && +new Date(n.encerramento_em) !== +new Date(e.encerramento_em)) add("prazo", `Prazo das propostas mudou de ${fmt(e.encerramento_em)} para ${fmt(n.encerramento_em)}.`);
  if (e.abertura_em && n.abertura_em && +new Date(n.abertura_em) !== +new Date(e.abertura_em)) add("prazo", `Abertura das propostas mudou de ${fmt(e.abertura_em)} para ${fmt(n.abertura_em)}.`);
  if (e.valor_estimado != null && n.valor_estimado != null && Number(n.valor_estimado) !== Number(e.valor_estimado)) add("valor", `Valor estimado mudou de ${brl(e.valor_estimado)} para ${brl(n.valor_estimado)}.`);
  if (e.objeto && n.objeto && n.objeto !== e.objeto) add("objeto", "O texto do objeto foi alterado.");
  if (e.n_arquivos != null && docs.length > e.n_arquivos) {
    const novos = docs.slice(e.n_arquivos).map((x) => x.titulo || x.tipoDocumentoNome).slice(0, 3).join("; ");
    add("arquivo", `${docs.length - e.n_arquivos} documento(s) novo(s) publicado(s): ${novos}.`);
  }
  await sb.from("editais").update({ ...n, n_arquivos: docs.length }).eq("id", e.id);
  if (ev.length) await sb.from("edital_eventos").insert(ev);
  return ev.length;
}
