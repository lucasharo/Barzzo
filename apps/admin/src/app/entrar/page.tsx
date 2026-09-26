"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { esquemaLogin } from "@barzzo/validacoes";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import { ShieldCheck } from "lucide-react";

function FormularioEntrarAdmin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const retornoUrl = searchParams.get("retorno") || "/painel";

  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Se já estiver logado, redireciona para o painel
  React.useEffect(() => {
    const supabase = criarClienteSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push(retornoUrl);
      }
    });
  }, [retornoUrl, router]);

  const lidarComLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const resultadoValidacao = esquemaLogin.safeParse({ email, senha });
    if (!resultadoValidacao.success) {
      setErro(resultadoValidacao.error.errors[0]?.message || "Dados inválidos");
      return;
    }

    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        setErro(traduzirErro(error, "Credenciais administrativas incorretas. Verifique seu e-mail e senha."));
        return;
      }

      if (data.session) {
        router.push(retornoUrl);
        router.refresh();
      }
    } catch {
      setErro("Ocorreu um erro ao processar o login. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <Card camada="primaria" className="w-full max-w-md border-neutral-200/80 dark:border-neutral-800 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-12 w-12 text-[#B45A2B]" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl font-black tracking-wider text-[#B45A2B]">
              BARZZO
            </span>
            <span className="text-[11px] uppercase tracking-wider bg-[#B45A2B] text-white font-bold px-2 py-0.5 rounded shadow-sm">
              Admin
            </span>
          </div>
          <CardTitle className="text-xl font-bold">Acesso Administrativo</CardTitle>
          <CardDescription>
            Painel de controle global, governança, relatórios e auditoria da plataforma.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={lidarComLogin} className="flex flex-col gap-4">
            {erro && (
              <Alert variante="erro">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" obrigatorio>
                E-mail do Administrador
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@barzzo.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha" obrigatorio>
                Senha de Acesso
              </Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                disabled={carregando}
                required
              />
            </div>

            <Button
              type="submit"
              variante="principal"
              tamanho="md"
              carregando={carregando}
              className="w-full mt-2 min-h-[44px] font-semibold"
            >
              Acessar Painel de Governança
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaginaEntrarAdmin() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex flex-col justify-center items-center py-24 gap-3">
          <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
          <p className="text-sm opacity-70">Carregando acesso administrativo...</p>
        </div>
      }
    >
      <FormularioEntrarAdmin />
    </React.Suspense>
  );
}
