import type { Metadata, Viewport } from "next";
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
  title: "Barzzo — Encontre e Agende Barbearias",
  description: "A melhor experiência para agendar serviços na sua barbearia favorita.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.svg",
    apple: "/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#B45A2B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={roboto.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#FFFFFF] text-black dark:bg-[#0A0A0B] dark:text-white transition-colors duration-150">
        <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-bold tracking-wider text-[#B45A2B] hover:opacity-90 transition-opacity"
            >
              BARZZO
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/barbearias"
                className="text-sm font-medium hover:text-[#B45A2B] transition-colors px-2 py-1"
              >
                Barbearias
              </Link>
              <Link
                href="/agendamentos"
                className="text-sm font-medium hover:text-[#B45A2B] transition-colors px-2 py-1"
              >
                Agendamentos
              </Link>
              <Link
                href="/favoritos"
                className="text-sm font-medium hover:text-[#B45A2B] transition-colors px-2 py-1"
              >
                Favoritos
              </Link>
              <Link
                href="/perfil"
                className="text-sm font-medium hover:text-[#B45A2B] transition-colors px-2 py-1"
              >
                Perfil
              </Link>
              <Link
                href="/entrar"
                className="text-sm font-medium bg-[#B45A2B] text-white hover:bg-[#C46632] px-3.5 py-1.5 rounded-lg transition-colors"
              >
                Entrar
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 py-6 text-center text-xs opacity-70">
          <p>© {new Date().getFullYear()} Barzzo. Todos os direitos reservados.</p>
        </footer>
      </body>
    </html>
  );
}
