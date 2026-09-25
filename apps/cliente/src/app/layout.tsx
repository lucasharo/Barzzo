import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@barzzo/ui";
import { NavegacaoCliente } from "../components/navegacao-cliente";
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
        <NavegacaoCliente />

        <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">
          {children}
        </main>

        <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 py-6 mb-16 md:mb-0 text-center text-xs opacity-70">
          <p>© {new Date().getFullYear()} Barzzo. Todos os direitos reservados.</p>
        </footer>
      </body>
    </html>
  );
}
