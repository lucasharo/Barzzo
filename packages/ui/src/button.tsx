import * as React from "react";
import { cn } from "@barzzo/utilitarios";
import { LoadingSpinner } from "./loading-spinner";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?:
    | "principal"
    | "secundario"
    | "cancelar-simples"
    | "cancelar-destrutivo"
    | "fantasma"
    | "link";
  tamanho?: "sm" | "md" | "lg" | "icone";
  carregando?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variante = "principal",
      tamanho = "md",
      carregando = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantes = {
      // Principal: Cobre #B45A2B
      principal:
        "bg-[#B45A2B] text-white hover:bg-[#C46632] active:bg-[#984820] shadow-sm",
      // Secundário: Inverte conforme tema
      secundario:
        "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm",
      // Cancelar simples (antes de confirmação destrutiva)
      "cancelar-simples":
        "border border-[#DC2626] text-[#DC2626] bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20",
      // Cancelar final/destrutivo (confirmação definitiva)
      "cancelar-destrutivo":
        "bg-[#DC2626] border border-[#DC2626] text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
      // Fantasma
      fantasma:
        "bg-transparent text-current hover:bg-[#EEEEF0] dark:hover:bg-[#1C1C1F]",
      // Link
      link: "bg-transparent text-[#B45A2B] hover:underline p-0 h-auto min-h-0 min-w-0 shadow-none",
    };

    const tamanhos = {
      sm: "h-9 px-3 text-sm min-h-[36px]",
      md: "h-11 px-5 text-base min-h-[44px]", // 44px min touch target
      lg: "h-12 px-6 text-lg min-h-[48px]",
      icone: "h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || carregando}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none",
          variantes[variante],
          tamanhos[tamanho],
          className
        )}
        {...props}
      >
        {carregando && (
          <LoadingSpinner className="mr-2 h-4 w-4" tamanho="sm" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
