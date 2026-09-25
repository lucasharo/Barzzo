// packages/dominio/src/relatorios.ts
// Regras de negócio e cálculos analíticos para métricas e relatórios.

import type { PeriodoFiltro } from "@barzzo/tipos";

/**
 * Calcula o ticket médio com precisão de 2 casas decimais.
 */
export function calcularTicketMedio(
  faturamentoTotal: number,
  totalAtendimentosConcluidos: number
): number {
  if (totalAtendimentosConcluidos <= 0 || faturamentoTotal <= 0) {
    return 0;
  }
  return Number((faturamentoTotal / totalAtendimentosConcluidos).toFixed(2));
}

/**
 * Calcula a taxa de ocupação da jornada de trabalho em porcentagem (0 a 100).
 */
export function calcularTaxaOcupacao(
  minutosAtendidos: number,
  minutosDisponiveisJornada: number
): number {
  if (minutosDisponiveisJornada <= 0 || minutosAtendidos <= 0) {
    return 0;
  }
  const percentual = (minutosAtendidos / minutosDisponiveisJornada) * 100;
  return Number(Math.min(100, Math.max(0, percentual)).toFixed(1));
}

/**
 * Analisa a duração real de atendimento comparada à duração prevista.
 */
export function calcularDiferencaPrevistoReal(
  duracaoPrevistaMinutos: number,
  inicioReal: string | Date | null,
  fimReal: string | Date | null
): {
  duracaoRealMinutos: number;
  diferencaMinutos: number;
  statusPontualidade: "pontual" | "atrasado" | "adiantado";
} {
  if (!inicioReal || !fimReal || duracaoPrevistaMinutos <= 0) {
    return {
      duracaoRealMinutos: duracaoPrevistaMinutos,
      diferencaMinutos: 0,
      statusPontualidade: "pontual",
    };
  }

  const inicioMs = new Date(inicioReal).getTime();
  const fimMs = new Date(fimReal).getTime();
  const duracaoRealMinutos = Math.max(1, Math.round((fimMs - inicioMs) / 60000));
  const diferencaMinutos = duracaoRealMinutos - duracaoPrevistaMinutos;

  let statusPontualidade: "pontual" | "atrasado" | "adiantado" = "pontual";
  if (diferencaMinutos > 5) {
    statusPontualidade = "atrasado";
  } else if (diferencaMinutos < -5) {
    statusPontualidade = "adiantado";
  }

  return {
    duracaoRealMinutos,
    diferencaMinutos,
    statusPontualidade,
  };
}

/**
 * Retorna as datas de início e fim no padrão ISO (AAAA-MM-DD) para cada período predefinido.
 */
export function calcularDatasPeriodo(
  periodo: PeriodoFiltro,
  hoje: Date = new Date()
): { dataInicio: string; dataFim: string } {
  const formatarData = (d: Date) => d.toISOString().split("T")[0];
  const dataFimStr = formatarData(hoje);

  switch (periodo) {
    case "hoje":
      return { dataInicio: dataFimStr, dataFim: dataFimStr };

    case "7d": {
      const dataInicio = new Date(hoje);
      dataInicio.setDate(dataInicio.getDate() - 6);
      return { dataInicio: formatarData(dataInicio), dataFim: dataFimStr };
    }

    case "30d": {
      const dataInicio = new Date(hoje);
      dataInicio.setDate(dataInicio.getDate() - 29);
      return { dataInicio: formatarData(dataInicio), dataFim: dataFimStr };
    }

    case "mes_atual": {
      const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { dataInicio: formatarData(dataInicio), dataFim: dataFimStr };
    }

    case "personalizado":
    default:
      return { dataInicio: dataFimStr, dataFim: dataFimStr };
  }
}
