
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { traduzirErro, formatarTelefone, formatarData } from "@barzzo/utilitarios";
import { obterUrlBaseAppCliente } from "../../utils/url-cliente";
import {
  esquemaInfluenciador,
  gerarLinkInfluenciador,
} from "@barzzo/dominio";
import type {
  Influenciador,
  ComissaoInfluenciador,
  Barbearia,
  Cupom,
} from "@barzzo/tipos";
import {
  Share2,
  Plus,
  Copy,
  Check,
  DollarSign,
  MousePointerClick,
  Scissors,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  UserCheck,
  TrendingUp,
  Phone,
  Pencil,
} from "lucide-react";

export default function PaginaInfluenciadoresParceiro() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [influenciadores, setInfluenciadores] = React.useState<Influenciador[]>([]);
  const [comissoes, setComissoes] = React.useState<ComissaoInfluenciador[]>([]);
  const [cupons, setCupons] = React.useState<Cupom[]>([]);
  const [aceitaBarzzo, setAceitaBarzzo] = React.useState(false);
  const [salvandoAceite, setSalvandoAceite] = React.useState(false);

  // Formulário de cadastro e edição
  const [modalAberto, setModalAberto] = React.useState(false);
  const [influenciadorEmEdicao, setInfluenciadorEmEdicao] = React.useState<Influenciador | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [chavePix, setChavePix] = React.useState("");
  const [tipoComissao, setTipoComissao] = React.useState<"percentual" | "valor_fixo">("percentual");
  const [valorComissao, setValorComissao] = React.useState("10");
  const [ativo, setAtivo] = React.useState(true);
  const [erroModal, setErroModal] = React.useState<string | null>(null);
  const gatilhoModalRef = React.useRef<HTMLButtonElement | null>(null);

  // Estado de cópia de link
  const [copiadoId, setCopiadoId] = React.useState<string | null>(null);

  // Ação de pagar comissão
  const [pagandoId, setPagandoId] = React.useState<string | null>(null);

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
        navigate("/entrar");
        return;
      }

      const { data: membro, error: erroMembro } = await obterMembroAtual(supabase, session.user.id, "barbearia_id");

      if (erroMembro || !membro) {
        setErro("Você não possui vínculo ativo com nenhuma barbearia.");
        return;
      }

      // Buscar barbearia
      const { data: bDb } = await (supabase.from("barbearias") as any)
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) {
        setBarbearia(bDb as Barbearia);
        setAceitaBarzzo(!!bDb.aceita_influenciadores_barzzo);
      }

      await carregarDados(membro.barbearia_id);
    } catch {
      setErro("Falha ao inicializar gestão de influenciadores.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarDados(bId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();

      // 1. Buscar influenciadores
      const { data: infDb, error: erroInf } = await (supabase.from("influenciadores") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .order("created_at", { ascending: false });

      if (erroInf) {
        setErro("Não foi possível carregar influenciadores.");
        return;
      }

      setInfluenciadores((infDb || []) as Influenciador[]);

      const { data: cuponsDb } = await (supabase.from("cupons") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .eq("ativo", true)
        .eq("origem", "INFLUENCIADOR")
        .order("created_at", { ascending: false });
      setCupons((cuponsDb || []) as Cupom[]);

      // 2. Buscar comissões com join no influenciador
      const { data: comDb, error: erroCom } = await (supabase.from("comissoes_influenciadores") as any)
        .select(`
          *,
          influenciadores (
            nome,
            chave_pix
          )
        `)
        .eq("barbearia_id", bId)
        .order("created_at", { ascending: false });

      if (!erroCom) {
        setComissoes((comDb || []) as ComissaoInfluenciador[]);
      }
    } catch {
      setErro("Erro de comunicação ao carregar dados.");
    }
  }

  async function salvarInfluenciador(e: React.FormEvent) {
    e.preventDefault();
    if (!barbearia) return;

    try {
      setSalvando(true);
      setErroModal(null);

      const dadosValidados = esquemaInfluenciador.safeParse({
        nome: nome.trim(),
        email: email.trim() ? email.trim() : null,
        telefone: telefone.trim() ? telefone.trim() : null,
        chave_pix: chavePix.trim() ? chavePix.trim() : null,
        tipo_comissao: tipoComissao,
        valor_comissao: parseFloat(valorComissao.replace(",", ".")) || 0,
        ativo,
      });

      if (!dadosValidados.success) {
        setErroModal(dadosValidados.error.errors[0]?.message || "Dados inválidos.");
        return;
      }

      const supabase = criarClienteSupabaseBrowser();
      const dados = {
        nome: dadosValidados.data.nome,
        email: dadosValidados.data.email,
        telefone: dadosValidados.data.telefone,
        chave_pix: dadosValidados.data.chave_pix,
        tipo_comissao: dadosValidados.data.tipo_comissao,
        valor_comissao: dadosValidados.data.valor_comissao,
        ativo: dadosValidados.data.ativo,
      };
      const { data: influenciadorSalvo, error: erroSalvar } = influenciadorEmEdicao
        ? await (supabase.from("influenciadores") as any)
            .update({ ...dados, updated_at: new Date().toISOString() })
            .eq("id", influenciadorEmEdicao.id)
            .eq("barbearia_id", barbearia.id)
            .select()
            .single()
        : await (supabase.from("influenciadores") as any)
            .insert({ ...dados, barbearia_id: barbearia.id })
            .select()
            .single();

      if (erroSalvar || !influenciadorSalvo) {
        setErroModal(traduzirErro(erroSalvar, "Não foi possível salvar o influenciador. Verifique o vínculo com a barbearia e tente novamente."));
        return;
      }

      if (influenciadorEmEdicao) {
        setInfluenciadores((ant) => ant.map((item) => item.id === influenciadorSalvo.id ? influenciadorSalvo as Influenciador : item));
        setComissoes((ant) => ant.map((item) => item.influenciador_id === influenciadorSalvo.id
          ? { ...item, influenciadores: { nome: influenciadorSalvo.nome, chave_pix: influenciadorSalvo.chave_pix } }
          : item));
        setSucesso(`Influenciador ${dadosValidados.data.nome} atualizado com sucesso!`);
      } else {
        setInfluenciadores((ant) => [influenciadorSalvo as Influenciador, ...ant]);
        setSucesso(`Influenciador ${dadosValidados.data.nome} cadastrado com sucesso!`);
      }
      fecharModal();
    } catch {
      setErroModal("Erro ao salvar influenciador. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAceiteBarzzo(valor: boolean) {
    if (!barbearia) return;
    try {
      setSalvandoAceite(true);
      const supabase = criarClienteSupabaseBrowser();
      const { error: erroAceite } = await (supabase.from("barbearias") as any)
        .update({ aceita_influenciadores_barzzo: valor })
        .eq("id", barbearia.id);

      if (erroAceite) {
        setErro(traduzirErro(erroAceite, "Não foi possível atualizar a adesão aos influenciadores do Barzzo."));
        return;
      }
      setAceitaBarzzo(valor);
      setSucesso(
        valor
          ? "Os cupons dos influenciadores do Barzzo agora valem na sua barbearia."
          : "Os cupons dos influenciadores do Barzzo foram desativados na sua barbearia."
      );
    } catch {
      setErro("Erro de conexão ao atualizar a adesão.");
    } finally {
      setSalvandoAceite(false);
    }
  }

  function fecharModal() {
    setModalAberto(false);
    requestAnimationFrame(() => gatilhoModalRef.current?.focus());
    setInfluenciadorEmEdicao(null);
    setErroModal(null);
    setNome("");
    setEmail("");
    setTelefone("");
    setChavePix("");
    setTipoComissao("percentual");
    setValorComissao("10");
    setAtivo(true);
  }

  function abrirNovoInfluenciador(evento: React.MouseEvent<HTMLButtonElement>) {
    gatilhoModalRef.current = evento.currentTarget;
    setModalAberto(true);
  }

  function editarInfluenciador(inf: Influenciador, evento: React.MouseEvent<HTMLButtonElement>) {
    gatilhoModalRef.current = evento.currentTarget;
    setInfluenciadorEmEdicao(inf);
    setNome(inf.nome);
    setEmail(inf.email || "");
    setTelefone(formatarTelefone(inf.telefone || ""));
    setChavePix(inf.chave_pix || "");
    setTipoComissao(inf.tipo_comissao);
    setValorComissao(String(inf.valor_comissao));
    setAtivo(inf.ativo);
    setErroModal(null);
    setModalAberto(true);
  }

  function copiarLink(inf: Influenciador) {
    if (!barbearia) return;
    if (!inf.ativo) {
      setErro("Ative o influenciador antes de divulgar seu cupom.");
      return;
    }
    const cupom = cupons.find((item) => item.influenciador_id === inf.id);
    if (!cupom) {
      setErro("Este influencer ainda não possui cupom ativo para divulgação. Crie um cupom associado antes de copiar o link.");
      return;
    }
    const link = gerarLinkInfluenciador(obterUrlBaseAppCliente(), barbearia.slug, cupom.codigo);

    navigator.clipboard.writeText(link);
    setCopiadoId(inf.id);
    setTimeout(() => setCopiadoId(null), 2500);
  }

  async function marcarComissaoComoPaga(comissaoId: string) {
    try {
      setPagandoId(comissaoId);
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await (supabase.from("comissoes_influenciadores") as any)
        .update({
          status: "paga",
          paga_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", comissaoId);

      if (error) {
        setErro("Não foi possível registrar o pagamento da comissão.");
        return;
      }

      setComissoes((ant) =>
        ant.map((c) =>
          c.id === comissaoId
            ? { ...c, status: "paga", paga_em: new Date().toISOString() }
            : c
        )
      );
      setSucesso("Comissão marcada como paga com sucesso!");
    } catch {
      setErro("Erro de conexão ao atualizar status.");
    } finally {
      setPagandoId(null);
    }
  }

  // Totais
  const totalComissoesPendentes = comissoes
    .filter((c) => c.status === "pendente")
    .reduce((acc, c) => acc + (c.valor_comissao || 0), 0);

  const totalComissoesPagas = comissoes
    .filter((c) => c.status === "paga")
    .reduce((acc, c) => acc + (c.valor_comissao || 0), 0);

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando influenciadores e comissões...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
            <Share2 className="w-7 h-7 text-[#B45A2B]" />
            Influenciadores e Comissões
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Cadastre promotores locais, associe cupons de benefício e gerencie comissões por atendimentos concluídos
          </p>
        </div>

        <Button
          onClick={abrirNovoInfluenciador}
          className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Novo Influenciador
        </Button>
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

      {/* Influenciadores do Barzzo */}
      <Card className="p-4 border-neutral-200 dark:border-neutral-800">
        <div className="flex items-start gap-3">
          <Switch
            marcado={aceitaBarzzo}
            aoMudar={alternarAceiteBarzzo}
            disabled={salvandoAceite}
            aria-label="Aceitar influenciadores do Barzzo"
          />
          <div className="space-y-1">
            <span className="text-sm font-bold block">Aceitar influenciadores do Barzzo</span>
            <p className="text-xs opacity-70 leading-relaxed">
              Os cupons dos influenciadores parceiros do Barzzo passam a valer na sua barbearia. O cliente ganha 15% no
              primeiro atendimento e 5% nos demais, e você paga a comissão do influenciador (5% por padrão) sobre cada
              atendimento concluído. Você pode desligar quando quiser; o que já foi agendado é mantido.
            </p>
            <p className="text-[11px] opacity-50">
              {aceitaBarzzo ? "Ativado: os cupons aprovados pelo Barzzo valem aqui." : "Desativado: esses cupons são recusados na sua barbearia."}
            </p>
          </div>
        </div>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Influenciadores Ativos</span>
          <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 block mt-1">
            {influenciadores.filter((i) => i.ativo).length}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">
            promotores com link ativo
          </span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Comissões a Pagar (Pendente)</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block mt-1">
            {totalComissoesPendentes.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">
            acertos pendentes com os parceiros
          </span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Comissões Já Acertadas</span>
          <span className="text-2xl font-black text-[#16A34A] block mt-1">
            {totalComissoesPagas.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">
            repasses efetuados diretamente
          </span>
        </Card>
      </div>

      {/* Grid de Influenciadores */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Influenciadores Cadastrados</h2>

        {influenciadores.length === 0 ? (
          <Card className="text-center py-12 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
            <UserCheck className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold">Nenhum influenciador cadastrado</h3>
            <p className="text-xs opacity-60 max-w-sm mx-auto mb-4">
              Cadastre parceiros para gerar links e comissões automáticas em cortes realizados.
            </p>
            <Button
              onClick={abrirNovoInfluenciador}
              className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Primeiro Parceiro
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {influenciadores.map((inf) => {
              const copiado = copiadoId === inf.id;

              return (
                <Card
                  key={inf.id}
                  className="p-5 flex flex-col justify-between hover:border-[#B45A2B]/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                          {inf.nome}
                        </h3>
                        <span className="font-mono text-xs font-bold text-[#B45A2B]">
                          CUPOM: {cupons.find((cupom) => cupom.influenciador_id === inf.id)?.codigo || "Nenhum cupom ativo"}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${inf.ativo ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20" : "bg-neutral-200 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700"}`}>
                        {inf.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="text-xs opacity-75 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#B45A2B]" />
                        Comissão:{" "}
                        <span className="font-bold">
                          {inf.tipo_comissao === "percentual"
                            ? `${inf.valor_comissao}%`
                            : inf.valor_comissao.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                        </span>
                      </p>

                      {inf.telefone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#B45A2B]" />
                          WhatsApp: <span>{formatarTelefone(inf.telefone)}</span>
                        </p>
                      )}

                      {inf.chave_pix && (
                        <p className="flex items-center gap-1.5 truncate">
                          <CreditCard className="w-3.5 h-3.5 text-[#B45A2B]" />
                          Pix: <span className="font-mono">{inf.chave_pix}</span>
                        </p>
                      )}

                      <p className="flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-[#B45A2B]" />
                        Divulgação por cupom; cliques legados: {inf.cliques_rastreados}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-2">
                    <Button
                      type="button"
                      variante="fantasma"
                      onClick={(evento) => editarInfluenciador(inf, evento)}
                      className="w-full min-h-[44px] gap-1.5 border border-[#B45A2B]/30"
                      aria-label={`Editar influenciador ${inf.nome}`}
                    >
                      <Pencil className="w-4 h-4" />
                      Editar Influenciador
                    </Button>
                    <Button
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => copiarLink(inf)}
                      className="w-full text-xs min-h-[40px] gap-1.5 font-semibold"
                    >
                      {copiado ? (
                        <>
                          <Check className="w-4 h-4 text-[#16A34A]" />
                          Link Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar Link de Divulgação
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Extrato de Comissões */}
      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-bold">Extrato de Comissões por Atendimento</h2>

        {comissoes.length === 0 ? (
          <Card className="text-center py-10 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
            <p className="text-xs opacity-50">
              Nenhuma comissão gerada ainda. As comissões são geradas automaticamente assim que um agendamento indicado é marcado como concluído.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden border-neutral-200 dark:border-neutral-800">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Influenciador</th>
                    <th className="py-3 px-4">Valor Atendimento</th>
                    <th className="py-3 px-4">Comissão Calculada</th>
                    <th className="py-3 px-4">Chave Pix</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {comissoes.map((com) => {
                    const dataFormatada = formatarData(com.created_at);

                    return (
                      <tr key={com.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                        <td className="py-3 px-4 font-medium">{dataFormatada}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold block">
                            {com.influenciadores?.nome || "Influenciador"}
                            {com.origem_cupom === "BARZZO_GLOBAL" && (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#B45A2B]/10 text-[#B45A2B] align-middle">
                                Barzzo
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] opacity-60 font-mono">
                            {com.codigo_cupom}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {com.valor_servicos.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#B45A2B]">
                          {com.valor_comissao.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="py-3 px-4 font-mono opacity-80">
                          {com.influenciadores?.chave_pix || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              com.status === "paga"
                                ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                                : com.status === "pendente"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-neutral-200 text-neutral-500"
                            }`}
                          >
                            {com.status === "paga"
                              ? "Paga"
                              : com.status === "pendente"
                              ? "Pendente"
                              : "Cancelada"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {com.status === "pendente" && (
                            <Button
                              type="button"
                              tamanho="sm"
                              disabled={pagandoId === com.id}
                              carregando={pagandoId === com.id}
                              onClick={() => marcarComissaoComoPaga(com.id)}
                              className="bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] min-h-[36px]"
                            >
                              Marcar como Paga
                            </Button>
                          )}
                          {com.status === "paga" && (
                            <span className="text-[11px] opacity-50">
                              Acertada em {formatarData(com.paga_em)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Cadastro e edição de influenciador */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-influenciador"
          onKeyDown={(evento) => {
            if (evento.key !== "Escape" || salvando) return;
            const alvo = evento.target;
            if (alvo instanceof HTMLElement && (
              alvo.closest('[aria-haspopup="listbox"][aria-expanded="true"]') || alvo.closest('[role="listbox"]')
            )) return;
            fecharModal();
          }}
        >
          <Card className="w-full max-w-lg bg-white dark:bg-[#111113] p-6 shadow-2xl border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <h2 id="titulo-modal-influenciador" className="text-lg font-bold flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#B45A2B]" />
                {influenciadorEmEdicao ? "Editar Influenciador" : "Novo Influenciador Parceiro"}
              </h2>
              <button
                type="button"
                onClick={fecharModal}
                disabled={salvando}
                aria-label="Fechar formulário de influenciador"
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarInfluenciador} className="space-y-4 pt-4">
              {erroModal && (
                <Alert variante="erro">
                  <AlertDescription>{erroModal}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="nomeInf" className="block text-sm font-semibold mb-1.5">
                  Nome do Influenciador / Promotor <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  id="nomeInf"
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Barba VIP"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipoCom" className="block text-sm font-semibold mb-1.5">
                    Tipo de Comissão
                  </Label>
                  <Seletor
                    id="tipoCom"
                    className="w-full"
                    valor={tipoComissao}
                    aoMudar={(val) => setTipoComissao(val as typeof tipoComissao)}
                    opcoes={[
                      { valor: "percentual", rotulo: "Percentual (%)" },
                      { valor: "valor_fixo", rotulo: "Fixo por corte (R$)" },
                    ]}
                  />
                </div>

                <div>
                  <Label htmlFor="taxaCom" className="block text-sm font-semibold mb-1.5">
                    Valor da Taxa ({tipoComissao === "percentual" ? "%" : "R$"}){" "}
                    <span className="text-[#DC2626]">*</span>
                  </Label>
                  <Input
                    id="taxaCom"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorComissao}
                    onChange={(e) => setValorComissao(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="chavePix" className="block text-sm font-semibold mb-1.5">
                  Chave Pix para Acerto Direto (opcional)
                </Label>
                <Input
                  id="chavePix"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emailInf" className="block text-sm font-semibold mb-1.5">
                    E-mail de Contato (opcional)
                  </Label>
                  <Input
                    id="emailInf"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parceiro@instagram.com"
                  />
                </div>

                <div>
                  <Label htmlFor="telInf" className="block text-sm font-semibold mb-1.5">
                    Telefone / WhatsApp (opcional)
                  </Label>
                  <InputMascarado
                    id="telInf"
                    value={telefone}
                    type="tel"
                    mascara={formatarTelefone}
                    onChangeValor={setTelefone}
                    placeholder="(11) 98888-7777"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 min-h-[44px]">
                <Switch marcado={ativo} aoMudar={setAtivo} disabled={salvando} aria-label="Influenciador ativo" />
                <div>
                  <span className="text-sm font-bold block">Influenciador Ativo</span>
                  <span className="text-xs opacity-60">{ativo ? "Disponível para novas atribuições por cupom" : "Sem novas atribuições; comissões anteriores são preservadas"}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variante="secundario"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  carregando={salvando}
                  className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px] px-6"
                >
                  {influenciadorEmEdicao ? "Salvar Alterações" : "Cadastrar Parceiro"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
