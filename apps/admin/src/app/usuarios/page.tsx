"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { Users, Search, Mail, Phone, Calendar } from "lucide-react";

export default function PaginaUsuariosAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [usuarios, setUsuarios] = React.useState<any[]>([]);
  const [busca, setBusca] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregarUsuarios() {
      try {
        setCarregando(true);
        setErro(null);
        const supabase = criarClienteSupabaseBrowser();

        const { data: uDb, error: erroDb } = await supabase
          .from("usuarios")
          .select("id, nome, email, telefone, criado_em")
          .order("criado_em", { ascending: false });

        if (erroDb) throw erroDb;
        setUsuarios(uDb || []);
      } catch {
        setErro("Não foi possível carregar as contas de usuários.");
      } finally {
        setCarregando(false);
      }
    }

    carregarUsuarios();
  }, []);

  const usuariosFiltrados = usuarios.filter((u) =>
    (u.nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(busca.toLowerCase()) ||
    (u.telefone || "").includes(busca)
  );

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Gestão de Usuários</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 font-bold">
              {usuarios.length} registros
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Contas de clientes, donos, gerentes e profissionais cadastrados no Barzzo.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs min-h-[44px]"
          />
        </div>
      </div>

      {/* Tabela de Usuários */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Nome</th>
                  <th className="p-4">E-mail</th>
                  <th className="p-4">Telefone</th>
                  <th className="p-4">Cadastrado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando usuários...</span>
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center opacity-60">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-500/5">
                      <td className="p-4 font-bold flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center font-bold text-xs">
                          {(u.nome || "BZ").slice(0, 2).toUpperCase()}
                        </div>
                        {u.nome || "Sem Nome"}
                      </td>
                      <td className="p-4 opacity-80">{u.email}</td>
                      <td className="p-4 opacity-80">{u.telefone || "Não cadastrado"}</td>
                      <td className="p-4 opacity-60">
                        {new Date(u.criado_em).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
