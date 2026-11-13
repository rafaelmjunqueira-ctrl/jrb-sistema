// Diário Oficial da União, seção 3 (avisos de licitação). Página pública "leitura do jornal" da Imprensa Nacional.
// Muitas prefeituras e órgãos estaduais publicam no DOU (obrigatório quando há recurso federal) e nem sempre no PNCP.
import { classificar, semAcento } from "./areas";

const BASE = "https://www.in.gov.br";
const UA = "Mozilla/5.0 (compatible; jrb-sistema/1.0; +https://jrb-sistema.vercel.app)";

export type ItemDou = { u: string; h: string; t: string; c: string; d: string };

const ESTADOS: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM", "bahia": "BA", "ceara": "CE", "distrito federal": "DF", "espirito santo": "ES",
  "goias": "GO", "maranhao": "MA", "mato grosso do sul": "MS", "mato grosso": "MT", "minas gerais": "MG", "para": "PA", "paraiba": "PB", "parana": "PR",
  "pernambuco": "PE", "piaui": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR",
  "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE", "tocantins": "TO",
};
const SIGLAS_UF = new Set(Object.values(ESTADOS));

// Órgãos federais já publicam no PNCP; daqui interessam prefeituras, estados, conselhos e afins
const RAIZ_OK = /^(prefeituras|governo do estado|entidades de fiscaliza|ineditoriais|poder legislativo|poder judici|minist[eé]rio p[uú]blico)/i;
const TIPO_OK = /aviso de licita|preg[aã]o|concorr|^edital$|chamamento|credenciamento|^aviso$|dispensa/i;
const NAO_E_ABERTURA = /^\s*(avisos? de |edital de )?(resultado|homologa|adjudica|anula|revoga|suspens|cancela|ratifica|extrato|retifica|errata|julgamento|impugna|prorroga|adiamento|reabertura|altera|inexigibilidade|deserta|fracassad|notifica|convoca|intima|penalidade|san[cç][aã]o)/i;

const dmy = (d: Date) => { const b = new Date(d.getTime() - 3 * 3600000); return `${String(b.getUTCDate()).padStart(2, "0")}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${b.getUTCFullYear()}`; };
export const diasDou = (n: number) => Array.from({ length: n }, (_, i) => dmy(new Date(Date.now() - (n - 1 - i) * 86400000)));

async function pegarTexto(url: string) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(12000) });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch { /* tenta de novo */ }
    await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  return null;
}

// Lista do dia (dd-mm-aaaa): só avisos que abrem disputa, de órgãos fora da esfera federal
export async function avisosDoDia(dia: string): Promise<ItemDou[]> {
  const html = await pegarTexto(`${BASE}/leiturajornal?data=${dia}&secao=do3`);
  if (!html) return [];
  const m = /<script id="params" type="application\/json">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(html);
  if (!m) return [];
  let arr: any[] = [];
  try { arr = JSON.parse(m[1]).jsonArray ?? []; } catch { return []; }
  return arr
    .filter((a) => RAIZ_OK.test(a.hierarchyStr ?? "") && TIPO_OK.test(a.artType ?? "") && !NAO_E_ABERTURA.test(a.content ?? "")
      && /licita|preg[aã]o|concorr[eê]ncia|chamamento|credenciamento|dispensa eletr|cota[cç][aã]o eletr|leil[aã]o/i.test(a.content ?? "")
      && !/concurso p[uú]blico|processo seletivo|provimento de (?:vagas|cargos)/i.test(a.content ?? ""))
    .map((a) => ({ u: String(a.urlTitle), h: String(a.hierarchyStr), t: String(a.artType), c: String(a.content).slice(0, 300), d: String(a.pubDate) }));
}

const entidades = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&([a-z]+);/gi, (x, n) => ({ ordm: "º", ordf: "ª", deg: "°", ccedil: "ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô" } as any)[n.toLowerCase()] ?? x);

export async function textoDoAviso(urlTitle: string) {
  const html = await pegarTexto(`${BASE}/web/dou/-/${urlTitle}`);
  if (!html) return null;
  const m = /<div class="texto-dou">([\s\S]*?)<\/div>/.exec(html);
  if (!m) return null;
  return entidades(m[1].replace(/<\/p>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n").trim();
}

const MESES: Record<string, number> = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const PALAVRA_PRAZO = /(abertura|sess[aã]o|propostas?|disputa|recebimento|realiza[cç][aã]o|certame|lances|entrega|credenciamento|in[ií]cio|data|dia|at[eé])/i;

// Datas do texto que podem ser o prazo das propostas: depois da publicação e até 120 dias à frente, perto de uma palavra-chave
export function datasDePrazo(texto: string, pub: Date) {
  const achadas: { quando: Date; pos: number }[] = [];
  const t = semAcento(texto);
  const re = /(\d{1,2})\s*[\/.]\s*(\d{1,2})\s*[\/.]\s*(\d{4})|(\d{1,2})\s*(?:º|o)?\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const [d, mes, a] = m[1] ? [+m[1], +m[2], +m[3]] : [+m[4], MESES[m[5]], +m[6]];
    if (!d || !mes || d > 31 || mes > 12) continue;
    const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 22);
    const hm = /^[^0-9]{0,8}(\d{1,2})\s*(?:h|:)\s*(\d{2})?/.exec(depois);
    const h = hm && +hm[1] < 24 ? +hm[1] : 9, mi = hm && hm[2] ? +hm[2] : 0;
    const quando = new Date(`${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00-03:00`);
    if (isNaN(+quando)) continue;
    const dias = (+quando - +pub) / 86400000;
    if (dias < 0.5 || dias > 120) continue;
    if (!PALAVRA_PRAZO.test(t.slice(Math.max(0, m.index - 90), m.index))) continue;
    achadas.push({ quando, pos: m.index });
  }
  return achadas.sort((x, y) => +x.quando - +y.quando);
}

export function modalidade(t: string): { id: number | null; nome: string | null } {
  const s = semAcento(t.slice(0, 400));
  if (/pregao\W{0,3}(\(|-)?\s*presencial/.test(s)) return { id: 7, nome: "Pregão - Presencial" };
  if (/pregao/.test(s)) return { id: 6, nome: "Pregão - Eletrônico" };
  if (/concorrencia\W{0,3}(\(|-)?\s*presencial/.test(s)) return { id: 5, nome: "Concorrência - Presencial" };
  if (/concorrencia/.test(s)) return { id: 4, nome: "Concorrência - Eletrônica" };
  if (/dispensa/.test(s)) return { id: 8, nome: "Dispensa" };
  if (/credenciamento|chamamento/.test(s)) return { id: 12, nome: "Credenciamento / chamamento" };
  if (/leilao/.test(s)) return { id: 1, nome: "Leilão" };
  if (/tomada de precos/.test(s)) return { id: null, nome: "Tomada de preços" };
  if (/convite/.test(s)) return { id: null, nome: "Convite" };
  return { id: null, nome: "Licitação" };
}

const RUIM = /^(processo|aviso|avisos|a prefeitura|o munic[ií]pio|o prefeito|a pregoeira|o pregoeiro|o agente|a comiss[aã]o|torna|n[º°o.]|edital|preg[aã]o|concorr[eê]ncia|tipo|modalidade)\b/i;
const limpa = (x: string) => x.replace(/\s+/g, " ").replace(/^["'“”\s:,;–-]+|["'“”\s]+$/g, "")
  .replace(/^(?:da presente licita[cç][aã]o |do certame |desta licita[cç][aã]o )?(?:consiste (?:na|no|em) |[ée] (?:a|o) )/i, "").replace(/^(?:a|o)\s+(?=[A-ZÀ-Úa-zà-ú]{4})/, "").trim();
const ok = (x?: string | null) => !!x && x.length >= 25 && !RUIM.test(x);

export function objetoDe(t: string) {
  const fim = String.raw`(?=\.\s|;\s|\n|\s(?:data|abertura|sess[aã]o p[uú]blica|crit[eé]rio|valor (?:estimado|global|total|m[aá]ximo)|local|tipo:|recebimento|prazo|in[ií]cio|realiza[cç][aã]o|entrega das|disputa|o edital|edital (?:e|completo|na [ií]ntegra)|informa[cç][oõ]es|retirada|julgamento)\b|$)`;
  const tentativas = [
    new RegExp(String.raw`\bobjeto\s*(?:da licita[cç][aã]o|do certame)?\s*[:\-–]\s*([\s\S]{15,700}?)` + fim, "i"),
    new RegExp(String.raw`(?:cujo|tendo (?:como|por)|que tem (?:como|por)|com o|tem por)\s+objeto\s*(?:é|e|a|o)?\s*:?\s*([\s\S]{15,700}?)` + fim, "i"),
    new RegExp(String.raw`\bobjeto\s*[:\-–]?\s*([\s\S]{15,700}?)` + fim, "i"),
    new RegExp(String.raw`((?:registro de pre[cç]os|aquisi[cç][aã]o|contrata[cç][aã]o|presta[cç][aã]o de servi[cç]os|execu[cç][aã]o d[ea]|fornecimento|loca[cç][aã]o|credenciamento de|concess[aã]o|aliena[cç][aã]o)[\s\S]{15,600}?)` + fim, "i"),
  ];
  for (const re of tentativas) { const m = re.exec(t); const x = m ? limpa(m[1]) : null; if (ok(x)) return x!; }
  return limpa(t.replace(/^[\s\S]{0,120}?\d{4}\s*/, "").slice(0, 300));
}

export const capitalizar = (s: string) => s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && /^(de|da|do|das|dos|e)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");

// Monta a linha da tabela "editais" a partir do item da lista e do texto completo
export function montarEdital(it: ItemDou, texto: string) {
  const partes = it.h.split("/").map((x) => x.trim()).filter(Boolean);
  const orgao = partes[partes.length - 1] ?? it.h;
  let uf: string | null = null;
  for (const p of partes) { const e = /^estado d[eoa] (.+)$/i.exec(p); if (e) uf = ESTADOS[semAcento(e[1])] ?? uf; }
  const cidUf = Array.from(texto.matchAll(/([A-ZÀ-Ú][A-Za-zÀ-ú'. ]{2,40}?)\s*[\/\-–]\s*([A-Z]{2})\b/g)).filter((x) => SIGLAS_UF.has(x[2]));
  if (!uf && cidUf.length) uf = cidUf[cidUf.length - 1][2];
  let municipio: string | null = null;
  const pm = /(?:prefeitura|c[aâ]mara|munic[ií]pio)(?: municipal)? d[eoa]s? (.+)$/i.exec(orgao);
  if (pm) municipio = capitalizar(pm[1].replace(/\s*[-\/]\s*[A-Z]{2}$/, ""));
  else if (/^prefeituras/i.test(it.h) && cidUf.length) municipio = capitalizar(cidUf[cidUf.length - 1][1].trim());

  const [d, mes, a] = it.d.split("/").map(Number);
  const pub = new Date(`${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}T06:00:00-03:00`);
  const datas = datasDePrazo(texto, pub);
  const mod = modalidade(texto);
  const num = /n[º°o.]*\s*(\d{1,6})\s*\/\s*(\d{4})/i.exec(texto);
  const valor = /valor[^R$]{0,50}R\$\s*([\d.]+,\d{2})/i.exec(texto);
  const objeto = objetoDe(texto);
  const portal = /(https?:\/\/[^\s,;)]+|www\.[^\s,;)]+)/i.exec(texto);
  const idNum = /(\d+)$/.exec(it.u)?.[1] ?? it.u;
  return {
    id: `DOU-${idNum}`, fonte: "dou", url_fonte: `${BASE}/web/dou/-/${it.u}`, texto: texto.slice(0, 8000),
    orgao_cnpj: null, ano: num ? +num[2] : a, sequencial: null,
    numero: num ? `${num[1]}/${num[2]}` : null, processo: null,
    orgao_nome: orgao, unidade_nome: partes.length > 2 ? partes[partes.length - 2] : null, uf, municipio, esfera: /^prefeituras/i.test(it.h) ? "M" : /^governo do estado/i.test(it.h) ? "E" : null,
    modalidade_id: mod.id, modalidade: mod.nome, modo_disputa: null, srp: /registro de pre[cç]os/i.test(texto),
    objeto: objeto.slice(0, 1200), info_complementar: null,
    valor_estimado: valor ? Number(valor[1].replace(/\./g, "").replace(",", ".")) || null : null,
    situacao_id: 1, situacao: "Divulgada no Diário Oficial da União",
    publicado_em: pub.toISOString(), abertura_em: datas.length ? datas[datas.length - 1].quando.toISOString() : null,
    encerramento_em: datas.length ? datas[0].quando.toISOString() : null, atualizado_pncp: null,
    link_origem: portal ? (portal[1].startsWith("http") ? portal[1] : `https://${portal[1]}`).replace(/[.]+$/, "") : null,
    n_arquivos: null, areas: classificar(`${objeto} ${texto.slice(0, 1500)}`),
    texto_busca: semAcento(`${objeto} ${orgao} ${municipio ?? ""} ${texto.slice(0, 1500)}`),
    coletado_em: new Date().toISOString(),
  };
}

// O mesmo aviso já veio do PNCP? (mesmo município, mesmo ano e mesmo número)
export function mesmoNumero(numeroPncp: string | null, numeroDou: string | null) {
  if (!numeroPncp || !numeroDou) return false;
  const a = parseInt(String(numeroPncp).replace(/\D.*$/, "").replace(/^0+/, "") || "0", 10);
  const b = parseInt(numeroDou.split("/")[0], 10);
  return a > 0 && a === b;
}
