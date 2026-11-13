import "server-only";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizar, relevante, paginaPublicacao, paginaPropostaAberta, detalhe, arquivos } from "./pncp";
import { avisosDoDia, textoDoAviso, montarEdital, diasDou, mesmoNumero, type ItemDou } from "./dou";
import { ultimaEdicao, localizar, textoDoPdf, avisosDaEdicao, nomeCidade, type EdicaoDosp } from "./dosp";

// Coleta diária de editais no PNCP, em etapas curtas e retomáveis (cada chamada roda ~45s e passa o bastão).
type Tarefa = { tipo: "pub" | "prop"; data: string; mod: number };
type Cursor = { fase: "lista" | "dou" | "dosp" | "acomp" | "limpeza";
  dosp?: { de: number; ate: number; prox: number; fila: EdicaoDosp[] }; tarefas: Tarefa[]; i: number; pagina: number; acomp: number; erros: number;
  dou?: { dias: string[]; d: number; fila: ItemDou[] | null } };
const idDou = (it: ItemDou) => `DOU-${/(\d+)$/.exec(it.u)?.[1] ?? it.u}`;

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

// Espera a tarefa só até perto do fim do tempo da rodada; se não der, devolve null (a rodada salva e passa a vez para a próxima)
const noPrazo = <T,>(p: Promise<T>, prazo: number) =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, prazo - Date.now() - 2000)))]);

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
      if (!t) { c.fase = "dou"; continue; }
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

    if (c.fase === "dou") {
      // Diário Oficial da União, seção 3: avisos de prefeituras, estados e conselhos (primeira vez: 7 dias; depois, ontem e hoje)
      if (!c.dou) {
        const { count } = await sb.from("editais").select("id", { count: "exact", head: true }).eq("fonte", "dou");
        c.dou = { dias: diasDou(count ? 2 : 7), d: 0, fila: null };
      }
      const D = c.dou;
      if (D.d >= D.dias.length) { c.fase = "dosp"; await salvar(); continue; }
      if (!D.fila) {
        const itens = await noPrazo(avisosDoDia(D.dias[D.d]).catch(() => [] as ItemDou[]), prazo);
        if (!itens) break;
        const ja = new Set<string>();
        for (let k = 0; k < itens.length; k += 150) {
          const { data } = await sb.from("editais").select("id").in("id", itens.slice(k, k + 150).map(idDou));
          for (const r of data ?? []) ja.add(r.id);
        }
        D.fila = itens.filter((it) => !ja.has(idDou(it)));
        await salvar();
        continue;
      }
      const lote = D.fila.splice(0, 8);
      if (!lote.length) { D.d++; D.fila = null; await salvar(); continue; }
      const lidas = await noPrazo(Promise.all(lote.map(async (it) => {
        const texto = await textoDoAviso(it.u).catch(() => null);
        return texto ? montarEdital(it, texto) : null;
      })), prazo);
      if (!lidas) { D.fila.unshift(...lote); await salvar(); break; }
      const linhas = lidas.filter(Boolean) as ReturnType<typeof montarEdital>[];
      const novas: typeof linhas = [];
      for (const l of linhas) {
        // Já veio pelo PNCP? Mesmo município, ano e número: fica só a versão do PNCP, que é mais completa
        if (l.municipio && l.numero) {
          const { data: iguais } = await sb.from("editais").select("numero").eq("fonte", "pncp").eq("ano", l.ano).ilike("municipio", l.municipio).limit(50);
          if ((iguais ?? []).some((x) => mesmoNumero(x.numero, l.numero))) continue;
        }
        novas.push(l);
      }
      if (novas.length) {
        const { error } = await sb.from("editais").upsert(novas, { onConflict: "id" });
        if (!error) registros += novas.length;
      }
      await salvar();
      continue;
    }

    if (c.fase === "dosp") {
      // DOSP / Imprensa Oficial Municipal: percorre os números de edição novos desde a última coleta
      if (!c.dosp) {
        const ate = await noPrazo(ultimaEdicao(), prazo);
        if (!ate) { c.fase = "acomp"; await salvar(); continue; }
        const { data: antes } = await sb.from("coleta_execucoes").select("cursor").neq("id", exec.id).order("id", { ascending: false }).limit(20);
        const ultimo = (antes ?? []).map((x: any) => x.cursor?.dosp?.ate).find((v: any) => typeof v === "number");
        const de = ultimo ? ultimo + 1 : ate - 1200; // primeira vez: uns 4 dias para trás
        c.dosp = { de, ate, prox: de, fila: [] };
        await salvar();
        continue;
      }
      const P = c.dosp;
      if (P.prox <= P.ate) {
        const ids = Array.from({ length: Math.min(30, P.ate - P.prox + 1) }, (_, k) => P.prox + k);
        const achadas = await noPrazo(Promise.all(ids.map(localizar)), prazo);
        if (!achadas) break;
        P.fila.push(...(achadas.filter(Boolean) as EdicaoDosp[]));
        P.prox += ids.length;
        await salvar();
        continue;
      }
      const lote = P.fila.splice(0, 4);
      if (!lote.length) { c.fase = "acomp"; await salvar(); continue; }
      const lidos = await noPrazo(Promise.all(lote.map(async (ed) => {
        const texto = await textoDoPdf(ed.url);
        return texto ? avisosDaEdicao(ed, texto, await nomeCidade(ed.uf, ed.cidade)) : [];
      })), prazo);
      if (!lidos) { P.fila.unshift(...lote); await salvar(); break; }
      const achados = lidos.flat();
      const novas: typeof achados = [];
      for (const l of achados) {
        if (l.numero) {
          const { data: iguais } = await sb.from("editais").select("numero").in("fonte", ["pncp", "dou"]).eq("ano", l.ano).ilike("municipio", l.municipio).limit(80);
          if ((iguais ?? []).some((x) => mesmoNumero(x.numero, l.numero))) continue;
        }
        novas.push(l);
      }
      if (novas.length) {
        const { error } = await sb.from("editais").upsert(novas, { onConflict: "id" });
        if (!error) registros += novas.length;
      }
      await salvar();
      continue;
    }

    if (c.fase === "acomp") {
      // Editais acompanhados por algum cliente: confere alterações no PNCP
      const corte = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: ac } = await sb.from("edital_acompanhamentos").select("edital_id, editais!inner(*)")
        .or(`encerramento_em.gte.${corte},encerramento_em.is.null`, { referencedTable: "editais" })
        .eq("editais.fonte", "pncp")
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
    // Avisos de diário sem data de propostas: saem 60 dias depois de publicados
    let q2 = sb.from("editais").delete().neq("fonte", "pncp").is("encerramento_em", null).lt("publicado_em", new Date(Date.now() - 60 * 86400000).toISOString());
    if (manter.length) q2 = q2.not("id", "in", `(${manter.map((m) => `"${m}"`).join(",")})`);
    await q2;
    await sb.from("coleta_execucoes").delete().lt("iniciada_em", new Date(Date.now() - 30 * 86400000).toISOString());
    await salvar({ status: "ok", terminada_em: new Date().toISOString(), mensagem: `${registros} editais coletados` });
    return { terminou: true };
  }
  // Fim da rodada: libera a vez (o "sinal" fica antigo) para a próxima rodada, chamada logo em seguida, não achar que ainda há outra rodando
  await sb.from("coleta_execucoes").update({ cursor: c, registros, pulso_em: new Date(Date.now() - 120_000).toISOString() }).eq("id", exec.id);
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
