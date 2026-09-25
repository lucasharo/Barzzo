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
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { esquemaCriarClienteManual } from "@barzzo/validacoes";
import { formatarTelefone, limparTelefone } from "@barzzo/utilitarios";
import type { ClienteBarbearia } from "@barzzo/tipos";
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

export default function PaginaClientesCRM() {
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [clientes, setClientes] = React.useState<ClienteBarbearia[]>([]);
  const [busca, setBusca] = React.useState("");

  // Modal de Novo Cliente
  const [modalAberto, setModalAberto] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");
  const [novoTelefone, setNovoTelefone] = React.useState("");
  const [novoEmail, setNovoEmail] = React.useState("");

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

      // Buscar membro ativo para obter a barbearia do usuário
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
      await carregarClientes(membro.barbearia_id);
    } catch {
      setErro("Falha ao inicializar o CRM da barbearia.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarClientes(bId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const { data, error } = await (supabase.from("clientes_barbearia") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .order("nome", { ascending: true });

      if (error) {
        setErro("Não foi possível carregar a lista de clientes.");
        return;
      }

      setClientes((data || []) as ClienteBarbearia[]);
    } catch {
      setErro("Erro de comunicação ao carregar clientes.");
    }
  }

  async function cadastrarNovoCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!barbeariaId) return;

    const telefoneLimpo = limparTelefone(novoTelefone);
    const validacao = esquemaCriarClienteManual.safeParse({
      nome: novoNome.trim(),
      telefone: telefoneLimpo || null,
      email: novoEmail.trim() || null,
    });

    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "Dados inválidos");
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { data: novoCliente, error } = await (supabase.from("clientes_barbearia") as any)
        .insert({
          barbearia_id: barbeariaId,
          nome: novoNome.trim(),
          telefone: telefoneLimpo || null,
          email: novoEmail.trim() || null,
        })
        .select()
        .single();

      if (error) {
        setErro("Não foi possível cadastrar o cliente. Verifique se o telefone já não existe.");
        return;
      }

      setSucesso("Cliente cadastrado com sucesso no CRM!");
      setClientes((anteriores) => [...anteriores, novoCliente as ClienteBarbearia].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoNome("");
      setNovoTelefone("");
      setNovoEmail("");
      setModalAberto(false);
    } catch {
      setErro("Erro inesperado ao salvar cliente.");
    } finally {
      setSalvando(false);
    }
  }

  const clientesFiltrados = clientes.filter((c) => {
    const termo = busca.toLowerCase();
    const nomeMatch = c.nome.toLowerCase().includes(termo);
    const telMatch = c.telefone?.includes(termo);
    const emailMatch = c.email?.toLowerCase().includes(termo);
    return nomeMatch || telMatch || emailMatch;
  });

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando CRM de clientes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
            <Users className="w-7 h-7 text-[#B45A2B]" />
            Clientes da Barbearia
          </h1>
          <p className="text-sm opacity-70 mt-1">
            CRM com histórico, métricas de frequência e observações operacionais da equipe
          </p>
        </div>

        <Button
          onClick={() => setModalAberto(true)}
          className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px]"
        >
          <UserPlus className="w-4 h-4" />
          Novo Cliente
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

      {/* Barra de Busca e Filtro */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
        />
      </div>

      {/* Lista de Clientes */}
      {clientesFiltrados.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold mb-1">
            {busca ? "Nenhum cliente encontrado com este filtro" : "Nenhum cliente cadastrado ainda"}
          </h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto mb-5">
            {busca
              ? "Tente buscar por outro termo ou limpe o campo de pesquisa."
              : "Cadastre clientes manualmente ou aguarde os agendamentos online pelo marketplace."}
          </p>
          {!busca && (
            <Button
              onClick={() => setModalAberto(true)}
              className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Cadastrar Primeiro Cliente
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((c) => (
            <Card
              key={c.id}
              className="overflow-hidden hover:border-[#B45A2B]/40 transition-colors shadow-sm flex flex-col justify-between"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#B45A2B]/15 text-[#B45A2B] flex items-center justify-center font-bold text-sm shrink-0">
                    {c.nome[0].toUpperCase()}
                  </div>
                  <div className="truncate">
                    <h3 className="font-bold text-base truncate">{c.nome}</h3>
                    <span className="text-[11px] opacity-60 block">
                      Cliente desde{" "}
                      {new Date(c.created_at).toLocaleDateString("pt-BR", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs opacity-80 pt-1">
                  {c.telefone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#B45A2B]" />
                      <span>{formatarTelefone(c.telefone)}</span>
                    </div>
                  ) : (
                    <span className="text-neutral-400 italic block">Sem telefone informado</span>
                  )}

                  {c.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-[#B45A2B]" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex justify-end">
                <Link href={`/clientes/${c.id}`}>
                  <Button
                    variante="fantasma"
                    tamanho="sm"
                    className="text-xs font-semibold text-[#B45A2B] hover:bg-[#B45A2B]/10 min-h-[36px] gap-1"
                  >
                    Ver Ficha e Notas
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Cadastro de Cliente Manual */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setModalAberto(false)}
              className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-1">Novo Cliente</h3>
            <p className="text-xs opacity-60 mb-5">
              Adicione os dados cadastrais do cliente no CRM da barbearia.
            </p>

            <form onSubmit={cadastrarNovoCliente} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full text-sm p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full text-sm p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder="carlos@email.com"
                  className="w-full text-sm p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variante="secundario"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  carregando={salvando}
                  className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px]"
                >
                  Salvar Cliente
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
