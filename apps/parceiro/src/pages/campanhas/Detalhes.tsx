
import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  InputMascarado,
  Label,
  Alert,
  AlertaTemporizado,
  AlertDescription,
  LoadingSpinner,
  Seletor,
  Switch,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { obterMembroAtual } from "../../lib/unidade-atual";
import { formatarData, formatarDataDigitada, traduzirErro } from "@barzzo/utilitarios";
import { esquemaCupom } from "@barzzo/dominio";
import type { Cupom, CupomRegra, Servico } from "@barzzo/tipos";
import {
  Tag,
  ChevronLeft,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Scissors,
} from "lucide-react";

function converterDataParaIso(valor: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!partes) return null;

  const [, dia, mes, ano] = partes;
  const iso = `${ano}-${mes}-${dia}`;
  const data = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso ? iso : null;
}

export default function PaginaFormularioCampanha() {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id as string;
  const isNovo = id === "novo";

  const [carregando, setCarregando] = React.useState(true);
  const [edicaoRestritaAoAdmin, setEdicaoRestritaAoAdmin] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = React.useState(false);

  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [servicosDisponiveis, setServicosDisponiveis] = React.useState<Servico[]>([]);
  const [influenciadoresDisponiveis, setInfluenciadoresDisponiveis] = React.useState<Array<{ id: string; nome: string }>>([]);

  // Campos do formulário
  const [codigo, setCodigo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [tipoDesconto, setTipoDesconto] = React.useState<"percentual" | "valor_fixo">("percentual");
  const [valorDesconto, setValorDesconto] = React.useState("");
  const [valorMinimo, setValorMinimo] = React.useState("0");
  const [limiteTotal, setLimiteTotal] = React.useState("");
  const [limitePorCliente, setLimitePorCliente] = React.useState("1");
  const [limitePorClienteSeguinte, setLimitePorClienteSeguinte] = React.useState("");
  const [apenasPrimeiraReserva, setApenasPrimeiraReserva] = React.useState(false);
  const [dataInicio, setDataInicio] = React.useState(() => formatarData(new Date()));
  // Opcional: em branco, o cupom vale até alguém desativá-lo.
  const [dataFim, setDataFim] = React.useState("");
  const [erroDataInicio, setErroDataInicio] = React.useState<string | null>(null);
  const [erroDataFim, setErroDataFim] = React.useState<string | null>(null);
  const [servicosSelecionados, setServicosSelecionados] = React.useState<string[]>([]);
  const [ativo, setAtivo] = React.useState(true);
  const [origemCupom, setOrigemCupom] = React.useState<"BARBEARIA" | "INFLUENCIADOR">("BARBEARIA");
  const [influenciadorId, setInfluenciadorId] = React.useState("");
  const [tipoDescontoSeguinte, setTipoDescontoSeguinte] = React.useState<"percentual" | "valor_fixo">("percentual");
  const [valorDescontoSeguinte, setValorDescontoSeguinte] = React.useState("");

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    inicializar();
  }, [id]);

  async function inicializar() {
    try {
      setCarregando(true);
      setErro(null);
      setEdicaoRestritaAoAdmin(false);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/entrar");
        return;
      }

      const { data: membro, error: erroMembro } = await obterMembroAtual(supabase, session.user.id, "barbearia_id");

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
      const { data: infDb } = await (supabase.from("influenciadores") as any)
        .select("id, nome")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });
      setInfluenciadoresDisponiveis(infDb || []);

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
        setLimitePorCliente(String(cupom.limite_usos_por_cliente));
        setApenasPrimeiraReserva(cupom.apenas_primeira_reserva);
        setDataInicio(formatarData(cupom.data_inicio.slice(0, 10)));
        setDataFim(cupom.data_fim ? formatarData(cupom.data_fim.slice(0, 10)) : "");
        setServicosSelecionados(cupom.servicos_elegiveis || []);
        setAtivo(cupom.ativo);
        if (cupom.origem === "BARZZO_GLOBAL") {
          setEdicaoRestritaAoAdmin(true);
          return;
        }
        setOrigemCupom(cupom.origem === "INFLUENCIADOR" ? "INFLUENCIADOR" : "BARBEARIA");
        setInfluenciadorId(cupom.influenciador_id || "");
        const { data: regrasDb } = await (supabase.from("cupons_regras") as any)
          .select("*")
          .eq("cupom_id", cupom.id)
          .order("prioridade", { ascending: true });
        if (regrasDb?.some((regra: { escopo_historico: string }) => regra.escopo_historico === "GLOBAL_BARZZO")) {
          setEdicaoRestritaAoAdmin(true);
          return;
        }
        const regraDb = regrasDb?.[0];
        if (regraDb) {
          setTipoDesconto(regraDb.tipo_desconto);
          setValorDesconto(String(regraDb.valor_desconto));
          setLimitePorCliente(regraDb.limite_usos_por_cliente === null ? "1" : String(regraDb.limite_usos_por_cliente));
          if (regraDb.atendimentos_minimos === 0 && regraDb.atendimentos_maximos === 0 && !regrasDb?.[1]) {
            setApenasPrimeiraReserva(true);
          }
        }
        if (regrasDb?.[1]) {
          setTipoDescontoSeguinte(regrasDb[1].tipo_desconto || "percentual");
          setValorDescontoSeguinte(String(regrasDb[1].valor_desconto));
          setLimitePorClienteSeguinte(regrasDb[1].limite_usos_por_cliente === null ? "" : String(regrasDb[1].limite_usos_por_cliente));
        } else if (regraDb && !cupom.apenas_primeira_reserva && regraDb.atendimentos_minimos === null && regraDb.atendimentos_maximos === null) {
          // Cupom antigo de regra única: mantém o benefício disponível para retornos ao editar.
          setTipoDescontoSeguinte(regraDb.tipo_desconto);
          setValorDescontoSeguinte(String(regraDb.valor_desconto));
          setLimitePorClienteSeguinte(regraDb.limite_usos_por_cliente === null ? "" : String(regraDb.limite_usos_por_cliente));
        }
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

      if (origemCupom === "INFLUENCIADOR" && !influenciadorId) {
        setErro("Selecione o influenciador associado ao cupom.");
        setSalvando(false);
        return;
      }

      const inicioIso = converterDataParaIso(dataInicio);
      const semDataFim = dataFim.trim() === "";
      const fimIso = semDataFim ? null : converterDataParaIso(dataFim);
      setErroDataInicio(inicioIso ? null : "Informe uma data de início válida no formato DD/MM/AAAA.");
      setErroDataFim(semDataFim || fimIso ? null : "Informe uma data de término válida no formato DD/MM/AAAA ou deixe em branco.");
      if (!inicioIso || (!semDataFim && !fimIso)) {
        setSalvando(false);
        return;
      }
      if (fimIso && fimIso < inicioIso) {
        setErroDataFim("A data de término deve ser igual ou posterior à data de início.");
        setSalvando(false);
        return;
      }

      const valorDescontoNum = parseFloat(valorDesconto.replace(",", "."));
      const valorMinimoNum = parseFloat(valorMinimo.replace(",", ".")) || 0;
      const limiteTotalNum = limiteTotal ? parseInt(limiteTotal) : null;
      const limiteClienteNum = Number(limitePorCliente);
      const limiteClienteSeguinteNum = limitePorClienteSeguinte.trim() ? Number(limitePorClienteSeguinte) : null;
      if (!limitePorCliente.trim() || !Number.isInteger(limiteClienteNum) || limiteClienteNum < 1) {
        setErro("Informe um limite de usos por cliente válido para o primeiro atendimento.");
        setSalvando(false);
        return;
      }
      if (!apenasPrimeiraReserva && limiteClienteSeguinteNum !== null && (!Number.isInteger(limiteClienteSeguinteNum) || limiteClienteSeguinteNum < 1)) {
        setErro("Informe um limite de usos por cliente válido para os demais atendimentos.");
        setSalvando(false);
        return;
      }
      const regra = {
        prioridade: 100,
        escopo_historico: "BARBEARIA" as const,
        atendimentos_minimos: 0,
        atendimentos_maximos: 0,
        tipo_desconto: tipoDesconto,
        valor_desconto: valorDescontoNum,
        valor_minimo_reserva: valorMinimoNum,
        limite_usos_total: limiteTotalNum,
        limite_usos_por_cliente: limiteClienteNum,
        servicos_elegiveis: servicosSelecionados,
        ativo,
      };
      const regras: Array<Omit<CupomRegra, "id" | "cupom_id">> = [regra];
      if (!apenasPrimeiraReserva) {
        const valorSeguinte = parseFloat(valorDescontoSeguinte.replace(",", "."));
        if (!valorSeguinte || valorSeguinte <= 0) {
          setErro("Informe o desconto da faixa para atendimentos seguintes.");
          setSalvando(false);
          return;
        }
        if (tipoDescontoSeguinte === "percentual" && valorSeguinte > 100) {
          setErro("O desconto percentual para os demais atendimentos não pode ultrapassar 100%.");
          setSalvando(false);
          return;
        }
        regras.push({
          prioridade: 200,
          escopo_historico: "BARBEARIA",
          atendimentos_minimos: 1,
          atendimentos_maximos: null,
          tipo_desconto: tipoDescontoSeguinte,
          valor_desconto: valorSeguinte,
          valor_minimo_reserva: valorMinimoNum,
          limite_usos_total: limiteTotalNum,
          limite_usos_por_cliente: limiteClienteSeguinteNum,
          servicos_elegiveis: servicosSelecionados,
          ativo,
        });
      }

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
        data_inicio: `${inicioIso}T00:00:00.000Z`,
        data_fim: fimIso ? `${fimIso}T23:59:59.999Z` : null,
        ativo,
        origem: origemCupom,
        influenciador_id: origemCupom === "INFLUENCIADOR" ? (influenciadorId || null) : null,
        regras,
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
        origem: dadosValidados.data.origem,
        influenciador_id: dadosValidados.data.influenciador_id,
        updated_at: new Date().toISOString(),
      };

      let cupomSalvoId = id;
      if (isNovo) {
        const { data: novoCupom, error: erroInsert } = await (supabase.from("cupons") as any).insert(payload).select("id").single();
        if (erroInsert) {
          if (erroInsert.message.includes("cupons_codigo_barbearia_unique")) {
            setErro("Já existe um cupom com este código nesta barbearia.");
          } else {
            setErro(traduzirErro(erroInsert, "Não foi possível cadastrar o cupom."));
          }
          setSalvando(false);
          return;
        }
        cupomSalvoId = novoCupom.id;
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

      const regraPayloads = (dadosValidados.data.regras || regras).map((item, indice) => ({
        ...item,
        cupom_id: cupomSalvoId,
        prioridade: item.prioridade ?? (indice + 1) * 100,
      }));
      if (!isNovo) {
        await (supabase.from("cupons_regras") as any).delete().eq("cupom_id", cupomSalvoId);
      }
      const { error: erroRegra } = await (supabase.from("cupons_regras") as any).insert(regraPayloads);
      if (erroRegra) {
        setErro(traduzirErro(erroRegra, "Cupom salvo, mas não foi possível salvar a regra de desconto."));
        setSalvando(false);
        return;
      }

      setSucesso("Cupom salvo com sucesso!");
      setTimeout(() => {
        navigate("/campanhas");
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

      navigate("/campanhas");
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

  if (edicaoRestritaAoAdmin) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <Link to="/campanhas" className="inline-flex items-center gap-1.5 text-sm font-medium min-h-[44px]">
          <ChevronLeft className="w-4 h-4" />
          Voltar para Campanhas e Cupons
        </Link>
        <Alert variante="alerta">
          <AlertDescription>Cupons e regras com abrangência em todo o Barzzo só podem ser administrados pelo Admin.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Voltar */}
      <div>
        <Link
          to="/campanhas"
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
        <AlertaTemporizado variante="erro" duracaoMs={6000} aoExpirar={() => setErro(null)}>
          <AlertDescription>{erro}</AlertDescription>
        </AlertaTemporizado>
      )}

      {sucesso && (
        <AlertaTemporizado variante="sucesso" duracaoMs={5000} aoExpirar={() => setSucesso(null)}>
          <AlertDescription>{sucesso}</AlertDescription>
        </AlertaTemporizado>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="origemCupom" className="block text-sm font-semibold mb-1.5">Origem do cupom</Label>
              <Seletor
                id="origemCupom"
                valor={origemCupom}
                aoMudar={(valor) => setOrigemCupom(valor as typeof origemCupom)}
                opcoes={[
                  { valor: "BARBEARIA", rotulo: "Barbearia" },
                  { valor: "INFLUENCIADOR", rotulo: "Influenciador" },
                ]}
                className="w-full"
              />
              <span className="text-[11px] opacity-60 mt-1 block">Campanhas Globais são criadas somente pelo Admin do Barzzo.</span>
            </div>
            {origemCupom === "INFLUENCIADOR" && (
              <div>
                <Label htmlFor="influenciadorId" className="block text-sm font-semibold mb-1.5">Influenciador associado</Label>
                <Seletor
                  id="influenciadorId"
                  valor={influenciadorId}
                  aoMudar={setInfluenciadorId}
                  placeholder="Selecione um influencer"
                  opcoes={influenciadoresDisponiveis.map((influenciador) => ({
                    valor: influenciador.id,
                    rotulo: influenciador.nome,
                  }))}
                  className="w-full"
                  erro={!influenciadorId}
                />
                <span className="text-[11px] opacity-60 mt-1 block">Este cupom identifica o influencer; não é necessário usar ref.</span>
              </div>
            )}
          </div>

          {/* Condições gerais do cupom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          </div>

          {/* Período de Vigência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dataInicio" className="block text-sm font-semibold mb-1.5">
                Data de Início <span className="text-[#DC2626]">*</span>
              </Label>
              <InputMascarado
                id="dataInicio"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={dataInicio}
                mascara={formatarDataDigitada}
                onChangeValor={(valor) => {
                  setDataInicio(valor);
                  setErroDataInicio(null);
                }}
                onBlur={() => setErroDataInicio(converterDataParaIso(dataInicio) ? null : "Informe uma data de início válida no formato DD/MM/AAAA.")}
                placeholder="DD/MM/AAAA"
                aria-invalid={!!erroDataInicio}
                aria-describedby={erroDataInicio ? "erro-data-inicio" : undefined}
                erro={!!erroDataInicio}
              />
              {erroDataInicio && <p id="erro-data-inicio" className="mt-1 text-xs text-[var(--erro)]" role="alert">{erroDataInicio}</p>}
            </div>

            <div>
              <Label htmlFor="dataFim" className="block text-sm font-semibold mb-1.5">
                Data de Término <span className="text-xs font-normal opacity-60">(opcional)</span>
              </Label>
              <InputMascarado
                id="dataFim"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={dataFim}
                mascara={formatarDataDigitada}
                onChangeValor={(valor) => {
                  setDataFim(valor);
                  setErroDataFim(null);
                }}
                onBlur={() => setErroDataFim(dataFim.trim() === "" || converterDataParaIso(dataFim) ? null : "Informe uma data de término válida no formato DD/MM/AAAA ou deixe em branco.")}
                placeholder="DD/MM/AAAA"
                aria-invalid={!!erroDataFim}
                aria-describedby={erroDataFim ? "erro-data-fim" : undefined}
                erro={!!erroDataFim}
              />
              {erroDataFim ? (
                <p id="erro-data-fim" className="mt-1 text-xs text-[var(--erro)]" role="alert">{erroDataFim}</p>
              ) : (
                <p className="mt-1 text-[11px] opacity-60">Em branco, o cupom fica ativo até você desativá-lo.</p>
              )}
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
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        servicosSelecionados.includes(s.id)
                          ? "bg-[#B45A2B]/10 text-[#B45A2B] font-bold"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <Switch
                        marcado={servicosSelecionados.includes(s.id)}
                        aoMudar={() => alternarServico(s.id)}
                        tamanho="sm"
                        aria-label={`Aplicar cupom ao serviço ${s.nome}`}
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

          {/* Regras de desconto por faixa */}
          <p className="text-sm opacity-70">Histórico considerado: apenas atendimentos nesta barbearia.</p>
          <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-4" aria-labelledby="titulo-primeira-faixa">
            <div>
              <h2 id="titulo-primeira-faixa" className="text-base font-bold">1. Primeiro atendimento</h2>
              <p className="text-xs opacity-60 mt-1">Válido para cliente sem atendimento concluído nesta barbearia.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="block text-sm font-semibold mb-1.5">Tipo de desconto *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setTipoDesconto("percentual")} aria-pressed={tipoDesconto === "percentual"} className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-colors min-h-[44px] ${tipoDesconto === "percentual" ? "bg-[#B45A2B] text-white border-[#B45A2B]" : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>Percentual (%)</button>
                  <button type="button" onClick={() => setTipoDesconto("valor_fixo")} aria-pressed={tipoDesconto === "valor_fixo"} className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-colors min-h-[44px] ${tipoDesconto === "valor_fixo" ? "bg-[#B45A2B] text-white border-[#B45A2B]" : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>Fixo em Reais (R$)</button>
                </div>
              </div>
              <div>
                <Label htmlFor="valorDesconto" className="block text-sm font-semibold mb-1.5">Valor do desconto ({tipoDesconto === "percentual" ? "%" : "R$"}) *</Label>
                <Input id="valorDesconto" type="number" step="0.01" min="0.01" max={tipoDesconto === "percentual" ? "100" : undefined} value={valorDesconto} onChange={(e) => setValorDesconto(e.target.value)} placeholder={tipoDesconto === "percentual" ? "10" : "10.00"} required />
              </div>
              <div>
                <Label htmlFor="limiteCliente" className="block text-sm font-semibold mb-1.5">Usos por cliente *</Label>
                <Input id="limiteCliente" type="number" min="1" step="1" value={limitePorCliente} onChange={(e) => setLimitePorCliente(e.target.value)} placeholder="1" required />
                <span className="text-xs opacity-60 mt-1 block">Limite independente desta faixa.</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-4" aria-labelledby="titulo-faixa-seguinte">
            <div>
              <h2 id="titulo-faixa-seguinte" className="text-base font-bold">2. Demais atendimentos</h2>
              <p className="text-xs opacity-60 mt-1">Válido a partir de um atendimento concluído nesta barbearia.</p>
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <Switch marcado={apenasPrimeiraReserva} aoMudar={setApenasPrimeiraReserva} aria-label="Aplicar cupom somente na primeira reserva" />
              <span className="text-sm font-bold">Apenas 1ª Reserva</span>
            </div>
            {apenasPrimeiraReserva ? (
              <div role="status" className="rounded-lg border border-[var(--alerta)] bg-[var(--alerta)]/10 p-3 text-sm">
                Este cupom será válido somente para a primeira reserva. Não haverá desconto para os demais atendimentos.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                <div className="sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="tipoDescontoSeguinte" className="block text-sm font-semibold mb-1.5">Tipo de desconto *</Label>
                  <Seletor id="tipoDescontoSeguinte" valor={tipoDescontoSeguinte} aoMudar={(valor) => setTipoDescontoSeguinte(valor as typeof tipoDescontoSeguinte)} opcoes={[{ valor: "percentual", rotulo: "Percentual (%)" }, { valor: "valor_fixo", rotulo: "Fixo em Reais (R$)" }]} className="w-full" />
                </div>
                <div>
                  <Label htmlFor="valorDescontoSeguinte" className="block text-sm font-semibold mb-1.5">Valor do desconto ({tipoDescontoSeguinte === "percentual" ? "%" : "R$"}) *</Label>
                  <Input id="valorDescontoSeguinte" type="number" min="0.01" max={tipoDescontoSeguinte === "percentual" ? "100" : undefined} step="0.01" value={valorDescontoSeguinte} onChange={(e) => setValorDescontoSeguinte(e.target.value)} placeholder={tipoDescontoSeguinte === "percentual" ? "5" : "8.00"} required />
                </div>
                <div>
                  <Label htmlFor="limiteClienteSeguinte" className="block text-sm font-semibold mb-1.5">Usos por cliente</Label>
                  <Input id="limiteClienteSeguinte" type="number" min="1" step="1" value={limitePorClienteSeguinte} onChange={(e) => setLimitePorClienteSeguinte(e.target.value)} placeholder="Ilimitado" />
                  <span className="text-xs opacity-60 mt-1 block">Vazio significa ilimitado nesta faixa.</span>
                </div>
              </div>
            )}
            <p className="text-[11px] opacity-60">Os limites por cliente são independentes. O limite total de usos acima vale para o cupom inteiro.</p>
          </section>

          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors min-h-[44px]">
            <Switch marcado={ativo} aoMudar={setAtivo} aria-label="Ativar cupom" />
            <div>
              <span className="text-sm font-bold block">Cupom Ativo</span>
              <span className="text-xs opacity-60">Disponível para validação e resgate</span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Link to="/campanhas">
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
