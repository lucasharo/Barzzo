
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
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import {
  esquemaProduto,
  calcularDimensoesRedimensionamento,
  validarArquivoMidia,
  gerarCaminhoStorage,
  DIMENSAO_MAXIMA_PRODUTO_PX,
} from "@barzzo/dominio";
import type { Produto } from "@barzzo/tipos";
import {
  Package,
  ChevronLeft,
  UploadCloud,
  X,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Star,
} from "lucide-react";

export default function PaginaFormularioProduto() {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id as string;
  const isNovo = id === "novo";

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = React.useState(false);

  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);

  // Campos do formulário
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [preco, setPreco] = React.useState<string>("");
  const [fotoUrl, setFotoUrl] = React.useState<string>("");
  const [ativo, setAtivo] = React.useState(true);
  const [destaque, setDestaque] = React.useState(false);
  const [ordem, setOrdem] = React.useState(0);

  // Estado do upload de foto
  const [arquivoBlob, setArquivoBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [processandoImagem, setProcessandoImagem] = React.useState(false);

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

      setBarbeariaId(membro.barbearia_id);

      if (!isNovo) {
        const { data: prodDb, error: erroProd } = await (supabase.from("produtos") as any)
          .select("*")
          .eq("id", id)
          .eq("barbearia_id", membro.barbearia_id)
          .single();

        if (erroProd || !prodDb) {
          setErro("Produto não encontrado ou você não tem permissão para editá-lo.");
          return;
        }

        const produto = prodDb as Produto;
        setNome(produto.nome);
        setDescricao(produto.descricao || "");
        setPreco(produto.preco.toString());
        setFotoUrl(produto.foto_url || "");
        setPreviewUrl(produto.foto_url || null);
        setAtivo(produto.ativo);
        setDestaque(produto.destaque);
        setOrdem(produto.ordem);
      }
    } catch {
      setErro("Falha ao carregar dados do produto.");
    } finally {
      setCarregando(false);
    }
  }

  async function processarArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validar formato e tamanho
    const validacao = validarArquivoMidia({
      tipo: file.type,
      tamanhoBytes: file.size,
    });

    if (!validacao.valido) {
      setErro(validacao.erro || "Arquivo de imagem inválido.");
      return;
    }

    try {
      setProcessandoImagem(true);
      setErro(null);

      // 2. Redimensionamento via Canvas mantendo aspecto
      const img = new Image();
      const tempUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao abrir imagem selecionada."));
        img.src = tempUrl;
      });

      const { largura, altura } = calcularDimensoesRedimensionamento(
        img.width,
        img.height,
        DIMENSAO_MAXIMA_PRODUTO_PX
      );

      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Não foi possível processar a imagem no navegador.");
      }

      ctx.drawImage(img, 0, 0, largura, altura);
      URL.revokeObjectURL(tempUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setErro("Falha ao compactar imagem.");
            setProcessandoImagem(false);
            return;
          }

          setArquivoBlob(blob);
          const localPreview = URL.createObjectURL(blob);
          setPreviewUrl(localPreview);
          setProcessandoImagem(false);
        },
        "image/webp",
        0.85
      );
    } catch (err: any) {
      setErro(traduzirErro(err, "Erro ao processar imagem."));
      setProcessandoImagem(false);
    }
  }

  function removerFoto() {
    setArquivoBlob(null);
    setPreviewUrl(null);
    setFotoUrl("");
  }

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    if (!barbeariaId) return;

    try {
      setSalvando(true);
      setErro(null);
      setSucesso(null);

      const precoNumerico = parseFloat(preco.replace(",", "."));
      if (isNaN(precoNumerico)) {
        setErro("Informe um preço válido.");
        setSalvando(false);
        return;
      }

      const dadosValidados = esquemaProduto.safeParse({
        nome: nome.trim(),
        descricao: descricao.trim() ? descricao.trim() : null,
        preco: precoNumerico,
        foto_url: fotoUrl || null,
        ativo,
        destaque,
        ordem: Number(ordem) || 0,
      });

      if (!dadosValidados.success) {
        setErro(dadosValidados.error.errors[0]?.message || "Dados inválidos.");
        setSalvando(false);
        return;
      }

      const supabase = criarClienteSupabaseBrowser();
      let urlFotoFinal = fotoUrl;

      // Se há um novo blob para upload
      if (arquivoBlob) {
        const caminhoStorage = gerarCaminhoStorage(barbeariaId, "produtos", "webp");
        const { error: erroUpload } = await supabase.storage
          .from("produtos")
          .upload(caminhoStorage, arquivoBlob, {
            contentType: "image/webp",
            upsert: true,
          });

        if (erroUpload) {
          setErro(traduzirErro(erroUpload, "Falha no upload da foto do produto. Tente novamente."));
          setSalvando(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("produtos")
          .getPublicUrl(caminhoStorage);

        urlFotoFinal = urlData.publicUrl;
      }

      const payload = {
        barbearia_id: barbeariaId,
        nome: dadosValidados.data.nome,
        descricao: dadosValidados.data.descricao,
        preco: dadosValidados.data.preco,
        foto_url: urlFotoFinal || null,
        ativo: dadosValidados.data.ativo,
        destaque: dadosValidados.data.destaque,
        ordem: dadosValidados.data.ordem,
        updated_at: new Date().toISOString(),
      };

      if (isNovo) {
        const { error: erroInsert } = await (supabase.from("produtos") as any).insert(payload);
        if (erroInsert) {
          setErro(traduzirErro(erroInsert, "Não foi possível cadastrar o produto."));
          setSalvando(false);
          return;
        }
      } else {
        const { error: erroUpdate } = await (supabase.from("produtos") as any)
          .update(payload)
          .eq("id", id)
          .eq("barbearia_id", barbeariaId);

        if (erroUpdate) {
          setErro(traduzirErro(erroUpdate, "Não foi possível atualizar o produto."));
          setSalvando(false);
          return;
        }
      }

      setSucesso("Produto salvo com sucesso!");
      setTimeout(() => {
        navigate("/produtos");
      }, 1000);
    } catch {
      setErro("Erro de comunicação ao salvar produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirProduto() {
    if (isNovo || !barbeariaId) return;

    try {
      setExcluindo(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await (supabase.from("produtos") as any)
        .delete()
        .eq("id", id)
        .eq("barbearia_id", barbeariaId);

      if (error) {
        setErro(traduzirErro(error, "Não foi possível excluir o produto. Tente novamente."));
        setExcluindo(false);
        return;
      }

      // Se tiver foto_url associada, tentar remover do storage
      if (fotoUrl && fotoUrl.includes("/produtos/")) {
        try {
          const partes = fotoUrl.split("/produtos/");
          if (partes[1]) {
            const caminho = `${barbeariaId}/produtos/${partes[1]}`;
            await supabase.storage.from("produtos").remove([caminho]);
          }
        } catch {
          // Exclusão no storage não bloqueia fluxo
        }
      }

      navigate("/produtos");
    } catch {
      setErro("Erro ao excluir produto.");
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando produto...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Voltar */}
      <div>
        <Link
          to="/produtos"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#B45A2B] transition-colors font-medium min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para Catálogo de Produtos
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2.5">
            <Package className="w-7 h-7 text-[#B45A2B]" />
            {isNovo ? "Novo Produto" : "Editar Produto"}
          </h1>
          <p className="text-sm opacity-70 mt-1">
            {isNovo
              ? "Cadastre um produto físico para venda no balcão da barbearia"
              : "Atualize os detalhes, preço e disponibilidade do item"}
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
                  onClick={excluirProduto}
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
        <form onSubmit={salvarProduto} className="space-y-6">
          {/* Upload de Foto */}
          <div>
            <Label className="block text-sm font-semibold mb-2">Foto do Produto</Label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-32 h-32 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden relative shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview do produto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-10 h-10 text-neutral-300 dark:text-neutral-700" />
                )}

                {processandoImagem && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <LoadingSpinner tamanho="sm" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#B45A2B] text-white hover:bg-[#C46632] transition-colors min-h-[44px]">
                    <UploadCloud className="w-4 h-4" />
                    <span>{previewUrl ? "Alterar Foto" : "Escolher Foto"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={processarArquivoSelecionado}
                      disabled={salvando || processandoImagem}
                    />
                  </label>

                  {previewUrl && (
                    <Button
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      onClick={removerFoto}
                      className="min-h-[44px] gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-[11px] opacity-60">
                  Formatos aceitos: JPG, PNG, WebP (máx. 5MB). A imagem será redimensionada e otimizada automaticamente (máx. 800x800px).
                </p>
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="nome" className="block text-sm font-semibold mb-1.5">
              Nome do Produto <span className="text-[#DC2626]">*</span>
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pomada Modeladora Matte Efeito Seco 100g"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="descricao" className="block text-sm font-semibold mb-1.5">
              Descrição (opcional)
            </Label>
            <textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre fixação, brilho, fragrância ou modo de uso..."
              rows={3}
              className="w-full text-sm p-3 rounded-lg border border-[#E5E5E8] dark:border-[#252529] bg-[#F6F6F7] dark:bg-[#1C1C1F] text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
            />
            <span className="text-[11px] opacity-50 block text-right mt-1">
              {descricao.length}/500 caracteres
            </span>
          </div>

          {/* Preço e Ordem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preco" className="block text-sm font-semibold mb-1.5">
                Preço de Venda (R$) <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                min="0"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="45.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="ordem" className="block text-sm font-semibold mb-1.5">
                Ordem de Exibição
              </Label>
              <Input
                id="ordem"
                type="number"
                min="0"
                value={ordem}
                onChange={(e) => setOrdem(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Checkboxes de Ativo e Destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors min-h-[44px]">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="w-4 h-4 rounded text-[#B45A2B] focus:ring-[#B45A2B]"
              />
              <div>
                <span className="text-sm font-bold block">Produto Ativo</span>
                <span className="text-xs opacity-60">Visível no catálogo para os clientes</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors min-h-[44px]">
              <input
                type="checkbox"
                checked={destaque}
                onChange={(e) => setDestaque(e.target.checked)}
                className="w-4 h-4 rounded text-[#B45A2B] focus:ring-[#B45A2B]"
              />
              <div className="flex items-center gap-1.5">
                <div>
                  <span className="text-sm font-bold flex items-center gap-1">
                    Destaque Especial
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  </span>
                  <span className="text-xs opacity-60">Prioridade no topo do catálogo</span>
                </div>
              </div>
            </label>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Link to="/produtos">
              <Button type="button" variante="secundario" className="min-h-[44px]">
                Cancelar
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={salvando || processandoImagem}
              carregando={salvando}
              className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px] px-6"
            >
              <Save className="w-4 h-4" />
              {isNovo ? "Cadastrar Produto" : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
