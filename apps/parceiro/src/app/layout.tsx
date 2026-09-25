import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@barzzo/ui";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Barzzo Parceiro — Gestão de Barbearias",
  description: "Plataforma de gestão para donos, gerentes e profissionais.",
};

export default function LayoutParceiro({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={roboto.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#FFFFFF] text-black dark:bg-[#0A0A0B] dark:text-white transition-colors duration-150">
        <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/painel" className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-wider text-[#B45A2B]">
                  BARZZO
                </span>
                <span className="text-[11px] uppercase tracking-wider bg-[#B45A2B]/15 text-[#B45A2B] font-semibold px-2 py-0.5 rounded">
                  Parceiro
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                <Link
                  href="/painel"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Painel
                </Link>
                <Link
                  href="/agenda"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Agenda
                </Link>
                <Link
                  href="/clientes"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Clientes
                </Link>
                <Link
                  href="/avaliacoes"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Avaliações
                </Link>
                <Link
                  href="/servicos"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Serviços
                </Link>
                <Link
                  href="/produtos"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Produtos
                </Link>
                <Link
                  href="/galeria"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Galeria
                </Link>
                <Link
                  href="/campanhas"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Campanhas
                </Link>
                <Link
                  href="/influenciadores"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Influenciadores
                </Link>
                <Link
                  href="/horarios"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Horários
                </Link>
                <Link
                  href="/agenda/bloqueios"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Bloqueios
                </Link>
                <Link
                  href="/equipe"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Equipe
                </Link>
                <Link
                  href="/convites"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Convites
                </Link>
                <Link
                  href="/configuracoes/perfil"
                  className="px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Configurações
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
