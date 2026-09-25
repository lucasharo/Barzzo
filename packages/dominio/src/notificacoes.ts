// packages/dominio/src/notificacoes.ts
// Regras de negócio para notificações in-app e push.

import type { PreferenciasNotificacao, TipoNotificacao } from "@barzzo/tipos";

/**
 * Avalia se uma notificação deve ser entregue com base nas preferências do usuário.
 */
export function podeEnviarNotificacao(
  tipo: TipoNotificacao,
  preferencias?: PreferenciasNotificacao | null
): boolean {
  if (!preferencias) {
    return true; // Default permissivo para transacionais e promoções iniciais
  }

  if (tipo === "promocao") {
    return preferencias.notificacoes_promocionais === true;
  }

  if (tipo === "lembrete") {
    return preferencias.notificacoes_lembretes === true;
  }

  if (
    tipo === "confirmacao" ||
    tipo === "cancelamento" ||
    tipo === "reagendamento"
  ) {
    return preferencias.notificacoes_transacionais === true;
  }

  // Notificações de sistema são sempre entregues
  return true;
}

/**
 * Gera os textos padrão de título e corpo para cada tipo de evento do ciclo de vida da barbearia.
 */
export function montarMensagemNotificacao(
  tipo: TipoNotificacao,
  contexto: {
    clienteNome?: string;
    barbeariaNome?: string;
    servicoNome?: string;
    dataHoraFormatada?: string;
    motivoCancelamento?: string;
    tituloPromocao?: string;
    mensagemCustomizada?: string;
  }
): { titulo: string; corpo: string } {
  const barbearia = contexto.barbeariaNome || "Barbearia";
  const servico = contexto.servicoNome || "atendimento";
  const dataHora = contexto.dataHoraFormatada || "horário agendado";

  switch (tipo) {
    case "confirmacao":
      return {
        titulo: "Agendamento Confirmado! ✂️",
        corpo: `Seu horário para ${servico} em ${barbearia} foi confirmado para ${dataHora}.`,
      };

    case "cancelamento":
      return {
        titulo: "Agendamento Cancelado",
        corpo: contexto.motivoCancelamento
          ? `O agendamento de ${servico} em ${barbearia} foi cancelado: ${contexto.motivoCancelamento}`
          : `O agendamento de ${servico} em ${barbearia} previsto para ${dataHora} foi cancelado.`,
      };

    case "lembrete":
      return {
        titulo: "Lembrete de Horário ⏰",
        corpo: `Falta pouco para o seu corte de ${servico} em ${barbearia}! Horário marcado: ${dataHora}.`,
      };

    case "reagendamento":
      return {
        titulo: "Horário Reagendado 🔄",
        corpo: `Seu agendamento em ${barbearia} foi alterado com sucesso para ${dataHora}.`,
      };

    case "promocao":
      return {
        titulo: contexto.tituloPromocao || "Promoção Especial no Barzzo! 🔥",
        corpo:
          contexto.mensagemCustomizada ||
          `Confira novidades e cupons exclusivos na ${barbearia}.`,
      };

    case "sistema":
    default:
      return {
        titulo: "Aviso do Sistema Barzzo",
        corpo:
          contexto.mensagemCustomizada ||
          "Atualização importante sobre sua conta ou serviços.",
      };
  }
}
