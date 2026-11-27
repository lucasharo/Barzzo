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
    ? { trilho: "h-5 w-[34px]", polegar: "left-2 h-[14px] w-[14px]", deslocamento: "translate-x-[14px]" }
    : { trilho: "h-6 w-10", polegar: "left-[5px] h-4 w-4", deslocamento: "translate-x-[18px]" };

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={marcado}
      disabled={disabled}
      onClick={() => aoMudar(!marcado)}
      className={cn(
        "relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-[#141416]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-150",
          dimensoes.trilho,
          marcado ? "bg-[#B45A2B]" : "bg-neutral-300 dark:bg-neutral-700"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm ring-0 transition-transform duration-150",
          dimensoes.polegar,
          marcado ? dimensoes.deslocamento : "translate-x-0"
        )}
      />
    </button>
  );
}
