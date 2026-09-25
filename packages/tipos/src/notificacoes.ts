// packages/tipos/src/notificacoes.ts
// Tipos para dispositivos, preferências e central de notificações.

export type PlataformaDispositivo = "web" | "android" | "ios";

export type TipoNotificacao =
  | "confirmacao"
  | "cancelamento"
  | "lembrete"
  | "reagendamento"
  | "promocao"
  | "sistema";

export interface Dispositivo {
  id: string;
  usuario_id: string;
  fcm_token: string;
  plataforma: PlataformaDispositivo;
  ativo: boolean;
  modelo: string | null;
  ultimo_acesso_em: string;
  criado_em: string;
}

export interface PreferenciasNotificacao {
  usuario_id: string;
  notificacoes_transacionais: boolean;
  notificacoes_promocionais: boolean;
  notificacoes_lembretes: boolean;
  atualizado_em: string;
}

export interface Notificacao {
  id: string;
  usuario_id: string;
  titulo: string;
  corpo: string;
  tipo: TipoNotificacao;
  lida: boolean;
  lida_em: string | null;
  link: string | null;
  metadata: Record<string, any>;
  criado_em: string;
}
