"use client";

import * as React from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Servico, Barbearia } from "@barzzo/tipos";
import {
  Scissors,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface ServicoComProfissionais extends Servico {
  profissionais_count?: number;
}

export default function PaginaServicosParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [servicos, setServicos] = React.useState<ServicoComProfissionais[]>([]);
  const [busca, setBusca] = React.useState("");
  const [filtroStatus, setFiltroStatus] = React.useState<"todos" | "ativos" | "inativos">("todos");
  const [erro, setErro] = React.useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarDados();
  }, []);

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

      // Buscar barbearia do usuário
      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membro || !membro.barbearia_id) {
        return;
      }

      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) {
        setBarbearia(bDb as Barbearia);
      }

      // Buscar serviços da barbearia
      const { data: servicosDb, error: erroServicos } = await supabase
        .from("servicos")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .order("nome", { ascending: true });

      if (erroServicos) {
        setErro("Não foi possível carregar os serviços da barbearia.");
        return;
      }

      // Buscar contagem de profissionais por serviço
      const { data: vinculos } = await supabase
        .from("profissionais_servicos")
        .select("servico_id, ativo")
        .eq("ativo", true);

      const contagemPorServico: Record<string, number> = {};
      if (vinculos) {
        vinculos.forEach((v: { servico_id: string }) => {
          contagemPorServico[v.servico_id] = (contagemPorServico[v.servico_id] || 0) + 1;
        });
      }

      const lista = ((servicosDb || []) as Servico[]).map((s) => ({
        ...s,
        profissionais_count: contagemPorServico[s.id] || 0,
      }));

      setServicos(lista);
    } catch {
      setErro("Ocorreu um erro ao consultar os serviços.");
    } finally {
      setCarregando(false);
    }
  }

  async function alternarStatusServico(id: string, ativoAtual: boolean) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await supabase
        .from("servicos")
        .update({ ativo: !ativoAtual })
        .eq("id", id);

      if (error) {
        setErro("Erro ao alterar o status do serviço.");
        return;
      }

      setServicos((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ativo: !ativoAtual } : s))
      );
      setMensagemSucesso(`Serviço ${!ativoAtual ? "ativado" : "desativado"} com sucesso.`);
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch {
      setErro("Erro inesperado ao atualizar o serviço.");
    }
  }

  const servicosFiltrados = servicos.filter((s) => {
    const atendeBusca = s.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (s.descricao && s.descricao.toLowerCase().includes(busca.toLowerCase()));
    if (!atendeBusca) return false;

    if (filtroStatus === "ativos") return s.ativo;
    if (filtroStatus === "inativos") return !s.ativo;
    return true;
  });

  const totalServicos = servicos.length;
  const totalAtivos = servicos.filter((s) => s.ativo).length;
  const precoMedio =
    totalServicos > 0
      ? servicos.reduce((acc, s) => acc + Number(s.preco), 0) / totalServicos
      : 0;

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando catálogo de serviços...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center flex flex-col items-center gap-6">
        <Scissors className="h-12 w-12 text-[#B45A2B]" />
        <h1 className="text-2xl font-bold">Nenhuma barbearia vinculada</h1>
        <p className="text-sm opacity-70">
          Você precisa ter uma barbearia ativa para gerenciar o catálogo de serviços.
        </p>
        <Link href="/onboarding">
          <Button variante="principal">Iniciar Onboarding</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {mensagemSucesso && (
        <Alert variante="sucesso">
          <AlertDescription>{mensagemSucesso}</AlertDescription>
        </Alert>
      )}

      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Catálogo de Serviços</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] font-semibold border border-[#B45A2B]/20">
              {totalServicos} {totalServicos === 1 ? "serviço" : "serviços"}
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Configure preços, durações e vincule os profissionais capacitados para cada atendimento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/horarios">
            <Button variante="secundario" tamanho="sm">
              <Clock className="h-4 w-4 mr-1.5" /> Grade de Horários
            </Button>
          </Link>
          <Link href="/servicos/novo">
            <Button variante="principal" tamanho="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Serviço
            </Button>
          </Link>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card camada="primaria">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Serviços Ativos</CardDescription>
              <CheckCircle className="h-4 w-4 text-[#16A34A]" />
            </div>
            <CardTitle className="text-2xl font-bold">{totalAtivos}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs opacity-70">
              Disponíveis para agendamento online
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Preço Médio do Catálogo</CardDescription>
              <TrendingUp className="h-4 w-4 text-[#B45A2B]" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(precoMedio)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs opacity-70">Média geral dos serviços</span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Agendamentos & Bloqueios</CardDescription>
              <Sparkles className="h-4 w-4 text-[#B45A2B]" />
            </div>
            <CardTitle className="text-2xl font-bold">Regras Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/agenda/bloqueios" className="text-xs text-[#B45A2B] hover:underline flex items-center gap-1 font-semibold">
              Gerenciar bloqueios temporários <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
          <Input
            placeholder="Buscar serviço por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variante={filtroStatus === "todos" ? "principal" : "fantasma"}
            tamanho="sm"
            onClick={() => setFiltroStatus("todos")}
          >
            Todos ({totalServicos})
          </Button>
          <Button
            variante={filtroStatus === "ativos" ? "principal" : "fantasma"}
            tamanho="sm"
            onClick={() => setFiltroStatus("ativos")}
          >
            Ativos ({totalAtivos})
          </Button>
          <Button
            variante={filtroStatus === "inativos" ? "principal" : "fantasma"}
            tamanho="sm"
            onClick={() => setFiltroStatus("inativos")}
          >
            Inativos ({totalServicos - totalAtivos})
          </Button>
        </div>
      </div>

      {/* Lista de Serviços */}
      {servicosFiltrados.length === 0 ? (
        <Card camada="primaria" className="text-center py-12">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
              <Scissors className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg">Nenhum serviço encontrado</h3>
              <p className="text-sm opacity-70 max-w-sm">
                {busca
                  ? "Nenhum resultado corresponde à sua pesquisa. Tente outro termo."
                  : "Sua barbearia ainda não tem serviços cadastrados. Adicione cortes, barba, combos e tratamentos."}
              </p>
            </div>
            <Link href="/servicos/novo">
              <Button variante="principal" tamanho="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Adicionar Primeiro Serviço
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicosFiltrados.map((servico) => (
            <Card
              key={servico.id}
              camada="primaria"
              className={`flex flex-col justify-between transition-all hover:border-[#B45A2B]/40 ${
                !servico.ativo ? "opacity-60 bg-neutral-100/50 dark:bg-neutral-900/40" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold">{servico.nome}</CardTitle>
                    <span className="text-xl font-extrabold text-[#B45A2B] mt-1 block">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(servico.preco))}
                    </span>
                  </div>

                  <button
                    onClick={() => alternarStatusServico(servico.id, servico.ativo)}
                    title={servico.ativo ? "Clique para desativar" : "Clique para ativar"}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition-colors flex items-center gap-1 ${
                      servico.ativo
                        ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30 hover:bg-[#16A34A]/20"
                        : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-300"
                    }`}
                  >
                    {servico.ativo ? (
                      <>
                        <CheckCircle className="h-3 w-3" /> Ativo
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" /> Inativo
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs opacity-70 line-clamp-2 mt-2 min-h-[2rem]">
                  {servico.descricao || "Sem descrição informada."}
                </p>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs py-2 border-t border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="flex items-center gap-1.5 opacity-80">
                    <Clock className="h-3.5 w-3.5 text-[#B45A2B]" />
                    <span>Duração: <strong>{servico.duracao_minutos} min</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-80">
                    <Users className="h-3.5 w-3.5 text-[#B45A2B]" />
                    <span>
                      <strong>{servico.profissionais_count || 0}</strong> {servico.profissionais_count === 1 ? "profissional" : "profissionais"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Link href={`/servicos/${servico.id}`} className="w-full">
                    <Button variante="secundario" tamanho="sm" className="w-full">
                      Editar Serviço
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
