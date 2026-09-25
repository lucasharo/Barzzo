import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@barzzo/ui";
import { NavegacaoParceiro } from "../components/navegacao-parceiro";
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
        <NavegacaoParceiro />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 pb-24 md:pb-8">
          {children}
        </main>
      </body>
    </html>
  );
}
