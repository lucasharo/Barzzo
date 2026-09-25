// packages/validacoes/src/crm.ts
// Schemas Zod para CRM de clientes, observações internas, favoritos e avaliações.

import { z } from "zod";

export const esquemaCriarClienteManual = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").max(100),
  telefone: z
    .string()
    .min(10, "Telefone deve ter DDD + número válido.")
    .max(20)
    .optional()
    .nullable(),
  email: z.string().email("E-mail com formato inválido.").optional().nullable().or(z.literal("")),
});

export const esquemaCriarObservacaoCliente = z.object({
  texto: z
    .string()
    .min(1, "A observação interna não pode ser vazia.")
    .max(1000, "A observação deve ter no máximo 1000 caracteres."),
});

export const esquemaCriarAvaliacao = z.object({
  agendamento_id: z.string().uuid("ID de agendamento inválido."),
  nota: z
    .coerce
    .number()
    .int("A nota deve ser um número inteiro.")
    .min(1, "A nota mínima é 1 estrela.")
    .max(5, "A nota máxima é 5 estrelas."),
  comentario: z
    .string()
    .max(1000, "O comentário deve ter no máximo 1000 caracteres.")
    .optional()
    .nullable(),
});

export const esquemaResponderAvaliacao = z.object({
  resposta_barbearia: z
    .string()
    .min(1, "A resposta não pode ser vazia.")
    .max(1000, "A resposta deve ter no máximo 1000 caracteres."),
});

export const esquemaAlternarFavorito = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
});

export type EntradaCriarClienteManual = z.infer<typeof esquemaCriarClienteManual>;
export type EntradaCriarObservacaoCliente = z.infer<typeof esquemaCriarObservacaoCliente>;
export type EntradaCriarAvaliacao = z.infer<typeof esquemaCriarAvaliacao>;
export type EntradaResponderAvaliacao = z.infer<typeof esquemaResponderAvaliacao>;
export type EntradaAlternarFavorito = z.infer<typeof esquemaAlternarFavorito>;
