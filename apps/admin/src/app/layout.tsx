import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { NavegacaoAdmin } from "../components/navegacao-admin";
import { AdminGuard } from "../components/admin-guard";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Barzzo Admin — Operação e Governança",
  description: "Painel de administração e governança global da plataforma Barzzo.",
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

export default function LayoutAdmin({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={roboto.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#FFFFFF] text-black dark:bg-[#0A0A0B] dark:text-white transition-colors duration-150">
        <NavegacaoAdmin />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 pb-24 md:pb-8 flex flex-col">
          <AdminGuard>{children}</AdminGuard>
        </main>
      </body>
    </html>
  );
}
