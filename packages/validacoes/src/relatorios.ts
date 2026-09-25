// packages/validacoes/src/relatorios.ts
// Schemas Zod para filtros de métricas e relatórios.

import { z } from "zod";

export const esquemaFiltroRelatorio = z
  .object({
    barbearia_id: z.string().uuid("ID da barbearia inválido."),
    periodo: z.enum(["hoje", "7d", "30d", "mes_atual", "personalizado"]).default("7d"),
    data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial deve estar no formato AAAA-MM-DD."),
    data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final deve estar no formato AAAA-MM-DD."),
    profissional_id: z.string().uuid("ID do profissional inválido.").optional().nullable(),
  })
  .refine(
    (dados) => {
      const inicio = new Date(`${dados.data_inicio}T00:00:00Z`).getTime();
      const fim = new Date(`${dados.data_fim}T23:59:59Z`).getTime();
      return !isNaN(inicio) && !isNaN(fim) && inicio <= fim;
    },
    {
      message: "Data inicial não pode ser posterior à data final.",
      path: ["data_fim"],
    }
  );

export type EntradaFiltroRelatorio = z.infer<typeof esquemaFiltroRelatorio>;
