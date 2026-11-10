import { Scale } from "lucide-react";
// Moldura simples das telas de senha (mesma cara do login)
export function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <a href="/login" className="flex items-center gap-2 mb-8"><Scale size={22} style={{ color: "var(--bordo)" }} /><span className="serif text-2xl font-semibold">JRB Advogados</span></a>
        {children}
      </div>
    </main>
  );
}
