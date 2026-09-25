import { z } from "zod";

export const esquemaCriarBarbearia = z.object({
  nome: z
    .string({ required_error: "Nome da barbearia é obrigatório" })
    .trim()
    .min(2, "O nome deve ter no mínimo 2 caracteres")
    .max(100, "O nome pode ter no máximo 100 caracteres"),
  slug: z
    .string({ required_error: "Identificador (slug) é obrigatório" })
    .trim()
    .min(2, "O slug deve ter no mínimo 2 caracteres")
    .max(60, "O slug pode ter no máximo 60 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "O slug deve conter apenas letras minúsculas, números e hífens"),
  telefone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const n = val.replace(/\D/g, "");
        return n.length === 10 || n.length === 11;
      },
      { message: "Telefone deve conter DDD válido com 10 ou 11 dígitos" }
    ),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  endereco: z.string().max(150).optional(),
  bairro: z.string().max(80).optional(),
  cidade: z.string().max(80).optional(),
  estado: z.string().max(2).optional(),
  cep: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const apenasNumeros = val.replace(/\D/g, "");
        return apenasNumeros.length === 8;
      },
      { message: "CEP deve conter 8 dígitos" }
    ),
});

export type DadosCriarBarbearia = z.infer<typeof esquemaCriarBarbearia>;
