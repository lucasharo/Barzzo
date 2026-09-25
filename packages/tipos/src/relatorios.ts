// packages/tipos/src/relatorios.ts
// Tipos para métricas de dashboard e relatórios analíticos.

export type PeriodoFiltro = "hoje" | "7d" | "30d" | "mes_atual" | "personalizado";

export interface MetricasDashboardHoje {
  total_hoje: number;
  proximos: number;
  em_atendimento: number;
  concluidos: number;
  cancelados_no_show: number;
  faturamento_realizado: number;
  faturamento_estimado: number;
  novos_clientes_hoje: number;
}

export interface RelatorioGeral {
  periodo_inicio: string;
  periodo_fim: string;
  total_agendamentos: number;
  concluidos: number;
  cancelados: number;
  no_show: number;
  faturamento_total: number;
  ticket_medio: number;
  duracao_prevista_media_min: number;
  duracao_real_media_min: number;
}

export interface DesempenhoProfissionalItem {
  profissional_id: string;
  nome: string;
  foto_url?: string | null;
  total_atendimentos: number;
  faturamento_gerado: number;
  ticket_medio: number;
  duracao_prevista_media_min: number;
  duracao_real_media_min: number;
  taxa_ocupacao_percentual: number;
  servicos_mais_realizados: Array<{
    nome: string;
    quantidade: number;
  }>;
}

export interface DesempenhoMarketingItem {
  tipo: "cupom" | "influenciador";
  identificador: string; // Código do cupom ou do influenciador
  nome_parceiro?: string;
  total_utilizacoes: number;
  faturamento_gerado: number;
  total_descontos_concedidos?: number;
  comissoes_geradas?: number;
  comissoes_pagas?: number;
}
