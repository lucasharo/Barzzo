// packages/validacoes/src/admin.ts
// Schemas Zod para ações do backoffice administrativo.

import { z } from "zod";

export const esquemaAcaoAuditoria = z.object({
  acao: z.string().min(2, "Ação obrigatória."),
  entidade: z.string().min(2, "Entidade obrigatória."),
  entidade_id: z.string().uuid().optional().nullable(),
  dados_anteriores: z.record(z.any()).optional().nullable(),
  dados_novos: z.record(z.any()).optional().nullable(),
});

export const esquemaModeracaoAvaliacao = z.object({
  avaliacao_id: z.string().uuid("ID da avaliação inválido."),
  motivo_bloqueio: z.string().min(5, "Informe o motivo do bloqueio da avaliação.").max(300),
});

export const esquemaStatusBarbeariaAdmin = z.object({
  barbearia_id: z.string().uuid("ID da barbearia inválido."),
  status: z.enum(["ativa", "suspensa"]),
  motivo: z.string().min(5, "Informe o motivo da alteração de status.").max(300),
});

export type EntradaAcaoAuditoria = z.infer<typeof esquemaAcaoAuditoria>;
export type EntradaModeracaoAvaliacao = z.infer<typeof esquemaModeracaoAvaliacao>;
export type EntradaStatusBarbeariaAdmin = z.infer<typeof esquemaStatusBarbeariaAdmin>;
