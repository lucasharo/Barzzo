// packages/dominio/src/admin.ts
// Regras e formatações administrativas.

/**
 * Formata ação de auditoria para leitura amigável no painel administrativo.
 */
export function formatarAcaoAuditoria(acao: string): string {
  switch (acao) {
    case "conceder_extensao_trial":
      return "Extensão de Trial Concedida";
    case "ativar_assinatura":
      return "Assinatura Ativada";
    case "suspender_barbearia":
      return "Barbearia Suspensa";
    case "reativar_barbearia":
      return "Barbearia Reativada";
    case "bloquear_avaliacao":
      return "Avaliação Bloqueada";
    default:
      return acao.replace(/_/g, " ").toUpperCase();
  }
}
