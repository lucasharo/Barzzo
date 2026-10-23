import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@barzzo/utilitarios";

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  subtitulo?: string;
  icone?: React.ReactNode;
}

export interface SeletorProps {
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  id?: string;
  icone?: React.ReactNode;
  placeholder?: string;
  desabilitado?: boolean;
  className?: string;
  tamanho?: "sm" | "md" | "lg";
  erro?: boolean;
}

export function Seletor({
  valor,
  aoMudar,
  opcoes,
  id,
  icone,
  placeholder = "Selecione uma opção",
  desabilitado = false,
  className,
  tamanho = "md",
  erro = false,
}: SeletorProps) {
  const [aberto, setAberto] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const opcaoSelecionada = opcoes.find((o) => o.valor === valor);

  // Fechar ao clicar fora ou pressionar ESC
  React.useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAberto(false);
      }
    }

    if (aberto) {
      document.addEventListener("mousedown", handleClickFora);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [aberto]);

  const classesTamanho = {
    sm: "h-9 px-3 text-xs",
    md: "h-11 px-3.5 text-sm",
    lg: "h-12 px-4 text-base",
  }[tamanho];

  return (
    <div ref={containerRef} className={cn("relative block w-full min-w-0 text-left", className)}>
      {/* Botão Trigger Customizado */}
      <button
        type="button"
        id={id}
        disabled={desabilitado}
        onClick={() => !desabilitado && setAberto((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className={cn(
          "flex items-center justify-between gap-2.5 w-full rounded-xl font-medium transition-all duration-150 select-none",
          "bg-[#F6F6F7] text-black border border-[#E5E5E8] shadow-sm",
          "dark:bg-[#1C1C1F] dark:text-white dark:border-[#252529]",
          "hover:border-[#B45A2B]/40 hover:bg-[#EEEEF0] dark:hover:bg-[#252529]",
          "focus:outline-none focus:ring-2 focus:ring-[#B45A2B] focus:border-transparent",
          aberto && "ring-2 ring-[#B45A2B] border-transparent dark:border-transparent bg-white dark:bg-[#141416]",
          desabilitado && "opacity-50 cursor-not-allowed",
          erro && "border-[#DC2626] focus:ring-[#DC2626]",
          classesTamanho
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {icone && <span className="shrink-0 text-neutral-400 dark:text-neutral-500">{icone}</span>}
          <span className="truncate">
            {opcaoSelecionada ? (
              <span className="flex items-center gap-2">
                {opcaoSelecionada.icone}
                <span>{opcaoSelecionada.rotulo}</span>
              </span>
            ) : (
              <span className="text-neutral-400 dark:text-neutral-500">{placeholder}</span>
            )}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200",
            aberto && "transform rotate-180 text-[#B45A2B]"
          )}
        />
      </button>

      {/* Dropdown Menu Flutuante */}
      {aberto && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl shadow-xl",
            "bg-white border border-neutral-200/90 text-black",
            "dark:bg-[#141416] dark:border-[#252529] dark:text-white",
            "animate-in fade-in-0 zoom-in-95 duration-150 right-0 sm:left-0 sm:right-auto"
          )}
        >
          {opcoes.map((opcao) => {
            const selecionado = opcao.valor === valor;
            return (
              <button
                key={opcao.valor}
                type="button"
                role="option"
                aria-selected={selecionado}
                onClick={() => {
                  aoMudar(opcao.valor);
                  setAberto(false);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs sm:text-sm transition-colors cursor-pointer select-none",
                  selecionado
                    ? "bg-[var(--primaria)] text-white font-bold"
                    : "hover:bg-[#EEEEF0] text-black dark:text-white dark:hover:bg-[#1C1C1F]"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {opcao.icone && <span className="shrink-0">{opcao.icone}</span>}
                  <div className="truncate">
                    <span className="block truncate">{opcao.rotulo}</span>
                    {opcao.subtitulo && (
                      <span className="block text-[11px] opacity-60 font-normal truncate">
                        {opcao.subtitulo}
                      </span>
                    )}
                  </div>
                </div>

                {selecionado && <Check className="h-4 w-4 shrink-0 text-white" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
