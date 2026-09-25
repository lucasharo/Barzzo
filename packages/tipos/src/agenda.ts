// packages/tipos/src/agenda.ts
// Tipos para agendamentos, snapshots e operações da agenda do Barzzo.

export type StatusAgendamento =
  | "pendente"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "cancelado"
  | "nao_compareceu";

export type OrigemAgendamento = "parceiro" | "cliente" | "marketplace";

export interface AgendamentoServicoSnapshot {
  id: string;
  agendamento_id: string;
  servico_id: string | null;
  nome_servico: string;
  preco: number;
  duracao_minutos: number;
  criado_em: string;
}

export interface Agendamento {
  id: string;
  barbearia_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_email: string | null;
  profissional_id: string;
  inicio_previsto: string; // ISO timestamptz
  fim_previsto: string;    // ISO timestamptz
  inicio_real: string | null;
  fim_real: string | null;
  status: StatusAgendamento;
  observacoes: string | null;
  origem: OrigemAgendamento;
  preco_total: number;
  duracao_total_minutos: number;
  criado_em: string;
  atualizado_em: string;
}

export interface AgendamentoComDetalhes extends Agendamento {
  profissional_nome?: string;
  profissional_foto_url?: string | null;
  servicos?: AgendamentoServicoSnapshot[];
}

export interface CriarAgendamentoManualInput {
  barbearia_id: string;
  profissional_id: string; // UUID específico ou ID retornado pelo motor
  cliente_nome: string;
  cliente_telefone?: string | null;
  cliente_email?: string | null;
  cliente_id?: string | null;
  inicio_previsto: string;
  fim_previsto: string;
  observacoes?: string | null;
  servicos: {
    servico_id: string;
    nome_servico: string;
    preco: number;
    duracao_minutos: number;
  }[];
}

export interface ReagendarInput {
  agendamento_id: string;
  novo_inicio: string;
  novo_fim: string;
  novo_profissional_id?: string | null;
}
