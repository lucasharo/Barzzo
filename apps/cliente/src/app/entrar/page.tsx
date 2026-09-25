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
import { esquemaLogin } from "@barzzo/validacoes";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";

export default function PaginaEntrar() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const lidarComLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    // Validação com Zod
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
        setSucesso("Conectado com sucesso! Redirecionando...");
        setTimeout(() => {
          router.push("/perfil");
        }, 800);
      }
    } catch (err: unknown) {
      setErro("Ocorreu um erro ao tentar entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10 px-4">
      <Card camada="primaria" className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Acesse sua conta</CardTitle>
          <CardDescription>
            Entre para gerenciar seus agendamentos e perfil no Barzzo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={lidarComLogin} className="flex flex-col gap-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="senha" obrigatorio>
                  Senha
                </Label>
                <Link
                  href="/recuperar-senha"
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
              Entrar
            </Button>

            <div className="text-center text-sm opacity-80 pt-2">
              Não possui uma conta?{" "}
              <Link
                href="/cadastro"
                className="font-semibold text-[#B45A2B] hover:underline"
              >
                Cadastre-se
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
