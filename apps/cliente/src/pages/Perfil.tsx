
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
import {
  formatarTelefone,
  limparTelefone,
  formatarCep,
  traduzirErro,
  geocodificarEndereco,
  salvarEnderecoBuscaSessao,
} from "@barzzo/utilitarios";
import { redimensionarEComprimirImagem } from "@barzzo/imagens";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Usuario } from "@barzzo/tipos";
import { Camera, LogOut, MapPin, Search } from "lucide-react";

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

  // Estados de Endereço do Cliente
  const [cep, setCep] = React.useState("");
  const [logradouro, setLogradouro] = React.useState("");
  const [numero, setNumero] = React.useState("");
  const [complemento, setComplemento] = React.useState("");
  const [bairro, setBairro] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [buscandoCep, setBuscandoCep] = React.useState(false);

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

        const meta = session.user.user_metadata || {};

        // Preencher dados de endereço a partir dos metadados da conta
        setCep(formatarCep(meta.cep || ""));
        setLogradouro(meta.logradouro || meta.endereco || "");
        setNumero(meta.numero || "");
        setComplemento(meta.complemento || "");
        setBairro(meta.bairro || "");
        setCidade(meta.cidade || "");
        setEstado(meta.estado || "");

        // Buscar dados na tabela public.usuarios
        const { data: usuarioDb, error } = await (supabase.from("usuarios") as any)
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error || !usuarioDb) {
          // Fallback para metadados de autenticação
          setNome(meta.nome || "");
          setEmail(session.user.email || "");
          setTelefone(formatarTelefone(meta.telefone || ""));
          setFotoUrl(meta.foto_url || null);
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


  // Busca de endereço automática via CEP
  const lidarComCep = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorFormatado = formatarCep(e.target.value);
    setCep(valorFormatado);

    const digitos = valorFormatado.replace(/\D/g, "");
    if (digitos.length === 8) {
      try {
        setBuscandoCep(true);
        const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
        if (res.ok) {
          const dados = await res.json();
          if (!dados.erro) {
            if (dados.logradouro) setLogradouro(dados.logradouro);
            if (dados.bairro) setBairro(dados.bairro);
            if (dados.localidade) setCidade(dados.localidade);
            if (dados.uf) setEstado(dados.uf);
          }
        }
      } catch {
        // Silencioso
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  // Salvar alterações de perfil e endereço
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

      // Geocodificar endereço do cliente para coordenadas precisas de busca
      const partesEndereco = [
        logradouro ? `${logradouro}${numero ? ", " + numero : ""}` : null,
        bairro || null,
        cidade && estado ? `${cidade} - ${estado}` : (cidade || estado || null),
      ].filter(Boolean);

      const enderecoCompletoFormatado = partesEndereco.join(", ");
      let coords: { lat: number; lng: number } | null = null;

      if (enderecoCompletoFormatado) {
        try {
          const resCoords = await geocodificarEndereco(
            partesEndereco.slice(0, 3).join(", ") || enderecoCompletoFormatado
          );
          if (resCoords) {
            coords = { lat: resCoords.lat, lng: resCoords.lng };
          }
        } catch {
          // Mantém null
        }
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

      // Sincronizar metadados no auth incluindo os campos de endereço
      await supabase.auth.updateUser({
        data: {
          nome,
          telefone: telefoneLimpo || null,
          cep: cep || null,
          logradouro: logradouro || null,
          endereco: logradouro || null,
          numero: numero || null,
          complemento: complemento || null,
          bairro: bairro || null,
          cidade: cidade || null,
          estado: estado || null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          endereco_completo: enderecoCompletoFormatado || null,
        },
      });

      // Atualizar endereço padrão na sessão de busca
      if (enderecoCompletoFormatado) {
        salvarEnderecoBuscaSessao({
          texto: enderecoCompletoFormatado,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          bairro: bairro || null,
          cidade: cidade || null,
          origem: "conta",
        });
      }

      setSucesso("Perfil e endereço salvos com sucesso!");
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
          Gerencie suas informações de conta, foto e endereço padrão de busca.
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

      <form onSubmit={salvarPerfil} className="flex flex-col gap-6">
        <Card camada="primaria">
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
          </CardContent>
        </Card>

        {/* Card de Endereço do Cliente */}
        <Card camada="primaria">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#B45A2B]" />
              <CardTitle className="text-lg">Meu Endereço</CardTitle>
            </div>
            <CardDescription>
              Seu endereço é utilizado automaticamente para encontrar as barbearias mais próximas de você no Barzzo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <Input
                    id="cep"
                    type="text"
                    placeholder="00000-000"
                    value={cep}
                    onChange={lidarComCep}
                    disabled={salvando}
                    maxLength={9}
                  />
                  {buscandoCep && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoadingSpinner tamanho="sm" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="logradouro">Rua / Logradouro</Label>
                <Input
                  id="logradouro"
                  type="text"
                  placeholder="Ex: Av. Paulista, Rua Augusta..."
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  disabled={salvando}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  type="text"
                  placeholder="123"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  disabled={salvando}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="complemento">Complemento (opcional)</Label>
                <Input
                  id="complemento"
                  type="text"
                  placeholder="Apto 42, Bloco B..."
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  disabled={salvando}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  type="text"
                  placeholder="Ex: Bela Vista"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  disabled={salvando}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  type="text"
                  placeholder="São Paulo"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  disabled={salvando}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="estado">Estado (UF)</Label>
                <Input
                  id="estado"
                  type="text"
                  placeholder="SP"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  disabled={salvando}
                  maxLength={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          variante="principal"
          tamanho="lg"
          carregando={salvando}
          className="self-start min-h-[44px]"
        >
          Salvar Alterações
        </Button>
      </form>

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
