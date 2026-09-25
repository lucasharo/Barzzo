"use client";

import * as React from "react";
import { cn } from "@barzzo/utilitarios";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
} from "lucide-react";

export interface AlertaTemporizadoProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variante?: "info" | "sucesso" | "alerta" | "erro";
  duracaoMs?: number;
  aoExpirar?: () => void;
  mostrarProgressoLinear?: boolean;
  pausarAoHover?: boolean;
}

export const AlertaTemporizado = React.forwardRef<
  HTMLDivElement,
  AlertaTemporizadoProps
>(
  (
    {
      className,
      variante = "info",
      duracaoMs = 5000,
      aoExpirar,
      mostrarProgressoLinear = true,
      pausarAoHover = true,
      children,
      ...props
    },
    ref
  ) => {
    const [tempoRestanteMs, setTempoRestanteMs] = React.useState(duracaoMs);
    const [emPausa, setEmPausa] = React.useState(false);
    const aoExpirarRef = React.useRef(aoExpirar);
    aoExpirarRef.current = aoExpirar;

    // Reinicia o tempo se duracaoMs mudar
    React.useEffect(() => {
      setTempoRestanteMs(duracaoMs);
    }, [duracaoMs]);

    // Loop de contagem regressiva suave
    React.useEffect(() => {
      if (emPausa) return;

      let ultimoTimestamp = Date.now();
      const intervalo = setInterval(() => {
        const agora = Date.now();
        const delta = agora - ultimoTimestamp;
        ultimoTimestamp = agora;

        setTempoRestanteMs((prev) => {
          const proximo = Math.max(0, prev - delta);
          if (proximo <= 0) {
            clearInterval(intervalo);
            aoExpirarRef.current?.();
            return 0;
          }
          return proximo;
        });
      }, 50);

      return () => clearInterval(intervalo);
    }, [emPausa]);

    const icones = {
      info: <Info className="h-5 w-5 text-[#2563EB] shrink-0" />,
      sucesso: <CheckCircle2 className="h-5 w-5 text-[#16A34A] shrink-0" />,
      alerta: <AlertTriangle className="h-5 w-5 text-[#EAB308] shrink-0" />,
      erro: <AlertCircle className="h-5 w-5 text-[#DC2626] shrink-0" />,
    };

    const estilos = {
      info: "border-[#2563EB]/40 bg-[#2563EB]/10 text-black dark:text-white",
      sucesso: "border-[#16A34A]/40 bg-[#16A34A]/10 text-black dark:text-white",
      alerta: "border-[#EAB308]/40 bg-[#EAB308]/10 text-black dark:text-white",
      erro: "border-[#DC2626]/40 bg-[#DC2626]/10 text-black dark:text-white",
    };

    const coresStroke = {
      info: "#2563EB",
      sucesso: "#16A34A",
      alerta: "#EAB308",
      erro: "#DC2626",
    };

    const coresBarra = {
      info: "bg-[#2563EB]",
      sucesso: "bg-[#16A34A]",
      alerta: "bg-[#EAB308]",
      erro: "bg-[#DC2626]",
    };

    const percentual = duracaoMs > 0 ? (tempoRestanteMs / duracaoMs) * 100 : 0;
    const segundosRestantes = Math.max(1, Math.ceil(tempoRestanteMs / 1000));

    // Parâmetros do SVG circular
    const raio = 13;
    const circunferencia = 2 * Math.PI * raio;
    const strokeDashoffset = circunferencia * (1 - percentual / 100);

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        onMouseEnter={() => pausarAoHover && setEmPausa(true)}
        onMouseLeave={() => pausarAoHover && setEmPausa(false)}
        className={cn(
          "relative w-full rounded-lg border p-4 flex items-center justify-between gap-3 text-sm overflow-hidden transition-all shadow-sm",
          estilos[variante],
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icones[variante]}
          <div className="flex-1 leading-snug">{children}</div>
        </div>

        {/* Loader Circular e Contador de Segundos */}
        <button
          type="button"
          onClick={() => aoExpirarRef.current?.()}
          aria-label={`Fechar aviso (expira em ${segundosRestantes} segundos)`}
          title="Clique para fechar agora"
          className="relative group shrink-0 flex items-center justify-center h-8 w-8 rounded-full hover:bg-black/10 dark:hover:bg-white/15 transition-all focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
        >
          <svg
            className="h-8 w-8 -rotate-90 transform"
            viewBox="0 0 32 32"
            aria-hidden="true"
          >
            {/* Círculo de fundo do loader */}
            <circle
              cx="16"
              cy="16"
              r={raio}
              stroke="currentColor"
              className="opacity-20"
              strokeWidth="2.5"
              fill="transparent"
              style={{ color: coresStroke[variante] }}
            />
            {/* Círculo dinâmico de progresso */}
            <circle
              cx="16"
              cy="16"
              r={raio}
              stroke="currentColor"
              className="transition-[stroke-dashoffset] duration-75 ease-linear"
              strokeWidth="2.5"
              strokeDasharray={circunferencia}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{ color: coresStroke[variante] }}
            />
          </svg>

          {/* Segundos restantes no centro */}
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold group-hover:hidden select-none"
            style={{ color: coresStroke[variante] }}
          >
            {segundosRestantes}s
          </span>

          {/* Ícone de fechar no hover do mouse */}
          <X
            className="absolute h-3.5 w-3.5 hidden group-hover:block transition-all"
            style={{ color: coresStroke[variante] }}
          />
        </button>

        {/* Barra de Progresso Linear na borda inferior */}
        {mostrarProgressoLinear && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-75 ease-linear",
                coresBarra[variante]
              )}
              style={{ width: `${percentual}%` }}
            />
          </div>
        )}
      </div>
    );
  }
);
AlertaTemporizado.displayName = "AlertaTemporizado";
