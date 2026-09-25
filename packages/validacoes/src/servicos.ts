// packages/validacoes/src/servicos.ts
// Schemas Zod para serviços, horários de funcionamento, jornadas e bloqueios.

import { z } from "zod";

const formatoHora = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export const esquemaServico = z.object({
  nome: z.string({ required_error: "Nome do serviço é obrigatório." })
    .min(2, "Nome deve ter no mínimo 2 caracteres.")
    .max(100, "Nome deve ter no máximo 100 caracteres.")
    .trim(),
  descricao: z.string().max(500, "Descrição deve ter no máximo 500 caracteres.").optional().nullable(),
  preco: z.coerce.number({ required_error: "Preço é obrigatório." })
    .min(0, "Preço não pode ser negativo."),
  duracao_minutos: z.coerce.number({ required_error: "Duração é obrigatória." })
    .int("Duração deve ser um número inteiro de minutos.")
    .min(5, "Duração mínima é de 5 minutos.")
    .max(480, "Duração máxima permitida é de 480 minutos (8 horas)."),
  ativo: z.boolean().default(true),
  profissionais_ids: z.array(z.string().uuid("ID de profissional inválido.")).optional().default([])
});

export type EntradaServico = z.infer<typeof esquemaServico>;

export const esquemaHorarioBarbearia = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora_abertura: z.string().regex(formatoHora, "Formato de hora de abertura inválido (HH:MM)."),
  hora_fechamento: z.string().regex(formatoHora, "Formato de hora de fechamento inválido (HH:MM)."),
  hora_inicio_almoco: z.string().regex(formatoHora, "Formato de início de almoço inválido.").optional().nullable(),
  hora_fim_almoco: z.string().regex(formatoHora, "Formato de término de almoço inválido.").optional().nullable(),
  ativo: z.boolean().default(true)
}).refine(data => data.hora_abertura < data.hora_fechamento, {
  message: "Hora de abertura deve ser anterior à hora de fechamento.",
  path: ["hora_fechamento"]
}).refine(data => {
  if (!data.hora_inicio_almoco && !data.hora_fim_almoco) return true;
  if (data.hora_inicio_almoco && data.hora_fim_almoco) {
    return (
      data.hora_inicio_almoco < data.hora_fim_almoco &&
      data.hora_inicio_almoco >= data.hora_abertura &&
      data.hora_fim_almoco <= data.hora_fechamento
    );
  }
  return false;
}, {
  message: "Horário de almoço deve ter início e término válidos dentro do expediente.",
  path: ["hora_fim_almoco"]
});

export type EntradaHorarioBarbearia = z.infer<typeof esquemaHorarioBarbearia>;

export const esquemaJornadaProfissional = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora_inicio: z.string().regex(formatoHora, "Formato de início inválido (HH:MM)."),
  hora_fim: z.string().regex(formatoHora, "Formato de término inválido (HH:MM)."),
  hora_inicio_pausa: z.string().regex(formatoHora, "Formato de início de pausa inválido.").optional().nullable(),
  hora_fim_pausa: z.string().regex(formatoHora, "Formato de término de pausa inválido.").optional().nullable(),
  ativo: z.boolean().default(true)
}).refine(data => data.hora_inicio < data.hora_fim, {
  message: "Hora de início da jornada deve ser anterior à hora de término.",
  path: ["hora_fim"]
}).refine(data => {
  if (!data.hora_inicio_pausa && !data.hora_fim_pausa) return true;
  if (data.hora_inicio_pausa && data.hora_fim_pausa) {
    return (
      data.hora_inicio_pausa < data.hora_fim_pausa &&
      data.hora_inicio_pausa >= data.hora_inicio &&
      data.hora_fim_pausa <= data.hora_fim
    );
  }
  return false;
}, {
  message: "Pausa da jornada deve ter início e término válidos dentro do expediente do profissional.",
  path: ["hora_fim_pausa"]
});

export type EntradaJornadaProfissional = z.infer<typeof esquemaJornadaProfissional>;

export const esquemaBloqueioAgenda = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  profissional_id: z.string().uuid("ID de profissional inválido.").optional().nullable(),
  inicio: z.string().datetime({ message: "Data/hora de início inválida." }),
  fim: z.string().datetime({ message: "Data/hora de término inválida." }),
  motivo: z.string({ required_error: "Motivo do bloqueio é obrigatório." })
    .min(3, "Motivo deve conter no mínimo 3 caracteres.")
    .max(200, "Motivo deve conter no máximo 200 caracteres.")
    .trim()
}).refine(data => new Date(data.inicio) < new Date(data.fim), {
  message: "Data de início deve ser anterior à data de término do bloqueio.",
  path: ["fim"]
});

export type EntradaBloqueioAgenda = z.infer<typeof esquemaBloqueioAgenda>;
