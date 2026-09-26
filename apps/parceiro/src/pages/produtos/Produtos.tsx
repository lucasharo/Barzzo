
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
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
import type { Produto } from "@barzzo/tipos";
import {
  Package,
  Plus,
  Search,
  Star,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShoppingBag,
} from "lucide-react";

export default function PaginaProdutosParceiro() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [produtos, setProdutos] = React.useState<Produto[]>([]);
  const [busca, setBusca] = React.useState("");
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [alternandoId, setAlternandoId] = React.useState<string | null>(null);

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
        navigate("/entrar");
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
      await carregarProdutos(membro.barbearia_id);
    } catch {
      setErro("Falha ao inicializar catálogo de produtos.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarProdutos(bId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const { data, error } = await (supabase.from("produtos") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      if (error) {
        setErro("Não foi possível carregar os produtos.");
        return;
      }

      setProdutos((data || []) as Produto[]);
    } catch {
      setErro("Erro de comunicação ao carregar catálogo.");
    }
  }

  async function alternarStatusAtivo(produto: Produto) {
    try {
      setAlternandoId(produto.id);
      const novoStatus = !produto.ativo;
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await (supabase.from("produtos") as any)
        .update({ ativo: novoStatus, updated_at: new Date().toISOString() })
        .eq("id", produto.id);

      if (error) {
        setErro("Não foi possível alterar a visibilidade do produto.");
        return;
      }

      setProdutos((ant) =>
        ant.map((p) => (p.id === produto.id ? { ...p, ativo: novoStatus } : p))
      );
      setSucesso(
        novoStatus
          ? `Produto "${produto.nome}" ativado no catálogo!`
          : `Produto "${produto.nome}" ocultado do catálogo.`
      );
    } catch {
      setErro("Erro de conexão ao atualizar produto.");
    } finally {
      setAlternandoId(null);
    }
  }

  const produtosFiltrados = produtos.filter((p) => {
    const termo = busca.toLowerCase();
    const nomeMatch = p.nome.toLowerCase().includes(termo);
    const descMatch = p.descricao?.toLowerCase().includes(termo);
    return nomeMatch || descMatch;
  });

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando catálogo de produtos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
            <Package className="w-7 h-7 text-[#B45A2B]" />
            Catálogo de Produtos
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Produtos físicos e cosméticos disponíveis para venda no balcão da barbearia
          </p>
        </div>

        <Link to="/produtos/novo">
          <Button className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px]">
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        </Link>
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

      {/* Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pomadas, balms, óleos, shampoos..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
        />
      </div>

      {/* Grid de Produtos */}
      {produtosFiltrados.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold mb-1">
            {busca ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
          </h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto mb-5">
            {busca
              ? "Tente buscar por outro termo ou limpe a pesquisa."
              : "Cadastre pomadas, óleos de barba, ceras e cosméticos para exibir aos clientes no marketplace."}
          </p>
          {!busca && (
            <Link to="/produtos/novo">
              <Button className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px]">
                <Plus className="w-4 h-4 mr-1.5" />
                Cadastrar Primeiro Produto
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {produtosFiltrados.map((prod) => (
            <Card
              key={prod.id}
              className={`overflow-hidden hover:border-[#B45A2B]/40 transition-all shadow-sm flex flex-col justify-between ${
                !prod.ativo ? "opacity-60 bg-neutral-50/50 dark:bg-neutral-900/40" : ""
              }`}
            >
              <div>
                {/* Imagem do Produto */}
                <div className="h-44 w-full bg-neutral-100 dark:bg-neutral-900 relative overflow-hidden flex items-center justify-center border-b border-neutral-100 dark:border-neutral-800">
                  {prod.foto_url ? (
                    <img
                      src={prod.foto_url}
                      alt={prod.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-700" />
                  )}

                  {prod.destaque && (
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-white" /> Destaque
                    </span>
                  )}

                  <span
                    className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-sm ${
                      prod.ativo
                        ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30 bg-white/90 dark:bg-black/80"
                        : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 border-neutral-300"
                    }`}
                  >
                    {prod.ativo ? "Disponível" : "Oculto"}
                  </span>
                </div>

                {/* Informações */}
                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 line-clamp-1">
                    {prod.nome}
                  </h3>
                  {prod.descricao && (
                    <p className="text-xs opacity-70 line-clamp-2 leading-relaxed">
                      {prod.descricao}
                    </p>
                  )}
                  <span className="text-base font-extrabold text-[#B45A2B] block pt-1">
                    {prod.preco.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => alternarStatusAtivo(prod)}
                  disabled={alternandoId === prod.id}
                  className="p-2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                  aria-label={prod.ativo ? "Ocultar produto" : "Ativar produto"}
                >
                  {prod.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <Link to={`/produtos/${prod.id}`}>
                  <Button
                    variante="secundario"
                    tamanho="sm"
                    className="text-xs min-h-[36px] gap-1 font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
