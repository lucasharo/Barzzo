"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  Avatar,
  LoadingSpinner,
} from "@barzzo/ui";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Profissional } from "@barzzo/tipos";
import { ArrowLeft, UserCheck } from "lucide-react";

export default function PaginaDetalhesProfissional() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [profissional, setProfissional] = React.useState<Profissional | null>(null);

  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        const supabase = criarClienteSupabaseBrowser();
        const { data, error } = await supabase
          .from("profissionais")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) {
          setErro("Profissional não encontrado.");
          return;
        }

        const p = data as Profissional;
        setProfissional(p);
        setNome(p.nome);
        setEmail(p.email || "");
        setTelefone(formatarTelefone(p.telefone || ""));
        setBio(p.bio || "");
        setAtivo(p.ativo);
      } catch {
        setErro("Erro ao carregar dados do profissional.");
      } finally {
        setCarregando(false);
      }
    }

    if (id) carregar();
  }, [id]);

  const salvarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await supabase
        .from("profissionais")
        .update({
          nome,
          email: email || null,
          telefone: limparTelefone(telefone) || null,
          bio: bio || null,
          ativo,
        })
        .eq("id", id);

      if (error) {
        setErro(traduzirErro(error, "Não foi possível atualizar os dados do profissional."));
        return;
      }

      setSucesso("Profissional atualizado com sucesso!");
    } catch {
      setErro("Falha ao salvar alterações.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando dados do profissional...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full py-4 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/equipe">
            <Button variante="fantasma" tamanho="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Editar Profissional</h1>
        </div>

        <Link href={`/equipe/${id}/jornada`}>
          <Button variante="secundario" tamanho="sm">
            <UserCheck className="h-4 w-4 mr-1.5" /> Configurar Jornada Semanal
          </Button>
        </Link>
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
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar
            src={profissional?.foto_url}
            nome={profissional?.nome}
            tamanho="lg"
          />
          <div>
            <CardTitle>{profissional?.nome}</CardTitle>
            <CardDescription>
              {profissional?.usuario_id ? (
                <span className="text-xs text-[#16A34A] font-semibold flex items-center gap-1 mt-1">
                  <UserCheck className="h-3.5 w-3.5" /> Vinculado a uma conta Barzzo
                </span>
              ) : (
                <span className="text-xs opacity-75 mt-1 block">
                  Cadastrado sem conta vinculada
                </span>
              )}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={salvarAlteracoes} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome" obrigatorio>
                Nome
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bio">Biografia / Apresentação</Label>
              <Input
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="ativo"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B45A2B]"
              />
              <Label htmlFor="ativo" className="cursor-pointer">
                Profissional ativo para agendamentos
              </Label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                variante="fantasma"
                tamanho="sm"
                onClick={() => router.push("/equipe")}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variante="principal"
                tamanho="md"
                carregando={salvando}
              >
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
