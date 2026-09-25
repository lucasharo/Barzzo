// packages/dominio/src/crm.ts
// Regras de negócio para reputação, cálculo de médias e validação de elegibilidade.

import type { ResumoReputacaoBarbearia } from "@barzzo/tipos";

/**
 * Calcula a média aritmética das notas de avaliações com 1 casa decimal.
 */
export function calcularMediaAvaliacoes(
  avaliacoes: Array<{ nota: number }>
): number {
  if (!avaliacoes || avaliacoes.length === 0) {
    return 0;
  }
  const soma = avaliacoes.reduce((acc, curr) => acc + curr.nota, 0);
  return Number((soma / avaliacoes.length).toFixed(1));
}

/**
 * Agrupa as avaliações por quantidade de estrelas (de 1 a 5).
 */
export function calcularDistribuicaoEstrelas(
  avaliacoes: Array<{ nota: number }>
): ResumoReputacaoBarbearia["distribuicao_estrelas"] {
  const dist = {
    estrela_5: 0,
    estrela_4: 0,
    estrela_3: 0,
    estrela_2: 0,
    estrela_1: 0,
  };

  for (const item of avaliacoes || []) {
    if (item.nota === 5) dist.estrela_5++;
    else if (item.nota === 4) dist.estrela_4++;
    else if (item.nota === 3) dist.estrela_3++;
    else if (item.nota === 2) dist.estrela_2++;
    else if (item.nota === 1) dist.estrela_1++;
  }

  return dist;
}

/**
 * Retorna o resumo completo de reputação da barbearia.
 */
export function formatarResumoReputacao(
  avaliacoes: Array<{ nota: number }>
): ResumoReputacaoBarbearia {
  return {
    media_nota: calcularMediaAvaliacoes(avaliacoes),
    total_avaliacoes: avaliacoes?.length || 0,
    distribuicao_estrelas: calcularDistribuicaoEstrelas(avaliacoes),
  };
}

/**
 * Verifica se um agendamento é elegível para receber avaliação do cliente.
 * Apenas atendimentos com status "concluido" podem ser avaliados.
 */
export function validarElegibilidadeAvaliacao(statusAgendamento: string): {
  elegivel: boolean;
  motivo?: string;
} {
  if (statusAgendamento === "concluido") {
    return { elegivel: true };
  }

  if (statusAgendamento === "cancelado") {
    return {
      elegivel: false,
      motivo: "Agendamentos cancelados não podem ser avaliados.",
    };
  }

  if (statusAgendamento === "nao_compareceu") {
    return {
      elegivel: false,
      motivo: "Atendimentos onde o cliente não compareceu não são elegíveis para avaliação.",
    };
  }

  return {
    elegivel: false,
    motivo: "A avaliação só pode ser realizada após a conclusão do atendimento na barbearia.",
  };
}
