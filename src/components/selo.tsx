import { Check, AlertTriangle, ShieldAlert } from "lucide-react";
import { type Sinal, cor, rotulo } from "@/lib/saude";

// O selo é o elemento de assinatura do painel: um carimbo de cartório com a situação da empresa.
export function Selo({ sinal, data }: { sinal: Sinal; data: string }) {
  const Icone = sinal === "verde" ? Check : sinal === "amarelo" ? AlertTriangle : ShieldAlert;
  const texto = `SITUAÇÃO JURÍDICA · JRB ADVOGADOS · ${data} · `;
  return (
    <div className="selo-anim relative shrink-0" style={{ width: 148, height: 148 }} role="img" aria-label={`Situação: ${rotulo[sinal]}`}>
      <svg viewBox="0 0 148 148" width="148" height="148" aria-hidden="true">
        <defs><path id="arco" d="M74,74 m-58,0 a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0" /></defs>
        <circle cx="74" cy="74" r="71" fill="none" stroke="var(--ouro)" strokeWidth="1.5" />
        <circle cx="74" cy="74" r="66" fill="none" stroke="var(--ouro)" strokeWidth=".75" strokeDasharray="2 3" />
        <circle cx="74" cy="74" r="48" fill="var(--folha)" stroke="var(--ouro)" strokeWidth="1" />
        <text fontSize="8.6" letterSpacing="1.6" fill="var(--ouro)" fontFamily="Public Sans Variable, sans-serif" fontWeight="600">
          <textPath href="#arco">{texto}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: cor[sinal] }}>
        <Icone size={26} strokeWidth={2.2} />
        <span className="serif text-[15px] font-semibold mt-1 leading-tight text-center px-6">{rotulo[sinal]}</span>
      </div>
    </div>
  );
}
