// packages/tipos/src/crm.ts
// Tipos para CRM de clientes, observações internas confidenciais, favoritos e avaliações.

export interface ClienteBarbearia {
  id: string;
  barbearia_id: string;
  usuario_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObservacaoCliente {
  id: string;
  barbearia_id: string;
  cliente_barbearia_id: string;
  autor_id: string;
  autor_nome: string;
  texto: string;
  created_at: string;
  updated_at: string;
}

export interface FavoritoBarbearia {
  id: string;
  cliente_id: string;
  barbearia_id: string;
  created_at: string;
  barbearia?: {
    id: string;
    nome: string;
    slug: string;
    logo_url: string | null;
    endereco_bairro: string;
    endereco_cidade: string;
    telefone: string | null;
  };
}

export interface Avaliacao {
  id: string;
  barbearia_id: string;
  agendamento_id: string;
  cliente_id: string;
  cliente_nome: string;
  profissional_id: string | null;
  nota: number; // 1 a 5
  comentario: string | null;
  resposta_barbearia: string | null;
  respondido_em: string | null;
  respondido_por: string | null;
  created_at: string;
  updated_at: string;
  profissionais?: {
    nome: string;
  } | null;
}

export interface MetricasClienteCRM {
  total_agendamentos: number;
  concluidos: number;
  cancelados: number;
  no_shows: number;
  total_gasto_centavos: number;
  ultimo_atendimento: string | null;
  profissional_mais_frequente_nome: string | null;
}

export interface ResumoReputacaoBarbearia {
  media_nota: number;
  total_avaliacoes: number;
  distribuicao_estrelas: {
    estrela_5: number;
    estrela_4: number;
    estrela_3: number;
    estrela_2: number;
    estrela_1: number;
  };
}
