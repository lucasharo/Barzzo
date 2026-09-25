import { z } from "zod";

export const esquemaAtualizarPerfil = z.object({
  nome: z
    .string({ required_error: "Nome é obrigatório" })
    .trim()
    .min(3, "O nome deve ter no mínimo 3 caracteres")
    .max(100, "O nome pode ter no máximo 100 caracteres"),
  telefone: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const apenasNumeros = val.replace(/\D/g, "");
        return apenasNumeros.length === 10 || apenasNumeros.length === 11;
      },
      {
        message: "Informe um telefone válido com DDD (10 ou 11 dígitos)",
      }
    ),
  foto_url: z.string().url("URL de foto inválida").optional().nullable(),
});

export type DadosAtualizarPerfil = z.infer<typeof esquemaAtualizarPerfil>;

export const esquemaArquivoImagem = z.object({
  tipo: z.string().refine(
    (tipo) => ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(tipo),
    {
      message: "Formato de imagem não suportado. Utilize JPEG, PNG ou WebP.",
    }
  ),
  tamanhoEmBytes: z.number().max(5 * 1024 * 1024, {
    message: "A imagem não pode ultrapassar 5MB.",
  }),
});

export type DadosValidacaoArquivoImagem = z.infer<typeof esquemaArquivoImagem>;
