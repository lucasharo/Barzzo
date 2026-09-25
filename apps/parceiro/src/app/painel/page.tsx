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
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Barbearia } from "@barzzo/tipos";
import {
  Store,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Circle,
} from "lucide-react";

export default function PaginaPainelParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [totalEquipe, setTotalEquipe] = React.useState(0);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregarDados() {
      try {
        setCarregando(true);
        const supabase = criarClienteSupabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          return;
        }

        // Buscar barbearia da qual o usuário é membro
        const { data: membro, error: erroMembro } = await supabase
          .from("membros_barbearia")
          .select("barbearia_id, papel")
          .eq("usuario_id", session.user.id)
          .limit(1)
          .maybeSingle();

        if (membro && membro.barbearia_id) {
          const { data: bDb } = await supabase
            .from("barbearias")
            .select("*")
            .eq("id", membro.barbearia_id)
            .single();

          if (bDb) {
            setBarbearia(bDb as Barbearia);

            // Contar equipe
            const { count } = await supabase
              .from("profissionais")
              .select("id", { count: "exact", head: true })
              .eq("barbearia_id", bDb.id);

            setTotalEquipe(count || 1);
          }
        }
      } catch {
        setErro("Não foi possível carregar os dados da barbearia.");
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, []);

  // Calcular dias restantes do trial
  const calcularDiasRestantesTrial = (dataFim: string) => {
    const fim = new Date(dataFim).getTime();
    const agora = new Date().getTime();
    const diffDias = Math.ceil((fim - agora) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDias);
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando painel da barbearia...</p>
      </div>
    );
  }

  // Se o usuário ainda não tem barbearia cadastrada
  if (!barbearia) {
    return (
      <div className="flex-1 max-w-xl mx-auto py-12 flex flex-col items-center text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
          <Store className="h-8 w-8" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Bem-vindo ao Barzzo Parceiro</h1>
          <p className="text-sm opacity-70">
            Você ainda não possui uma barbearia cadastrada em sua conta. Crie sua primeira barbearia para começar com 30 dias de trial gratuito.
          </p>
        </div>
        <Link href="/onboarding">
          <Button variante="principal" tamanho="lg">
            Iniciar Onboarding da Barbearia <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    );
  }

  const diasRestantes = calcularDiasRestantesTrial(barbearia.trial_fim);

  return (
    <div className="flex flex-col gap-8">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header do Painel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">{barbearia.nome}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-semibold border border-[#16A34A]/20">
              Ativa
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            barzzo.com/{barbearia.slug} • {barbearia.cidade || "Localização não definida"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/convites">
            <Button variante="secundario" tamanho="sm">
              Convidar Membro
            </Button>
          </Link>
          <Link href="/configuracoes/perfil">
            <Button variante="fantasma" tamanho="sm">
              Configurações
            </Button>
          </Link>
        </div>
      </div>

      {/* Card de Destaque: Trial de 30 Dias */}
      <Card camada="primaria" className="border-l-4 border-l-[#B45A2B]">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase font-bold tracking-wider text-[#B45A2B]">
                Plano Barzzo MVP
              </span>
              <h2 className="text-lg font-bold">
                Período de Avaliação Gratuita (Trial)
              </h2>
              <p className="text-sm opacity-75">
                Você possui <strong className="text-black dark:text-white font-semibold">{diasRestantes} dias restantes</strong> no seu trial de 30 dias com acesso a todos os recursos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-lg bg-[#E5E5E8] dark:bg-[#252529] font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#B45A2B]" />
              Expira em: {new Date(barbearia.trial_fim).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Métricas e Atalhos Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <Card camada="primaria">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Equipe Cadastrada</CardDescription>
              <Users className="h-5 w-5 text-[#B45A2B]" />
            </div>
            <CardTitle className="text-3xl font-bold">{totalEquipe}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/equipe"
              className="text-xs font-semibold text-[#B45A2B] hover:underline flex items-center gap-1"
            >
              Ver e gerenciar profissionais <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Onboarding da Barbearia</CardDescription>
              <ShieldCheck className="h-5 w-5 text-[#16A34A]" />
            </div>
            <CardTitle className="text-3xl font-bold">
              {barbearia.onboarding_concluido ? "Concluído" : "Em Progresso"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/onboarding"
              className="text-xs font-semibold text-[#B45A2B] hover:underline flex items-center gap-1"
            >
              Revisar etapas do onboarding <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Catálogo de Serviços</CardDescription>
              <Store className="h-5 w-5 text-[#B45A2B]" />
            </div>
            <CardTitle className="text-base font-semibold">Serviços & Horários</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/servicos"
              className="text-xs font-semibold text-[#B45A2B] hover:underline flex items-center gap-1"
            >
              Configurar serviços e horários <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Checklist de Implantação */}
      <Card camada="primaria">
        <CardHeader>
          <CardTitle className="text-lg">Checklist de Configuração</CardTitle>
          <CardDescription>
            Acompanhe o que já foi configurado e o que entra nas próximas tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="h-5 w-5 text-[#16A34A]" />
            <span className="font-medium">Identificação e slug oficial da barbearia</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="h-5 w-5 text-[#16A34A]" />
            <span className="font-medium">Vinculação do Dono e Trial de 30 dias</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="h-5 w-5 text-[#16A34A]" />
            <span className="font-medium">Estrutura de equipe e convites operacionais</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle className="h-5 w-5 text-[#16A34A]" />
            <span className="font-medium">Serviços, jornadas e disponibilidade</span>
          </div>
          <div className="flex items-center gap-3 text-sm opacity-60">
            <Circle className="h-5 w-5" />
            <span>Grade de agendamentos e concorrência (Task 04)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
