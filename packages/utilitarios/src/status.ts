/**
 * Retorna a classe CSS do badge de status de acordo com a semântica de cores do Barzzo.
 * Verde = sucesso/ativo | Amarelo = alerta/trial/pendente | Vermelho = erro/cancelado/vencido
 */
export function classeStatusBadge(status: string | null | undefined): string {
  const s = (status || "").toLowerCase().trim();

  // Verde: estados positivos/ativos
  if (["ativo", "ativa", "ativas", "ativos", "confirmado", "concluido", "concluida", "paga", "pagas", "sucesso", "ativa"].includes(s)) {
    return "bg-[#16A34A]/10 text-[#16A34A]";
  }

  // Amarelo: estados de alerta/transição
  if (["trial", "pendente", "pendentes", "agendado", "agendada", "em_atendimento", "alerta"].includes(s)) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  // Vermelho: estados negativos/finalizados de forma ruim
  if (["vencida", "vencido", "inadimplente", "inadimplentes", "suspensa", "suspenso", "suspensas", "cancelada", "cancelado", "canceladas", "cancelados", "rejeitado", "rejeitada", "nao_compareceu", "erro", "inativo", "inativa"].includes(s)) {
    return "bg-[#DC2626]/10 text-[#DC2626]";
  }

  // Fallback: neutro
  return "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400";
}

/**
 * Traduz o status para exibição amigável em português.
 */
export function traduzirStatus(status: string | null | undefined): string {
  const s = (status || "").toLowerCase().trim();
  const mapa: Record<string, string> = {
    ativo: "Ativo",
    ativa: "Ativa",
    trial: "Trial",
    pendente: "Pendente",
    agendado: "Agendado",
    agendada: "Agendada",
    confirmado: "Confirmado",
    em_atendimento: "Em Atendimento",
    concluido: "Concluído",
    concluida: "Concluída",
    cancelado: "Cancelado",
    cancelada: "Cancelada",
    nao_compareceu: "Não Compareceu",
    paga: "Paga",
    vencida: "Vencida",
    vencido: "Vencido",
    inadimplente: "Inadimplente",
    suspensa: "Suspensa",
    suspenso: "Suspenso",
    rejeitado: "Rejeitado",
    rejeitada: "Rejeitada",
    inativo: "Inativo",
    inativa: "Inativa",
  };
  return mapa[s] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : "");
}
