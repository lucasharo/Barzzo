import { z } from "zod";

export const esquemaCriarProfissional = z.object({
  nome: z
    .string({ required_error: "Nome do profissional é obrigatório" })
    .trim()
    .min(2, "O nome deve ter no mínimo 2 caracteres")
    .max(100),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const n = val.replace(/\D/g, "");
        return n.length === 10 || n.length === 11;
      },
      { message: "Telefone deve conter DDD com 10 ou 11 dígitos" }
    ),
  bio: z.string().max(300, "Bio pode ter no máximo 300 caracteres").optional(),
});

export type DadosCriarProfissional = z.infer<typeof esquemaCriarProfissional>;

export const esquemaCriarConvite = z.object({
  email: z
    .string({ required_error: "E-mail para envio do convite é obrigatório" })
    .trim()
    .email("Informe um e-mail válido"),
  papel: z.enum(["gerente", "profissional"], {
    required_error: "Selecione a função do membro",
  }),
});

export type DadosCriarConvite = z.infer<typeof esquemaCriarConvite>;
