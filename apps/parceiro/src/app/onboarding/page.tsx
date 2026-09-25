"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
} from "@barzzo/ui";
import { esquemaCriarBarbearia } from "@barzzo/validacoes";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { CheckCircle2, Store, MapPin, Users, ArrowRight } from "lucide-react";

export default function PaginaOnboarding() {
  const router = useRouter();
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

      router.push("/painel");
    } catch {
      setErro("Falha ao concluir onboarding. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full py-4 flex flex-col gap-8">
      {/* Indicador de progresso */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">Onboarding da sua Barbearia</h1>
        <p className="text-sm opacity-70">
          Configure a sua barbearia para começar a gerenciar sua equipe e receber agendamentos.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-4">
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
