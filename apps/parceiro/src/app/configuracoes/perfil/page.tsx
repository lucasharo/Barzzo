"use client";

import * as React from "react";
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
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Barbearia } from "@barzzo/tipos";
import { Store } from "lucide-react";

export default function PaginaConfiguracoesBarbearia() {
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);

  const [nome, setNome] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [documento, setDocumento] = React.useState("");
  const [endereco, setEndereco] = React.useState("");
  const [bairro, setBairro] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [estado, setEstado] = React.useState("SP");
  const [cep, setCep] = React.useState("");

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        const supabase = criarClienteSupabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const { data: membro } = await supabase
          .from("membros_barbearia")
          .select("barbearia_id, papel")
          .eq("usuario_id", session.user.id)
          .limit(1)
          .maybeSingle();

        if (membro?.barbearia_id) {
          const { data: bDb } = await supabase
            .from("barbearias")
            .select("*")
            .eq("id", membro.barbearia_id)
            .single();

          if (bDb) {
            const b = bDb as Barbearia;
            setBarbearia(b);
            setNome(b.nome);
            setTelefone(formatarTelefone(b.telefone || ""));
            setEmail(b.email || "");
            setDocumento(b.documento || "");
            setEndereco(b.endereco || "");
            setBairro(b.bairro || "");
            setCidade(b.cidade || "");
            setEstado(b.estado || "SP");
            setCep(b.cep || "");
          }
        }
      } catch {
        setErro("Falha ao carregar dados da barbearia.");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  const salvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbearia) return;

    setErro(null);
    setSucesso(null);

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { error: dbError } = await supabase
        .from("barbearias")
        .update({
          nome,
          telefone: limparTelefone(telefone) || null,
          email: email || null,
          documento: documento || null,
          endereco: endereco || null,
          bairro: bairro || null,
          cidade: cidade || null,
          estado: estado || null,
          cep: cep.replace(/\D/g, "") || null,
        })
        .eq("id", barbearia.id);

      if (dbError) {
        setErro(traduzirErro(dbError, "Erro ao salvar informações da barbearia."));
        return;
      }

      setSucesso("Informações da barbearia atualizadas com sucesso!");
    } catch {
      setErro("Falha ao atualizar dados.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando configurações...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <Alert variante="alerta">
        <AlertDescription>
          Nenhuma barbearia vinculada. Conclua o Onboarding primeiro.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full py-4 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6 text-[#B45A2B]" />
          Configurações da Barbearia
        </h1>
        <p className="text-sm opacity-70">
          Atualize os dados institucionais, endereço e contato do seu negócio.
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
          <CardTitle className="text-lg">Dados Institucionais</CardTitle>
          <CardDescription>
            Identificador público: <strong>barzzo.com/{barbearia.slug}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={salvarDados} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome" obrigatorio>
                Nome da Barbearia
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
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documento">CNPJ ou CPF</Label>
              <Input
                id="documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                <Label htmlFor="estado">UF</Label>
                <Input
                  id="estado"
                  maxLength={2}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="submit"
                variante="principal"
                tamanho="md"
                carregando={salvando}
              >
                Salvar Configurações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
