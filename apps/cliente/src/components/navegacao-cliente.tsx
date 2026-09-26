
import * as React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  Home,
  Scissors,
  Calendar,
  Heart,
  Bell,
  User,
  LogIn,
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

export function NavegacaoCliente() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [drawerAberto, setDrawerAberto] = React.useState(false);
  const [usuario, setUsuario] = React.useState<any>(null);

  React.useEffect(() => {
    const supabase = criarClienteSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fechar drawer ao navegar para outra rota
  React.useEffect(() => {
    setDrawerAberto(false);
  }, [pathname]);

  const lidarComLogout = async () => {
    const supabase = criarClienteSupabaseBrowser();
    await supabase.auth.signOut();
    setUsuario(null);
    setDrawerAberto(false);
    navigate("/");
  };

  const itensAutenticados = [
    { href: "/agendamentos", rotulo: "Agendamentos", icone: Calendar },
    { href: "/favoritos", rotulo: "Favoritos", icone: Heart },
    { href: "/notificacoes", rotulo: "Notificações", icone: Bell },
    { href: "/perfil", rotulo: "Perfil", icone: User },
  ];

  const itensNav = usuario ? itensAutenticados : [];

  const rotaLoginComRetorno =
    pathname && pathname !== "/" && pathname !== "/entrar" && pathname !== "/cadastro"
      ? `/entrar?retorno=${encodeURIComponent(pathname)}`
      : "/entrar";

  return (
    <>
      {/* Header Principal */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="text-2xl font-bold tracking-wider text-[#B45A2B] hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            BARZZO
          </Link>

          {/* Área Direita: Navegação Desktop + Alternador de Tema + Menu Mobile */}
          <div className="flex items-center gap-1.5 md:gap-3">
            {/* Links Desktop (telas >= md) */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-3 text-sm font-medium">
              {itensNav.map((item) => {
                const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      ativo
                        ? "text-[#B45A2B] font-semibold bg-[#B45A2B]/10"
                        : "hover:text-[#B45A2B] hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {item.rotulo}
                  </Link>
                );
              })}

              {usuario ? (
                <Button
                  variante="fantasma"
                  tamanho="sm"
                  onClick={lidarComLogout}
                  className="text-xs"
                >
                  Sair
                </Button>
              ) : (
                <Link to={rotaLoginComRetorno}>
                  <Button variante="principal" tamanho="sm">
                    Entrar
                  </Button>
                </Link>
              )}
            </nav>

            {/* Alternador de Tema Único (Desktop e Mobile) */}
            <ThemeToggle />

            {/* Botão Hambúrguer Mobile (telas < md) */}
            <button
              type="button"
              onClick={() => setDrawerAberto(true)}
              className="flex md:hidden h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer Lateral Mobile */}
      <Drawer
        aberto={drawerAberto}
        aoFechar={() => setDrawerAberto(false)}
        titulo="Barzzo"
        descricao="Encontre e agende os melhores serviços"
        posicao="direita"
        rodape={
          <div className="flex flex-col gap-2">
            {usuario ? (
              <Button
                variante="cancelar-simples"
                tamanho="md"
                onClick={lidarComLogout}
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </Button>
            ) : (
              <Link to={rotaLoginComRetorno} className="w-full">
                <Button
                  variante="principal"
                  tamanho="md"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Entrar na Minha Conta
                </Button>
              </Link>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-1 py-2">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/"
                ? "bg-[#B45A2B]/10 text-[#B45A2B] font-semibold"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
            }`}
          >
            <Home className="h-5 w-5 opacity-70" />
            Página Inicial
          </Link>

          {itensNav.map((item) => {
            const Icone = item.icone;
            const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  ativo
                    ? "bg-[#B45A2B]/10 text-[#B45A2B] font-semibold"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <Icone className="h-5 w-5 opacity-70" />
                {item.rotulo}
              </Link>
            );
          })}
        </div>
      </Drawer>

      {/* Barra de Navegação Inferior Mobile (Bottom Nav) */}
      <BottomNav>
        <BottomNavItem
          icone={Home}
          rotulo="Início"
          ativo={pathname === "/" || pathname === "/barbearias"}
          onClick={() => navigate("/")}
        />
        {usuario ? (
          <>
            <BottomNavItem
              icone={Calendar}
              rotulo="Agenda"
              ativo={pathname === "/agendamentos" || pathname.startsWith("/agendamentos/")}
              onClick={() => navigate("/agendamentos")}
            />
            <BottomNavItem
              icone={Heart}
              rotulo="Favoritos"
              ativo={pathname === "/favoritos"}
              onClick={() => navigate("/favoritos")}
            />
            <BottomNavItem
              icone={User}
              rotulo="Perfil"
              ativo={pathname === "/perfil"}
              onClick={() => navigate("/perfil")}
            />
          </>
        ) : (
          <BottomNavItem
            icone={LogIn}
            rotulo="Entrar"
            ativo={pathname === "/entrar"}
            onClick={() => navigate(rotaLoginComRetorno)}
          />
        )}
      </BottomNav>
    </>
  );
}
