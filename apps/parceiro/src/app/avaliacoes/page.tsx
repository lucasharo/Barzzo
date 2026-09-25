"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { formatarResumoReputacao } from "@barzzo/dominio";
import { esquemaResponderAvaliacao } from "@barzzo/validacoes";
import type { Avaliacao, ResumoReputacaoBarbearia } from "@barzzo/tipos";
import {
  Star,
  MessageSquare,
  Send,
  AlertCircle,
  CheckCircle2,
  Building2,
  Calendar,
  User,
  ThumbsUp,
} from "lucide-react";

export default function PaginaAvaliacoesParceiro() {
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(true);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [avaliacoes, setAvaliacoes] = React.useState<Avaliacao[]>([]);
  const [resumo, setResumo] = React.useState<ResumoReputacaoBarbearia>({
    media_nota: 0,
    total_avaliacoes: 0,
    distribuicao_estrelas: { estrela_5: 0, estrela_4: 0, estrela_3: 0, estrela_2: 0, estrela_1: 0 },
  });

  // Estado de resposta inline por avaliação
  const [respostasEmEdicao, setRespostasEmEdicao] = React.useState<Record<string, string>>({});
  const [enviandoRespostaId, setEnviandoRespostaId] = React.useState<string | null>(null);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/entrar");
        return;
      }

      // Buscar barbearia vinculada ao usuário
      const { data: membro, error: erroMembro } = await (supabase.from("membros_equipe") as any)
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single();

      if (erroMembro || !membro) {
        setErro("Você não possui vínculo ativo com nenhuma barbearia.");
        return;
      }

      setBarbeariaId(membro.barbearia_id);
      await carregarAvaliacoes(membro.barbearia_id);
    } catch {
      setErro("Falha ao inicializar o painel de reputação.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAvaliacoes(bId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const { data, error } = await (supabase.from("avaliacoes") as any)
        .select(`
          *,
          profissionais (
            nome
          )
        `)
        .eq("barbearia_id", bId)
        .order("created_at", { ascending: false });

      if (error) {
        setErro("Não foi possível carregar as avaliações da barbearia.");
        return;
      }

      const lista = (data || []) as Avaliacao[];
      setAvaliacoes(lista);
      setResumo(formatarResumoReputacao(lista));
    } catch {
      setErro("Erro de comunicação ao carregar avaliações.");
    }
  }

  async function enviarResposta(avaliacaoId: string) {
    const texto = respostasEmEdicao[avaliacaoId]?.trim();
    const validacao = esquemaResponderAvaliacao.safeParse({ resposta_barbearia: texto });

    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "Texto da resposta inválido.");
      return;
    }

    try {
      setEnviandoRespostaId(avaliacaoId);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const agora = new Date().toISOString();
      const { error } = await (supabase.from("avaliacoes") as any)
        .update({
          resposta_barbearia: texto,
          respondido_em: agora,
          respondido_por: session.user.id,
          updated_at: agora,
        })
        .eq("id", avaliacaoId);

      if (error) {
        setErro("Falha ao salvar a resposta oficial da barbearia.");
        return;
      }

      setSucesso("Resposta oficial publicada com sucesso!");
      setAvaliacoes((anteriores) =>
        anteriores.map((a) =>
          a.id === avaliacaoId
            ? {
                ...a,
                resposta_barbearia: texto,
                respondido_em: agora,
                respondido_por: session.user.id,
              }
            : a
        )
      );

      // Limpar campo de edição
      setRespostasEmEdicao((prev) => {
        const copy = { ...prev };
        delete copy[avaliacaoId];
        return copy;
      });
    } catch {
      setErro("Erro de comunicação ao publicar resposta.");
    } finally {
      setEnviandoRespostaId(null);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando painel de reputação...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
          <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
          Avaliações e Reputação
        </h1>
        <p className="text-sm opacity-70 mt-1">
          Acompanhe o nível de satisfação dos clientes e responda aos comentários oficialmente
        </p>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Painel de Métricas de Reputação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Nota Média Geral */}
        <Card className="p-6 border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold tracking-wider opacity-60 mb-2">
            Nota Geral da Barbearia
          </span>
          <span className="text-5xl font-black text-amber-500">
            {resumo.media_nota > 0 ? resumo.media_nota.toFixed(1) : "—"}
          </span>
          <div className="flex items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-5 h-5 ${
                  s <= Math.round(resumo.media_nota)
                    ? "text-amber-400 fill-amber-400"
                    : "text-neutral-300 dark:text-neutral-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs opacity-60">
            Baseado em {resumo.total_avaliacoes} {resumo.total_avaliacoes === 1 ? "avaliação" : "avaliações"}
          </span>
        </Card>

        {/* Distribuição de Estrelas */}
        <Card className="p-6 md:col-span-2 border-neutral-200 dark:border-neutral-800 flex flex-col justify-center">
          <h3 className="text-sm font-bold mb-3">Distribuição das Avaliações</h3>
          <div className="space-y-2 text-xs">
            {[
              { estrelas: 5, cont: resumo.distribuicao_estrelas.estrela_5 },
              { estrelas: 4, cont: resumo.distribuicao_estrelas.estrela_4 },
              { estrelas: 3, cont: resumo.distribuicao_estrelas.estrela_3 },
              { estrelas: 2, cont: resumo.distribuicao_estrelas.estrela_2 },
              { estrelas: 1, cont: resumo.distribuicao_estrelas.estrela_1 },
            ].map((linha) => {
              const perc = resumo.total_avaliacoes > 0 ? (linha.cont / resumo.total_avaliacoes) * 100 : 0;
              return (
                <div key={linha.estrelas} className="flex items-center gap-3">
                  <span className="w-14 font-medium flex items-center gap-1">
                    {linha.estrelas} <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all rounded-full"
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                  <span className="w-12 text-right opacity-60 font-semibold">{linha.cont}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Lista de Avaliações */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Comentários e Feedbacks dos Clientes</h2>

        {avaliacoes.length === 0 ? (
          <Card className="text-center py-16 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
            <Star className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <h3 className="text-base font-bold mb-1">Nenhuma avaliação recebida ainda</h3>
            <p className="text-xs opacity-60 max-w-sm mx-auto">
              Assim que os clientes concluírem os atendimentos, eles poderão avaliar e opinar sobre o corte e serviço prestado.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {avaliacoes.map((av) => {
              const emResposta = respostasEmEdicao[av.id] !== undefined;
              const respostaAtual = respostasEmEdicao[av.id] || "";

              return (
                <Card
                  key={av.id}
                  className="p-6 border-neutral-200 dark:border-neutral-800 space-y-4"
                >
                  {/* Topo do Feedback */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#B45A2B]/15 text-[#B45A2B] flex items-center justify-center font-bold text-sm">
                        {av.cliente_nome[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{av.cliente_nome}</h4>
                        <span className="text-[11px] opacity-60">
                          {new Date(av.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {av.profissionais?.nome ? ` • Barbeiro: ${av.profissionais.nome}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= av.nota
                              ? "text-amber-400 fill-amber-400"
                              : "text-neutral-300 dark:text-neutral-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Comentário do Cliente */}
                  {av.comentario ? (
                    <p className="text-xs text-neutral-800 dark:text-neutral-200 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 leading-relaxed">
                      "{av.comentario}"
                    </p>
                  ) : (
                    <p className="text-xs opacity-50 italic">
                      Cliente avaliou com {av.nota} estrelas sem comentário por escrito.
                    </p>
                  )}

                  {/* Resposta da Barbearia */}
                  {av.resposta_barbearia ? (
                    <div className="p-4 rounded-xl bg-[#B45A2B]/10 border border-[#B45A2B]/20 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#B45A2B] flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Resposta Oficial da Barbearia:
                        </span>
                        {av.respondido_em && (
                          <span className="text-[10px] opacity-60">
                            {new Date(av.respondido_em).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed pl-5">
                        {av.resposta_barbearia}
                      </p>
                    </div>
                  ) : emResposta ? (
                    /* Formulário de Resposta Aberto */
                    <div className="p-4 rounded-xl border border-[#B45A2B]/40 bg-[#B45A2B]/5 space-y-3">
                      <span className="text-xs font-bold text-[#B45A2B] block">
                        Responder como Barbearia:
                      </span>
                      <textarea
                        value={respostaAtual}
                        onChange={(e) =>
                          setRespostasEmEdicao((ant) => ({ ...ant, [av.id]: e.target.value }))
                        }
                        placeholder="Agradeça pelo feedback ou dê esclarecimentos sobre o atendimento..."
                        rows={3}
                        className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variante="secundario"
                          tamanho="sm"
                          onClick={() =>
                            setRespostasEmEdicao((ant) => {
                              const copy = { ...ant };
                              delete copy[av.id];
                              return copy;
                            })
                          }
                          disabled={enviandoRespostaId === av.id}
                          className="min-h-[36px] text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          tamanho="sm"
                          onClick={() => enviarResposta(av.id)}
                          disabled={enviandoRespostaId === av.id || !respostaAtual.trim()}
                          carregando={enviandoRespostaId === av.id}
                          className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[36px] text-xs font-semibold gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          Publicar Resposta
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Botão para Iniciar Resposta */
                    <div className="flex justify-end pt-1">
                      <Button
                        variante="secundario"
                        tamanho="sm"
                        onClick={() =>
                          setRespostasEmEdicao((ant) => ({ ...ant, [av.id]: "" }))
                        }
                        className="min-h-[36px] text-xs gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Responder ao Cliente
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
