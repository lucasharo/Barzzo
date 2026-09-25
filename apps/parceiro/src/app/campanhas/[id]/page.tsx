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
import { traduzirErro } from "@barzzo/utilitarios";
import { esquemaCupom } from "@barzzo/dominio";
import type { Cupom, Servico } from "@barzzo/tipos";
import {
  Tag,
  ChevronLeft,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Scissors,
} from "lucide-react";

export default function PaginaFormularioCampanha() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNovo = id === "novo";

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = React.useState(false);

  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [servicosDisponiveis, setServicosDisponiveis] = React.useState<Servico[]>([]);

  // Campos do formulário
  const [codigo, setCodigo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [tipoDesconto, setTipoDesconto] = React.useState<"percentual" | "valor_fixo">("percentual");
  const [valorDesconto, setValorDesconto] = React.useState("");
  const [valorMinimo, setValorMinimo] = React.useState("0");
  const [limiteTotal, setLimiteTotal] = React.useState("");
  const [limitePorCliente, setLimitePorCliente] = React.useState("1");
  const [apenasPrimeiraReserva, setApenasPrimeiraReserva] = React.useState(false);
  const [dataInicio, setDataInicio] = React.useState(new Date().toISOString().split("T")[0]);
  const [dataFim, setDataFim] = React.useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [servicosSelecionados, setServicosSelecionados] = React.useState<string[]>([]);
  const [ativo, setAtivo] = React.useState(true);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    inicializar();
  }, [id]);

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

      // Carregar serviços da barbearia
      const { data: sDb } = await (supabase.from("servicos") as any)
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      setServicosDisponiveis((sDb || []) as Servico[]);

      // Se for edição, carregar dados do cupom
      if (!isNovo) {
        const { data: cupDb, error: erroCup } = await (supabase.from("cupons") as any)
          .select("*")
          .eq("id", id)
          .eq("barbearia_id", membro.barbearia_id)
          .single();

        if (erroCup || !cupDb) {
          setErro("Cupom não encontrado ou você não tem permissão para editá-lo.");
          return;
        }

        const cupom = cupDb as Cupom;
        setCodigo(cupom.codigo);
        setDescricao(cupom.descricao || "");
        setTipoDesconto(cupom.tipo_desconto);
        setValorDesconto(cupom.valor_desconto.toString());
        setValorMinimo(cupom.valor_minimo_reserva.toString());
        setLimiteTotal(cupom.limite_usos_total ? cupom.limite_usos_total.toString() : "");
        setLimitePorCliente(cupom.limite_usos_por_cliente.toString());
        setApenasPrimeiraReserva(cupom.apenas_primeira_reserva);
        setDataInicio(new Date(cupom.data_inicio).toISOString().split("T")[0]);
        setDataFim(new Date(cupom.data_fim).toISOString().split("T")[0]);
        setServicosSelecionados(cupom.servicos_elegiveis || []);
        setAtivo(cupom.ativo);
      }
    } catch {
      setErro("Falha ao inicializar formulário de cupom.");
    } finally {
      setCarregando(false);
    }
  }

  function alternarServico(servicoId: string) {
    setServicosSelecionados((ant) =>
      ant.includes(servicoId) ? ant.filter((s) => s !== servicoId) : [...ant, servicoId]
    );
  }

  function marcarTodosServicos() {
    setServicosSelecionados([]);
  }

  async function salvarCupom(e: React.FormEvent) {
    e.preventDefault();
    if (!barbeariaId) return;

    try {
      setSalvando(true);
      setErro(null);
      setSucesso(null);

      const valorDescontoNum = parseFloat(valorDesconto.replace(",", "."));
      const valorMinimoNum = parseFloat(valorMinimo.replace(",", ".")) || 0;
      const limiteTotalNum = limiteTotal ? parseInt(limiteTotal) : null;
      const limiteClienteNum = parseInt(limitePorCliente) || 1;

      const dadosValidados = esquemaCupom.safeParse({
        codigo: codigo.trim().toUpperCase(),
        descricao: descricao.trim() ? descricao.trim() : null,
        tipo_desconto: tipoDesconto,
        valor_desconto: valorDescontoNum,
        valor_minimo_reserva: valorMinimoNum,
        limite_usos_total: limiteTotalNum,
        limite_usos_por_cliente: limiteClienteNum,
        apenas_primeira_reserva: apenasPrimeiraReserva,
        servicos_elegiveis: servicosSelecionados,
        data_inicio: new Date(`${dataInicio}T00:00:00.000Z`).toISOString(),
        data_fim: new Date(`${dataFim}T23:59:59.999Z`).toISOString(),
        ativo,
      });

      if (!dadosValidados.success) {
        setErro(dadosValidados.error.errors[0]?.message || "Dados inválidos.");
        setSalvando(false);
        return;
      }

      const supabase = criarClienteSupabaseBrowser();
      const payload = {
        barbearia_id: barbeariaId,
        codigo: dadosValidados.data.codigo,
        descricao: dadosValidados.data.descricao,
        tipo_desconto: dadosValidados.data.tipo_desconto,
        valor_desconto: dadosValidados.data.valor_desconto,
        valor_minimo_reserva: dadosValidados.data.valor_minimo_reserva,
        limite_usos_total: dadosValidados.data.limite_usos_total,
        limite_usos_por_cliente: dadosValidados.data.limite_usos_por_cliente,
        apenas_primeira_reserva: dadosValidados.data.apenas_primeira_reserva,
        servicos_elegiveis: dadosValidados.data.servicos_elegiveis,
        data_inicio: dadosValidados.data.data_inicio,
        data_fim: dadosValidados.data.data_fim,
        ativo: dadosValidados.data.ativo,
        updated_at: new Date().toISOString(),
      };

      if (isNovo) {
        const { error: erroInsert } = await (supabase.from("cupons") as any).insert(payload);
        if (erroInsert) {
          if (erroInsert.message.includes("cupons_codigo_barbearia_unique")) {
            setErro("Já existe um cupom com este código nesta barbearia.");
          } else {
            setErro(traduzirErro(erroInsert, "Não foi possível cadastrar o cupom."));
          }
          setSalvando(false);
          return;
        }
      } else {
        const { error: erroUpdate } = await (supabase.from("cupons") as any)
          .update(payload)
          .eq("id", id)
          .eq("barbearia_id", barbeariaId);

        if (erroUpdate) {
          setErro(traduzirErro(erroUpdate, "Não foi possível atualizar o cupom."));
          setSalvando(false);
          return;
        }
      }

      setSucesso("Cupom salvo com sucesso!");
      setTimeout(() => {
        router.push("/campanhas");
      }, 1000);
    } catch {
      setErro("Erro de comunicação ao salvar cupom.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCupom() {
    if (isNovo || !barbeariaId) return;

    try {
      setExcluindo(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await (supabase.from("cupons") as any)
        .delete()
        .eq("id", id)
        .eq("barbearia_id", barbeariaId);

      if (error) {
        setErro(traduzirErro(error, "Não foi possível excluir o cupom. Tente novamente."));
        setExcluindo(false);
        return;
      }

      router.push("/campanhas");
    } catch {
      setErro("Erro ao excluir cupom.");
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando formulário...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Voltar */}
      <div>
        <Link
          href="/campanhas"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#B45A2B] transition-colors font-medium min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para Campanhas e Cupons
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2.5">
            <Tag className="w-7 h-7 text-[#B45A2B]" />
            {isNovo ? "Criar Cupom de Desconto" : "Editar Cupom"}
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Configure regras de aplicação, validade e tipo de abatimento na reserva
          </p>
        </div>

        {!isNovo && (
          <div>
            {!confirmarExclusao ? (
              <Button
                type="button"
                variante="cancelar-destrutivo"
                tamanho="sm"
                onClick={() => setConfirmarExclusao(true)}
                className="gap-1.5 min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-red-500/10 p-1.5 rounded-lg border border-red-500/30">
                <span className="text-xs text-red-600 font-semibold px-2">Confirmar?</span>
                <Button
                  type="button"
                  variante="cancelar-destrutivo"
                  tamanho="sm"
                  disabled={excluindo}
                  carregando={excluindo}
                  onClick={excluirCupom}
                  className="min-h-[36px] text-xs"
                >
                  Sim, Excluir
                </Button>
                <Button
                  type="button"
                  variante="secundario"
                  tamanho="sm"
                  onClick={() => setConfirmarExclusao(false)}
                  className="min-h-[36px] text-xs"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
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

      {/* Formulário */}
      <Card className="p-6 border-neutral-200 dark:border-neutral-800">
        <form onSubmit={salvarCupom} className="space-y-6">
          {/* Código do Cupom */}
          <div>
            <Label htmlFor="codigo" className="block text-sm font-semibold mb-1.5">
              Código do Cupom <span className="text-[#DC2626]">*</span>
            </Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: PRIMEIRA15, BEMVINDO10, VERAO2026"
              className="font-mono uppercase tracking-wider font-bold"
              required
            />
            <span className="text-[11px] opacity-60 mt-1 block">
              Apenas letras maiúsculas, números, hífens e sublinhados.
            </span>
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="descricao" className="block text-sm font-semibold mb-1.5">
              Descrição ou Finalidade (opcional)
            </Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: 15% de desconto para novos clientes no primeiro atendimento"
            />
          </div>

          {/* Tipo e Valor de Desconto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-semibold mb-1.5">
                Tipo de Desconto <span className="text-[#DC2626]">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoDesconto("percentual")}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-colors min-h-[44px] ${
                    tipoDesconto === "percentual"
                      ? "bg-[#B45A2B] text-white border-[#B45A2B]"
                      : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  Percentual (%)
                </button>
                <button
                  type="button"
                  onClick={() => setTipoDesconto("valor_fixo")}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-colors min-h-[44px] ${
                    tipoDesconto === "valor_fixo"
                      ? "bg-[#B45A2B] text-white border-[#B45A2B]"
                      : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  Fixo em Reais (R$)
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="valorDesconto" className="block text-sm font-semibold mb-1.5">
                Valor do Abatimento ({tipoDesconto === "percentual" ? "%" : "R$"}){" "}
                <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                id="valorDesconto"
                type="number"
                step="0.01"
                min="0.01"
                max={tipoDesconto === "percentual" ? "100" : undefined}
                value={valorDesconto}
                onChange={(e) => setValorDesconto(e.target.value)}
                placeholder={tipoDesconto === "percentual" ? "15" : "10.00"}
                required
              />
            </div>
          </div>

          {/* Valor Mínimo e Limites */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valorMinimo" className="block text-sm font-semibold mb-1.5">
                Valor Mínimo (R$)
              </Label>
              <Input
                id="valorMinimo"
                type="number"
                step="0.01"
                min="0"
                value={valorMinimo}
                onChange={(e) => setValorMinimo(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="limiteTotal" className="block text-sm font-semibold mb-1.5">
                Limite Total de Usos
              </Label>
              <Input
                id="limiteTotal"
                type="number"
                min="1"
                value={limiteTotal}
                onChange={(e) => setLimiteTotal(e.target.value)}
                placeholder="Ilimitado"
              />
            </div>

            <div>
              <Label htmlFor="limiteCliente" className="block text-sm font-semibold mb-1.5">
                Usos por Cliente
              </Label>
              <Input
                id="limiteCliente"
                type="number"
                min="1"
                value={limitePorCliente}
                onChange={(e) => setLimitePorCliente(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          {/* Período de Vigência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dataInicio" className="block text-sm font-semibold mb-1.5">
                Data de Início <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="dataFim" className="block text-sm font-semibold mb-1.5">
                Data de Término <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Serviços Elegíveis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Serviços Elegíveis</Label>
              <button
                type="button"
                onClick={marcarTodosServicos}
                className="text-xs text-[#B45A2B] hover:underline font-medium min-h-[36px]"
              >
                {servicosSelecionados.length === 0 ? "Válido para todos os serviços" : "Limpar filtro (todos)"}
              </button>
            </div>

            {servicosDisponiveis.length === 0 ? (
              <p className="text-xs opacity-50">Nenhum serviço cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {servicosDisponiveis.map((s) => {
                  const marcado =
                    servicosSelecionados.length === 0 ||
                    servicosSelecionados.includes(s.id);

                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        servicosSelecionados.includes(s.id)
                          ? "bg-[#B45A2B]/10 text-[#B45A2B] font-bold"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={servicosSelecionados.includes(s.id)}
                        onChange={() => alternarServico(s.id)}
                        className="rounded text-[#B45A2B] focus:ring-[#B45A2B]"
                      />
                      <Scissors className="w-3.5 h-3.5 opacity-60" />
                      <span className="truncate">{s.nome}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <span className="text-[11px] opacity-60 mt-1 block">
              Se nenhum for marcado especificamente, o cupom será aceito em qualquer serviço.
            </span>
          </div>

          {/* Checkboxes de Regras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors min-h-[44px]">
              <input
                type="checkbox"
                checked={apenasPrimeiraReserva}
                onChange={(e) => setApenasPrimeiraReserva(e.target.checked)}
                className="w-4 h-4 rounded text-[#B45A2B] focus:ring-[#B45A2B]"
              />
              <div>
                <span className="text-sm font-bold flex items-center gap-1">
                  Apenas 1ª Reserva
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </span>
                <span className="text-xs opacity-60">Exclusivo para clientes novos na barbearia</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors min-h-[44px]">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="w-4 h-4 rounded text-[#B45A2B] focus:ring-[#B45A2B]"
              />
              <div>
                <span className="text-sm font-bold block">Cupom Ativo</span>
                <span className="text-xs opacity-60">Disponível para validação e resgate</span>
              </div>
            </label>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Link href="/campanhas">
              <Button type="button" variante="secundario" className="min-h-[44px]">
                Cancelar
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={salvando}
              carregando={salvando}
              className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px] px-6"
            >
              <Save className="w-4 h-4" />
              {isNovo ? "Criar Cupom" : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
