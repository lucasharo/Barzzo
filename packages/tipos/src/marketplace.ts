// packages/tipos/src/marketplace.ts
// Tipos para busca, rascunho de reserva pré-login e marketplace do cliente.

export interface RascunhoReserva {
  barbearia_id: string;
  barbearia_nome: string;
  barbearia_slug: string;
  servico_id: string;
  servico_nome: string;
  preco: number;
  duracao_minutos: number;
  profissional_id: string | null; // null = qualquer profissional
  profissional_nome?: string | null;
  data: string; // "YYYY-MM-DD"
  horario: string; // "HH:MM"
  observacoes?: string | null;
  codigo_cupom?: string | null;
  valor_desconto?: number | null;
  preco_final?: number | null;
}

export interface BarbeariaMarketplace {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  distancia_km: number | null;
  total_servicos_ativos: number;
  total_profissionais_ativos: number;
}

export interface FiltrosBuscaMarketplace {
  termo?: string;
  cidade?: string;
  estado?: string;
  latitude?: number;
  longitude?: number;
  raio_km?: number;
}
