// packages/dominio/src/campanhas.ts
// Regras de negócio para campanhas, cupons de desconto, atribuição e comissões.

import type {
  Cupom,
  CupomRegra,
  ResultadoValidacaoCupom,
  TipoComissaoInfluenciador,
} from "@barzzo/tipos";

/**
 * Valida elegibilidade e calcula o desconto exato de um cupom sobre o valor da reserva.
 */
export function calcularDescontoCupom(parametros: {
  cupom: Cupom;
  valorTotal: number;
  servicosIds?: string[];
  servicos?: Array<{ id: string; preco: number }>;
  totalAgendamentosConcluidosCliente?: number;
  historicoPorEscopo?: { barbearia: number; global: number };
  usosCupom?: number;
  usosCupomCliente?: number;
  agora?: Date;
}): ResultadoValidacaoCupom {
  const {
    cupom,
    valorTotal,
    servicosIds = [],
    servicos = [],
    totalAgendamentosConcluidosCliente = 0,
    historicoPorEscopo,
    usosCupom,
    usosCupomCliente,
    agora = new Date(),
  } = parametros;
  const usosCupomEfetivos = usosCupom ?? cupom.usos_atuais ?? 0;
  const usosCupomClienteEfetivos = usosCupomCliente ?? 0;

  // 1. Cupom ativo
  if (!cupom.ativo) {
    return { valido: false, motivo_invalido: "Este cupom não está mais ativo." };
  }

  // 2. Vigência de data
  const dataAtual = agora.getTime();
  const inicio = new Date(cupom.data_inicio).getTime();
  const fim = new Date(cupom.data_fim).getTime();

  if (dataAtual < inicio) {
    return { valido: false, motivo_invalido: "Esta promoção ainda não iniciou." };
  }

  if (dataAtual > fim) {
    return { valido: false, motivo_invalido: "Este cupom já expirou." };
  }

  // 3. Limite total de usos
  if (!cupom.regras?.length && cupom.limite_usos_total !== null && cupom.limite_usos_total !== undefined && cupom.usos_atuais >= cupom.limite_usos_total) {
    return { valido: false, motivo_invalido: "O limite de utilizações deste cupom foi atingido." };
  }

  // 4. Valor mínimo de reserva
  const regras = [...(cupom.regras || [])].filter((regra) => regra.ativo !== false).sort((a, b) => a.prioridade - b.prioridade);
  const regraLegada: CupomRegra = {
    id: "legada",
    cupom_id: cupom.id,
    prioridade: 100,
    escopo_historico: "BARBEARIA",
    atendimentos_minimos: cupom.apenas_primeira_reserva ? 0 : null,
    atendimentos_maximos: cupom.apenas_primeira_reserva ? 0 : null,
    tipo_desconto: cupom.tipo_desconto,
    valor_desconto: cupom.valor_desconto,
    valor_minimo_reserva: cupom.valor_minimo_reserva || 0,
    limite_usos_total: cupom.limite_usos_total ?? null,
    limite_usos_por_cliente: cupom.limite_usos_por_cliente ?? null,
    servicos_elegiveis: cupom.servicos_elegiveis || [],
    ativo: true,
  };
  const historico = historicoPorEscopo || { barbearia: totalAgendamentosConcluidosCliente, global: totalAgendamentosConcluidosCliente };
  const regra = regras.length
    ? regras.find((candidata) => {
        const total = candidata.escopo_historico === "GLOBAL_BARZZO" ? historico.global : historico.barbearia;
        const atendeHistorico = (candidata.atendimentos_minimos === null || candidata.atendimentos_minimos === undefined || total >= candidata.atendimentos_minimos)
          && (candidata.atendimentos_maximos === null || candidata.atendimentos_maximos === undefined || total <= candidata.atendimentos_maximos);
        const atendeMinimo = valorTotal >= candidata.valor_minimo_reserva;
        const ids = candidata.servicos_elegiveis || [];
        const atendeServico = ids.length === 0 || (servicos.length > 0 ? servicos : servicosIds.map((id) => ({ id, preco: valorTotal }))).some((servico) => ids.includes(servico.id));
        return atendeHistorico && atendeMinimo && atendeServico;
      })
    : regraLegada;
  if (!regra) {
    return { valido: false, motivo_invalido: "Nenhuma regra deste cupom é válida para esta reserva." };
  }
  const totalHistorico = regra.escopo_historico === "GLOBAL_BARZZO" ? historico.global : historico.barbearia;

  if (regra.atendimentos_minimos !== null && totalHistorico < regra.atendimentos_minimos) {
    return { valido: false, motivo_invalido: "Este cupom ainda não está disponível para o seu histórico." };
  }
  if (regra.atendimentos_maximos !== null && totalHistorico > regra.atendimentos_maximos) {
    return { valido: false, motivo_invalido: "Este benefício é válido apenas para a faixa de histórico selecionada." };
  }
  if (regra.limite_usos_total !== null && regra.limite_usos_total !== undefined && usosCupomEfetivos >= regra.limite_usos_total) {
    return { valido: false, motivo_invalido: "O limite de utilizações deste cupom foi atingido." };
  }
  if (regra.limite_usos_por_cliente !== null && regra.limite_usos_por_cliente !== undefined && usosCupomClienteEfetivos >= regra.limite_usos_por_cliente) {
    return { valido: false, motivo_invalido: "Você já atingiu o limite de uso deste cupom." };
  }

  if (regra.valor_minimo_reserva > 0 && valorTotal < regra.valor_minimo_reserva) {
    const valorMinFormatado = regra.valor_minimo_reserva.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return {
      valido: false,
      motivo_invalido: `O valor mínimo para aplicar este cupom é de ${valorMinFormatado}.`,
    };
  }

  // Serviços elegíveis: o desconto incide no subtotal, nunca no total bruto.
  const idsElegiveis = regra.servicos_elegiveis || [];
  if (idsElegiveis.length > 0) {
    const temServicoElegivel = (servicos.length > 0 ? servicos.map((s) => s.id) : servicosIds).some((sId) => idsElegiveis.includes(sId));
    if (!temServicoElegivel) {
      return {
        valido: false,
        motivo_invalido: "Este cupom não é válido para os serviços selecionados.",
      };
    }
  }

  const subtotalElegivel = servicos.length > 0
    ? servicos.filter((servico) => idsElegiveis.length === 0 || idsElegiveis.includes(servico.id)).reduce((total, servico) => total + Number(servico.preco || 0), 0)
    : idsElegiveis.length === 0 || servicosIds.some((sId) => idsElegiveis.includes(sId)) ? valorTotal : 0;

  // 7. Cálculo do desconto
  let descontoCalculado = 0;
  if (regra.tipo_desconto === "percentual") {
    descontoCalculado = Number(((subtotalElegivel * regra.valor_desconto) / 100).toFixed(2));
  } else {
    descontoCalculado = Number(regra.valor_desconto.toFixed(2));
  }

  const descontoFinal = Math.min(subtotalElegivel, Math.max(0, descontoCalculado));
  const valorComDesconto = Number((valorTotal - descontoFinal).toFixed(2));

  return {
    valido: true,
    cupom,
    valor_desconto_calculado: descontoFinal,
    subtotal_elegivel: Number(subtotalElegivel.toFixed(2)),
    valor_final: valorComDesconto,
    regra_aplicada: regra,
  };
}

/**
 * Calcula a comissão do influenciador a partir do valor faturado do corte/serviço.
 */
export function calcularValorComissao(
  valorServicos: number,
  tipoComissao: TipoComissaoInfluenciador,
  taxaComissao: number
): number {
  if (valorServicos <= 0 || taxaComissao <= 0) return 0;

  if (tipoComissao === "percentual") {
    return Number(((valorServicos * taxaComissao) / 100).toFixed(2));
  } else {
    return Number(taxaComissao.toFixed(2));
  }
}

/**
 * Gera a URL completa com parâmetros de rastreamento de influenciador.
 */
export function gerarLinkInfluenciador(
  urlBase: string,
  slugBarbearia: string,
  codigoCupom: string
): string {
  const baseLimpa = urlBase.replace(/\/+$/, "");
  return `${baseLimpa}/barbearias/${slugBarbearia}?cupom=${encodeURIComponent(codigoCupom)}`;
}
