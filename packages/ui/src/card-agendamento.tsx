"use client";

import * as React from "react";
import { formatarTelefone } from "@barzzo/utilitarios";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import {
  Clock,
  User,
  Scissors,
  Play,
  Check,
  XCircle,
  ArrowRight,
  Phone,
} from "lucide-react";

export type StatusCardAgendamento =
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "cancelado"
  | "nao_compareceu"
  | string;

export interface BadgeStatusInfo {
  label: string;
  classe: string;
}

export interface CardAgendamentoProps {
  id: string;
  inicioPrevisto: string | Date;
  fimPrevisto?: string | Date | null;
  duracaoMinutos?: number;
  clienteNome: string;
  clienteTelefone?: string | null;
  servicosTexto: string;
  precoTotal: number | string;
  profissionalNome?: string | null;
  status: StatusCardAgendamento;
  badgeCustomizado?: BadgeStatusInfo;
  usarUtc?: boolean;
  onIniciar?: () => void;
  onConcluir?: () => void;
  onCancelar?: () => void;
  onDetalhes?: () => void;
  linkDetalhes?: string;
  renderLink?: (props: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
  acoesExtras?: React.ReactNode;
  carregandoAcao?: boolean;
  className?: string;
}

export function obterBadgePadrao(status: StatusCardAgendamento): BadgeStatusInfo {
  switch (status) {
    case "confirmado":
      return {
        label: "Confirmado",
        classe: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      };
    case "em_atendimento":
      return {
        label: "Em Atendimento",
        classe: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
      };
    case "concluido":
      return {
        label: "Concluído",
        classe: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20",
      };
    case "cancelado":
      return {
        label: "Cancelado",
        classe: "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700",
      };
    case "nao_compareceu":
      return {
        label: "Não Compareceu",
        classe: "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20",
      };
    default:
      return {
        label: status,
        classe: "bg-neutral-200 text-neutral-600 border-neutral-300",
      };
  }
}

export function CardAgendamento({
  id,
  inicioPrevisto,
  fimPrevisto,
  duracaoMinutos,
  clienteNome,
  clienteTelefone,
  servicosTexto,
  precoTotal,
  profissionalNome,
  status,
  badgeCustomizado,
  usarUtc = true,
  onIniciar,
  onConcluir,
  onCancelar,
  onDetalhes,
  linkDetalhes,
  renderLink,
  acoesExtras,
  carregandoAcao = false,
  className = "",
}: CardAgendamentoProps) {
  const badge = badgeCustomizado || obterBadgePadrao(status);

  // Formatação de horários
  const dtInicio = new Date(inicioPrevisto);
  let dtFim: Date;

  if (fimPrevisto) {
    dtFim = new Date(fimPrevisto);
  } else if (duracaoMinutos && !isNaN(dtInicio.getTime())) {
    dtFim = new Date(dtInicio.getTime() + duracaoMinutos * 60 * 1000);
  } else {
    dtFim = dtInicio;
  }

  const horaInicio = !isNaN(dtInicio.getTime())
    ? dtInicio.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: usarUtc ? "UTC" : undefined,
      })
    : "--:--";

  const horaFim = !isNaN(dtFim.getTime())
    ? dtFim.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: usarUtc ? "UTC" : undefined,
      })
    : "--:--";

  const precoFormatado =
    typeof precoTotal === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(precoTotal)
      : precoTotal;

  const urlDetalhes = linkDetalhes || `/agendamentos/${id}`;

  const renderizarBotaoDetalhes = () => {
    const botaoConteudo = (
      <Button
        variante="fantasma"
        tamanho="sm"
        className="h-7 min-h-[28px] text-xs px-2 text-neutral-700 dark:text-neutral-300 hover:text-[#B45A2B] dark:hover:text-[#B45A2B]"
        onClick={onDetalhes}
      >
        Detalhes <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    );

    if (onDetalhes && !linkDetalhes) {
      return botaoConteudo;
    }

    if (renderLink) {
      return renderLink({
        href: urlDetalhes,
        children: botaoConteudo,
      });
    }

    return (
      <a href={urlDetalhes} className="inline-block">
        {botaoConteudo}
      </a>
    );
  };

  const renderizarTituloCliente = () => {
    const classes =
      "font-bold text-sm sm:text-base hover:underline hover:text-[#B45A2B] text-neutral-900 dark:text-neutral-100 transition-colors truncate";

    if (renderLink) {
      return renderLink({
        href: urlDetalhes,
        className: classes,
        children: clienteNome || "Cliente sem nome",
      });
    }

    return (
      <a href={urlDetalhes} className={classes}>
        {clienteNome || "Cliente sem nome"}
      </a>
    );
  };

  const emExecucao = status === "em_atendimento";
  const canceladoOuFalta = status === "cancelado" || status === "nao_compareceu";

  return (
    <Card
      camada="primaria"
      className={`relative overflow-hidden transition-all hover:border-[#B45A2B]/40 ${
        emExecucao
          ? "border-amber-500/50 bg-amber-500/5 shadow-sm"
          : canceladoOuFalta
          ? "opacity-60 border-neutral-200/80 dark:border-neutral-800"
          : "border-neutral-200/80 dark:border-neutral-800"
      } ${className}`}
    >
      {/* Badge no Canto Superior Direito */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3.5 z-10">
        <span
          className={`inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-semibold border shadow-sm ${badge.classe}`}
        >
          {emExecucao && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
          )}
          {badge.label}
        </span>
      </div>

      <CardContent className="p-3 sm:p-3.5 flex items-start gap-3 sm:gap-3.5">
        {/* Bloco de Horário */}
        <div className="flex flex-col items-center justify-center min-w-[68px] sm:min-w-[72px] py-1 px-2 rounded-lg bg-neutral-100/90 dark:bg-neutral-800/90 border border-neutral-200/60 dark:border-neutral-700/60 shrink-0 self-start">
          <span className="text-sm sm:text-base font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
            {horaInicio}
          </span>
          <span className="text-[10px] sm:text-[11px] font-medium opacity-60">
            até {horaFim}
          </span>
        </div>

        {/* Informações do Agendamento */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          {/* Linha 1: Cliente e Telefone (com pr-20 para não sobrepor o badge superior direito) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-20 sm:pr-24">
            {renderizarTituloCliente()}

            {clienteTelefone && (
              <span className="inline-flex items-center gap-1 text-xs opacity-65 font-medium whitespace-nowrap">
                <Phone className="h-3 w-3 opacity-70" />
                {formatarTelefone(clienteTelefone)}
              </span>
            )}
          </div>

          {/* Linha 2: Serviços, Preço e Duração */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200">
              <Scissors className="h-3.5 w-3.5 text-[#B45A2B] shrink-0" />
              {servicosTexto || "Serviço"}
            </span>
            <span className="opacity-30">•</span>
            <span className="font-extrabold text-[#B45A2B]">
              {precoFormatado}
            </span>
            {duracaoMinutos ? (
              <>
                <span className="opacity-30">•</span>
                <span className="inline-flex items-center gap-1 opacity-70">
                  <Clock className="h-3 w-3 shrink-0" />
                  {duracaoMinutos} min
                </span>
              </>
            ) : null}
          </div>

          {/* Linha 3: Profissional À ESQUERDA e Ações/Detalhes À DIREITA (NA MESMA LINHA) */}
          <div className="flex items-center justify-between gap-2 pt-0.5 mt-0.5 min-h-[28px]">
            {profissionalNome ? (
              <div className="flex items-center gap-1 text-xs opacity-75 truncate">
                <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">
                  Profissional:{" "}
                  <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {profissionalNome}
                  </strong>
                </span>
              </div>
            ) : (
              <div />
            )}

            {/* Ações Operacionais e Botão Detalhes exatamente na mesma linha */}
            <div className="flex items-center gap-1.5 shrink-0">
              {status === "confirmado" && onIniciar && (
                <Button
                  variante="principal"
                  tamanho="sm"
                  className="h-7 min-h-[28px] text-xs font-semibold px-2.5"
                  disabled={carregandoAcao}
                  onClick={onIniciar}
                >
                  <Play className="h-3 w-3 mr-1" /> Iniciar
                </Button>
              )}

              {status === "confirmado" && onCancelar && (
                <Button
                  variante="cancelar-destrutivo"
                  tamanho="sm"
                  className="h-7 min-h-[28px] text-xs font-semibold px-2"
                  disabled={carregandoAcao}
                  onClick={onCancelar}
                >
                  <XCircle className="h-3 w-3 mr-1" /> Cancelar
                </Button>
              )}

              {status === "em_atendimento" && onConcluir && (
                <Button
                  variante="principal"
                  tamanho="sm"
                  className="h-7 min-h-[28px] text-xs font-semibold px-3 bg-[#16A34A] hover:bg-[#15803D] text-white"
                  disabled={carregandoAcao}
                  onClick={onConcluir}
                >
                  <Check className="h-3 w-3 mr-1" /> Concluir Atendimento
                </Button>
              )}

              {acoesExtras}

              {renderizarBotaoDetalhes()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
