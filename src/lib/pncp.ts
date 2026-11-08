import "server-only";
import { classificar, semAcento } from "./areas";

// Portal Nacional de Contratações Públicas — API pública de consulta (dados abertos, CC BY 4.0).
const CONSULTA = "https://pncp.gov.br/api/consulta/v1";
const PNCP = "https://pncp.gov.br/api/pncp/v1";

async function pegar(url: string, tentativas = 3): Promise<any> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", "User-Agent": "jrb-sistema" } });
      if (r.status === 204) return null;
      if (r.ok) return await r.json();
      if (r.status < 500 && r.status !== 429) throw new Error(`PNCP ${r.status}`);
    } catch (e) { if (i === tentativas - 1) throw e; }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
}

// Datas do PNCP vêm no horário de Brasília, sem fuso
const iso = (d?: string | null) => (d ? `${d.slice(0, 19)}-03:00` : null);

export function normalizar(c: any) {
  const objeto = String(c.objetoCompra ?? "").trim();
  const uo = c.unidadeOrgao ?? {}, oe = c.orgaoEntidade ?? {};
  return {
    id: c.numeroControlePNCP,
    orgao_cnpj: oe.cnpj, ano: c.anoCompra, sequencial: c.sequencialCompra,
    numero: c.numeroCompra ?? null, processo: c.processo ?? null,
    orgao_nome: oe.razaoSocial ?? null, unidade_nome: uo.nomeUnidade ?? null,
    uf: uo.ufSigla ?? null, municipio: uo.municipioNome ?? null, esfera: oe.esferaId ?? null,
    modalidade_id: c.modalidadeId ?? null, modalidade: c.modalidadeNome ?? null, modo_disputa: c.modoDisputaNome ?? null,
    srp: c.srp ?? null, objeto, info_complementar: c.informacaoComplementar ? String(c.informacaoComplementar).slice(0, 2000) : null,
    valor_estimado: c.valorTotalEstimado ?? null, situacao_id: c.situacaoCompraId ?? null, situacao: c.situacaoCompraNome ?? null,
    publicado_em: iso(c.dataPublicacaoPncp), abertura_em: iso(c.dataAberturaProposta), encerramento_em: iso(c.dataEncerramentoProposta),
    atualizado_pncp: iso(c.dataAtualizacaoGlobal ?? c.dataAtualizacao), link_origem: c.linkSistemaOrigem ?? null,
    areas: classificar(`${objeto} ${c.informacaoComplementar ?? ""}`),
    texto_busca: semAcento(`${objeto} ${oe.razaoSocial ?? ""} ${uo.nomeUnidade ?? ""} ${uo.municipioNome ?? ""}`),
    coletado_em: new Date().toISOString(),
  };
}

// Dispensas sem prazo de propostas são compras diretas sem disputa: não interessam ao fornecedor.
export const relevante = (c: any) => !!c.objetoCompra && (c.modalidadeId !== 8 || !!c.dataEncerramentoProposta);

export async function paginaPublicacao(data: string, modalidade: number, pagina: number) {
  return pegar(`${CONSULTA}/contratacoes/publicacao?dataInicial=${data}&dataFinal=${data}&codigoModalidadeContratacao=${modalidade}&pagina=${pagina}&tamanhoPagina=50`);
}
export async function paginaPropostaAberta(dataFinal: string, modalidade: number, pagina: number) {
  return pegar(`${CONSULTA}/contratacoes/proposta?dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalidade}&pagina=${pagina}&tamanhoPagina=50`);
}
export async function detalhe(cnpj: string, ano: number, seq: number) {
  return pegar(`${CONSULTA}/orgaos/${cnpj}/compras/${ano}/${seq}`);
}
export async function arquivos(cnpj: string, ano: number, seq: number) {
  const r = await pegar(`${PNCP}/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`).catch(() => null);
  return (Array.isArray(r) ? r : []).filter((a: any) => a.statusAtivo !== false) as
    { url: string; titulo: string; tipoDocumentoNome: string; dataPublicacaoPncp: string; sequencialDocumento: number }[];
}
export async function itens(cnpj: string, ano: number, seq: number) {
  const r = await pegar(`${PNCP}/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1&tamanhoPagina=100`).catch(() => null);
  return (Array.isArray(r) ? r : []) as
    { numeroItem: number; descricao: string; quantidade: number; unidadeMedida: string; valorUnitarioEstimado: number | null; valorTotal: number | null; tipoBeneficioNome?: string; orcamentoSigiloso?: boolean }[];
}
export const linkPncp = (cnpj: string, ano: number, seq: number) => `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
