"use client";

import * as React from "react";
import Link from "next/link";
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
import { esquemaRecuperarSenha } from "@barzzo/validacoes";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";

export default function PaginaRecuperarSenha() {
  const [email, setEmail] = React.useState("");
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const lidarComRecuperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const resultadoValidacao = esquemaRecuperarSenha.safeParse({ email });
    if (!resultadoValidacao.success) {
      setErro(resultadoValidacao.error.errors[0]?.message || "E-mail inválido");
      return;
    }

    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) {
        setErro(error.message);
        return;
      }

      setSucesso(
        "Se o e-mail estiver cadastrado, enviamos as instruções para recuperação de acesso."
      );
    } catch (err: unknown) {
      setErro("Ocorreu um erro ao processar sua solicitação.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10 px-4">
      <Card camada="primaria" className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Recuperação de Senha</CardTitle>
          <CardDescription>
            Informe seu e-mail cadastrado para enviarmos o link de recuperação.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={lidarComRecuperacao} className="flex flex-col gap-4">
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

            <Button
              type="submit"
              variante="principal"
              tamanho="md"
              carregando={carregando}
              className="w-full mt-2"
            >
              Enviar link de recuperação
            </Button>

            <div className="text-center text-sm opacity-80 pt-2">
              Lembrou sua senha?{" "}
              <Link
                href="/entrar"
                className="font-semibold text-[#B45A2B] hover:underline"
              >
                Voltar para o login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
