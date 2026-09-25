"use client";

import * as React from "react";
import Link from "next/link";
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
import { esquemaCriarProfissional } from "@barzzo/validacoes";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Profissional, MembroBarbearia } from "@barzzo/tipos";
import { Users, UserPlus, Mail, Shield, UserCheck, Phone } from "lucide-react";

export default function PaginaEquipe() {
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [membros, setMembros] = React.useState<MembroBarbearia[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = React.useState(false);

  // Form novo profissional
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [bio, setBio] = React.useState("");

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const carregarEquipe = React.useCallback(async () => {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (membro?.barbearia_id) {
        setBarbeariaId(membro.barbearia_id);

        // Buscar profissionais
        const { data: profsDb } = await supabase
          .from("profissionais")
          .select("*")
          .eq("barbearia_id", membro.barbearia_id)
          .order("criado_em", { ascending: true });

        // Buscar membros
        const { data: membrosDb } = await supabase
          .from("membros_barbearia")
          .select("*, usuario:usuarios(*)")
          .eq("barbearia_id", membro.barbearia_id);

        setProfissionais((profsDb as Profissional[]) || []);
        setMembros((membrosDb as unknown as MembroBarbearia[]) || []);
      }
    } catch {
      setErro("Falha ao carregar lista da equipe.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarEquipe();
  }, [carregarEquipe]);

  const lidarComCriarProfissional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeariaId) return;

    setErro(null);
    setSucesso(null);

    const validacao = esquemaCriarProfissional.safeParse({
      nome,
      email: email || undefined,
      telefone: limparTelefone(telefone) || undefined,
      bio,
    });

    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "Dados inválidos");
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

      // Inserir profissional (suporta profissional sem conta, usuario_id = NULL)
      const { error: dbError } = await supabase.from("profissionais").insert({
        barbearia_id: barbeariaId,
        nome,
        email: email || null,
        telefone: limparTelefone(telefone) || null,
        bio: bio || null,
        ativo: true,
      });

      if (dbError) {
        setErro(traduzirErro(dbError, "Erro ao cadastrar profissional. Tente novamente."));
        return;
      }

      setSucesso("Profissional cadastrado com sucesso!");
      setNome("");
      setEmail("");
      setTelefone("");
      setBio("");
      setMostrarFormulario(false);
      carregarEquipe();
    } catch {
      setErro("Erro ao cadastrar profissional.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando equipe...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestão da Equipe</h1>
          <p className="text-sm opacity-70">
            Gerencie profissionais, funções e convites de membros para sua barbearia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/convites">
            <Button variante="secundario" tamanho="sm">
              <Mail className="h-4 w-4 mr-1.5" /> Convidar por E-mail
            </Button>
          </Link>
          <Button
            variante="principal"
            tamanho="sm"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            {mostrarFormulario ? "Fechar Formulário" : "Novo Profissional"}
          </Button>
        </div>
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

      {/* Formulário de Novo Profissional (sem conta obrigatória) */}
      {mostrarFormulario && (
        <Card camada="primaria" className="border-l-4 border-l-[#B45A2B]">
          <CardHeader>
            <CardTitle className="text-lg">Cadastrar Profissional</CardTitle>
            <CardDescription>
              O profissional pode ser cadastrado agora e começar a receber agendamentos. Posteriormente ele pode vincular sua conta via convite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={lidarComCriarProfissional} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nomeProfissional" obrigatorio>
                    Nome do Barbeiro / Profissional
                  </Label>
                  <Input
                    id="nomeProfissional"
                    type="text"
                    placeholder="Ex: Barbeiro Rafael"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emailProfissional">E-mail (opcional)</Label>
                  <Input
                    id="emailProfissional"
                    type="email"
                    placeholder="rafael@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telProfissional">Telefone / WhatsApp (opcional)</Label>
                  <Input
                    id="telProfissional"
                    type="tel"
                    placeholder="(11) 98888-7777"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bioProfissional">Apresentação / Especialidade</Label>
                  <Input
                    id="bioProfissional"
                    type="text"
                    placeholder="Especialista em degrade e barba na toalha quente"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => setMostrarFormulario(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variante="principal"
                  tamanho="md"
                  carregando={salvando}
                >
                  Salvar Profissional
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de Profissionais da Barbearia */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-[#B45A2B]" />
          Profissionais Atendentes ({profissionais.length})
        </h2>

        {profissionais.length === 0 ? (
          <Card camada="primaria" className="p-8 text-center">
            <p className="opacity-70 text-sm">
              Nenhum profissional cadastrado ainda. Clique em &quot;Novo Profissional&quot; acima para adicionar o primeiro membro à sua equipe.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profissionais.map((prof) => (
              <Card
                key={prof.id}
                camada="primaria"
                className="hover:border-[#B45A2B]/40 transition-colors"
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <Avatar
                    src={prof.foto_url}
                    nome={prof.nome}
                    tamanho="lg"
                    className="shrink-0"
                  />
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base truncate">{prof.nome}</h3>
                      {prof.usuario_id ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-semibold border border-[#16A34A]/20 flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> Conta ativa
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#EAB308]/10 text-[#EAB308] font-semibold border border-[#EAB308]/20">
                          Sem conta
                        </span>
                      )}
                    </div>

                    {prof.bio && (
                      <p className="text-xs opacity-75 line-clamp-2">{prof.bio}</p>
                    )}

                    {prof.telefone && (
                      <p className="text-xs opacity-60 flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" /> {formatarTelefone(prof.telefone)}
                      </p>
                    )}

                    <div className="pt-3 mt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <Link
                        href={`/equipe/${prof.id}`}
                        className="text-xs font-semibold text-[#B45A2B] hover:underline"
                      >
                        Ver detalhes / Editar
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Membros Administrativos (Dono / Gerentes) */}
      <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#2563EB]" />
          Membros com Acesso ao Painel ({membros.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {membros.map((membro) => {
            const coresPapel = {
              dono: "bg-[#B45A2B]/15 text-[#B45A2B] border-[#B45A2B]/30",
              gerente: "bg-[#2563EB]/15 text-[#2563EB] border-[#2563EB]/30",
              profissional: "bg-neutral-200 dark:bg-neutral-800 text-current",
            };

            return (
              <Card key={membro.id} camada="secundaria">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={membro.usuario?.foto_url}
                      nome={membro.usuario?.nome || "Membro"}
                      tamanho="md"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">
                        {membro.usuario?.nome || "Usuário"}
                      </span>
                      <span className="text-xs opacity-60">
                        {membro.usuario?.email || "E-mail não informado"}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded border ${
                      coresPapel[membro.papel]
                    }`}
                  >
                    {membro.papel}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
