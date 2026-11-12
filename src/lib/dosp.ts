// DOSP / Imprensa Oficial Municipal: diários de centenas de prefeituras (a maioria de SP), um PDF por edição.
// Cada edição tem um número sequencial; exibe_do.php?i=<número em base64> redireciona para o PDF (com UF, cidade e data na URL).
import { extractText, getDocumentProxy } from "unpdf";
import { classificar, semAcento } from "./areas";
import { datasDePrazo, modalidade, objetoDe, capitalizar } from "./dou";

const BASE = "https://dosp.com.br";
const UA = "jrb-sistema/1.0 (+https://jrb-sistema.vercel.app)";
export type EdicaoDosp = { id: number; url: string; uf: string; cidade: string; data: string };

// Maior número de edição publicado (a página inicial lista as últimas edições)
export async function ultimaEdicao(): Promise<number | null> {
  const r = await fetch(`${BASE}/`, { cache: "no-store", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!r?.ok) return null;
  const ids = Array.from((await r.text()).matchAll(/\/ed-[\w]+-(\d+)-[0-9a-f]+\.pdf/g)).map((m) => +m[1]);
  return ids.length ? Math.max(...ids) : null;
}

// Descobre o PDF de cada número (sem baixar). Números que não existem ou são de outro serviço voltam null.
export async function localizar(id: number): Promise<EdicaoDosp | null> {
  try {
    const r = await fetch(`${BASE}/exibe_do.php?i=${Buffer.from(String(id)).toString("base64")}`, { redirect: "manual", cache: "no-store", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    const loc = r.headers.get("location");
    const m = loc && /\/diario\/([a-z]{2})\/([a-z0-9-]+)\/(\d{4}-\d{2}-\d{2})\/[^/]+\.pdf$/.exec(loc);
    return m ? { id, url: loc!, uf: m[1].toUpperCase(), cidade: m[2], data: m[3] } : null;
  } catch { return null; }
}

export async function textoDoPdf(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA, Accept: "application/pdf" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok || !/pdf/.test(r.headers.get("content-type") ?? "")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 40_000_000) return null;
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    // Junta palavras escritas com letras espaçadas (ex.: "H I G I E N I Z A Ç Ã O")
    return String(text).replace(/[ \t]+/g, " ").replace(/\b(?:[A-Za-zÀ-ú] ){3,}[A-Za-zÀ-ú]\b/g, (m) => m.replace(/ /g, ""));
  } catch { return null; }
}

// Nome certo da cidade (com acento), pela lista do IBGE
const cacheIbge = new Map<string, Map<string, string>>();
const slug = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export async function nomeCidade(uf: string, cidadeSlug: string) {
  const base = cidadeSlug.replace(/-(legislativo|camara)$/, "");
  if (!cacheIbge.has(uf)) {
    const mapa = new Map<string, string>();
    try {
      const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, { cache: "force-cache", signal: AbortSignal.timeout(10000) });
      for (const m of (await r.json()) as { nome: string }[]) mapa.set(slug(m.nome), m.nome);
    } catch { /* sem IBGE: usa o nome da URL */ }
    cacheIbge.set(uf, mapa);
  }
  return cacheIbge.get(uf)!.get(base) ?? capitalizar(base.replace(/-/g, " "));
}

// Onde começa um aviso que abre disputa
const INICIO = /(aviso\s+de\s+(?:abertura\s+de\s+)?licita[cç][aã]o|aviso\s+de\s+(?:preg[aã]o|concorr[eê]ncia|dispensa|credenciamento|chamamento)|edital\s+de\s+(?:preg[aã]o|concorr[eê]ncia|credenciamento|chamamento)|(?:preg[aã]o|concorr[eê]ncia)\s+(?:eletr[oô]nic[oa]|presencial|p[uú]blica)\s*(?:srp\s*)?n[º°o.]*\s*:?\s*\d{1,5}\s*\/\s*\d{2,4}|dispensa\s+eletr[oô]nica\s*n[º°o.]*\s*:?\s*\d{1,5}\s*\/\s*\d{2,4}|chamamento\s+p[uú]blico\s*n[º°o.]*\s*:?\s*\d{1,5}\s*\/\s*\d{2,4})/gi;
// Atos que citam a licitação mas não abrem disputa
const DEPOIS = /(homolog|adjudic|extrato|ata de registro|contrato|resultado|revoga|anula|ratifica|aditivo|deserta|fracassad|julgamento|recurso|suspens|retifica|errata|convoca[cç][aã]o|sum[aá]rio|[ií]ndice)/i;

export function avisosDaEdicao(ed: EdicaoDosp, texto: string, cidade: string) {
  const t = texto.replace(/\s+/g, " ");
  const pub = new Date(`${ed.data}T06:00:00-03:00`);
  const ancoras: number[] = [];
  for (const m of Array.from(t.matchAll(INICIO))) {
    if (DEPOIS.test(t.slice(Math.max(0, m.index! - 70), m.index!))) continue;
    if (ancoras.length && m.index! - ancoras[ancoras.length - 1] < 400) continue;
    ancoras.push(m.index!);
  }
  const vistos = new Set<string>();
  const out: ReturnType<typeof montar>[] = [];
  ancoras.forEach((ini, k) => {
    const bloco = t.slice(ini, Math.min(ancoras[k + 1] ?? t.length, ini + 2500));
    if (/\.{6,}/.test(bloco.slice(0, 120))) return; // sumário
    if (!/objeto|aquisi[cç][aã]o|contrata[cç][aã]o|registro de pre[cç]os|presta[cç][aã]o de servi/i.test(bloco)) return;
    if (!datasDePrazo(bloco, pub).length) return; // sem data futura de propostas: não é abertura
    const e = montar(ed, bloco, cidade, k, pub);
    const chave = e.numero ?? e.objeto.slice(0, 60);
    if (vistos.has(chave)) return;
    vistos.add(chave); out.push(e);
  });
  return out;
}

function montar(ed: EdicaoDosp, bloco: string, cidade: string, k: number, pub: Date) {
  const camara = /-(legislativo|camara)$/.test(ed.cidade);
  const datas = datasDePrazo(bloco, pub);
  const mod = modalidade(bloco);
  const num = /n[º°o.]*\s*:?\s*(\d{1,5})\s*\/\s*(\d{4}|\d{2})\b/i.exec(bloco);
  const ano = num ? (num[2].length === 2 ? 2000 + +num[2] : +num[2]) : pub.getFullYear();
  const valor = /valor[^R$]{0,50}R\$\s*([\d.]+,\d{2})/i.exec(bloco);
  const objeto = objetoDe(bloco);
  const portal = /(https?:\/\/[^\s,;)]+|www\.[^\s,;)]+)/i.exec(bloco);
  const orgao = `${camara ? "Câmara Municipal" : "Prefeitura Municipal"} de ${cidade}`;
  return {
    id: `DOSP-${ed.id}-${k + 1}`, fonte: "dosp", url_fonte: ed.url, texto: bloco.slice(0, 6000),
    orgao_cnpj: null, ano, sequencial: null, numero: num ? `${+num[1]}/${ano}` : null, processo: null,
    orgao_nome: orgao, unidade_nome: null, uf: ed.uf, municipio: cidade, esfera: "M",
    modalidade_id: mod.id, modalidade: mod.nome, modo_disputa: null, srp: /registro de pre[cç]os/i.test(bloco),
    objeto: objeto.slice(0, 1200), info_complementar: null,
    valor_estimado: valor ? Number(valor[1].replace(/\./g, "").replace(",", ".")) || null : null,
    situacao_id: 1, situacao: "Divulgada no diário oficial do município",
    publicado_em: pub.toISOString(), abertura_em: datas.length ? datas[datas.length - 1].quando.toISOString() : null,
    encerramento_em: datas.length ? datas[0].quando.toISOString() : null, atualizado_pncp: null,
    link_origem: portal ? (portal[1].startsWith("http") ? portal[1] : `https://${portal[1]}`).replace(/[.]+$/, "") : null,
    n_arquivos: null, areas: classificar(`${objeto} ${bloco.slice(0, 1500)}`),
    texto_busca: semAcento(`${objeto} ${orgao} ${cidade} ${bloco.slice(0, 1500)}`),
    coletado_em: new Date().toISOString(),
  };
}
