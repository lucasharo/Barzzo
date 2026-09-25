// packages/validacoes/src/marketplace.ts
// Schemas Zod para marketplace e rascunho de reserva pré-login.

import { z } from "zod";

const formatoData = /^\d{4}-\d{2}-\d{2}$/;
const formatoHora = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const esquemaRascunhoReserva = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  barbearia_nome: z.string().min(1, "Nome da barbearia é obrigatório."),
  barbearia_slug: z.string().min(1, "Slug da barbearia é obrigatório."),
  servico_id: z.string().uuid("ID do serviço inválido."),
  servico_nome: z.string().min(1, "Nome do serviço é obrigatório."),
  preco: z.coerce.number().min(0, "Preço do serviço não pode ser negativo."),
  duracao_minutos: z.coerce.number().int().min(1, "Duração mínima de 1 minuto."),
  profissional_id: z.string().uuid("ID do profissional inválido.").optional().nullable(),
  profissional_nome: z.string().optional().nullable(),
  data: z.string().regex(formatoData, "Formato de data inválido (AAAA-MM-DD)."),
  horario: z.string().regex(formatoHora, "Formato de horário inválido (HH:MM)."),
  observacoes: z.string().max(500).optional().nullable(),
  codigo_cupom: z.string().max(50).optional().nullable()
});

export type EntradaRascunhoReserva = z.infer<typeof esquemaRascunhoReserva>;
