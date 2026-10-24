import * as React from "react";
import { cn } from "@barzzo/utilitarios";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "onClick"> {
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
  tamanho?: "sm" | "md";
}

export function Switch({
  marcado,
  aoMudar,
  tamanho = "md",
  className,
  disabled,
  ...props
}: SwitchProps) {
  const dimensoes = tamanho === "sm"
    ? { trilho: "h-5 w-9", polegar: "h-4 w-4", deslocamento: "translate-x-4" }
    : { trilho: "h-6 w-11", polegar: "h-5 w-5", deslocamento: "translate-x-5" };

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={marcado}
      disabled={disabled}
      onClick={() => aoMudar(!marcado)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-[#141416]",
        dimensoes.trilho,
        marcado ? "bg-[#B45A2B]" : "bg-neutral-300 dark:bg-neutral-700",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-150",
          dimensoes.polegar,
          marcado ? dimensoes.deslocamento : "translate-x-0"
        )}
      />
    </button>
  );
}
