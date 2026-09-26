import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
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
  LoadingSpinner,
} from "@barzzo/ui";
import { esquemaCriarBarbearia } from "@barzzo/validacoes";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { CheckCircle2, Store, MapPin, Users, ArrowRight, LogIn, UserPlus } from "lucide-react";

export default function PaginaOnboarding() {
  const navigate = useNavigate();
  const [carregandoSessao, setCarregandoSessao] = React.useState(true);
  const [usuario, setUsuario] = React.useState<any>(null);
  const [barbeariaExistente, setBarbeariaExistente] = React.useState<any>(null);

  const [etapa, setEtapa] = React.useState<1 | 2 | 3>(1);
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Dados Etapa 1
  const [nome, setNome] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [documento, setDocumento] = React.useState("");

  // Dados Etapa 2
  const [telefone, setTelefone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [endereco, setEndereco] = React.useState("");
  const [bairro, setBairro] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [estado, setEstado] = React.useState("SP");
  const [cep, setCep] = React.useState("");

  // Dados Etapa 3 (Primeiro membro / profissional)
  const [primeiroProfissional, setPrimeiroProfissional] = React.useState("");

  React.useEffect(() => {
    async function verificarSessao() {
      try {
        setCarregandoSessao(true);
        const supabase = criarClienteSupabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUsuario(session.user);
          if (session.user.email && !email) {
            setEmail(session.user.email);
          }

          // Verificar se já possui barbearia vinculada
          const { data: membro } = await supabase
            .from("membros_barbearia")
            .select("barbearia_id, barbearias (id, nome, slug)")
            .eq("usuario_id", session.user.id)
            .limit(1)
            .maybeSingle();

          if (membro?.barbearias) {
            setBarbeariaExistente(membro.barbearias);
          }
        } else {
          setUsuario(null);
        }
      } catch {
        // Silencioso
      } finally {
        setCarregandoSessao(false);
      }
    }

    verificarSessao();
  }, []);

  const gerarSlugAutomatico = (valorNome: string) => {
    setNome(valorNome);
    const slugLimpo = valorNome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    setSlug(slugLimpo);
  };

  const avancarParaEtapa2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || nome.length < 2) {
      setErro("Informe o nome da sua barbearia (mínimo 2 caracteres).");
      return;
    }
    if (!slug.trim()) {
      setErro("Defina um identificador (slug) exclusivo.");
      return;
    }
    setEtapa(2);
  };

  const avancarParaEtapa3 = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const validacao = esquemaCriarBarbearia.safeParse({
      nome,
      slug,
      telefone: limparTelefone(telefone) || undefined,
      email: email || undefined,
      endereco,
      bairro,
      cidade,
      estado,
      cep: cep.replace(/\D/g, "") || undefined,
    });

    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "Verifique os dados informados.");
      return;
    }

    setEtapa(3);
  };

  const finalizarOnboarding = async () => {
    setErro(null);
    setCarregando(true);

    try {
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErro("Você precisa estar autenticado para criar a barbearia.");
        return;
      }

      // Executar RPC atômica: cria a barbearia, inicializa o trial de 30 dias e adiciona o usuário como dono
      const { data: barbeariaId, error: rpcError } = await supabase.rpc(
        "criar_barbearia_com_dono",
        {
          p_nome: nome,
          p_slug: slug,
          p_telefone: limparTelefone(telefone) || null,
          p_email: email || null,
          p_endereco: endereco || null,
          p_bairro: bairro || null,
          p_cidade: cidade || null,
          p_estado: estado || null,
          p_cep: cep.replace(/\D/g, "") || null,
        }
      );

      if (rpcError) {
        if (rpcError.message.includes("barbearias_slug_key")) {
          setErro("Este identificador (slug) já está em uso por outra barbearia.");
        } else {
          setErro(traduzirErro(rpcError, "Não foi possível concluir o cadastro da barbearia."));
        }
        return;
      }

      // Se informou primeiro profissional, cadastrar na tabela de profissionais
      if (primeiroProfissional.trim() && barbeariaId) {
        await supabase.from("profissionais").insert({
          barbearia_id: barbeariaId,
          nome: primeiroProfissional.trim(),
          ativo: true,
        });
      }

      // Concluir onboarding
      await supabase
        .from("barbearias")
        .update({ onboarding_concluido: true })
        .eq("id", barbeariaId);

      navigate("/painel");
    } catch {
      setErro("Falha ao concluir onboarding. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  if (carregandoSessao) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Verificando credenciais de parceiro...</p>
      </div>
    );
  }

  // Se o usuário NÃO está logado, orienta para login ou cadastro antes de preencher o formulário
  if (!usuario) {
    return (
      <div className="flex-1 max-w-xl mx-auto w-full py-12 flex flex-col items-center text-center gap-6">
        <Store className="h-16 w-16 text-[#B45A2B]" />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Cadastre sua Barbearia no Barzzo
          </h1>
          <p className="text-sm opacity-75 max-w-md mx-auto">
            Para ativar seu <strong>trial gratuito de 30 dias</strong> e vincular sua barbearia com segurança, você precisa estar conectado à sua conta de parceiro.
          </p>
        </div>

        <div className="w-full flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to="/entrar?retorno=/onboarding" className="w-full sm:w-auto">
            <Button variante="principal" tamanho="lg" className="w-full gap-2 min-h-[48px]">
              <LogIn className="h-5 w-5" /> Já tenho conta (Entrar)
            </Button>
          </Link>
          <Link to="/cadastro?retorno=/onboarding" className="w-full sm:w-auto">
            <Button variante="secundario" tamanho="lg" className="w-full gap-2 min-h-[48px]">
              <UserPlus className="h-5 w-5" /> Criar conta grátis
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-4 text-left">
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <span className="font-bold text-xs text-[#B45A2B] block">30 Dias Grátis</span>
            <span className="text-[11px] opacity-70">Acesso completo sem necessidade de cartão de crédito.</span>
          </div>
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <span className="font-bold text-xs text-[#B45A2B] block">Gestão da Equipe</span>
            <span className="text-[11px] opacity-70">Agendas individuais, serviços e comissões automáticas.</span>
          </div>
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <span className="font-bold text-xs text-[#B45A2B] block">Sem Complicação</span>
            <span className="text-[11px] opacity-70">Seus clientes agendam direto pelo app sem login inicial.</span>
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário já possui uma barbearia cadastrada
  if (barbeariaExistente && etapa === 1 && !nome) {
    return (
      <div className="flex-1 max-w-lg mx-auto w-full py-12 flex flex-col items-center text-center gap-6">
        <Store className="h-14 w-14 text-[#B45A2B]" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Barbearia já cadastrada</h1>
          <p className="text-sm opacity-70">
            Sua conta já é proprietária da barbearia <strong>{barbeariaExistente.nome}</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Link to="/painel" className="w-full sm:w-auto">
            <Button variante="principal" tamanho="lg" className="w-full">
              Ir para o Painel Geral
            </Button>
          </Link>
          <Button
            variante="secundario"
            tamanho="lg"
            className="w-full sm:w-auto"
            onClick={() => setBarbeariaExistente(null)}
          >
            Cadastrar outra unidade
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full py-4 flex flex-col gap-8">
      {/* Indicador de progresso */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Onboarding da sua Barbearia</h1>
          <span className="text-xs px-2.5 py-1 rounded bg-[#B45A2B]/10 text-[#B45A2B] font-semibold">
            Passo {etapa} de 3
          </span>
        </div>
        <p className="text-sm opacity-70">
          Configure a sua barbearia para começar a gerenciar sua equipe e receber agendamentos.
        </p>

        {usuario && (
          <div className="text-xs opacity-75 mt-1">
            Conectado como: <strong>{usuario.email}</strong>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div
            className={`h-2 rounded-full transition-all ${
              etapa >= 1 ? "bg-[#B45A2B]" : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              etapa >= 2 ? "bg-[#B45A2B]" : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              etapa >= 3 ? "bg-[#B45A2B]" : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          />
        </div>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Etapa 1: Dados Institucionais */}
      {etapa === 1 && (
        <Card camada="primaria">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[#B45A2B]" />
              <CardTitle className="text-xl">Passo 1: Identificação</CardTitle>
            </div>
            <CardDescription>
              Defina o nome de exibição e o link amigável da barbearia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={avancarParaEtapa2} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome" obrigatorio>
                  Nome da Barbearia
                </Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Ex: Barbearia do Mestre"
                  value={nome}
                  onChange={(e) => gerarSlugAutomatico(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slug" obrigatorio>
                  Identificador / URL Amigável
                </Label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="opacity-60">barzzo.com/</span>
                  <Input
                    id="slug"
                    type="text"
                    placeholder="barbearia-do-mestre"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                  />
                </div>
                <span className="text-xs opacity-60">
                  Apenas letras minúsculas, números e hífens.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="documento">CNPJ ou CPF (opcional)</Label>
                <Input
                  id="documento"
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                variante="principal"
                tamanho="md"
                className="mt-2 self-end"
              >
                Próximo: Endereço & Contato <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Etapa 2: Endereço & Contato */}
      {etapa === 2 && (
        <Card camada="primaria">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#B45A2B]" />
              <CardTitle className="text-xl">Passo 2: Localização e Contato</CardTitle>
            </div>
            <CardDescription>
              Informações para os clientes encontrarem sua barbearia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={avancarParaEtapa3} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">E-mail de Contato</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@barbearia.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Input
                  id="endereco"
                  type="text"
                  placeholder="Rua Augusta, 1500"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    type="text"
                    placeholder="Consolação"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    type="text"
                    placeholder="São Paulo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <Label htmlFor="estado">UF</Label>
                  <Input
                    id="estado"
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => setEtapa(1)}
                >
                  Voltar
                </Button>
                <Button type="submit" variante="principal" tamanho="md">
                  Próximo: Equipe <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Etapa 3: Equipe Inicial & Conclusão */}
      {etapa === 3 && (
        <Card camada="primaria">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#B45A2B]" />
              <CardTitle className="text-xl">Passo 3: Equipe e Trial</CardTitle>
            </div>
            <CardDescription>
              Cadastre o primeiro profissional da sua equipe. Você pode convidar mais barbeiros a qualquer momento.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="p-4 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#16A34A] shrink-0 mt-0.5" />
              <div className="flex flex-col text-sm">
                <span className="font-semibold text-[#16A34A]">Trial Gratuito de 30 Dias Ativado</span>
                <span className="opacity-80">
                  Sua barbearia recebe 30 dias de acesso completo sem necessidade de cartão de crédito.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primeiroProfissional">
                Primeiro Barbeiro / Profissional (opcional)
              </Label>
              <Input
                id="primeiroProfissional"
                type="text"
                placeholder="Ex: Barbeiro Marcos (ou você mesmo)"
                value={primeiroProfissional}
                onChange={(e) => setPrimeiroProfissional(e.target.value)}
              />
              <span className="text-xs opacity-60">
                Pode ser cadastrado antes mesmo de ter uma conta no Barzzo.
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variante="fantasma"
                tamanho="sm"
                onClick={() => setEtapa(2)}
                disabled={carregando}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variante="principal"
                tamanho="md"
                carregando={carregando}
                onClick={finalizarOnboarding}
              >
                Concluir e Abrir Painel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
