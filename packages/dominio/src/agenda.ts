// packages/dominio/src/agenda.ts
// Regras de negócio da agenda, máquina de estados finita e algoritmo "Qualquer Profissional".

import type { StatusAgendamento, Profissional } from "@barzzo/tipos";

/**
 * Matriz de transições de status válidas para agendamentos no Barzzo.
 */
export const TRANSICOES_VALIDAS: Record<StatusAgendamento, StatusAgendamento[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["em_atendimento", "cancelado", "nao_compareceu", "confirmado"],
  em_atendimento: ["concluido", "cancelado"],
  concluido: [],      // Estado terminal imutável
  cancelado: [],      // Estado terminal imutável
  nao_compareceu: [], // Estado terminal imutável
};

/**
 * Verifica se uma transição de status é permitida pelo domínio.
 */
export function validarTransicaoStatus(
  statusAtual: StatusAgendamento,
  novoStatus: StatusAgendamento
): boolean {
  if (statusAtual === novoStatus && statusAtual === "confirmado") {
    // Permite reagendamento mantendo status confirmado
    return true;
  }
  const permitidos = TRANSICOES_VALIDAS[statusAtual];
  return permitidos ? permitidos.includes(novoStatus) : false;
}

export interface CandidatoProfissional {
  id: string;
  nome: string;
  ativo: boolean;
  totalAgendamentosNoDia: number;
}

/**
 * Seleciona o profissional com menor carga de trabalho agendada no dia.
 * Em caso de empate na contagem de atendimentos, aplica critério determinístico estável:
 * 1. Nome alfabético ASC
 * 2. ID ASC
 */
export function selecionarProfissionalMenorCarga(
  candidatos: CandidatoProfissional[]
): CandidatoProfissional | null {
  if (!candidatos || candidatos.length === 0) {
    return null;
  }

  const ativos = candidatos.filter((c) => c.ativo);
  if (ativos.length === 0) {
    return null;
  }

  return [...ativos].sort((a, b) => {
    // 1. Menor carga no dia
    if (a.totalAgendamentosNoDia !== b.totalAgendamentosNoDia) {
      return a.totalAgendamentosNoDia - b.totalAgendamentosNoDia;
    }
    // 2. Ordem alfabética por nome
    const cmpNome = a.nome.localeCompare(b.nome);
    if (cmpNome !== 0) {
      return cmpNome;
    }
    // 3. Desempate final estável por ID
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Compara tempo previsto com tempo real e calcula variações em minutos.
 */
export function calcularComparativoTempo(
  inicioPrevistoIso: string,
  fimPrevistoIso: string,
  inicioRealIso?: string | null,
  fimRealIso?: string | null
): {
  duracaoPrevistaMinutos: number;
  duracaoRealMinutos: number | null;
  atrasoInicioMinutos: number | null;
  diferencaDuracaoMinutos: number | null;
} {
  const iniPrev = new Date(inicioPrevistoIso).getTime();
  const fimPrev = new Date(fimPrevistoIso).getTime();
  const duracaoPrevistaMinutos = Math.round((fimPrev - iniPrev) / 60000);

  let duracaoRealMinutos: number | null = null;
  let atrasoInicioMinutos: number | null = null;
  let diferencaDuracaoMinutos: number | null = null;

  if (inicioRealIso) {
    const iniReal = new Date(inicioRealIso).getTime();
    atrasoInicioMinutos = Math.round((iniReal - iniPrev) / 60000);

    if (fimRealIso) {
      const fimReal = new Date(fimRealIso).getTime();
      duracaoRealMinutos = Math.round((fimReal - iniReal) / 60000);
      diferencaDuracaoMinutos = duracaoRealMinutos - duracaoPrevistaMinutos;
    }
  }

  return {
    duracaoPrevistaMinutos,
    duracaoRealMinutos,
    atrasoInicioMinutos,
    diferencaDuracaoMinutos,
  };
}
