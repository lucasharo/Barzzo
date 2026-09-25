"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import type { ConviteProfissional } from "@barzzo/tipos";
import { Users, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function PaginaAceitarConvite() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [carregando, setCarregando] = React.useState(true);
  const [aceitando, setAceitando] = React.useState(false);
  const [estaAutenticado, setEstaAutenticado] = React.useState(false);
  const [convite, setConvite] = React.useState<ConviteProfissional | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState(false);

  React.useEffect(() => {
    async function validarConvite() {
      try {
        setCarregando(true);
        const supabase = criarClienteSupabaseBrowser();

        const {
          data: { session },
        } = await supabase.auth.getSession();
        setEstaAutenticado(!!session);

        // Buscar dados do convite
        const { data, error } = await supabase
          .from("convites_profissionais")
          .select("*, profissional:profissionais(*), barbearia:barbearias(*)")
          .eq("token", token)
          .single();

        if (error || !data) {
          setErro("Convite não encontrado ou já expirado.");
          return;
        }

        const conv = data as unknown as ConviteProfissional;
        if (new Date(conv.expira_em) < new Date()) {
          setErro("Este link de convite expirou.");
          return;
        }

        if (conv.status === "aceito") {
          setErro("Este convite já foi aceito anteriormente.");
          return;
        }

        setConvite(conv);
      } catch {
        setErro("Erro ao verificar convite.");
      } finally {
        setCarregando(false);
      }
    }

    if (token) validarConvite();
  }, [token]);

  const aceitarConvite = async () => {
    setErro(null);
    setAceitando(true);

    try {
      const supabase = criarClienteSupabaseBrowser();

      // Executar RPC atômica de aceite de convite
      const { error: rpcError } = await supabase.rpc("aceitar_convite_equipe", {
        p_token: token,
      });

      if (rpcError) {
        setErro(traduzirErro(rpcError, "Convite inválido ou expirado."));
        return;
      }

      setSucesso(true);
      setTimeout(() => {
        router.push("/painel");
      }, 1500);
    } catch {
      setErro("Falha ao aceitar o convite. Tente novamente.");
    } finally {
      setAceitando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Validando convite...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-lg mx-auto w-full py-12 px-4 flex flex-col items-center">
      <Card camada="primaria" className="w-full">
        <CardHeader className="text-center">
          <div className="h-14 w-14 rounded-full bg-[#B45A2B]/10 mx-auto flex items-center justify-center text-[#B45A2B] mb-2">
            <Users className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Convite de Equipe</CardTitle>
          <CardDescription>
            Você foi convidado para integrar a equipe da barbearia no Barzzo.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {erro && (
            <Alert variante="erro">
              <AlertTriangle className="h-5 w-5" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {sucesso && (
            <Alert variante="sucesso">
              <CheckCircle2 className="h-5 w-5" />
              <AlertDescription>
                Convite aceito com sucesso! Redirecionando para o seu painel...
              </AlertDescription>
            </Alert>
          )}

          {!erro && !sucesso && convite && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-lg bg-[#EEEEF0] dark:bg-[#1C1C1F] flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-70">Função:</span>
                  <span className="font-bold uppercase text-xs px-2 py-0.5 rounded bg-neutral-300 dark:bg-neutral-700">
                    {convite.papel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-70">E-mail convidado:</span>
                  <span className="font-medium">{convite.email}</span>
                </div>
              </div>

              {!estaAutenticado ? (
                <div className="flex flex-col gap-3 text-center">
                  <p className="text-sm opacity-80">
                    Para aceitar este convite, você precisa entrar com sua conta Barzzo ou se cadastrar com o mesmo e-mail.
                  </p>
                  <Link href={`/entrar?retorno=/convite/${token}`}>
                    <Button variante="principal" tamanho="md" className="w-full">
                      Entrar / Criar Conta para Aceitar
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button
                  variante="principal"
                  tamanho="lg"
                  carregando={aceitando}
                  onClick={aceitarConvite}
                  className="w-full flex items-center justify-center gap-2"
                >
                  Aceitar Convite e Entrar na Equipe <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
