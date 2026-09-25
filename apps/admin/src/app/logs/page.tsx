"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Alert,
  AlertDescription,
  LoadingSpinner,
  Button,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { formatarAcaoAuditoria } from "@barzzo/dominio";
import {
  Shield,
  Search,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";

export default function PaginaLogsAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [logs, setLogs] = React.useState<any[]>([]);
  const [busca, setBusca] = React.useState("");
  const [filtroEntidade, setFiltroEntidade] = React.useState<string>("todas");
  const [logSelecionado, setLogSelecionado] = React.useState<any | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  const carregarLogs = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { data, error: erroDb } = await (supabase.from("logs_auditoria") as any)
        .select(
          `
          id,
          usuario_id,
          barbearia_id,
          acao,
          entidade,
          entidade_id,
          dados_anteriores,
          dados_novos,
          ip,
          criado_em,
          usuarios ( nome, email ),
          barbearias ( nome, slug )
        `
        )
        .order("criado_em", { ascending: false })
        .limit(100);

      if (erroDb) throw erroDb;
      setLogs(data || []);
    } catch {
      setErro("Falha ao carregar trilha de auditoria.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  const logsFiltrados = logs.filter((log) => {
    const termo = busca.toLowerCase();
    const acaoFormatada = formatarAcaoAuditoria(log.acao).toLowerCase();
    const entidade = (log.entidade || "").toLowerCase();
    const usuarioNome = (log.usuarios?.nome || "").toLowerCase();
    const barbeariaNome = (log.barbearias?.nome || "").toLowerCase();

    const correspondeBusca =
      !termo ||
      acaoFormatada.includes(termo) ||
      entidade.includes(termo) ||
      usuarioNome.includes(termo) ||
      barbeariaNome.includes(termo) ||
      log.acao.toLowerCase().includes(termo);

    const correspondeEntidade =
      filtroEntidade === "todas" || log.entidade === filtroEntidade;

    return correspondeBusca && correspondeEntidade;
  });

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-[#B45A2B]" /> Trilha de Auditoria
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Registro cronológico inalterável de todas as ações administrativas sensíveis na plataforma.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={filtroEntidade}
            onChange={(e) => setFiltroEntidade(e.target.value)}
            className="w-full sm:w-auto h-11 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
          >
            <option value="todas">Todas as entidades</option>
            <option value="barbearias">Barbearias</option>
            <option value="assinaturas">Assinaturas</option>
            <option value="avaliacoes">Avaliações</option>
            <option value="usuarios">Usuários</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <Input
              placeholder="Buscar por ação, usuário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 text-xs min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Logs */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Data / Hora</th>
                  <th className="p-4">Ação</th>
                  <th className="p-4">Entidade</th>
                  <th className="p-4">Autor / Admin</th>
                  <th className="p-4">Barbearia Relacionada</th>
                  <th className="p-4 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando registros de auditoria...</span>
                    </td>
                  </tr>
                ) : logsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center opacity-60">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  logsFiltrados.map((log) => {
                    return (
                      <tr key={log.id} className="hover:bg-neutral-500/5">
                        <td className="p-4 whitespace-nowrap opacity-75 font-mono text-xs">
                          {new Date(log.criado_em).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#B45A2B]/10 text-[#B45A2B]">
                            <Shield className="h-3 w-3" />
                            {formatarAcaoAuditoria(log.acao)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold capitalize">{log.entidade}</span>
                          {log.entidade_id && (
                            <span className="block text-[11px] font-mono opacity-50 truncate max-w-[120px]">
                              {log.entidade_id}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {log.usuarios ? (
                            <div>
                              <strong className="block text-xs font-semibold">
                                {log.usuarios.nome}
                              </strong>
                              <span className="text-[11px] opacity-60">{log.usuarios.email}</span>
                            </div>
                          ) : (
                            <span className="text-xs opacity-50">Sistema / Automático</span>
                          )}
                        </td>
                        <td className="p-4">
                          {log.barbearias ? (
                            <div>
                              <strong className="block text-xs">{log.barbearias.nome}</strong>
                              <span className="text-[11px] opacity-50 font-mono">
                                /{log.barbearias.slug}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs opacity-50">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variante="secundario"
                            tamanho="sm"
                            onClick={() => setLogSelecionado(log)}
                            className="text-xs min-h-[36px]"
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" /> Inspecionar
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Inspeção do Registro de Auditoria */}
      {logSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#B45A2B]" /> Registro de Auditoria
                </CardTitle>
                <p className="text-xs opacity-60 mt-0.5">
                  ID: <span className="font-mono">{logSelecionado.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogSelecionado(null)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <span className="text-[11px] opacity-60 block">Ação</span>
                  <strong className="text-[#B45A2B] font-bold text-sm">
                    {formatarAcaoAuditoria(logSelecionado.acao)}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] opacity-60 block">Data e Hora</span>
                  <span className="font-mono">
                    {new Date(logSelecionado.criado_em).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] opacity-60 block">Entidade</span>
                  <span className="capitalize font-semibold">{logSelecionado.entidade}</span>
                  {logSelecionado.entidade_id && (
                    <span className="block font-mono text-[10px] opacity-50">
                      ID: {logSelecionado.entidade_id}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[11px] opacity-60 block">IP Registrado</span>
                  <span className="font-mono">{logSelecionado.ip || "Não registrado"}</span>
                </div>
              </div>

              {logSelecionado.dados_anteriores && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-400">
                    Estado Anterior
                  </span>
                  <pre className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-950 font-mono text-[11px] overflow-x-auto border border-neutral-200 dark:border-neutral-800">
                    {JSON.stringify(logSelecionado.dados_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {logSelecionado.dados_novos && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-400">
                    Estado Novo / Dados da Operação
                  </span>
                  <pre className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-950 font-mono text-[11px] overflow-x-auto border border-neutral-200 dark:border-neutral-800">
                    {JSON.stringify(logSelecionado.dados_novos, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variante="principal"
                  onClick={() => setLogSelecionado(null)}
                  className="min-h-[44px] text-xs font-bold"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
