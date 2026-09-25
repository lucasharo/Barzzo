"use client";

import * as React from "react";
import { cn, obterIniciais } from "@barzzo/utilitarios";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  nome?: string | null;
  tamanho?: "sm" | "md" | "lg" | "xl";
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, nome, tamanho = "md", ...props }, ref) => {
    const [erroImagem, setErroImagem] = React.useState(false);

    const tamanhos = {
      sm: "h-8 w-8 text-xs",
      md: "h-11 w-11 text-sm",
      lg: "h-16 w-16 text-lg",
      xl: "h-24 w-24 text-2xl",
    };

    const iniciais = obterIniciais(nome || alt);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700 bg-[#E5E5E8] dark:bg-[#252529] font-medium text-black dark:text-white items-center justify-center select-none",
          tamanhos[tamanho],
          className
        )}
        {...props}
      >
        {src && !erroImagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt || nome || "Avatar do usuário"}
            className="aspect-square h-full w-full object-cover"
            onError={() => setErroImagem(true)}
          />
        ) : (
          <span className="font-semibold">{iniciais}</span>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";
