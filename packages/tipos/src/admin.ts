// packages/tipos/src/admin.ts
// Tipos para backoffice administrativo e auditoria do Barzzo.

export interface LogAuditoria {
  id: string;
  usuario_id: string | null;
  barbearia_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_anteriores: Record<string, any> | null;
  dados_novos: Record<string, any> | null;
  ip: string | null;
  criado_em: string;
  // Joins opcionais
  usuarios?: {
    nome: string;
    email: string;
  } | null;
  barbearias?: {
    nome: string;
    slug: string;
  } | null;
}

export interface MetricasAdminGlobal {
  total_barbearias: number;
  barbearias_ativas: number;
  barbearias_trial: number;
  total_assinantes: number;
  mrr_estimado: number;
  total_agendamentos: number;
  total_usuarios: number;
}
