import Link from "next/link";
import { Star, Search, Bookmark, SlidersHorizontal, FolderLock, Activity } from "lucide-react";
import { NOME_AREA } from "@/lib/areas";
import { reais } from "@/components/util";

export const STATUS_ACOMP: { id: string; nome: string; classe: string }[] = [
  { id: "interesse", nome: "Quero analisar", classe: "" },
  { id: "analisando", nome: "Analisando", classe: "etq-alerta" },
  { id: "participando", nome: "Vou participar", classe: "etq-bordo" },
  { id: "enviada", nome: "Proposta enviada", classe: "etq-bordo" },
  { id: "ganhamos", nome: "Ganhamos", classe: "etq-ok" },
  { id: "descartado", nome: "Descartado", classe: "" },
];
export const NOME_STATUS = Object.fromEntries(STATUS_ACOMP.map((s) => [s.id, s]));

// Editais do PNCP: cnpj-ano-sequencial. Editais de diários oficiais: o próprio id (ex.: DOU-743348423).
export const slugEdital = (e: { id?: string; fonte?: string | null; orgao_cnpj: string | null; ano: number | null; sequencial: number | null }) =>
  e.fonte && e.fonte !== "pncp" && e.id ? e.id : `${e.orgao_cnpj}-${e.ano}-${e.sequencial}`;
export const NOME_FONTE: Record<string, string> = { pncp: "PNCP", dou: "Diário Oficial da União" };

export function SubNavEscritorio({ atual }: { atual: "buscar" | "acompanhados" }) {
  const itens = [
    { k: "buscar", href: "/escritorio/licitacoes", rotulo: "Buscar editais", Icone: Search },
    { k: "acompanhados", href: "/escritorio/licitacoes/acompanhados", rotulo: "Acompanhados e coleta", Icone: Activity },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-5">
      {itens.map(({ k, href, rotulo, Icone }) => {
        const on = k === atual;
        return <Link key={k} href={href} aria-current={on ? "page" : undefined}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap"
          style={on ? { background: "var(--tinta)", color: "var(--folha)" } : { background: "var(--folha)", border: "1px solid var(--fio)", color: "var(--tinta-2)" }}>
          <Icone size={15} />{rotulo}</Link>;
      })}
    </div>
  );
}

export function prazoInfo(enc?: string | null) {
  if (!enc) return { dia: "—", mes: "", texto: "sem prazo informado", tom: "neutro" as const };
  const d = new Date(enc);
  const ms = d.getTime() - Date.now();
  const dias = Math.floor(ms / 86400000), horas = Math.floor(ms / 3600000);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" });
  const mes = d.toLocaleDateString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
  if (ms < 0) return { dia, mes, texto: "propostas encerradas", tom: "neutro" as const };
  if (horas < 48) return { dia, mes, texto: horas < 1 ? "encerra em minutos" : `encerra em ${horas}h`, tom: "risco" as const };
  return { dia, mes, texto: `faltam ${dias} dias`, tom: dias <= 5 ? ("alerta" as const) : ("ok" as const) };
}
const COR = { risco: ["var(--risco-fundo)", "var(--risco)"], alerta: ["var(--alerta-fundo)", "var(--alerta)"], ok: ["var(--papel)", "var(--tinta)"], neutro: ["var(--fio-2)", "var(--tinta-3)"] };

export function SubNavLicitacoes({ cid, atual, nAcomp }: { cid: string; atual: "buscar" | "acompanhando" | "preferencias"; nAcomp?: number }) {
  const itens = [
    { k: "buscar", href: `/cliente/licitacoes?c=${cid}`, rotulo: "Buscar editais", Icone: Search },
    { k: "acompanhando", href: `/cliente/licitacoes/acompanhando?c=${cid}`, rotulo: "Acompanhando", Icone: Bookmark, n: nAcomp },
    { k: "preferencias", href: `/cliente/licitacoes/preferencias?c=${cid}`, rotulo: "Preferências", Icone: SlidersHorizontal },
    { k: "documentos", href: `/cliente/documentos?c=${cid}`, rotulo: "Documentos e CNDs", Icone: FolderLock },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-5">
      {itens.map(({ k, href, rotulo, Icone, n }) => {
        const on = k === atual;
        return <Link key={k} href={href} aria-current={on ? "page" : undefined}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap"
          style={on ? { background: "var(--tinta)", color: "var(--folha)" } : { background: "var(--folha)", border: "1px solid var(--fio)", color: "var(--tinta-2)" }}>
          <Icone size={15} />{rotulo}{!!n && <span className="text-[12px] opacity-80">{n}</span>}</Link>;
      })}
    </div>
  );
}

type Ed = { id: string; fonte?: string | null; orgao_cnpj: string | null; ano: number | null; sequencial: number | null; orgao_nome: string | null; uf: string | null; municipio: string | null;
  modalidade: string | null; objeto: string; valor_estimado: number | null; situacao_id: number | null; situacao: string | null; publicado_em: string | null;
  encerramento_em: string | null; areas: string[]; srp: boolean | null };

export function CartaoEdital({ e, cid, seguido, novo, acao, volta, escritorio }: { e: Ed; cid: string; seguido: boolean; novo?: boolean; acao: (f: FormData) => Promise<void>; volta: string; escritorio?: boolean }) {
  const semData = !e.encerramento_em && e.fonte && e.fonte !== "pncp";
  const p = semData ? { dia: "DOU", mes: e.publicado_em ? new Date(e.publicado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "", texto: "ver data no aviso", tom: "neutro" as const } : prazoInfo(e.encerramento_em);
  const [fundo, cor] = COR[p.tom];
  const href = escritorio ? `/escritorio/licitacoes/${slugEdital(e)}` : `/cliente/licitacoes/${slugEdital(e)}?c=${cid}`;
  return (
    <li className="folha relative grid grid-cols-[58px_1fr] sm:grid-cols-[64px_1fr_auto] gap-3 sm:gap-4 p-4 sm:p-5 transition-colors hover:border-[var(--tinta-3)]">
      <div className="rounded-lg text-center py-2 h-fit" style={{ background: fundo }}>
        <div className={`serif font-semibold leading-none ${semData ? "text-[15px]" : "text-[22px]"}`} style={{ color: cor }}>{p.dia}</div>
        <div className="text-[11px] mt-1" style={{ color: cor }}>{p.mes}</div>
      </div>
      <div className="min-w-0">
        <Link href={href} className="after:absolute after:inset-0 after:content-['']">
          <h3 className="font-semibold text-[15px] leading-snug line-clamp-3">{capitaliza(e.objeto)}</h3>
        </Link>
        <p className="text-[13px] apoio mt-1 truncate">{titulo(e.orgao_nome)}{e.municipio ? ` · ${e.municipio}` : ""}{e.uf ? `/${e.uf}` : ""}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {novo && <span className="etiqueta etq-bordo">Novo</span>}
          {e.situacao_id === 4 && <span className="etiqueta etq-alerta">Suspensa</span>}
          {e.fonte === "dou" && <span className="etiqueta etq-alerta" title="Publicado no Diário Oficial da União">DOU</span>}
          {e.modalidade && <span className="etiqueta">{e.modalidade}</span>}
          {e.valor_estimado ? <span className="etiqueta">{reais(Number(e.valor_estimado))}</span> : null}
          {(e.areas ?? []).slice(0, 2).map((a) => <span key={a} className="etiqueta hidden sm:inline-flex">{NOME_AREA[a] ?? a}</span>)}
          <span className="text-[12px] ml-1" style={{ color: cor === "var(--tinta)" ? "var(--tinta-3)" : cor }}>{p.texto}</span>
        </div>
      </div>
      {!escritorio && <form action={acao} className="relative z-10 col-start-2 sm:col-start-auto row-start-auto">
        <input type="hidden" name="cliente_id" value={cid} /><input type="hidden" name="edital_id" value={e.id} /><input type="hidden" name="volta" value={volta} />
        <button className="btn-sec !py-1.5 !px-3" aria-pressed={seguido} title={seguido ? "Parar de acompanhar" : "Acompanhar este edital"}
          style={seguido ? { borderColor: "var(--ouro)", color: "var(--ouro)" } : {}}>
          <Star size={16} fill={seguido ? "currentColor" : "none"} /><span className="text-[13px]">{seguido ? "Acompanhando" : "Acompanhar"}</span>
        </button>
      </form>}
    </li>
  );
}

// Objetos do PNCP costumam vir em CAIXA ALTA: deixa legível
export function capitaliza(s: string) {
  const t = s.trim();
  if (t.replace(/[^A-ZÀ-Ú]/g, "").length < t.replace(/[^A-Za-zÀ-ú]/g, "").length * 0.7) return t;
  const l = t.toLowerCase().replace(SIGLAS, (m) => m.toUpperCase());
  return l.charAt(0).toUpperCase() + l.slice(1);
}
const SIGLAS = /\b(bls|acls|pals|atls|phtls|sbv|sav|upa|ubs|ubsf|samu|sus|epi|epis|ti|cftv|glp|me|epp|mei|cnpj|cpf|srp|art|rrt|nr|abnt|inss|fgts|iptu|iss|icms|caps|cras|creas|uti|utis|cti|hc|apae|detran|der|dnit|emei|emef|ceu|cei|sp|mg|rj|pr|sc|rs|ba|go|df|ms|mt|pa)\b/g;
export function titulo(s?: string | null) {
  if (!s) return "";
  const minus = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em"]);
  return s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && minus.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
