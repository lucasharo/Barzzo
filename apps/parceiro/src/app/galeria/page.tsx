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
  Input,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  esquemaFotoGaleria,
  calcularDimensoesRedimensionamento,
  validarArquivoMidia,
  gerarCaminhoStorage,
  DIMENSAO_MAXIMA_GALERIA_PX,
} from "@barzzo/dominio";
import type { FotoGaleria } from "@barzzo/tipos";
import {
  Images,
  UploadCloud,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Eye,
  Camera,
} from "lucide-react";

export default function PaginaGaleriaParceiro() {
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(true);
  const [fotos, setFotos] = React.useState<FotoGaleria[]>([]);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);

  // Estado do modal / formulário de envio
  const [modalAberto, setModalAberto] = React.useState(false);
  const [titulo, setTitulo] = React.useState("");
  const [destaqueCapa, setDestaqueCapa] = React.useState(false);
  const [arquivoBlob, setArquivoBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [processando, setProcessando] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);

  // Ação em andamento
  const [definindoCapaId, setDefinindoCapaId] = React.useState<string | null>(null);
  const [excluindoId, setExcluindoId] = React.useState<string | null>(null);
  const [fotoParaExcluir, setFotoParaExcluir] = React.useState<FotoGaleria | null>(null);

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
      await carregarGaleria(membro.barbearia_id);
    } catch {
      setErro("Falha ao inicializar galeria.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarGaleria(bId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const { data, error } = await (supabase.from("galeria_fotos") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .order("destaque_capa", { ascending: false })
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        setErro("Não foi possível carregar as fotos da galeria.");
        return;
      }

      setFotos((data || []) as FotoGaleria[]);
    } catch {
      setErro("Erro de comunicação ao carregar galeria.");
    }
  }

  async function processarArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validar tipo e tamanho
    const validacao = validarArquivoMidia({
      tipo: file.type,
      tamanhoBytes: file.size,
    });

    if (!validacao.valido) {
      setErro(validacao.erro || "Arquivo de foto inválido.");
      return;
    }

    try {
      setProcessando(true);
      setErro(null);

      // 2. Redimensionamento via Canvas mantendo proporção (máx 1200x1200px)
      const img = new Image();
      const tempUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar imagem selecionada."));
        img.src = tempUrl;
      });

      const { largura, altura } = calcularDimensoesRedimensionamento(
        img.width,
        img.height,
        DIMENSAO_MAXIMA_GALERIA_PX
      );

      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Não foi possível processar a foto no navegador.");
      }

      ctx.drawImage(img, 0, 0, largura, altura);
      URL.revokeObjectURL(tempUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setErro("Falha ao compactar foto.");
            setProcessando(false);
            return;
          }

          setArquivoBlob(blob);
          const localPreview = URL.createObjectURL(blob);
          setPreviewUrl(localPreview);
          setProcessando(false);
        },
        "image/webp",
        0.85
      );
    } catch (err: any) {
      setErro(err?.message || "Erro ao processar arquivo de foto.");
      setProcessando(false);
    }
  }

  function fecharModal() {
    setModalAberto(false);
    setTitulo("");
    setDestaqueCapa(false);
    setArquivoBlob(null);
    setPreviewUrl(null);
    setProcessando(false);
    setEnviando(false);
  }

  async function salvarNovaFoto(e: React.FormEvent) {
    e.preventDefault();
    if (!barbeariaId || !arquivoBlob) {
      setErro("Selecione uma foto para enviar.");
      return;
    }

    try {
      setEnviando(true);
      setErro(null);
      setSucesso(null);

      const supabase = criarClienteSupabaseBrowser();

      // 1. Upload para o bucket galeria
      const caminhoStorage = gerarCaminhoStorage(barbeariaId, "galeria", "webp");
      const { error: erroUpload } = await supabase.storage
        .from("galeria")
        .upload(caminhoStorage, arquivoBlob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (erroUpload) {
        setErro("Falha no upload da foto: " + erroUpload.message);
        setEnviando(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("galeria")
        .getPublicUrl(caminhoStorage);

      const fotoUrlFinal = urlData.publicUrl;

      // 2. Se for destaque_capa, desmarcar capas anteriores
      if (destaqueCapa) {
        await (supabase.from("galeria_fotos") as any)
          .update({ destaque_capa: false })
          .eq("barbearia_id", barbeariaId);
      }

      // 3. Inserir registro na tabela galeria_fotos
      const { data: novaFotoDb, error: erroInsert } = await (supabase.from("galeria_fotos") as any)
        .insert({
          barbearia_id: barbeariaId,
          titulo: titulo.trim() ? titulo.trim() : null,
          foto_url: fotoUrlFinal,
          destaque_capa: destaqueCapa,
          ordem: destaqueCapa ? 0 : fotos.length + 1,
        })
        .select()
        .single();

      if (erroInsert || !novaFotoDb) {
        setErro("Não foi possível salvar o registro da foto: " + erroInsert?.message);
        setEnviando(false);
        return;
      }

      // Atualizar lista local
      if (destaqueCapa) {
        setFotos((ant) => [
          novaFotoDb as FotoGaleria,
          ...ant.map((f) => ({ ...f, destaque_capa: false })),
        ]);
      } else {
        setFotos((ant) => [...ant, novaFotoDb as FotoGaleria]);
      }

      setSucesso("Foto adicionada à galeria com sucesso!");
      fecharModal();
    } catch {
      setErro("Erro de comunicação ao enviar foto.");
    } finally {
      setEnviando(false);
    }
  }

  async function definirComoCapa(foto: FotoGaleria) {
    if (!barbeariaId) return;

    try {
      setDefinindoCapaId(foto.id);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      // Desmarcar todas da barbearia
      await (supabase.from("galeria_fotos") as any)
        .update({ destaque_capa: false })
        .eq("barbearia_id", barbeariaId);

      // Marcar a selecionada
      const { error } = await (supabase.from("galeria_fotos") as any)
        .update({ destaque_capa: true })
        .eq("id", foto.id);

      if (error) {
        setErro("Não foi possível definir esta foto como capa.");
        return;
      }

      setFotos((ant) =>
        ant.map((f) => ({
          ...f,
          destaque_capa: f.id === foto.id,
        }))
      );
      setSucesso("Foto definida como capa principal da barbearia!");
    } catch {
      setErro("Erro ao alterar foto de capa.");
    } finally {
      setDefinindoCapaId(null);
    }
  }

  async function confirmarRemocaoFoto() {
    if (!fotoParaExcluir || !barbeariaId) return;

    try {
      setExcluindoId(fotoParaExcluir.id);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await (supabase.from("galeria_fotos") as any)
        .delete()
        .eq("id", fotoParaExcluir.id)
        .eq("barbearia_id", barbeariaId);

      if (error) {
        setErro("Não foi possível excluir a foto: " + error.message);
        setExcluindoId(null);
        return;
      }

      // Tentar remover do storage
      if (fotoParaExcluir.foto_url.includes("/galeria/")) {
        try {
          const partes = fotoParaExcluir.foto_url.split("/galeria/");
          if (partes[1]) {
            const caminho = `${barbeariaId}/galeria/${partes[1]}`;
            await supabase.storage.from("galeria").remove([caminho]);
          }
        } catch {
          // Exclusão no storage não bloqueia
        }
      }

      setFotos((ant) => ant.filter((f) => f.id !== fotoParaExcluir.id));
      setSucesso("Foto removida da galeria.");
      setFotoParaExcluir(null);
    } catch {
      setErro("Erro ao excluir foto da galeria.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando galeria de fotos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
            <Images className="w-7 h-7 text-[#B45A2B]" />
            Galeria de Fotos
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Exiba fotos do ambiente da barbearia, equipe e cortes realizados para atrair novos clientes
          </p>
        </div>

        <Button
          onClick={() => setModalAberto(true)}
          className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Adicionar Foto
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

      {/* Grade de Fotos */}
      {fotos.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center mx-auto mb-3">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold mb-1">Sua galeria ainda está vazia</h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto mb-5">
            Adicione fotos dos melhores cortes, da decoração e da equipe para destacar a sua barbearia no marketplace.
          </p>
          <Button
            onClick={() => setModalAberto(true)}
            className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar Primeira Foto
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fotos.map((foto) => (
            <Card
              key={foto.id}
              className={`overflow-hidden group hover:border-[#B45A2B]/50 transition-all flex flex-col justify-between ${
                foto.destaque_capa ? "ring-2 ring-[#B45A2B]" : ""
              }`}
            >
              <div>
                {/* Imagem */}
                <div className="aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-900 relative overflow-hidden">
                  <img
                    src={foto.foto_url}
                    alt={foto.titulo || "Foto da barbearia"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {foto.destaque_capa && (
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#B45A2B] text-white flex items-center gap-1 shadow-md">
                      <Star className="w-3.5 h-3.5 fill-white" /> Foto de Capa
                    </span>
                  )}
                </div>

                {/* Legenda / Título */}
                <div className="p-3">
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 line-clamp-1">
                    {foto.titulo || "Sem legenda"}
                  </p>
                  <span className="text-[10px] opacity-50 block mt-0.5">
                    Postada em {new Date(foto.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="p-2.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between gap-2">
                {!foto.destaque_capa ? (
                  <Button
                    type="button"
                    variante="secundario"
                    tamanho="sm"
                    disabled={definindoCapaId === foto.id}
                    carregando={definindoCapaId === foto.id}
                    onClick={() => definirComoCapa(foto)}
                    className="text-xs min-h-[36px] gap-1 font-semibold"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    Definir Capa
                  </Button>
                ) : (
                  <span className="text-xs font-bold text-[#B45A2B] px-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Capa Atual
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setFotoParaExcluir(foto)}
                  className="p-2 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                  aria-label="Excluir foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Adicionar Foto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-[#111113] p-6 shadow-2xl border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#B45A2B]" />
                Nova Foto da Barbearia
              </h2>
              <button
                type="button"
                onClick={fecharModal}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarNovaFoto} className="space-y-4 pt-4">
              {/* Área de Seleção de Foto */}
              <div>
                <Label className="block text-sm font-semibold mb-2">Arquivo de Imagem</Label>
                <div className="w-full aspect-[16/9] rounded-xl bg-neutral-100 dark:bg-neutral-900 border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden relative">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Pré-visualização"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <Camera className="w-10 h-10 text-neutral-400 mb-2" />
                      <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Nenhuma imagem selecionada
                      </p>
                      <p className="text-[11px] opacity-60 mt-1">
                        Formatos: JPG, PNG ou WebP (máx. 5MB)
                      </p>
                    </div>
                  )}

                  {processando && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <LoadingSpinner tamanho="md" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 mt-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#B45A2B] text-white hover:bg-[#C46632] transition-colors min-h-[44px]">
                    <UploadCloud className="w-4 h-4" />
                    <span>{previewUrl ? "Trocar Imagem" : "Selecionar Imagem"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={processarArquivoSelecionado}
                      disabled={enviando || processando}
                    />
                  </label>

                  {previewUrl && (
                    <Button
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => {
                        setArquivoBlob(null);
                        setPreviewUrl(null);
                      }}
                      className="min-h-[44px] gap-1 text-xs text-red-600"
                    >
                      <X className="w-4 h-4" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>

              {/* Título / Legenda */}
              <div>
                <Label htmlFor="titulo" className="block text-sm font-semibold mb-1.5">
                  Título ou Legenda (opcional)
                </Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Corte Degradê Navalhado, Ambiente Lounge..."
                  maxLength={100}
                />
              </div>

              {/* Destaque de Capa */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors min-h-[44px]">
                <input
                  type="checkbox"
                  checked={destaqueCapa}
                  onChange={(e) => setDestaqueCapa(e.target.checked)}
                  className="w-4 h-4 rounded text-[#B45A2B] focus:ring-[#B45A2B]"
                />
                <div>
                  <span className="text-sm font-bold block flex items-center gap-1">
                    Definir como Foto de Capa
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  </span>
                  <span className="text-xs opacity-60">
                    Esta imagem será a imagem principal da barbearia no marketplace
                  </span>
                </div>
              </label>

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variante="secundario"
                  onClick={fecharModal}
                  disabled={enviando}
                  className="min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!arquivoBlob || enviando || processando}
                  carregando={enviando}
                  className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px] px-6"
                >
                  Salvar na Galeria
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {fotoParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white dark:bg-[#111113] p-6 shadow-2xl border-neutral-200 dark:border-neutral-800 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold mb-1">Excluir esta foto?</h3>
            <p className="text-xs opacity-60 mb-5">
              Esta ação removerá a imagem da sua galeria e do perfil público da barbearia. Não pode ser desfeita.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variante="secundario"
                disabled={excluindoId !== null}
                onClick={() => setFotoParaExcluir(null)}
                className="min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variante="cancelar-destrutivo"
                disabled={excluindoId !== null}
                carregando={excluindoId !== null}
                onClick={confirmarRemocaoFoto}
                className="min-h-[44px]"
              >
                Sim, Excluir
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
