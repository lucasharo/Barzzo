// packages/validacoes/src/notificacoes.ts
// Schemas Zod para dispositivos, preferências e central de notificações.

import { z } from "zod";

export const esquemaDispositivo = z.object({
  fcm_token: z.string().trim().min(1, "O token do dispositivo é obrigatório."),
  plataforma: z.enum(["web", "android", "ios"], {
    required_error: "A plataforma do dispositivo é obrigatória.",
  }),
  modelo: z.string().max(100).optional().nullable(),
});

export const esquemaPreferenciasNotificacao = z.object({
  notificacoes_transacionais: z.boolean().default(true),
  notificacoes_promocionais: z.boolean().default(true),
  notificacoes_lembretes: z.boolean().default(true),
});

export const esquemaNotificacao = z.object({
  usuario_id: z.string().uuid("ID do destinatário inválido."),
  titulo: z.string().trim().min(1, "O título da notificação é obrigatório.").max(120),
  corpo: z.string().trim().min(1, "O corpo da notificação é obrigatório.").max(500),
  tipo: z.enum([
    "confirmacao",
    "cancelamento",
    "lembrete",
    "reagendamento",
    "promocao",
    "sistema",
  ]),
  link: z.string().max(255).optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
});

export type EntradaDispositivo = z.infer<typeof esquemaDispositivo>;
export type EntradaPreferenciasNotificacao = z.infer<typeof esquemaPreferenciasNotificacao>;
export type EntradaNotificacao = z.infer<typeof esquemaNotificacao>;
