"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Calendar,
  Share2,
  Star,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import {
  Button,
  ThemeToggle,
  Drawer,
  BottomNav,
  BottomNavItem,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";

export function NavegacaoAdmin() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerAberto, setDrawerAberto] = React.useState(false);

  // Fechar gaveta ao navegar
  React.useEffect(() => {
    setDrawerAberto(false);
  }, [pathname]);

  const lidarComLogout = async () => {
    const supabase = criarClienteSupabaseBrowser();
    await supabase.auth.signOut();
    setDrawerAberto(false);
    router.push("/");
  };

  const itensNav = [
    { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
    { href: "/barbearias", rotulo: "Barbearias", icone: Building2 },
    { href: "/usuarios", rotulo: "Usuários", icone: Users },
    { href: "/assinaturas", rotulo: "Assinaturas", icone: CreditCard },
    { href: "/agendamentos", rotulo: "Agendamentos", icone: Calendar },
    { href: "/influenciadores", rotulo: "Influenciadores", icone: Share2 },
    { href: "/avaliacoes", rotulo: "Avaliações", icone: Star },
    { href: "/logs", rotulo: "Auditoria", icone: ShieldAlert },
  ];

  return (
    <>
      {/* Header Admin */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/painel" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-wider text-[#B45A2B]">
                BARZZO
              </span>
              <span className="text-[11px] uppercase tracking-wider bg-[#B45A2B] text-white font-bold px-2 py-0.5 rounded shadow-sm">
                Admin
              </span>
            </Link>

            {/* Menu Horizontal Desktop (telas >= lg) */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
              {itensNav.map((item) => {
                const ativo = pathname === item.href || (item.href !== "/painel" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      ativo
                        ? "bg-[#B45A2B]/15 text-[#B45A2B] font-semibold"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {item.rotulo}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Botão Hambúrguer Mobile/Tablet (telas < lg) */}
            <button
              type="button"
              onClick={() => setDrawerAberto(true)}
              className="flex lg:hidden h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              aria-label="Abrir menu administrativo"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer Administrativo */}
      <Drawer
        aberto={drawerAberto}
        aoFechar={() => setDrawerAberto(false)}
        titulo="Administração Barzzo"
        descricao="Gestão da plataforma e auditoria"
        posicao="direita"
        rodape={
          <Button
            variante="cancelar-simples"
            tamanho="md"
            onClick={lidarComLogout}
            className="w-full flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sair do Admin
          </Button>
        }
      >
        <div className="flex flex-col gap-1 py-1">
          {itensNav.map((item) => {
            const Icone = item.icone;
            const ativo =
              pathname === item.href ||
              (item.href !== "/painel" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  ativo
                    ? "bg-[#B45A2B]/15 text-[#B45A2B] font-semibold"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <Icone className="h-4 w-4 opacity-75 shrink-0" />
                <span>{item.rotulo}</span>
              </Link>
            );
          })}
        </div>
      </Drawer>

      {/* Bottom Navigation Bar Mobile (< md) */}
      <BottomNav>
        <BottomNavItem
          icone={LayoutDashboard}
          rotulo="Painel"
          ativo={pathname === "/painel"}
          onClick={() => router.push("/painel")}
        />
        <BottomNavItem
          icone={Building2}
          rotulo="Barbearias"
          ativo={pathname === "/barbearias" || pathname.startsWith("/barbearias/")}
          onClick={() => router.push("/barbearias")}
        />
        <BottomNavItem
          icone={CreditCard}
          rotulo="Assinaturas"
          ativo={pathname === "/assinaturas" || pathname.startsWith("/assinaturas/")}
          onClick={() => router.push("/assinaturas")}
        />
        <BottomNavItem
          icone={Users}
          rotulo="Usuários"
          ativo={pathname === "/usuarios" || pathname.startsWith("/usuarios/")}
          onClick={() => router.push("/usuarios")}
        />
        <BottomNavItem
          icone={Menu}
          rotulo="Menu"
          ativo={drawerAberto}
          onClick={() => setDrawerAberto(true)}
        />
      </BottomNav>
    </>
  );
}
