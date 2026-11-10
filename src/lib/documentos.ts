import { semAcento } from "./areas";

// Cofre de documentos da empresa: categorias da habilitação em licitações + uso geral
export const CATEGORIAS: { id: string; nome: string; descricao: string }[] = [
  { id: "juridica", nome: "Habilitação jurídica", descricao: "Contrato social, cartão CNPJ, documentos dos sócios" },
  { id: "fiscal", nome: "Regularidade fiscal e trabalhista", descricao: "CNDs federal, estadual, municipal, FGTS e trabalhista" },
  { id: "economica", nome: "Econômico-financeira", descricao: "Balanços, DRE, certidão de falência" },
  { id: "tecnica", nome: "Qualificação técnica", descricao: "Atestados, registros no CREA/CRM, ART" },
  { id: "contratos", nome: "Contratos e procurações", descricao: "Contratos, procurações, atas" },
  { id: "outros", nome: "Outros documentos", descricao: "Alvarás, licenças e demais arquivos" },
];
export const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nome]));

// Itens que quase todo edital pede; marcados pelo "tipo" do documento
export const CHECKLIST: { tipo: string; categoria: string; termos: RegExp; validade: boolean }[] = [
  { tipo: "Contrato social e alterações", categoria: "juridica", termos: /contrato social|alteracao contratual|estatuto|requerimento de empresario/, validade: false },
  { tipo: "Cartão CNPJ", categoria: "juridica", termos: /cartao cnpj|comprovante de inscricao|cnpj/, validade: false },
  { tipo: "CND Federal (Receita/PGFN)", categoria: "fiscal", termos: /federal|receita|pgfn|uniao/, validade: true },
  { tipo: "CRF do FGTS", categoria: "fiscal", termos: /fgts|crf/, validade: true },
  { tipo: "CNDT Trabalhista", categoria: "fiscal", termos: /trabalhist|cndt/, validade: true },
  { tipo: "CND Estadual", categoria: "fiscal", termos: /estadual|icms|sefaz|divida ativa estadual/, validade: true },
  { tipo: "CND Municipal", categoria: "fiscal", termos: /municipal|iss|mobiliario/, validade: true },
  { tipo: "Certidão de falência", categoria: "economica", termos: /falencia|recuperacao judicial|concordata/, validade: true },
  { tipo: "Balanço patrimonial", categoria: "economica", termos: /balanc|dre|demonstra/, validade: false },
];

export function sugerirCategoria(nome: string) {
  const t = semAcento(nome);
  if (/balanc|dre\b|demonstra|falencia|indice/.test(t)) return "economica";
  if (/certid|cnd|crf|fgts|trabalhist|receita|federal|estadual|municipal|regularidade/.test(t) && !/crea|crm|cau|tecnic/.test(t)) return "fiscal";
  if (/contrato social|cnpj|estatuto|alteracao|rg|cpf|cnh|socio|jucesp|junta/.test(t)) return "juridica";
  if (/atestado|crea|crm|cau|art\b|rrt|acervo|tecnic|engenheiro/.test(t)) return "tecnica";
  if (/procura|contrato|ata\b|substabelec/.test(t)) return "contratos";
  return "outros";
}

// Muitas certidões trazem a validade no nome do arquivo ("CERTIDÃO CREA 31.12.2025")
export function validadeNoNome(nome: string): string | null {
  const m = /(\d{2})[./-](\d{2})[./-](\d{4})/.exec(nome);
  if (!m) return null;
  const [, d, mth, y] = m; const iso = `${y}-${mth}-${d}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

export function tituloDoArquivo(nome: string) {
  return nome.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/^\d+(\.\d+)?\s*[-–.]\s*/, "").replace(/[_]+/g, " ").trim();
}

export function situacaoValidade(validade?: string | null) {
  if (!validade) return { texto: "sem validade", classe: "", dias: null as number | null };
  const dias = Math.round((new Date(validade + "T12:00:00").getTime() - Date.now()) / 86400000);
  if (dias < 0) return { texto: `vencido há ${-dias} dia${dias === -1 ? "" : "s"}`, classe: "etq-risco", dias };
  if (dias <= 15) return { texto: `vence em ${dias} dia${dias === 1 ? "" : "s"}`, classe: "etq-alerta", dias };
  return { texto: `válido até ${validade.split("-").reverse().join("/")}`, classe: "etq-ok", dias };
}

export function docValido(d: string) {
  const s = d.replace(/\D/g, "");
  if (s.length === 11) {
    if (/^(\d)\1+$/.test(s)) return false;
    const dv = (n: number) => { let soma = 0; for (let i = 0; i < n; i++) soma += +s[i] * (n + 1 - i); const r = (soma * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +s[9] && dv(10) === +s[10];
  }
  if (s.length === 14) {
    if (/^(\d)\1+$/.test(s)) return false;
    const calc = (n: number) => { const p = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const soma = p.reduce((a, w, i) => a + w * +s[i], 0); const r = soma % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +s[12] && calc(13) === +s[13];
  }
  return false;
}
