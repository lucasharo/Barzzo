export interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  status_assinatura: "trial" | "ativo" | "inadimplente" | "cancelado";
  trial_inicio: string;
  trial_fim: string;
  onboarding_concluido: boolean;
  ativa: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface CriarBarbeariaDTO {
  nome: string;
  slug: string;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}
