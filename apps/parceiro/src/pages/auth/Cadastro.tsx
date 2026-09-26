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
import { esquemaCadastro } from "@barzzo/validacoes";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { Store } from "lucide-react";

export default function PaginaCadastroParceiro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retornoUrl = searchParams.get("retorno");

  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const lidarComTelefone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatarTelefone(e.target.value);
    setTelefone(formatado);
  };

  const lidarComCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const telefoneLimpo = limparTelefone(telefone);

    // Validação com Zod
    const resultadoValidacao = esquemaCadastro.safeParse({
      nome,
      email,
      telefone: telefoneLimpo ? telefoneLimpo : undefined,
      senha,
      confirmarSenha,
    });

    if (!resultadoValidacao.success) {
      setErro(resultadoValidacao.error.errors[0]?.message || "Dados inválidos");
      return;
    }

    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            nome,
            telefone: telefoneLimpo || null,
          },
        },
      });

      if (error) {
        setErro(traduzirErro(error, "Não foi possível criar sua conta de parceiro. Verifique os dados informados."));
        return;
      }

      if (data.user) {
        setSucesso("Conta de parceiro criada com sucesso! Redirecionando para o onboarding...");
        const destino = retornoUrl || "/onboarding";
        setTimeout(() => {
          navigate(destino);
        }, 800);
      }
    } catch {
      setErro("Ocorreu um erro ao criar a conta de parceiro. Tente novamente.");
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
          <CardTitle className="text-2xl font-bold">Cadastre sua Barbearia</CardTitle>
          <CardDescription>
            Crie sua conta de parceiro e ganhe 30 dias de trial gratuito sem taxa de adesão.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {erro && (
            <Alert variante="erro" className="mb-4">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {sucesso && (
            <Alert variante="sucesso" className="mb-4">
              <AlertDescription>{sucesso}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={lidarComCadastro} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome" obrigatorio>
                Nome do Responsável
              </Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" obrigatorio>
                E-mail Profissional
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@suabarbearia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={lidarComTelefone}
                autoComplete="tel"
                disabled={carregando}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha" obrigatorio>
                Senha
              </Label>
              <Input
                id="senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmarSenha" obrigatorio>
                Confirmar Senha
              </Label>
              <Input
                id="confirmarSenha"
                type="password"
                placeholder="Digite a mesma senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
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
              Criar Conta e Iniciar Onboarding
            </Button>

            <div className="text-center text-sm opacity-80 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              Já possui uma conta de parceiro?{" "}
              <Link
                to={retornoUrl ? `/entrar?retorno=${encodeURIComponent(retornoUrl)}` : "/entrar"}
                className="font-semibold text-[#B45A2B] hover:underline"
              >
                Fazer login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
