"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@barzzo/utilitarios";

export interface DrawerProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo?: string;
  descricao?: string;
  posicao?: "direita" | "esquerda";
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}

export function Drawer({
  aberto,
  aoFechar,
  titulo,
  descricao,
  posicao = "direita",
  children,
  rodape,
  largura = "w-80 max-w-[85vw]",
}: DrawerProps) {
  // Fechar ao pressionar ESC
  React.useEffect(() => {
    const lidarComKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) {
        aoFechar();
      }
    };
    window.addEventListener("keydown", lidarComKeyDown);
    return () => window.removeEventListener("keydown", lidarComKeyDown);
  }, [aberto, aoFechar]);

  // Travar o scroll do body quando aberto
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

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={titulo || "Menu de navegação"}
    >
      {/* Backdrop com blur suave */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={aoFechar}
        aria-hidden="true"
      />

      {/* Conteúdo do Drawer */}
      <aside
        className={cn(
          "relative z-50 flex h-full flex-col bg-white dark:bg-[#0A0A0B] shadow-2xl transition-transform duration-300 ease-out",
          posicao === "direita"
            ? "ml-auto border-l border-neutral-200 dark:border-neutral-800"
            : "mr-auto border-r border-neutral-200 dark:border-neutral-800",
          largura
        )}
      >
        {/* Cabeçalho do Drawer */}
        <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 py-3.5 min-h-[56px]">
          <div>
            {titulo && (
              <h2 className="text-base font-bold text-black dark:text-white">
                {titulo}
              </h2>
            )}
            {descricao && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {/* Rodapé opcional */}
        {rodape && (
          <div className="border-t border-neutral-200/80 dark:border-neutral-800/80 p-4">
            {rodape}
          </div>
        )}
      </aside>
    </div>
  );
}
