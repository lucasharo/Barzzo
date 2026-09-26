
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
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import {
  esquemaInfluenciador,
  gerarLinkInfluenciador,
} from "@barzzo/dominio";
import type {
  Influenciador,
  ComissaoInfluenciador,
  Barbearia,
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
} from "lucide-react";

export default function PaginaInfluenciadoresParceiro() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [influenciadores, setInfluenciadores] = React.useState<Influenciador[]>([]);
  const [comissoes, setComissoes] = React.useState<ComissaoInfluenciador[]>([]);

  // Modal Novo Influenciador
  const [modalAberto, setModalAberto] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [codigoRef, setCodigoRef] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [chavePix, setChavePix] = React.useState("");
  const [tipoComissao, setTipoComissao] = React.useState<"percentual" | "valor_fixo">("percentual");
  const [valorComissao, setValorComissao] = React.useState("10");

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

      // Buscar barbearia
      const { data: bDb } = await (supabase.from("barbearias") as any)
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) setBarbearia(bDb as Barbearia);

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

      // 2. Buscar comissões com join no influenciador
      const { data: comDb, error: erroCom } = await (supabase.from("comissoes_influenciadores") as any)
        .select(`
          *,
          influenciadores (
            nome,
            codigo_ref,
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

  async function cadastrarInfluenciador(e: React.FormEvent) {
    e.preventDefault();
    if (!barbearia) return;

    try {
      setSalvando(true);
      setErro(null);

      const dadosValidados = esquemaInfluenciador.safeParse({
        nome: nome.trim(),
        codigo_ref: codigoRef.trim().toUpperCase(),
        email: email.trim() ? email.trim() : null,
        telefone: telefone.trim() ? telefone.trim() : null,
        chave_pix: chavePix.trim() ? chavePix.trim() : null,
        tipo_comissao: tipoComissao,
        valor_comissao: parseFloat(valorComissao.replace(",", ".")) || 0,
        ativo: true,
      });

      if (!dadosValidados.success) {
        setErro(dadosValidados.error.errors[0]?.message || "Dados inválidos.");
        setSalvando(false);
        return;
      }

      const supabase = criarClienteSupabaseBrowser();
      const { data: novoInf, error: erroInsert } = await (supabase.from("influenciadores") as any)
        .insert({
          barbearia_id: barbearia.id,
          nome: dadosValidados.data.nome,
          codigo_ref: dadosValidados.data.codigo_ref,
          email: dadosValidados.data.email,
          telefone: dadosValidados.data.telefone,
          chave_pix: dadosValidados.data.chave_pix,
          tipo_comissao: dadosValidados.data.tipo_comissao,
          valor_comissao: dadosValidados.data.valor_comissao,
          ativo: true,
        })
        .select()
        .single();

      if (erroInsert || !novoInf) {
        if (erroInsert?.message?.includes("influenciadores_codigo_barbearia_unique")) {
          setErro("Já existe um influenciador com este código nesta barbearia.");
        } else {
          setErro(traduzirErro(erroInsert, "Erro ao cadastrar influenciador. Tente novamente."));
        }
        setSalvando(false);
        return;
      }

      setSucesso(`Influenciador ${dadosValidados.data.nome} cadastrado com sucesso!`);
      setInfluenciadores((ant) => [novoInf as Influenciador, ...ant]);
      fecharModal();
    } catch {
      setErro("Erro ao salvar influenciador.");
    } finally {
      setSalvando(false);
    }
  }

  function fecharModal() {
    setModalAberto(false);
    setNome("");
    setCodigoRef("");
    setEmail("");
    setTelefone("");
    setChavePix("");
    setTipoComissao("percentual");
    setValorComissao("10");
  }

  function copiarLink(inf: Influenciador) {
    if (!barbearia) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://barzzo.com.br";
    const link = gerarLinkInfluenciador(origin, barbearia.slug, inf.codigo_ref);

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
            Cadastre promotores locais, gere links rastreados e gerencie comissões por cortes concluídos
          </p>
        </div>

        <Button
          onClick={() => setModalAberto(true)}
          className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Novo Influenciador
        </Button>
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
              onClick={() => setModalAberto(true)}
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
                          CÓDIGO: {inf.codigo_ref}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20">
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

                      {inf.chave_pix && (
                        <p className="flex items-center gap-1.5 truncate">
                          <CreditCard className="w-3.5 h-3.5 text-[#B45A2B]" />
                          Pix: <span className="font-mono">{inf.chave_pix}</span>
                        </p>
                      )}

                      <p className="flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-[#B45A2B]" />
                        Cliques no link: {inf.cliques_rastreados}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800">
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
                    const dataFormatada = new Date(com.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <tr key={com.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                        <td className="py-3 px-4 font-medium">{dataFormatada}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold block">
                            {com.influenciadores?.nome || "Influenciador"}
                          </span>
                          <span className="text-[11px] opacity-60 font-mono">
                            {com.influenciadores?.codigo_ref}
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
                              Acertada em {new Date(com.paga_em || "").toLocaleDateString("pt-BR")}
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

      {/* Modal Novo Influenciador */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-[#111113] p-6 shadow-2xl border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#B45A2B]" />
                Novo Influenciador Parceiro
              </h2>
              <button
                type="button"
                onClick={fecharModal}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={cadastrarInfluenciador} className="space-y-4 pt-4">
              <div>
                <Label htmlFor="nomeInf" className="block text-sm font-semibold mb-1.5">
                  Nome do Influenciador / Promotor <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  id="nomeInf"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Barba VIP"
                  required
                />
              </div>

              <div>
                <Label htmlFor="codigoInf" className="block text-sm font-semibold mb-1.5">
                  Código de Rastreamento (Ref) <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  id="codigoInf"
                  value={codigoRef}
                  onChange={(e) => setCodigoRef(e.target.value.toUpperCase())}
                  placeholder="Ex: CARLOSVIP10"
                  className="font-mono uppercase font-bold"
                  required
                />
                <span className="text-[11px] opacity-60 mt-1 block">
                  Identificador usado no link de indicação: ?ref=CODIGO
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipoCom" className="block text-sm font-semibold mb-1.5">
                    Tipo de Comissão
                  </Label>
                  <select
                    id="tipoCom"
                    value={tipoComissao}
                    onChange={(e) => setTipoComissao(e.target.value as any)}
                    className="w-full h-11 px-3 rounded-lg border border-[#E5E5E8] dark:border-[#252529] bg-[#F6F6F7] dark:bg-[#1C1C1F] text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                  >
                    <option value="percentual">Percentual (%)</option>
                    <option value="valor_fixo">Fixo por corte (R$)</option>
                  </select>
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
                  <Input
                    id="telInf"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 98888-7777"
                  />
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
                  Cadastrar Parceiro
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
