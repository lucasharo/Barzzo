import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { AuthCallbackBridge } from "../components/auth-callback-bridge";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Barzzo — Encontre e Agende Barbearias",
  description:
    "Descubra as melhores barbearias perto de você. Agende serviços de corte, barba e muito mais de forma rápida e fácil.",
  metadataBase: new URL("https://barzzo.io"),
  openGraph: {
    title: "Barzzo — Encontre e Agende Barbearias",
    description:
      "Descubra as melhores barbearias perto de você. Agende serviços de corte, barba e muito mais.",
    url: "https://barzzo.io",
    siteName: "Barzzo",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Barzzo — Encontre e Agende Barbearias",
    description: "Descubra as melhores barbearias perto de você.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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
      <body className="min-h-screen flex flex-col bg-[--fundo] text-[--texto] transition-colors duration-150">
        <AuthCallbackBridge />
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center" aria-label="Barzzo, página inicial">
              <Image
                src="/marca/barzzo-logo-claro.webp"
                alt="Barzzo"
                width="116"
                height="35"
                className="h-8 w-auto object-contain dark:hidden"
              />
              <Image
                src="/marca/barzzo-logo-escuro.webp"
                alt=""
                aria-hidden="true"
                width="116"
                height="35"
                className="hidden h-8 w-auto object-contain dark:block"
              />
            </Link>

            {/* Nav */}
            <nav className="flex items-center gap-4">
              <Link
                href="/barbearias"
                className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-[#B45A2B] dark:hover:text-[#B45A2B] transition-colors"
              >
                Para Barbearias
              </Link>
              <a
                href="https://cliente.barzzo.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-[#B45A2B] hover:bg-[#C46632] active:bg-[#984820] text-white text-sm font-semibold transition-colors"
              >
                Abrir App
              </a>
            </nav>
          </div>
        </header>

        {/* Conteúdo principal */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 py-8">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <Image
              src="/marca/barzzo-logo-claro.webp"
              alt="Barzzo"
              width="116"
              height="35"
              className="h-8 w-auto object-contain dark:hidden"
            />
            <Image
              src="/marca/barzzo-logo-escuro.webp"
              alt=""
              aria-hidden="true"
              width="116"
              height="35"
              className="hidden h-8 w-auto object-contain dark:block"
            />
            <nav className="flex gap-6 text-sm text-neutral-500 dark:text-neutral-400">
              <Link href="/barbearias" className="hover:text-[#B45A2B] transition-colors">
                Barbearias
              </Link>
              <a
                href="https://parceiro.barzzo.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B45A2B] transition-colors"
              >
                Seja Parceiro
              </a>
              <a
                href="https://cliente.barzzo.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#B45A2B] transition-colors"
              >
                Abrir App
              </a>
            </nav>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              © {new Date().getFullYear()} Barzzo. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
