// packages/validacoes/src/produtos-galeria.ts
// Schemas Zod para catálogo de produtos e galeria de fotos do Barzzo.

import { z } from "zod";

export const esquemaProduto = z.object({
  nome: z.string().min(2, "Nome do produto deve ter pelo menos 2 caracteres.").max(100),
  descricao: z.string().max(500, "Descrição deve ter no máximo 500 caracteres.").optional().nullable(),
  preco: z.coerce.number().min(0, "Preço não pode ser negativo."),
  foto_url: z.string().url("URL da foto inválida.").optional().nullable().or(z.literal("")),
  ativo: z.boolean().default(true),
  destaque: z.boolean().default(false),
  ordem: z.coerce.number().int().min(0).default(0),
});

export const esquemaFotoGaleria = z.object({
  titulo: z.string().max(100, "Título deve ter no máximo 100 caracteres.").optional().nullable(),
  foto_url: z.string().url("URL da foto inválida."),
  destaque_capa: z.boolean().default(false),
  ordem: z.coerce.number().int().min(0).default(0),
});

export const FORMATOS_IMAGEM_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const TAMANHO_MAXIMO_IMAGEM_BYTES = 5 * 1024 * 1024; // 5 MB

export const esquemaArquivoMidia = z.object({
  tipo: z.enum(FORMATOS_IMAGEM_PERMITIDOS, {
    errorMap: () => ({ message: "Formato inválido. Use JPEG, PNG ou WebP." }),
  }),
  tamanhoBytes: z
    .number()
    .max(TAMANHO_MAXIMO_IMAGEM_BYTES, "A imagem não pode ultrapassar 5 MB."),
});

export type EntradaProduto = z.infer<typeof esquemaProduto>;
export type EntradaFotoGaleria = z.infer<typeof esquemaFotoGaleria>;
export type EntradaArquivoMidia = z.infer<typeof esquemaArquivoMidia>;
