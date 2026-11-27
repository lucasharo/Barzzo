import * as React from "react";
import { Card, CardContent } from "./card";
import { Switch } from "./switch";

export type ChavePreferenciaNotificacao =
  | "notificacoes_confirmacao"
  | "notificacoes_cancelamento"
  | "notificacoes_reagendamento"
  | "notificacoes_lembretes"
  | "notificacoes_promocionais"
  | "notificacoes_sistema";

export interface ValoresPreferenciasNotificacao {
  notificacoes_confirmacao: boolean;
  notificacoes_cancelamento: boolean;
  notificacoes_reagendamento: boolean;
  notificacoes_lembretes: boolean;
  notificacoes_promocionais: boolean;
  notificacoes_sistema: boolean;
}

interface ItemPreferenciaNotificacao {
  chave: ChavePreferenciaNotificacao;
  titulo: string;
  descricao: string;
}

const itens: ItemPreferenciaNotificacao[] = [
  {
    chave: "notificacoes_confirmacao",
    titulo: "Confirmações de agendamento",
    descricao: "Quando um agendamento for confirmado pela barbearia.",
  },
  {
    chave: "notificacoes_cancelamento",
    titulo: "Cancelamentos",
    descricao: "Quando um agendamento for cancelado.",
  },
  {
    chave: "notificacoes_reagendamento",
    titulo: "Reagendamentos",
    descricao: "Quando o horário de um agendamento for alterado.",
  },
  {
    chave: "notificacoes_lembretes",
    titulo: "Lembretes de horário",
    descricao: "Avisos antes do início do agendamento.",
  },
  {
    chave: "notificacoes_promocionais",
    titulo: "Promoções e cupons",
    descricao: "Ofertas, novidades e cupons das barbearias.",
  },
  {
    chave: "notificacoes_sistema",
    titulo: "Avisos do sistema",
    descricao: "Atualizações e informações importantes sobre sua conta.",
  },
];

interface PreferenciasNotificacaoPorTipoProps {
  preferencias: ValoresPreferenciasNotificacao;
  prefixoId: string;
  desabilitado?: boolean;
  aoMudar: (chave: ChavePreferenciaNotificacao, valor: boolean) => void;
}

export function PreferenciasNotificacaoPorTipo({
  preferencias,
  prefixoId,
  desabilitado = false,
  aoMudar,
}: PreferenciasNotificacaoPorTipoProps) {
  return (
    <div className="flex flex-col gap-3" aria-label="Preferências por tipo de notificação">
      {itens.map(({ chave, titulo, descricao }) => {
        const id = `${prefixoId}-${chave}`;
        const descricaoId = `${id}-descricao`;

        return (
          <Card key={chave} aria-disabled={desabilitado}>
            <CardContent className="flex min-h-[72px] items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span id={id} className="text-sm font-bold">
                  {titulo}
                </span>
                <span id={descricaoId} className="text-xs opacity-70">
                  {descricao}
                </span>
              </div>
              <Switch
                id={`${id}-switch`}
                aria-labelledby={id}
                aria-describedby={descricaoId}
                marcado={preferencias[chave]}
                aoMudar={(valor) => aoMudar(chave, valor)}
                disabled={desabilitado}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
