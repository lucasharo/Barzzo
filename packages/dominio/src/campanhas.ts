// packages/dominio/src/campanhas.ts
// Regras de negócio para campanhas, cupons de desconto, atribuição e comissões.

import type {
  Cupom,
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
  totalAgendamentosConcluidosCliente?: number;
  agora?: Date;
}): ResultadoValidacaoCupom {
  const {
    cupom,
    valorTotal,
    servicosIds = [],
    totalAgendamentosConcluidosCliente = 0,
    agora = new Date(),
  } = parametros;

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
  if (cupom.limite_usos_total !== null && cupom.usos_atuais >= cupom.limite_usos_total) {
    return { valido: false, motivo_invalido: "O limite de utilizações deste cupom foi atingido." };
  }

  // 4. Valor mínimo de reserva
  if (cupom.valor_minimo_reserva > 0 && valorTotal < cupom.valor_minimo_reserva) {
    const valorMinFormatado = cupom.valor_minimo_reserva.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return {
      valido: false,
      motivo_invalido: `O valor mínimo para aplicar este cupom é de ${valorMinFormatado}.`,
    };
  }

  // 5. Regra de primeira reserva
  if (cupom.apenas_primeira_reserva && totalAgendamentosConcluidosCliente > 0) {
    return {
      valido: false,
      motivo_invalido: "Este cupom é exclusivo para novos clientes (primeira reserva).",
    };
  }

  // 6. Serviços elegíveis
  if (cupom.servicos_elegiveis && cupom.servicos_elegiveis.length > 0) {
    const temServicoElegivel = servicosIds.some((sId) =>
      cupom.servicos_elegiveis.includes(sId)
    );
    if (!temServicoElegivel) {
      return {
        valido: false,
        motivo_invalido: "Este cupom não é válido para os serviços selecionados.",
      };
    }
  }

  // 7. Cálculo do desconto
  let descontoCalculado = 0;
  if (cupom.tipo_desconto === "percentual") {
    descontoCalculado = Number(((valorTotal * cupom.valor_desconto) / 100).toFixed(2));
  } else {
    descontoCalculado = Number(cupom.valor_desconto.toFixed(2));
  }

  // O desconto não pode exceder o valor total da reserva
  const descontoFinal = Math.min(valorTotal, Math.max(0, descontoCalculado));
  const valorComDesconto = Number((valorTotal - descontoFinal).toFixed(2));

  return {
    valido: true,
    cupom,
    valor_desconto_calculado: descontoFinal,
    valor_final: valorComDesconto,
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
  codigoRef: string
): string {
  const baseLimpa = urlBase.replace(/\/+$/, "");
  return `${baseLimpa}/barbearias/${slugBarbearia}?ref=${encodeURIComponent(codigoRef)}`;
}
