// packages/validacoes/src/assinaturas.ts
// Schemas Zod para planos, assinaturas e benefícios de retenção.

import { z } from "zod";

export const esquemaPlano = z.object({
  identificador: z.enum(["solo", "pro", "growth", "rede"], {
    required_error: "Identificador de plano obrigatório.",
  }),
  nome: z.string().trim().min(2, "Nome do plano deve ter pelo menos 2 caracteres.").max(60),
  descricao: z.string().max(200).optional().nullable(),
  limite_profissionais: z.coerce.number().int().positive().optional().nullable(),
  preco_mensal: z.coerce.number().positive("O preço mensal deve ser maior que zero."),
  preco_semestral: z.coerce.number().positive("O preço semestral deve ser maior que zero."),
  ativo: z.boolean().default(true),
  ordem: z.coerce.number().int().default(0),
  recursos: z.array(z.string()).default([]),
});

export const esquemaBeneficioAssinatura = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  tipo: z.enum(["extensao_trial", "desconto", "dias_bonus"]),
  dias_concedidos: z.coerce
    .number()
    .int()
    .min(1, "A extensão deve ser de pelo menos 1 dia.")
    .max(180, "A extensão máxima permitida é de 180 dias."),
  motivo: z
    .string()
    .trim()
    .min(5, "O motivo deve conter pelo menos 5 caracteres.")
    .max(300, "O motivo deve ter no máximo 300 caracteres."),
});

export const esquemaCheckoutAssinatura = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  plano_id: z.string().uuid("ID do plano inválido."),
  ciclo: z.enum(["mensal", "semestral"], {
    required_error: "Selecione o ciclo de cobrança.",
  }),
});

export type EntradaPlano = z.infer<typeof esquemaPlano>;
export type EntradaBeneficioAssinatura = z.infer<typeof esquemaBeneficioAssinatura>;
export type EntradaCheckoutAssinatura = z.infer<typeof esquemaCheckoutAssinatura>;
