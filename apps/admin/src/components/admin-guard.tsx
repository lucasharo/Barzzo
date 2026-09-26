"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { LoadingSpinner, Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@barzzo/ui";
import { ShieldAlert, LogIn } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(true);
  const [autenticado, setAutenticado] = React.useState(false);

  React.useEffect(() => {
    // A página de login é pública
    if (pathname === "/entrar") {
      setCarregando(false);
      return;
    }

    const supabase = criarClienteSupabaseBrowser();
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAutenticado(true);
      } else {
        setAutenticado(false);
        router.push(`/entrar?retorno=${encodeURIComponent(pathname)}`);
      }
      setCarregando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAutenticado(true);
      } else if (pathname !== "/entrar") {
        setAutenticado(false);
        router.push(`/entrar?retorno=${encodeURIComponent(pathname)}`);
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  // Se estiver na página de login, renderiza direto
  if (pathname === "/entrar") {
    return <>{children}</>;
  }

  // Enquanto verifica a sessão
  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70 font-medium">Validando credenciais administrativas...</p>
      </div>
    );
  }

  // Se não autenticado
  if (!autenticado) {
    return (
      <div className="flex-1 max-w-md mx-auto py-16 flex flex-col items-center text-center gap-6">
        <ShieldAlert className="h-16 w-16 text-[#B45A2B]" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-sm opacity-70">
            Esta área é exclusiva para a equipe de administração e governança da plataforma Barzzo.
          </p>
        </div>
        <Button
          variante="principal"
          tamanho="lg"
          onClick={() => router.push(`/entrar?retorno=${encodeURIComponent(pathname)}`)}
          className="gap-2 min-h-[48px]"
        >
          <LogIn className="h-5 w-5" /> Fazer Login no Admin
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
