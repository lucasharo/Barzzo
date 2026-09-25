// packages/dominio/src/assinaturas.ts
// Regras de negócio para planos SaaS, assinaturas, MRR e limites de equipe.

import type { CicloAssinatura, StatusAssinatura } from "@barzzo/tipos";

/**
 * Calcula a receita recorrente mensal (MRR) baseada nas assinaturas ativas.
 * No ciclo semestral, o valor é rateado proporcionalmente em 6 meses.
 */
export function calcularMRR(
  assinaturas: Array<{
    ciclo: CicloAssinatura;
    valor: number;
    status: StatusAssinatura;
  }>
): number {
  if (!assinaturas || assinaturas.length === 0) return 0;

  const total = assinaturas.reduce((acumulado, ass) => {
    if (ass.status !== "ativa" || ass.valor <= 0) return acumulado;
    if (ass.ciclo === "semestral") {
      return acumulado + ass.valor / 6;
    }
    return acumulado + ass.valor;
  }, 0);

  return Number(total.toFixed(2));
}

/**
 * Valida se uma barbearia tem permissão para operar com base no estado da assinatura e vigência de trial.
 */
export function verificarAcessoPlano(
  status: StatusAssinatura,
  trialFim?: string | null,
  agora: Date = new Date()
): { acessoPermitido: boolean; motivoBloqueio?: string } {
  if (status === "ativa") {
    return { acessoPermitido: true };
  }

  if (status === "trial") {
    if (!trialFim) {
      return { acessoPermitido: true };
    }
    const fimTime = new Date(trialFim).getTime();
    if (agora.getTime() <= fimTime) {
      return { acessoPermitido: true };
    }
    return {
      acessoPermitido: false,
      motivoBloqueio:
        "Seu período de testes de 30 dias expirou. Escolha um plano para continuar gerenciando sua barbearia sem interrupções.",
    };
  }

  if (status === "suspensa") {
    return {
      acessoPermitido: false,
      motivoBloqueio: "Esta barbearia encontra-se suspensa pela administração do Barzzo.",
    };
  }

  if (status === "vencida") {
    return {
      acessoPermitido: false,
      motivoBloqueio: "Sua assinatura está vencida. Regularize o pagamento para restaurar o acesso completo.",
    };
  }

  return {
    acessoPermitido: false,
    motivoBloqueio: "Assinatura inativa ou cancelada.",
  };
}

/**
 * Valida se o estabelecimento pode cadastrar mais um profissional sem exceder o teto do plano.
 */
export function validarCapacidadeEquipe(
  limiteProfissionais: number | null,
  totalProfissionaisAtuais: number
): { permitido: boolean; motivo?: string } {
  if (limiteProfissionais === null || limiteProfissionais === undefined) {
    return { permitido: true }; // Ilimitado (ex: Rede)
  }

  if (totalProfissionaisAtuais >= limiteProfissionais) {
    return {
      permitido: false,
      motivo: `Seu plano atual permite no máximo ${limiteProfissionais} profissional(is). Faça upgrade do seu plano para expandir sua equipe.`,
    };
  }

  return { permitido: true };
}

/**
 * Calcula a economia monetária e percentual oferecida pela assinatura semestral em relação à mensal.
 */
export function calcularEconomiaSemestral(
  precoMensal: number,
  precoSemestral: number
): { economiaTotal: number; percentualEconomia: number } {
  if (precoMensal <= 0 || precoSemestral <= 0) {
    return { economiaTotal: 0, percentualEconomia: 0 };
  }

  const custoSeisMesesMensal = precoMensal * 6;
  const economiaTotal = Math.max(0, Number((custoSeisMesesMensal - precoSemestral).toFixed(2)));
  const percentualEconomia = Math.round((economiaTotal / custoSeisMesesMensal) * 100);

  return {
    economiaTotal,
    percentualEconomia,
  };
}
