"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function PaginaCadastro() {
  const router = useRouter();
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
        setErro(traduzirErro(error, "Não foi possível criar sua conta. Verifique os dados informados."));
        return;
      }

      if (data.user) {
        setSucesso("Conta criada com sucesso! Redirecionando...");
        setTimeout(() => {
          router.push("/perfil");
        }, 1000);
      }
    } catch (err: unknown) {
      setErro("Ocorreu um erro ao criar a conta. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10 px-4">
      <Card camada="primaria" className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Crie sua conta</CardTitle>
          <CardDescription>
            Cadastre-se para agendar cortes e serviços com rapidez no Barzzo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={lidarComCadastro} className="flex flex-col gap-4">
            {erro && (
              <Alert variante="erro">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            {sucesso && (
              <Alert variante="sucesso">
                <AlertDescription>{sucesso}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome" obrigatorio>
                Nome Completo
              </Label>
              <Input
                id="nome"
                type="text"
                placeholder="Ex: Carlos Eduardo Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" obrigatorio>
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seuemail@exemplo.com"
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
                maxLength={15}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha" obrigatorio>
                Senha (mínimo 6 caracteres)
              </Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
                disabled={carregando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmarSenha" obrigatorio>
                Confirmação de Senha
              </Label>
              <Input
                id="confirmarSenha"
                type="password"
                placeholder="••••••••"
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
              Criar Conta
            </Button>

            <div className="text-center text-sm opacity-80 pt-2">
              Já tem uma conta?{" "}
              <Link
                href="/entrar"
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
