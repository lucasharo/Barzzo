// packages/validacoes/src/agenda.ts
// Schemas Zod para criação e gestão de agendamentos.

import { z } from "zod";

export const esquemaServicoAgendamento = z.object({
  servico_id: z.string().uuid("ID de serviço inválido."),
  nome_servico: z.string().min(1, "Nome do serviço é obrigatório.").trim(),
  preco: z.coerce.number().min(0, "Preço não pode ser negativo."),
  duracao_minutos: z.coerce.number().int().min(1, "Duração mínima de 1 minuto.")
});

export const esquemaCriarAgendamentoManual = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  profissional_id: z.string().uuid("ID do profissional inválido."),
  cliente_nome: z.string({ required_error: "Nome do cliente é obrigatório." })
    .min(2, "Nome do cliente deve ter pelo menos 2 caracteres.")
    .max(100, "Nome do cliente deve ter no máximo 100 caracteres.")
    .trim(),
  cliente_telefone: z.string().max(20).optional().nullable(),
  cliente_email: z.string().email("E-mail do cliente inválido.").optional().nullable().or(z.literal("")),
  cliente_id: z.string().uuid().optional().nullable(),
  inicio_previsto: z.string().datetime({ message: "Data/hora de início inválida." }),
  fim_previsto: z.string().datetime({ message: "Data/hora de término inválida." }),
  observacoes: z.string().max(500, "Observações devem ter no máximo 500 caracteres.").optional().nullable(),
  servicos: z.array(esquemaServicoAgendamento).min(1, "Selecione pelo menos um serviço.")
}).refine((data) => new Date(data.inicio_previsto) < new Date(data.fim_previsto), {
  message: "Horário de início deve ser anterior ao término previsto.",
  path: ["fim_previsto"]
});

export type EntradaCriarAgendamentoManual = z.infer<typeof esquemaCriarAgendamentoManual>;

export const esquemaReagendamento = z.object({
  agendamento_id: z.string().uuid("ID do agendamento inválido."),
  novo_inicio: z.string().datetime({ message: "Novo horário de início inválido." }),
  novo_fim: z.string().datetime({ message: "Novo horário de término inválido." }),
  novo_profissional_id: z.string().uuid().optional().nullable()
}).refine((data) => new Date(data.novo_inicio) < new Date(data.novo_fim), {
  message: "Novo horário de início deve ser anterior ao término.",
  path: ["novo_fim"]
});

export type EntradaReagendamento = z.infer<typeof esquemaReagendamento>;

export const esquemaAtualizarStatusAgendamento = z.object({
  status: z.enum([
    "pendente",
    "confirmado",
    "em_atendimento",
    "concluido",
    "cancelado",
    "nao_compareceu"
  ], {
    errorMap: () => ({ message: "Status de agendamento inválido." })
  })
});

export type EntradaAtualizarStatusAgendamento = z.infer<typeof esquemaAtualizarStatusAgendamento>;
