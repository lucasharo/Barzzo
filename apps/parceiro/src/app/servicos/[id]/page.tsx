"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { esquemaServico } from "@barzzo/validacoes";
import type { Profissional, Barbearia } from "@barzzo/tipos";
import {
  ArrowLeft,
  Scissors,
  Clock,
  Trash2,
  CheckCircle,
  Save,
  Users,
} from "lucide-react";

const DURACOES_RAPIDAS = [15, 30, 45, 60, 90, 120];

export default function PaginaEdicaoServico() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const ehNovo = id === "novo";

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);

  // Form states
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [preco, setPreco] = React.useState<string>("40.00");
  const [duracaoMinutos, setDuracaoMinutos] = React.useState<number>(30);
  const [ativo, setAtivo] = React.useState(true);

  // Profissionais da barbearia e vinculados
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [profissionaisSelecionados, setProfissionaisSelecionados] = React.useState<string[]>([]);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarDados();
  }, [id]);

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

      // Buscar barbearia
      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membro || !membro.barbearia_id) {
        setErro("Nenhuma barbearia vinculada.");
        return;
      }

      setBarbeariaId(membro.barbearia_id);

      // Carregar lista de profissionais da barbearia
      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const listaProfs = (profsDb || []) as Profissional[];
      setProfissionais(listaProfs);

      // Se for edição, carregar dados do serviço existente
      if (!ehNovo) {
        const { data: servicoDb, error: erroServico } = await supabase
          .from("servicos")
          .select("*")
          .eq("id", id)
          .eq("barbearia_id", membro.barbearia_id)
          .single();

        if (erroServico || !servicoDb) {
          setErro("Serviço não encontrado.");
          return;
        }

        setNome(servicoDb.nome);
        setDescricao(servicoDb.descricao || "");
        setPreco(Number(servicoDb.preco).toFixed(2));
        setDuracaoMinutos(servicoDb.duracao_minutos);
        setAtivo(servicoDb.ativo);

        // Carregar vínculos profissionais
        const { data: vinculos } = await supabase
          .from("profissionais_servicos")
          .select("profissional_id")
          .eq("servico_id", id)
          .eq("ativo", true);

        if (vinculos) {
          setProfissionaisSelecionados(vinculos.map((v: { profissional_id: string }) => v.profissional_id));
        }
      } else {
        // Se for novo serviço, marcar todos os profissionais por padrão
        setProfissionaisSelecionados(listaProfs.map((p) => p.id));
      }
    } catch {
      setErro("Erro ao inicializar formulário de serviço.");
    } finally {
      setCarregando(false);
    }
  }

  function alternarProfissional(profId: string) {
    setProfissionaisSelecionados((prev) =>
      prev.includes(profId) ? prev.filter((p) => p !== profId) : [...prev, profId]
    );
  }

  function selecionarTodosProfissionais() {
    if (profissionaisSelecionados.length === profissionais.length) {
      setProfissionaisSelecionados([]);
    } else {
      setProfissionaisSelecionados(profissionais.map((p) => p.id));
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!barbeariaId) {
      setErro("Barbearia não identificada.");
      return;
    }

    // Validar esquema Zod
    const resultado = esquemaServico.safeParse({
      nome,
      descricao: descricao ? descricao : null,
      preco: Number(preco.replace(",", ".")),
      duracao_minutos: duracaoMinutos,
      ativo,
      profissionais_ids: profissionaisSelecionados,
    });

    if (!resultado.success) {
      const primeiroErro = resultado.error.errors[0]?.message || "Verifique os dados preenchidos.";
      setErro(primeiroErro);
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();
      let servicoIdFinal = id;

      if (ehNovo) {
        // Inserir novo serviço
        const { data: novoServico, error: erroInsert } = await supabase
          .from("servicos")
          .insert({
            barbearia_id: barbeariaId,
            nome: resultado.data.nome,
            descricao: resultado.data.descricao,
            preco: resultado.data.preco,
            duracao_minutos: resultado.data.duracao_minutos,
            ativo: resultado.data.ativo,
          })
          .select("id")
          .single();

        if (erroInsert || !novoServico) {
          setErro("Falha ao salvar o novo serviço.");
          return;
        }

        servicoIdFinal = novoServico.id;
      } else {
        // Atualizar serviço existente
        const { error: erroUpdate } = await supabase
          .from("servicos")
          .update({
            nome: resultado.data.nome,
            descricao: resultado.data.descricao,
            preco: resultado.data.preco,
            duracao_minutos: resultado.data.duracao_minutos,
            ativo: resultado.data.ativo,
          })
          .eq("id", id)
          .eq("barbearia_id", barbeariaId);

        if (erroUpdate) {
          setErro("Falha ao atualizar o serviço.");
          return;
        }
      }

      // Sincronizar vínculos em profissionais_servicos
      // 1. Remover vínculos antigos
      await supabase
        .from("profissionais_servicos")
        .delete()
        .eq("servico_id", servicoIdFinal);

      // 2. Inserir vínculos selecionados
      if (profissionaisSelecionados.length > 0) {
        const novosVinculos = profissionaisSelecionados.map((pId) => ({
          profissional_id: pId,
          servico_id: servicoIdFinal,
          ativo: true,
        }));

        await supabase.from("profissionais_servicos").insert(novosVinculos);
      }

      setSucesso("Serviço salvo com sucesso!");
      setTimeout(() => {
        router.push("/servicos");
      }, 1200);
    } catch {
      setErro("Ocorreu um erro ao salvar o serviço.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!confirm("Tem certeza que deseja remover este serviço do catálogo? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      setExcluindo(true);
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await supabase
        .from("servicos")
        .delete()
        .eq("id", id)
        .eq("barbearia_id", barbeariaId);

      if (error) {
        setErro("Não foi possível excluir o serviço.");
        return;
      }

      router.push("/servicos");
    } catch {
      setErro("Erro ao excluir o serviço.");
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando informações do serviço...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/servicos"
          className="text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Serviços
        </Link>

        {!ehNovo && (
          <Button
            variante="destrutivo"
            tamanho="sm"
            onClick={handleExcluir}
            disabled={excluindo}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {excluindo ? "Excluindo..." : "Excluir Serviço"}
          </Button>
        )}
      </div>

      <Card camada="primaria">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">
                {ehNovo ? "Criar Novo Serviço" : `Editar Serviço: ${nome || "Serviço"}`}
              </CardTitle>
              <CardDescription>
                Defina o valor cobrado, o tempo estimado de execução e a equipe capacitada.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {erro && (
            <Alert variante="erro" className="mb-6">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {sucesso && (
            <Alert variante="sucesso" className="mb-6">
              <AlertDescription>{sucesso}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSalvar} className="flex flex-col gap-6">
            {/* Nome do Serviço */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome do Serviço *</Label>
              <Input
                id="nome"
                placeholder="Ex: Corte Degradê + Barba Alinhada"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
              <span className="text-xs opacity-60">
                Nome visível para os clientes no catálogo e no agendamento.
              </span>
            </div>

            {/* Descrição */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição (Opcional)</Label>
              <textarea
                id="descricao"
                rows={3}
                placeholder="Ex: Inclui lavagem com shampoo especial, toalha quente e finalização com pomada modeladora."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
              />
            </div>

            {/* Preço e Duração */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="preco">Preço (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold opacity-60">
                    R$
                  </span>
                  <Input
                    id="preco"
                    type="number"
                    step="0.50"
                    min="0"
                    placeholder="45.00"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="pl-10 font-bold"
                    required
                  />
                </div>
                <span className="text-xs opacity-60">Preço padronizado para o MVP.</span>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="duracao">Duração Estimada (Minutos) *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                  <Input
                    id="duracao"
                    type="number"
                    step="5"
                    min="5"
                    max="480"
                    value={duracaoMinutos}
                    onChange={(e) => setDuracaoMinutos(Number(e.target.value))}
                    className="pl-10 font-bold"
                    required
                  />
                </div>
                {/* Atalhos Rápidos de Duração */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DURACOES_RAPIDAS.map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setDuracaoMinutos(min)}
                      className={`text-[11px] px-2 py-0.5 rounded font-medium border transition-colors ${
                        duracaoMinutos === min
                          ? "bg-[#B45A2B] text-white border-[#B45A2B]"
                          : "border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B]/60"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Status Ativo / Inativo */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Disponível para agendamento online</span>
                <span className="text-xs opacity-60">
                  Desative temporariamente se este serviço não puder ser reservado no momento.
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#16A34A]"></div>
              </label>
            </div>

            {/* Vínculo de Profissionais */}
            <div className="flex flex-col gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#B45A2B]" />
                  <Label className="text-base font-bold">Profissionais Habilitados</Label>
                </div>

                {profissionais.length > 0 && (
                  <button
                    type="button"
                    onClick={selecionarTodosProfissionais}
                    className="text-xs text-[#B45A2B] font-semibold hover:underline"
                  >
                    {profissionaisSelecionados.length === profissionais.length
                      ? "Desmarcar todos"
                      : "Selecionar todos"}
                  </button>
                )}
              </div>

              <p className="text-xs opacity-70">
                Selecione quais barbeiros da equipe executam este serviço. Apenas profissionais marcados terão slots disponíveis para esta reserva.
              </p>

              {profissionais.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-sm opacity-70">
                  Nenhum profissional cadastrado na barbearia.{" "}
                  <Link href="/equipe" className="text-[#B45A2B] font-semibold hover:underline">
                    Adicione membros à equipe primeiro.
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {profissionais.map((prof) => {
                    const selecionado = profissionaisSelecionados.includes(prof.id);
                    return (
                      <div
                        key={prof.id}
                        onClick={() => alternarProfissional(prof.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all ${
                          selecionado
                            ? "border-[#B45A2B] bg-[#B45A2B]/5 shadow-sm"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 opacity-70"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs">
                            {prof.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold">{prof.nome}</span>
                        </div>

                        <div
                          className={`h-5 w-5 rounded border flex items-center justify-center ${
                            selecionado
                              ? "bg-[#B45A2B] border-[#B45A2B] text-white"
                              : "border-neutral-300 dark:border-neutral-700"
                          }`}
                        >
                          {selecionado && <CheckCircle className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Link href="/servicos">
                <Button variante="fantasma" type="button">
                  Cancelar
                </Button>
              </Link>
              <Button variante="principal" type="submit" disabled={salvando}>
                <Save className="h-4 w-4 mr-1.5" />
                {salvando ? "Salvando..." : ehNovo ? "Criar Serviço" : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
