import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
} from "@barzzo/ui";
import { esquemaLogin } from "@barzzo/validacoes";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import { Store } from "lucide-react";

export default function PaginaEntrarParceiro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retornoUrl = searchParams.get("retorno");

  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

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
        setErro(traduzirErro(error, "E-mail ou senha incorretos. Por favor, verifique e tente novamente."));
        return;
      }

      if (data.session) {
        if (retornoUrl) {
          navigate(retornoUrl);
          return;
        }

        // Verificar se já possui barbearia vinculada
        const { data: membro } = await supabase
          .from("membros_barbearia")
          .select("barbearia_id")
          .eq("usuario_id", data.session.user.id)
          .limit(1)
          .maybeSingle();

        if (membro?.barbearia_id) {
          navigate("/painel");
        } else {
          navigate("/onboarding");
        }
      }
    } catch {
      setErro("Ocorreu um erro ao processar seu login. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10 px-4">
      <Card camada="primaria" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Store className="h-10 w-10 text-[#B45A2B]" />
          </div>
          <CardTitle className="text-2xl font-bold">Barzzo Parceiro</CardTitle>
          <CardDescription>
            Acesse o painel da sua barbearia para gerenciar agenda, equipe e clientes.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={lidarComLogin} className="flex flex-col gap-4">
            {erro && (
              <Alert variante="erro">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" obrigatorio>
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seuemail@barbearia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha" obrigatorio>
                  Senha
                </Label>
                <Link
                  to="/recuperar-senha"
                  className="text-xs text-[#B45A2B] hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
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
              className="w-full mt-2"
            >
              Entrar no Painel
            </Button>

            <div className="text-center text-sm opacity-80 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              Ainda não cadastrou sua barbearia?{" "}
              <Link
                to={retornoUrl ? `/cadastro?retorno=${encodeURIComponent(retornoUrl)}` : "/cadastro"}
                className="font-semibold text-[#B45A2B] hover:underline"
              >
                Cadastre-se grátis
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
