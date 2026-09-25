import type { Metadata } from "next";
import { Roboto } from "next/font/google";
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
        <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <span className="text-xl font-bold tracking-wider text-[#B45A2B]">
              BARZZO <span className="text-xs uppercase text-black dark:text-white font-normal px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800">Parceiro</span>
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
