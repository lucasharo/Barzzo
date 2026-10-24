"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@barzzo/utilitarios";

export interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo?: string;
  descricao?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  /** Conteúdo extra no cabeçalho, ao lado do botão de fechar (ex.: um badge de status). */
  acaoCabecalho?: React.ReactNode;
  tamanho?: "sm" | "md" | "lg" | "xl";
  /** "responsivo" (padrão): bottom sheet no celular e card centralizado no desktop. "centralizado": sempre card centralizado. */
  posicao?: "responsivo" | "centralizado";
  className?: string;
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  acaoCabecalho,
  tamanho = "md",
  posicao = "responsivo",
  className,
}: ModalProps) {
  React.useEffect(() => {
    const lidarComKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) {
        aoFechar();
      }
    };
    window.addEventListener("keydown", lidarComKeyDown);
    return () => window.removeEventListener("keydown", lidarComKeyDown);
  }, [aberto, aoFechar]);

  React.useEffect(() => {
    if (aberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  if (!aberto) return null;

  const centralizado = posicao === "centralizado";

  const tamanhos = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center",
        centralizado ? "items-center p-4" : "items-end sm:items-center p-0 sm:p-4"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={titulo || "Modal de diálogo"}
    >
      {/* Backdrop com blur suave */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={aoFechar}
        aria-hidden="true"
      />

      {/* Janela do Modal (BottomSheet no mobile, card centralizado no desktop) */}
      <div
        className={cn(
          "relative z-50 w-full bg-white dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden animate-in duration-200",
          centralizado
            ? "rounded-2xl max-h-[85vh] zoom-in-95 fade-in"
            : "rounded-t-3xl sm:rounded-2xl max-h-[90vh] sm:max-h-[85vh] slide-in-from-bottom sm:zoom-in-95",
          tamanhos[tamanho],
          className
        )}
      >
        {/* Indicador de arrasto no mobile */}
        <div className={cn("flex justify-center pt-3 pb-1", centralizado ? "hidden" : "sm:hidden")}>
          <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 min-h-[56px]">
          <div>
            {titulo && (
              <h2 className="text-base sm:text-lg font-bold text-black dark:text-white">
                {titulo}
              </h2>
            )}
            {descricao && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {descricao}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
          {acaoCabecalho}
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
            aria-label="Fechar janela"
          >
            <X className="h-5 w-5" />
          </button>
          </div>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-5 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">{children}</div>

        {/* Rodapé de Ações */}
        {rodape && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 bg-neutral-50 dark:bg-[#0A0A0B]/60">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
