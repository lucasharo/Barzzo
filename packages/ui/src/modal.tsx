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
  tamanho?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  tamanho = "md",
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

  const tamanhos = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
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
          "relative z-50 w-full rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200",
          tamanhos[tamanho],
          className
        )}
      >
        {/* Indicador de arrasto no mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
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
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
            aria-label="Fechar janela"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

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
