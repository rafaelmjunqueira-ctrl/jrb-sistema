import "server-only";

// Envio de e-mails pelo Resend (resend.com). Sem RESEND_API_KEY, nada é enviado e o sistema segue funcionando.
const REMETENTE = () => process.env.EMAIL_REMETENTE || "JRB Advogados <painel@jrbadvs.com.br>";
export const emailAtivo = () => Boolean(process.env.RESEND_API_KEY);

export async function enviarEmail(para: string, assunto: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMETENTE(), to: [para], subject: assunto, html, ...(process.env.EMAIL_RESPOSTA ? { reply_to: process.env.EMAIL_RESPOSTA } : {}) }),
    });
    return r.ok;
  } catch { return false; }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// Moldura única dos e-mails: cabeçalho bordô, texto, um botão e o rodapé do escritório
export function modelo(titulo: string, paragrafos: string[], botao?: { texto: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F4EFE8;font-family:Verdana,Arial,sans-serif;color:#2A2422">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#6E1F2E;padding:22px 28px;color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:bold">JRB <span style="font-weight:normal;font-size:15px;color:#E9D9B8">Advogados Associados</span></td></tr>
<tr><td style="padding:28px">
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px">${esc(titulo)}</h1>
${paragrafos.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${p}</p>`).join("")}
${botao ? `<p style="margin:22px 0"><a href="${botao.url}" style="background:#6E1F2E;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-size:15px;display:inline-block">${esc(botao.texto)}</a></p>
<p style="font-size:12px;color:#7A706B;margin:0">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${botao.url}</span></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#FAF7F2;font-size:12px;color:#7A706B">JRB Advogados Associados · Ribeirão Preto/SP · WhatsApp (16) 99406-3738<br>Este e-mail foi enviado automaticamente pelo painel do cliente. Para falar com o escritório, use o WhatsApp.</td></tr>
</table></td></tr></table></body></html>`;
}
export { esc as escaparHtml };
