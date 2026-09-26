
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
  Avatar,
  LoadingSpinner,
} from "@barzzo/ui";
import { esquemaAtualizarPerfil } from "@barzzo/validacoes";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { redimensionarEComprimirImagem } from "@barzzo/imagens";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Usuario } from "@barzzo/tipos";
import { Camera, LogOut } from "lucide-react";

export default function PaginaPerfil() {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = React.useState<Usuario | null>(null);
  const [carregandoInicial, setCarregandoInicial] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [enviandoFoto, setEnviandoFoto] = React.useState(false);

  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [fotoUrl, setFotoUrl] = React.useState<string | null>(null);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  // Carregar dados da sessão e perfil
  React.useEffect(() => {
    async function carregarPerfil() {
      try {
        setCarregandoInicial(true);
        const supabase = criarClienteSupabaseBrowser();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate("/entrar");
          return;
        }

        // Buscar dados na tabela public.usuarios
        const { data: usuarioDb, error } = await (supabase.from("usuarios") as any)
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error || !usuarioDb) {
          // Fallback para metadados de autenticação
          setNome(session.user.user_metadata?.nome || "");
          setEmail(session.user.email || "");
          setTelefone(
            formatarTelefone(session.user.user_metadata?.telefone || "")
          );
          setFotoUrl(session.user.user_metadata?.foto_url || null);
        } else {
          setUsuario(usuarioDb as Usuario);
          setNome(usuarioDb.nome);
          setEmail(usuarioDb.email);
          setTelefone(formatarTelefone(usuarioDb.telefone || ""));
          setFotoUrl(usuarioDb.foto_url);
        }
      } catch (err) {
        setErro("Não foi possível carregar os dados do seu perfil.");
      } finally {
        setCarregandoInicial(false);
      }
    }

    carregarPerfil();
  }, [navigate]);

  const lidarComTelefone = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatarTelefone(e.target.value));
  };

  // Upload e redimensionamento da foto
  const lidarComMudancaFoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setSucesso(null);

    try {
      setEnviandoFoto(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      // Redimensionamento para máx 800x800 e compressão com Canvas
      const blobProcessado = await redimensionarEComprimirImagem(
        arquivo,
        800,
        0.85
      );

      const extensao = "webp";
      const caminho = `${session.user.id}/avatar_${Date.now()}.${extensao}`;

      // Upload no Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatares")
        .upload(caminho, blobProcessado, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        setErro(traduzirErro(uploadError, "Falha ao enviar imagem."));
        return;
      }

      // Obter URL pública do avatar
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatares").getPublicUrl(uploadData.path);

      // Atualizar no banco public.usuarios
      const { error: updateError } = await (supabase.from("usuarios") as any)
        .update({ foto_url: publicUrl })
        .eq("id", session.user.id);

      if (updateError) {
        setErro(traduzirErro(updateError, "Falha ao vincular imagem ao perfil."));
        return;
      }

      setFotoUrl(publicUrl);
      setSucesso("Foto de perfil atualizada com sucesso!");
    } catch (err: unknown) {
      setErro(traduzirErro(err, "Erro ao processar imagem para envio."));
    } finally {
      setEnviandoFoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };


  // Salvar alterações de nome e telefone
  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const telefoneLimpo = limparTelefone(telefone);

    // Validação com Zod
    const resultadoValidacao = esquemaAtualizarPerfil.safeParse({
      nome,
      telefone: telefoneLimpo ? telefoneLimpo : null,
      foto_url: fotoUrl,
    });

    if (!resultadoValidacao.success) {
      setErro(resultadoValidacao.error.errors[0]?.message || "Dados inválidos");
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      const { error: dbError } = await (supabase.from("usuarios") as any)
        .update({
          nome,
          telefone: telefoneLimpo || null,
        })
        .eq("id", session.user.id);

      if (dbError) {
        setErro(traduzirErro(dbError, "Erro ao atualizar perfil. Tente novamente."));
        return;
      }

      // Sincronizar metadados no auth
      await supabase.auth.updateUser({
        data: {
          nome,
          telefone: telefoneLimpo || null,
        },
      });

      setSucesso("Perfil atualizado com sucesso!");
    } catch {
      setErro("Ocorreu um erro ao salvar o perfil.");
    } finally {
      setSalvando(false);
    }
  };

  // Logout seguro
  const lidarComLogout = async () => {
    const supabase = criarClienteSupabaseBrowser();
    await supabase.auth.signOut();
    navigate("/entrar");
  };

  if (carregandoInicial) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando informações do perfil...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full py-8 px-4 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Meu Perfil</h1>
        <p className="text-sm opacity-70">
          Gerencie suas informações de conta e foto de perfil.
        </p>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      <Card camada="primaria">
        <CardHeader>
          <CardTitle className="text-lg">Foto de Perfil</CardTitle>
          <CardDescription>
            Envie uma foto recente. A imagem é validada e redimensionada
            automaticamente para até 800x800.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative inline-block">
            <Avatar
              src={fotoUrl}
              nome={nome}
              tamanho="xl"
              className="ring-2 ring-[#B45A2B]/40"
            />
            {enviandoFoto && (
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                <LoadingSpinner tamanho="md" className="text-white" />
              </div>
            )}
            {/* Ícone de câmera no canto inferior direito sobre a foto */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviandoFoto}
              aria-label="Alterar foto de perfil"
              title="Alterar foto de perfil"
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#B45A2B] hover:bg-[#C46632] text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#141416] transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1 text-center sm:text-left">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={lidarComMudancaFoto}
              className="hidden"
            />
            <p className="text-sm font-medium text-black dark:text-white">
              Toque no ícone da câmera para trocar sua foto
            </p>
            <span className="text-xs opacity-60">
              Formatos aceitos: JPG, PNG ou WebP. Máximo de 5MB.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card camada="primaria">
        <CardHeader>
          <CardTitle className="text-lg">Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarPerfil} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome" obrigatorio>
                Nome Completo
              </Label>
              <Input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={salvando}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="opacity-70 cursor-not-allowed"
              />
              <span className="text-xs opacity-60">
                O e-mail é o identificador da sua conta e não pode ser alterado diretamente.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={lidarComTelefone}
                disabled={salvando}
                maxLength={15}
              />
            </div>

            <Button
              type="submit"
              variante="principal"
              tamanho="md"
              carregando={salvando}
              className="mt-2 self-start"
            >
              Salvar Alterações
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Ações da Conta / Sair no final da tela */}
      <div className="pt-4 pb-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs opacity-60">
          Deseja encerrar sua sessão neste dispositivo?
        </span>
        <Button
          type="button"
          variante="cancelar-simples"
          tamanho="md"
          onClick={lidarComLogout}
          className="flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px]"
        >
          <LogOut className="h-4 w-4" />
          Sair da Conta
        </Button>
      </div>
    </div>
  );
}
