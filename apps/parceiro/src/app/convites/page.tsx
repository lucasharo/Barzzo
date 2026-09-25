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
import { esquemaCriarConvite } from "@barzzo/validacoes";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { ConviteProfissional, Profissional } from "@barzzo/tipos";
import { Mail, Send, Copy, Check, Clock, CheckCircle } from "lucide-react";

export default function PaginaConvites() {
  const [carregando, setCarregando] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [convites, setConvites] = React.useState<ConviteProfissional[]>([]);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);

  const [email, setEmail] = React.useState("");
  const [papel, setPapel] = React.useState<"gerente" | "profissional">("profissional");
  const [profissionalId, setProfissionalId] = React.useState<string>("");

  const [copiadoToken, setCopiadoToken] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const carregarDados = React.useCallback(async () => {
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

        const { data: profs } = await supabase
          .from("profissionais")
          .select("*")
          .eq("barbearia_id", membro.barbearia_id);

        const { data: convitesDb } = await supabase
          .from("convites_profissionais")
          .select("*, profissional:profissionais(*)")
          .eq("barbearia_id", membro.barbearia_id)
          .order("criado_em", { ascending: false });

        setProfissionais((profs as Profissional[]) || []);
        setConvites((convitesDb as unknown as ConviteProfissional[]) || []);

        if (profs && profs.length > 0) {
          setProfissionalId(profs[0].id);
        }
      }
    } catch {
      setErro("Falha ao carregar convites.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const lidarComEnviarConvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeariaId) return;

    setErro(null);
    setSucesso(null);

    const validacao = esquemaCriarConvite.safeParse({ email, papel });
    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "E-mail inválido");
      return;
    }

    try {
      setEnviando(true);
      const supabase = criarClienteSupabaseBrowser();

      let targetProfId = profissionalId;

      // Se nenhum profissional selecionado, cria o registro básico de profissional primeiro
      if (!targetProfId) {
        const nomeSugerido = email.split("@")[0];
        const { data: novoProf, error: errProf } = await supabase
          .from("profissionais")
          .insert({
            barbearia_id: barbeariaId,
            nome: nomeSugerido,
            email: email,
            ativo: true,
          })
          .select("id")
          .single();

        if (errProf || !novoProf) {
          setErro("Falha ao preparar perfil do profissional.");
          return;
        }
        targetProfId = novoProf.id;
      }

      // Gerar token de convite e data de expiração (7 dias)
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: errConvite } = await supabase
        .from("convites_profissionais")
        .insert({
          barbearia_id: barbeariaId,
          profissional_id: targetProfId,
          email,
          papel,
          token,
          status: "pendente",
          expira_em: expiraEm,
        });

      if (errConvite) {
        setErro(errConvite.message);
        return;
      }

      setSucesso(`Convite gerado para ${email}! O link expira em 7 dias.`);
      setEmail("");
      carregarDados();
    } catch {
      setErro("Erro ao gerar convite.");
    } finally {
      setEnviando(false);
    }
  };

  const copiarLinkConvite = (token: string) => {
    const link = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiadoToken(token);
    setTimeout(() => setCopiadoToken(null), 2500);
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando convites...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Convites de Equipe</h1>
        <p className="text-sm opacity-70">
          Envie convites por e-mail para que barbeiros e gerentes acessem a barbearia com suas próprias contas.
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

      {/* Formulário de Envio de Convite */}
      <Card camada="primaria">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#B45A2B]" />
            <CardTitle className="text-lg">Novo Convite</CardTitle>
          </div>
          <CardDescription>
            O convidado receberá um link com validade de 7 dias para vincular sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={lidarComEnviarConvite} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <Label htmlFor="emailConvite" obrigatorio>
                  E-mail do Membro
                </Label>
                <Input
                  id="emailConvite"
                  type="email"
                  placeholder="profissional@barbearia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="papelConvite" obrigatorio>
                  Função / Papel
                </Label>
                <select
                  id="papelConvite"
                  value={papel}
                  onChange={(e) =>
                    setPapel(e.target.value as "gerente" | "profissional")
                  }
                  className="flex h-11 w-full rounded-lg px-3 py-2 text-sm bg-[#F6F6F7] text-black border border-[#E5E5E8] dark:bg-[#1C1C1F] dark:text-white dark:border-[#252529] focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                >
                  <option value="profissional">Profissional (Barbeiro)</option>
                  <option value="gerente">Gerente Operacional</option>
                </select>
              </div>
            </div>

            {profissionais.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profAssociado">
                  Vincular a um profissional já cadastrado (opcional)
                </Label>
                <select
                  id="profAssociado"
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value)}
                  className="flex h-11 w-full rounded-lg px-3 py-2 text-sm bg-[#F6F6F7] text-black border border-[#E5E5E8] dark:bg-[#1C1C1F] dark:text-white dark:border-[#252529] focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                >
                  <option value="">Novo profissional a partir do e-mail</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.usuario_id ? "(Conta já vinculada)" : "(Sem conta)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="submit"
              variante="principal"
              tamanho="md"
              carregando={enviando}
              className="mt-2 self-start flex items-center gap-1.5"
            >
              <Send className="h-4 w-4" /> Gerar Convite
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Histórico e Links de Convites */}
      <Card camada="primaria">
        <CardHeader>
          <CardTitle className="text-lg">Convites Emitidos ({convites.length})</CardTitle>
          <CardDescription>
            Copie o link direto caso queira enviar pelo WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {convites.length === 0 ? (
            <p className="text-sm opacity-70 text-center py-6">
              Nenhum convite emitido até o momento.
            </p>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {convites.map((convite) => {
                const expirado = new Date(convite.expira_em) < new Date();
                const statusEfetivo =
                  convite.status === "pendente" && expirado ? "expirado" : convite.status;

                return (
                  <div
                    key={convite.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{convite.email}</span>
                        <span className="text-xs uppercase px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-bold">
                          {convite.papel}
                        </span>
                      </div>
                      <span className="text-xs opacity-60 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expira em: {new Date(convite.expira_em).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {statusEfetivo === "aceito" && (
                        <span className="text-xs text-[#16A34A] font-semibold flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Aceito
                        </span>
                      )}
                      {statusEfetivo === "expirado" && (
                        <span className="text-xs text-[#DC2626] font-semibold">
                          Expirado
                        </span>
                      )}
                      {statusEfetivo === "pendente" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copiarLinkConvite(convite.token)}
                          className="flex items-center gap-1 text-xs"
                        >
                          {copiadoToken === convite.token ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#16A34A]" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copiar Link
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
