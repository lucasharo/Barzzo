import { z } from "zod";

export const esquemaLogin = z.object({
  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .trim()
    .min(1, "E-mail é obrigatório")
    .email("Informe um e-mail válido"),
  senha: z
    .string({ required_error: "Senha é obrigatória" })
    .min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export type DadosLogin = z.infer<typeof esquemaLogin>;

export const esquemaCadastro = z
  .object({
    nome: z
      .string({ required_error: "Nome completo é obrigatório" })
      .trim()
      .min(3, "O nome deve ter no mínimo 3 caracteres")
      .max(100, "O nome pode ter no máximo 100 caracteres"),
    email: z
      .string({ required_error: "E-mail é obrigatório" })
      .trim()
      .min(1, "E-mail é obrigatório")
      .email("Informe um e-mail válido"),
    telefone: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val.trim() === "") return true;
          // Aceita formato com DDD: 10 ou 11 dígitos numéricos
          const apenasNumeros = val.replace(/\D/g, "");
          return apenasNumeros.length === 10 || apenasNumeros.length === 11;
        },
        {
          message: "Informe um telefone válido com DDD (10 ou 11 dígitos)",
        }
      ),
    senha: z
      .string({ required_error: "Senha é obrigatória" })
      .min(6, "A senha deve ter no mínimo 6 caracteres"),
    confirmarSenha: z
      .string({ required_error: "Confirmação de senha é obrigatória" })
      .min(6, "A confirmação deve ter no mínimo 6 caracteres"),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não conferem",
    path: ["confirmarSenha"],
  });

export type DadosCadastro = z.infer<typeof esquemaCadastro>;

export const esquemaRecuperarSenha = z.object({
  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .trim()
    .min(1, "E-mail é obrigatório")
    .email("Informe um e-mail válido"),
});

export type DadosRecuperarSenha = z.infer<typeof esquemaRecuperarSenha>;

export const esquemaRedefinirSenha = z
  .object({
    senha: z
      .string({ required_error: "Nova senha é obrigatória" })
      .min(6, "A nova senha deve ter no mínimo 6 caracteres"),
    confirmarSenha: z
      .string({ required_error: "Confirmação de senha é obrigatória" })
      .min(6, "A confirmação deve ter no mínimo 6 caracteres"),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não conferem",
    path: ["confirmarSenha"],
  });

export type DadosRedefinirSenha = z.infer<typeof esquemaRedefinirSenha>;
