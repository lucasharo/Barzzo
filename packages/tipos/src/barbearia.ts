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
  foto_capa_url?: string | null;
  /** Preenchido nas filiais: id da matriz cuja assinatura vale para a unidade. */
  matriz_id?: string | null;
  /** Aceita os cupons dos influenciadores do Barzzo e paga a comissão deles. */
  aceita_influenciadores_barzzo?: boolean;
  status_assinatura: "trial" | "ativa" | "ativo" | "vencida" | "inadimplente" | "suspensa" | "cancelada" | "cancelado";
  trial_inicio: string;
  trial_fim: string;
  onboarding_concluido: boolean;
  mercado_pago_customer_id?: string | null;
  mercado_pago_card_id?: string | null;
  mercado_pago_card_first_four?: string | null;
  mercado_pago_card_last_four?: string | null;
  mercado_pago_card_expiration?: string | null;
  mercado_pago_card_brand?: string | null;
  recorrencia_ativa?: boolean;
  cancelamento_agendado?: boolean;
  cancelado_em?: string | null;
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
