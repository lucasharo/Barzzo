// packages/tipos/src/servicos.ts
// Tipos fundamentais para catálogo de serviços, jornadas e disponibilidade.

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const NOMES_DIAS_SEMANA: Record<DiaSemana, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado"
};

export const NOMES_CURTOS_DIAS_SEMANA: Record<DiaSemana, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb"
};

export interface Servico {
  id: string;
  barbearia_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_minutos: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  profissionais_ids?: string[];
}

export interface ProfissionalServico {
  profissional_id: string;
  servico_id: string;
  ativo: boolean;
  criado_em: string;
}

export interface HorarioBarbearia {
  id: string;
  barbearia_id: string;
  dia_semana: DiaSemana;
  hora_abertura: string; // formato "HH:MM" ou "HH:MM:SS"
  hora_fechamento: string;
  hora_inicio_almoco: string | null;
  hora_fim_almoco: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface JornadaProfissional {
  id: string;
  profissional_id: string;
  dia_semana: DiaSemana;
  hora_inicio: string;
  hora_fim: string;
  hora_inicio_pausa: string | null;
  hora_fim_pausa: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface BloqueioAgenda {
  id: string;
  barbearia_id: string;
  profissional_id: string | null;
  inicio: string; // ISO timestamptz
  fim: string;    // ISO timestamptz
  motivo: string;
  criado_em: string;
}

export interface SlotDisponivel {
  horario: string; // "09:00", "09:30", etc.
  duracao_minutos: number;
  profissional_id: string;
  profissional_nome: string;
}

export interface ParametrosBuscarDisponibilidade {
  barbearia_id: string;
  servico_id: string;
  data: string; // "YYYY-MM-DD"
  profissional_id?: string | null;
}
