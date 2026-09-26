import * as React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Star,
  Scissors,
  ShoppingBag,
  Image as ImageIcon,
  Megaphone,
  Share2,
  BarChart3,
  CreditCard,
  UserCheck,
  Mail,
  Settings,
  LogOut,
  SlidersHorizontal,
  LogIn,
  Store,
  Home,
} from "lucide-react";
import {
  Button,
  ThemeToggle,
  Drawer,
  BottomNav,
  BottomNavItem,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";

export function NavegacaoParceiro() {
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

  // Fechar drawer ao mudar de rota
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

  const secoesMenu = [
    {
      titulo: "Operação",
      itens: [
        { href: "/painel", rotulo: "Painel Geral", icone: LayoutDashboard },
        { href: "/agenda", rotulo: "Agenda de Horários", icone: Calendar },
        { href: "/agenda/bloqueios", rotulo: "Bloqueios de Horário", icone: Clock },
      ],
    },
    {
      titulo: "Atendimento & Catálogo",
      itens: [
        { href: "/clientes", rotulo: "Clientes", icone: Users },
        { href: "/servicos", rotulo: "Serviços", icone: Scissors },
        { href: "/produtos", rotulo: "Produtos", icone: ShoppingBag },
        { href: "/galeria", rotulo: "Galeria de Fotos", icone: ImageIcon },
        { href: "/avaliacoes", rotulo: "Avaliações", icone: Star },
      ],
    },
    {
      titulo: "Crescimento & Métricas",
      itens: [
        { href: "/relatorios", rotulo: "Relatórios & Faturamento", icone: BarChart3 },
        { href: "/campanhas", rotulo: "Campanhas & Cupons", icone: Megaphone },
        { href: "/influenciadores", rotulo: "Influenciadores & Afiliados", icone: Share2 },
      ],
    },
    {
      titulo: "Configurações da Barbearia",
      itens: [
        { href: "/assinatura", rotulo: "Assinatura & Plano", icone: CreditCard },
        { href: "/horarios", rotulo: "Horários de Funcionamento", icone: Clock },
        { href: "/equipe", rotulo: "Profissionais & Equipe", icone: UserCheck },
        { href: "/convites", rotulo: "Convites de Membros", icone: Mail },
        { href: "/configuracoes/perfil", rotulo: "Dados da Barbearia", icone: Settings },
      ],
    },
  ];

  // Itens mais usados exibidos diretamente na barra superior em desktop
  const itensDesktopTopo = [
    { href: "/painel", rotulo: "Painel" },
    { href: "/agenda", rotulo: "Agenda" },
    { href: "/clientes", rotulo: "Clientes" },
    { href: "/servicos", rotulo: "Serviços" },
    { href: "/relatorios", rotulo: "Relatórios" },
    { href: "/assinatura", rotulo: "Assinatura" },
  ];

  return (
    <>
      {/* Header Parceiro */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 lg:gap-6">
            <Link to={usuario ? "/painel" : "/"} className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-wider text-[#B45A2B]">
                BARZZO
              </span>
              <span className="text-[11px] uppercase tracking-wider bg-[#B45A2B]/15 text-[#B45A2B] font-semibold px-2 py-0.5 rounded">
                Parceiro
              </span>
            </Link>

            {/* Menu Horizontal Desktop (telas >= lg) */}
            {usuario ? (
              <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
                {itensDesktopTopo.map((item) => {
                  const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`px-3 py-1.5 rounded-md transition-colors ${
                        ativo
                          ? "bg-[#B45A2B]/10 text-[#B45A2B] font-semibold"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      {item.rotulo}
                    </Link>
                  );
                })}

                {/* Botão para abrir gaveta completa de opções no desktop */}
                <button
                  type="button"
                  onClick={() => setDrawerAberto(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                  title="Ver todas as ferramentas e cadastros"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Mais
                </button>
              </nav>
            ) : (
              <nav className="hidden lg:flex items-center gap-2 text-sm font-medium">
                <Link
                  to="/"
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    pathname === "/"
                      ? "text-[#B45A2B] font-semibold"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  }`}
                >
                  Início
                </Link>
                <Link
                  to="/onboarding"
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    pathname === "/onboarding"
                      ? "text-[#B45A2B] font-semibold"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  }`}
                >
                  Cadastrar Barbearia
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!usuario && (
              <div className="hidden lg:flex items-center gap-2">
                <Link to="/entrar">
                  <Button variante="principal" tamanho="sm">
                    Entrar
                  </Button>
                </Link>
              </div>
            )}

            {usuario && (
              <Button
                variante="fantasma"
                tamanho="sm"
                onClick={lidarComLogout}
                className="hidden lg:inline-flex text-xs"
              >
                Sair
              </Button>
            )}

            <ThemeToggle />

            {/* Botão Hambúrguer Mobile/Tablet (telas < lg) */}
            <button
              type="button"
              onClick={() => setDrawerAberto(true)}
              className="flex lg:hidden h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              aria-label="Abrir menu de navegação da barbearia"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer Completo (Mobile e Tablet, também acessível no desktop via 'Mais') */}
      <Drawer
        aberto={drawerAberto}
        aoFechar={() => setDrawerAberto(false)}
        titulo="Menu do Parceiro"
        descricao="Painel de controle e configurações da barbearia"
        posicao="direita"
        largura="w-84 max-w-[88vw]"
        rodape={
          usuario ? (
            <Button
              variante="cancelar-simples"
              tamanho="md"
              onClick={lidarComLogout}
              className="w-full flex items-center justify-center gap-2 text-sm"
            >
              <LogOut className="h-4 w-4" />
              Sair do Painel
            </Button>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <Link to="/entrar" className="w-full">
                <Button variante="principal" tamanho="md" className="w-full gap-2">
                  <LogIn className="h-4 w-4" /> Entrar na Minha Conta
                </Button>
              </Link>
              <Link to="/onboarding" className="w-full">
                <Button variante="secundario" tamanho="md" className="w-full gap-2">
                  <Store className="h-4 w-4" /> Cadastrar Barbearia
                </Button>
              </Link>
            </div>
          )
        }
      >
        {usuario ? (
          <div className="flex flex-col gap-6 py-1">
            {secoesMenu.map((secao) => (
              <div key={secao.titulo} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-3 py-1">
                  {secao.titulo}
                </span>
                {secao.itens.map((item) => {
                  const Icone = item.icone;
                  const ativo =
                    pathname === item.href ||
                    (item.href !== "/painel" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
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
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
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
            <Link
              to="/onboarding"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/onboarding"
                  ? "bg-[#B45A2B]/10 text-[#B45A2B] font-semibold"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
              }`}
            >
              <Store className="h-5 w-5 opacity-70" />
              Cadastrar Barbearia (30 dias grátis)
            </Link>
            <Link
              to="/entrar"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/entrar"
                  ? "bg-[#B45A2B]/10 text-[#B45A2B] font-semibold"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
              }`}
            >
              <LogIn className="h-5 w-5 opacity-70" />
              Fazer Login
            </Link>
          </div>
        )}
      </Drawer>

      {/* Bottom Navigation Bar Mobile (< md) */}
      <BottomNav>
        {usuario ? (
          <>
            <BottomNavItem
              icone={LayoutDashboard}
              rotulo="Painel"
              ativo={pathname === "/painel"}
              onClick={() => navigate("/painel")}
            />
            <BottomNavItem
              icone={Calendar}
              rotulo="Agenda"
              ativo={pathname === "/agenda" || pathname.startsWith("/agenda/")}
              onClick={() => navigate("/agenda")}
            />
            <BottomNavItem
              icone={Users}
              rotulo="Clientes"
              ativo={pathname === "/clientes" || pathname.startsWith("/clientes/")}
              onClick={() => navigate("/clientes")}
            />
            <BottomNavItem
              icone={BarChart3}
              rotulo="Relatórios"
              ativo={pathname === "/relatorios"}
              onClick={() => navigate("/relatorios")}
            />
            <BottomNavItem
              icone={Menu}
              rotulo="Menu"
              ativo={drawerAberto}
              onClick={() => setDrawerAberto(true)}
            />
          </>
        ) : (
          <>
            <BottomNavItem
              icone={Home}
              rotulo="Início"
              ativo={pathname === "/"}
              onClick={() => navigate("/")}
            />
            <BottomNavItem
              icone={Store}
              rotulo="Cadastrar"
              ativo={pathname === "/onboarding" || pathname === "/cadastro"}
              onClick={() => navigate("/onboarding")}
            />
            <BottomNavItem
              icone={LogIn}
              rotulo="Entrar"
              ativo={pathname === "/entrar"}
              onClick={() => navigate("/entrar")}
            />
          </>
        )}
      </BottomNav>
    </>
  );
}
