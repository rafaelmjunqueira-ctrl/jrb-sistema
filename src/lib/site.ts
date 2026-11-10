import { headers } from "next/headers";
// Endereço do site, para montar links de e-mail e convite
export function enderecoSite() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = headers();
  return `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
}
