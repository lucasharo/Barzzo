import { criarClienteSupabaseBrowser } from "@barzzo/supabase";

/** Unidade (barbearia) da qual o usuário é membro ativo, com o plano vigente da matriz. */
export interface UnidadeUsuario {
  id: string;
  nome: string;
  slug: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  matriz_id: string | null;
  papel: string;
  status_assinatura: string;
  plano: string | null;
  /** O plano da matriz inclui filiais (Growth ou Rede). */
  plano_permite_filiais: boolean;
  /** Filiais incluídas no plano; `null` = ilimitadas. */
  limite_filiais: number | null;
  /** Filiais já cadastradas na rede desta unidade. */
  total_filiais: number;
}

const CHAVE_UNIDADE = "barzzo:unidade-atual";

export function lerUnidadeSalva(): string | null {
  try {
    return localStorage.getItem(CHAVE_UNIDADE);
  } catch {
    return null;
  }
}

export function salvarUnidadeAtual(id: string) {
  try {
    localStorage.setItem(CHAVE_UNIDADE, id);
  } catch {
    // Sem armazenamento: a primeira unidade passa a valer.
  }
}

/** Troca a unidade em uso e recarrega a tela para que tudo seja lido da nova unidade. */
export function trocarUnidade(id: string, destino = "/painel") {
  salvarUnidadeAtual(id);
  window.location.assign(destino);
}

/**
 * Vínculo do usuário com a unidade em uso. Com várias unidades, vale a escolhida por último
 * (se o usuário ainda for membro dela); caso contrário, a mais antiga. Mantém o formato
 * `{ data, error }` das consultas do Supabase.
 */
export async function obterMembroAtual(
  supabase: any,
  usuarioId: string,
  colunas = "barbearia_id"
): Promise<{ data: any | null; error: any }> {
  const colunasComUnidade = colunas.includes("barbearia_id") ? colunas : `barbearia_id, ${colunas}`;
  const { data, error } = await supabase
    .from("membros_barbearia")
    .select(colunasComUnidade)
    .eq("usuario_id", usuarioId)
    .eq("ativo", true)
    .order("criado_em", { ascending: true });

  if (error || !data || data.length === 0) return { data: null, error: error ?? null };

  const salva = lerUnidadeSalva();
  const escolhido = data.find((membro: { barbearia_id: string }) => membro.barbearia_id === salva) ?? data[0];
  return { data: escolhido, error: null };
}

export async function obterUnidades(): Promise<UnidadeUsuario[]> {
  const supabase = criarClienteSupabaseBrowser();
  const { data, error } = await (supabase.rpc as any)("obter_unidades_do_usuario");
  if (error || !data) return [];
  return data as UnidadeUsuario[];
}

export function escolherUnidadeAtual(unidades: UnidadeUsuario[]): UnidadeUsuario | null {
  if (unidades.length === 0) return null;
  const salva = lerUnidadeSalva();
  return unidades.find((u) => u.id === salva) ?? unidades[0];
}

export interface SituacaoFiliais {
  /** Matriz da qual o usuário é dono, com assinatura ativa. */
  matriz: UnidadeUsuario | null;
  /** O plano da matriz inclui filiais (Growth: 1; Rede: ilimitadas). */
  permiteFiliais: boolean;
  /** O plano inclui filiais, mas todas já foram cadastradas. */
  limiteAtingido: boolean;
  podeCadastrar: boolean;
}

export function situacaoFiliais(unidades: UnidadeUsuario[]): SituacaoFiliais {
  const matriz =
    unidades.find((u) => u.matriz_id === null && u.papel === "dono" && u.status_assinatura === "ativo") ?? null;
  const permiteFiliais = !!matriz?.plano_permite_filiais;
  const limiteAtingido =
    permiteFiliais && matriz!.limite_filiais !== null && matriz!.total_filiais >= matriz!.limite_filiais;
  return { matriz, permiteFiliais, limiteAtingido, podeCadastrar: permiteFiliais && !limiteAtingido };
}

/** Matriz em que o usuário é dono e ainda pode cadastrar filiais pelo plano contratado. */
export function matrizQuePodeCadastrarFiliais(unidades: UnidadeUsuario[]): UnidadeUsuario | null {
  const situacao = situacaoFiliais(unidades);
  return situacao.podeCadastrar ? situacao.matriz : null;
}

export function rotuloLocalUnidade(unidade: Pick<UnidadeUsuario, "bairro" | "cidade" | "estado">): string {
  return [unidade.bairro, unidade.cidade && unidade.estado ? `${unidade.cidade} - ${unidade.estado}` : unidade.cidade]
    .filter(Boolean)
    .join(", ");
}
