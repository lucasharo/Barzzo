// packages/validacoes/src/campanhas.ts
// Schemas Zod para campanhas promocionais, cupons e influenciadores.

import { z } from "zod";

export const esquemaCampanha = z
  .object({
    nome: z.string().min(2, "Nome da campanha deve ter pelo menos 2 caracteres.").max(100),
    descricao: z.string().max(500, "Descrição deve ter no máximo 500 caracteres.").optional().nullable(),
    data_inicio: z.string().min(1, "Data de início é obrigatória."),
    data_fim: z.string().min(1, "Data de término é obrigatória."),
    ativa: z.boolean().default(true),
  })
  .refine(
    (dados) => {
      const inicio = new Date(dados.data_inicio).getTime();
      const fim = new Date(dados.data_fim).getTime();
      return !isNaN(inicio) && !isNaN(fim) && inicio <= fim;
    },
    {
      message: "Data de início não pode ser posterior à data de término.",
      path: ["data_fim"],
    }
  );

export const esquemaCupom = z
  .object({
    campanha_id: z.string().uuid("ID da campanha inválido.").optional().nullable(),
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Código do cupom deve ter pelo menos 2 caracteres.")
      .max(30, "Código do cupom deve ter no máximo 30 caracteres.")
      .regex(
        /^[A-Z0-9_-]+$/,
        "Código deve conter apenas letras maiúsculas, números, hífens ou sublinhados."
      ),
    descricao: z.string().max(200, "Descrição deve ter no máximo 200 caracteres.").optional().nullable(),
    tipo_desconto: z.enum(["percentual", "valor_fixo"], {
      required_error: "Selecione o tipo de desconto.",
    }),
    valor_desconto: z.coerce.number().positive("Valor do desconto deve ser maior que zero."),
    valor_minimo_reserva: z.coerce.number().min(0, "Valor mínimo não pode ser negativo.").default(0),
    limite_usos_total: z.coerce
      .number()
      .int()
      .positive("Limite total deve ser um número positivo.")
      .optional()
      .nullable(),
    limite_usos_por_cliente: z.coerce
      .number()
      .int()
      .min(1, "Limite por cliente deve ser de pelo menos 1.")
      .default(1),
    apenas_primeira_reserva: z.boolean().default(false),
    servicos_elegiveis: z.array(z.string().uuid()).default([]),
    data_inicio: z.string().min(1, "Data de início é obrigatória."),
    data_fim: z.string().min(1, "Data de término é obrigatória."),
    ativo: z.boolean().default(true),
  })
  .refine(
    (dados) => {
      const inicio = new Date(dados.data_inicio).getTime();
      const fim = new Date(dados.data_fim).getTime();
      return !isNaN(inicio) && !isNaN(fim) && inicio <= fim;
    },
    {
      message: "Data de início não pode ser posterior à data de término.",
      path: ["data_fim"],
    }
  )
  .refine(
    (dados) => {
      if (dados.tipo_desconto === "percentual") {
        return dados.valor_desconto <= 100;
      }
      return true;
    },
    {
      message: "Desconto percentual não pode ultrapassar 100%.",
      path: ["valor_desconto"],
    }
  );

export const esquemaInfluenciador = z.object({
  nome: z.string().min(2, "Nome do influenciador deve ter pelo menos 2 caracteres.").max(100),
  codigo_ref: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Código de referência deve ter pelo menos 2 caracteres.")
    .max(30, "Código de referência deve ter no máximo 30 caracteres.")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Código de referência deve conter apenas letras maiúsculas, números, hífens ou sublinhados."
    ),
  email: z.string().email("E-mail inválido.").optional().nullable().or(z.literal("")),
  telefone: z.string().optional().nullable().or(z.literal("")),
  chave_pix: z.string().max(100).optional().nullable().or(z.literal("")),
  tipo_comissao: z.enum(["percentual", "valor_fixo"]).default("percentual"),
  valor_comissao: z.coerce.number().min(0, "Valor de comissão não pode ser negativo.").default(10),
  cupom_padrao_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const esquemaValidarCupom = z.object({
  codigo: z.string().min(1, "Informe o código do cupom."),
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  valor_total: z.coerce.number().min(0),
  servicos_ids: z.array(z.string().uuid()).default([]),
  cliente_id: z.string().uuid().optional().nullable(),
});

export type EntradaCampanha = z.infer<typeof esquemaCampanha>;
export type EntradaCupom = z.infer<typeof esquemaCupom>;
export type EntradaInfluenciador = z.infer<typeof esquemaInfluenciador>;
export type EntradaValidarCupom = z.infer<typeof esquemaValidarCupom>;
