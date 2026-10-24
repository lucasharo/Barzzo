import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  InputMascarado,
  Label,
  LoadingSpinner,
  Modal,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { esquemaCriarBarbearia } from "@barzzo/validacoes";
import {
  buscarEnderecoPorCep,
  formatarCep,
  formatarTelefone,
  limparTelefone,
  traduzirErro,
} from "@barzzo/utilitarios";
import { Building2, CheckCircle2, MapPin, Plus, Store } from "lucide-react";
import {
  escolherUnidadeAtual,
  obterUnidades,
  situacaoFiliais,
  rotuloLocalUnidade,
  trocarUnidade,
  type UnidadeUsuario,
} from "../../lib/unidade-atual";

function gerarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function PaginaUnidades() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [unidades, setUnidades] = React.useState<UnidadeUsuario[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  const [modalAberto, setModalAberto] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erroModal, setErroModal] = React.useState<string | null>(null);
  const [nome, setNome] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [cep, setCep] = React.useState("");
  const [endereco, setEndereco] = React.useState("");
  const [numero, setNumero] = React.useState("");
  const [bairro, setBairro] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [estado, setEstado] = React.useState("SP");
  const [buscandoCep, setBuscandoCep] = React.useState(false);

  React.useEffect(() => {
    async function carregar() {
      try {
        const supabase = criarClienteSupabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navigate("/entrar");
          return;
        }
        setUnidades(await obterUnidades());
      } catch {
        setErro("Não foi possível carregar as unidades.");
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [navigate]);

  // Preenche rua, bairro, cidade e UF pelo CEP (BrasilAPI).
  React.useEffect(() => {
    const digitos = cep.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    const controle = new AbortController();
    setBuscandoCep(true);
    buscarEnderecoPorCep(digitos, controle.signal).then((resultado) => {
      if (controle.signal.aborted) return;
      setBuscandoCep(false);
      if (!resultado.ok) return;
      if (resultado.endereco.logradouro) setEndereco(resultado.endereco.logradouro);
      if (resultado.endereco.bairro) setBairro(resultado.endereco.bairro);
      if (resultado.endereco.cidade) setCidade(resultado.endereco.cidade);
      if (resultado.endereco.estado) setEstado(resultado.endereco.estado);
    });
    return () => controle.abort();
  }, [cep]);

  const atual = escolherUnidadeAtual(unidades);
  const { matriz, permiteFiliais, limiteAtingido, podeCadastrar } = situacaoFiliais(unidades);
  const nomeLimite = matriz?.limite_filiais === 1 ? "1 filial" : `${matriz?.limite_filiais} filiais`;

  function limparFormulario() {
    setNome("");
    setSlug("");
    setTelefone("");
    setCep("");
    setEndereco("");
    setNumero("");
    setBairro("");
    setCidade("");
    setEstado("SP");
    setErroModal(null);
  }

  async function cadastrarFilial(evento: React.FormEvent) {
    evento.preventDefault();
    if (!matriz || !podeCadastrar) return;
    setErroModal(null);

    const enderecoCompleto = [endereco.trim(), numero.trim()].filter(Boolean).join(", ");
    const validacao = esquemaCriarBarbearia.safeParse({
      nome,
      slug,
      telefone: limparTelefone(telefone) || undefined,
      endereco: enderecoCompleto,
      bairro,
      cidade,
      estado,
      cep: cep.replace(/\D/g, "") || undefined,
    });
    if (!validacao.success) {
      setErroModal(validacao.error.errors[0]?.message || "Verifique os dados informados.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();
      const { data: novaId, error } = await (supabase.rpc as any)("criar_filial", {
        p_matriz_id: matriz.id,
        p_nome: nome.trim(),
        p_slug: slug,
        p_telefone: limparTelefone(telefone) || null,
        p_email: null,
        p_endereco: enderecoCompleto || null,
        p_bairro: bairro || null,
        p_cidade: cidade || null,
        p_estado: estado || null,
        p_cep: cep.replace(/\D/g, "") || null,
      });

      if (error) {
        setErroModal(
          error.message?.includes("barbearias_slug_key")
            ? "Este identificador (slug) já está em uso por outra barbearia."
            : traduzirErro(error, "Não foi possível cadastrar a filial.")
        );
        return;
      }

      // A nova filial passa a ser a unidade em uso; falta configurar horários, serviços e equipe.
      trocarUnidade(novaId as string, "/painel");
    } catch {
      setErroModal("Erro inesperado ao cadastrar a filial.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando unidades...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Unidades da Rede</h1>
          <p className="text-sm opacity-70 mt-1">
            Gerencie a matriz e as filiais. Cada unidade tem a própria agenda, equipe, serviços e clientes.
          </p>
        </div>
        {permiteFiliais && (
          <Button
            variante="principal"
            tamanho="md"
            className="w-full sm:w-auto"
            disabled={!podeCadastrar}
            onClick={() => {
              limparFormulario();
              setModalAberto(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Nova filial
          </Button>
        )}
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {!permiteFiliais && (
        <Alert variante="info">
          <AlertDescription>
            O cadastro de filiais está disponível para o dono de uma barbearia nos planos Growth (matriz + 1 filial)
            e Rede (filiais ilimitadas), com assinatura ativa. As filiais ficam incluídas na assinatura da matriz.
          </AlertDescription>
        </Alert>
      )}

      {permiteFiliais && limiteAtingido && (
        <Alert variante="alerta">
          <AlertDescription>
            Seu plano {matriz?.plano === "growth" ? "Growth" : "atual"} inclui {nomeLimite}, e o limite já foi usado.
            Para cadastrar mais filiais, faça upgrade para o plano Rede (filiais ilimitadas) em Assinatura &amp; Plano.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3">
        {unidades.map((unidade) => {
          const emUso = atual?.id === unidade.id;
          const local = rotuloLocalUnidade(unidade);
          return (
            <Card key={unidade.id} camada="primaria" className={emUso ? "border-[#B45A2B]" : ""}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Store className="h-4 w-4 text-[#B45A2B] shrink-0" />
                    <span className="font-bold truncate">{unidade.nome}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20">
                      {unidade.matriz_id ? "Filial" : "Matriz"}
                    </span>
                    {emUso && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Em uso
                      </span>
                    )}
                  </div>
                  {local && (
                    <span className="inline-flex items-center gap-1 text-xs opacity-70">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {local}
                    </span>
                  )}
                </div>
                <Button
                  variante={emUso ? "fantasma" : "secundario"}
                  tamanho="md"
                  className="w-full sm:w-auto"
                  disabled={emUso}
                  onClick={() => trocarUnidade(unidade.id)}
                >
                  <Building2 className="h-4 w-4 mr-1.5" /> {emUso ? "Unidade em uso" : "Gerenciar esta unidade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal
        aberto={modalAberto}
        aoFechar={() => !salvando && setModalAberto(false)}
        titulo="Nova filial"
        descricao="Incluída na assinatura da matriz"
        posicao="centralizado"
        tamanho="lg"
      >
        <form onSubmit={cadastrarFilial} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filial-nome">Nome da filial</Label>
            <Input
              id="filial-nome"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setSlug(gerarSlug(e.target.value));
              }}
              placeholder="Ex.: Bandoleiros Centro"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filial-slug">Identificador (slug)</Label>
            <Input id="filial-slug" value={slug} onChange={(e) => setSlug(gerarSlug(e.target.value))} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filial-telefone">Telefone / WhatsApp</Label>
            <InputMascarado
              id="filial-telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={telefone}
              mascara={formatarTelefone}
              onChangeValor={setTelefone}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:w-1/2">
            <Label htmlFor="filial-cep">CEP</Label>
            <InputMascarado
              id="filial-cep"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={cep}
              mascara={formatarCep}
              onChangeValor={setCep}
            />
            <p className="text-xs opacity-70 min-h-4" role="status">
              {buscandoCep ? "Buscando endereço..." : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label htmlFor="filial-endereco">Endereço</Label>
              <Input id="filial-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filial-numero">Número</Label>
              <Input id="filial-numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filial-bairro">Bairro</Label>
              <Input id="filial-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filial-cidade">Cidade</Label>
              <Input id="filial-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="filial-uf">UF</Label>
              <Input
                id="filial-uf"
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {erroModal && (
            <div role="alert" className="rounded-lg border border-[#DC2626] bg-[#DC2626]/10 p-3 text-sm text-[#DC2626]">
              {erroModal}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variante="fantasma"
              tamanho="md"
              className="w-full border border-neutral-300 dark:border-neutral-700"
              disabled={salvando}
              onClick={() => setModalAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variante="principal" tamanho="md" className="w-full" carregando={salvando}>
              Cadastrar filial
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
