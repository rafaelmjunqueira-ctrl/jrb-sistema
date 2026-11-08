import type { Metadata, Viewport } from "next";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/literata";
import "./globals.css";

export const metadata: Metadata = {
  title: "JRB Advogados",
  description: "Acompanhamento jurídico dos clientes da JRB Advogados Associados",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5E1A28" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
