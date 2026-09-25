"use client";

import * as React from "react";
import { cn } from "@barzzo/utilitarios";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

export interface SeletorDataProps {
  id?: string;
  valor: string; // Formato YYYY-MM-DD
  aoMudar: (novaData: string) => void;
  min?: string; // Formato YYYY-MM-DD
  max?: string;
  rotulo?: string;
  className?: string;
  disabled?: boolean;
  erro?: boolean;
}

const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const NOMES_DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function obterHojeIso(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterAmanhaIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function decomporIso(dataIso: string): { ano: number; mes: number; dia: number } {
  const partes = (dataIso || obterHojeIso()).split("-").map(Number);
  return {
    ano: partes[0] || new Date().getFullYear(),
    mes: (partes[1] || 1) - 1,
    dia: partes[2] || 1,
  };
}

function formatarIso(ano: number, mes: number, dia: number): string {
  const m = String(mes + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

export function SeletorData({
  id,
  valor,
  aoMudar,
  min,
  max,
  rotulo,
  className,
  disabled = false,
  erro = false,
}: SeletorDataProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = React.useState(false);

  const hojeIso = React.useMemo(() => obterHojeIso(), []);
  const amanhaIso = React.useMemo(() => obterAmanhaIso(), []);

  const dataValida = valor || hojeIso;
  const parsed = React.useMemo(() => decomporIso(dataValida), [dataValida]);

  const [anoVisualizado, setAnoVisualizado] = React.useState(parsed.ano);
  const [mesVisualizado, setMesVisualizado] = React.useState(parsed.mes);

  // Sincronizar mês visualizado quando o valor externo mudar e o calendário estiver fechado
  React.useEffect(() => {
    if (!aberto) {
      setAnoVisualizado(parsed.ano);
      setMesVisualizado(parsed.mes);
    }
  }, [dataValida, aberto, parsed.ano, parsed.mes]);

  // Fechar ao clicar fora ou ESC
  React.useEffect(() => {
    function tratarCliqueFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }

    function tratarTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAberto(false);
      }
    }

    if (aberto) {
      document.addEventListener("mousedown", tratarCliqueFora);
      document.addEventListener("keydown", tratarTeclado);
    }
    return () => {
      document.removeEventListener("mousedown", tratarCliqueFora);
      document.removeEventListener("keydown", tratarTeclado);
    };
  }, [aberto]);

  // Cálculos do calendário do mês atual
  const diasNoMes = new Date(anoVisualizado, mesVisualizado + 1, 0).getDate();
  const primeiroDiaSemana = new Date(anoVisualizado, mesVisualizado, 1).getDay();

  // Limites de navegação
  const podeVoltarMes = React.useMemo(() => {
    if (!min) return true;
    const { ano: minAno, mes: minMes } = decomporIso(min);
    if (anoVisualizado < minAno) return false;
    if (anoVisualizado === minAno && mesVisualizado <= minMes) return false;
    return true;
  }, [min, anoVisualizado, mesVisualizado]);

  const podeAvancarMes = React.useMemo(() => {
    if (!max) return true;
    const { ano: maxAno, mes: maxMes } = decomporIso(max);
    if (anoVisualizado > maxAno) return false;
    if (anoVisualizado === maxAno && mesVisualizado >= maxMes) return false;
    return true;
  }, [max, anoVisualizado, mesVisualizado]);

  const retrocederMes = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!podeVoltarMes) return;
    if (mesVisualizado === 0) {
      setMesVisualizado(11);
      setAnoVisualizado((a) => a - 1);
    } else {
      setMesVisualizado((m) => m - 1);
    }
  };

  const avancarMes = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!podeAvancarMes) return;
    if (mesVisualizado === 11) {
      setMesVisualizado(0);
      setAnoVisualizado((a) => a + 1);
    } else {
      setMesVisualizado((m) => m + 1);
    }
  };

  const selecionarDia = (dia: number) => {
    const novaDataIso = formatarIso(anoVisualizado, mesVisualizado, dia);
    aoMudar(novaDataIso);
    setAberto(false);
  };

  // Texto formatado para o input trigger
  const textoDataFormatada = React.useMemo(() => {
    const { ano, mes, dia } = decomporIso(dataValida);
    const dataObj = new Date(ano, mes, dia);
    const diaSemana = NOMES_DIAS_SEMANA[dataObj.getDay()];
    const nomeMes = NOMES_MESES[mes];

    let prefixoEspecial = "";
    if (dataValida === hojeIso) {
      prefixoEspecial = "Hoje · ";
    } else if (dataValida === amanhaIso) {
      prefixoEspecial = "Amanhã · ";
    }

    return `${prefixoEspecial}${dia} de ${nomeMes} de ${ano} (${diaSemana})`;
  }, [dataValida, hojeIso, amanhaIso]);

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1.5 w-full", className)}>
      {rotulo && (
        <label
          htmlFor={id}
          className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {rotulo}
        </label>
      )}

      {/* Botão Gatilho com Estilo do Design System Barzzo */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setAberto((prev) => !prev)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-xl px-4 text-left transition-all select-none",
          "bg-[#F6F6F7] text-black border border-[#E5E5E8]",
          "dark:bg-[#1C1C1F] dark:text-white dark:border-[#252529]",
          "hover:border-[#B45A2B] dark:hover:border-[#B45A2B]",
          "focus:outline-none focus:ring-2 focus:ring-[#B45A2B] focus:border-transparent",
          aberto && "border-[#B45A2B] ring-2 ring-[#B45A2B]/20 dark:border-[#B45A2B]",
          erro && "border-[#DC2626] dark:border-[#DC2626] focus:ring-[#DC2626]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-3 truncate min-w-0 pr-2">
          <div className="w-8 h-8 rounded-lg bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm sm:text-base truncate">
            {textoDataFormatada}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200",
            aberto && "rotate-180 text-[#B45A2B]"
          )}
        />
      </button>

      {/* Popover de Calendário Customizado no Tema Oficial */}
      {aberto && (
        <div
          role="dialog"
          aria-label="Calendário de seleção de data"
          className={cn(
            "absolute top-[calc(100%+6px)] left-0 z-50 w-full sm:w-[340px]",
            "rounded-2xl border p-4 shadow-2xl transition-all",
            "bg-white border-neutral-200 text-neutral-900",
            "dark:bg-[#141416] dark:border-[#252529] dark:text-white",
            "backdrop-blur-md"
          )}
        >
          {/* Cabeçalho do Mês / Navegação */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={retrocederMes}
              disabled={!podeVoltarMes}
              aria-label="Mês anterior"
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                "hover:bg-neutral-100 dark:hover:bg-[#252529]",
                "text-neutral-700 dark:text-neutral-200",
                !podeVoltarMes && "opacity-20 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="font-bold text-base capitalize">
              {NOMES_MESES[mesVisualizado]} {anoVisualizado}
            </span>

            <button
              type="button"
              onClick={avancarMes}
              disabled={!podeAvancarMes}
              aria-label="Próximo mês"
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                "hover:bg-neutral-100 dark:hover:bg-[#252529]",
                "text-neutral-700 dark:text-neutral-200",
                !podeAvancarMes && "opacity-20 cursor-not-allowed"
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Atalhos Rápidos: Hoje e Amanhã */}
          <div className="flex items-center gap-2 mb-3 px-1">
            {(!min || hojeIso >= min) && (
              <button
                type="button"
                onClick={() => {
                  aoMudar(hojeIso);
                  setAberto(false);
                }}
                className={cn(
                  "flex-1 py-1 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center",
                  dataValida === hojeIso
                    ? "bg-[#B45A2B] text-white border-[#B45A2B]"
                    : "border-neutral-200 dark:border-[#252529] hover:border-[#B45A2B] text-neutral-600 dark:text-neutral-300"
                )}
              >
                Hoje
              </button>
            )}

            {(!min || amanhaIso >= min) && (
              <button
                type="button"
                onClick={() => {
                  aoMudar(amanhaIso);
                  setAberto(false);
                }}
                className={cn(
                  "flex-1 py-1 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center",
                  dataValida === amanhaIso
                    ? "bg-[#B45A2B] text-white border-[#B45A2B]"
                    : "border-neutral-200 dark:border-[#252529] hover:border-[#B45A2B] text-neutral-600 dark:text-neutral-300"
                )}
              >
                Amanhã
              </button>
            )}
          </div>

          {/* Dias da Semana (D, S, T, Q, Q, S, S) */}
          <div className="grid grid-cols-7 mb-1 text-center">
            {DIAS_SEMANA_ABREV.map((diaAbrev) => (
              <span
                key={diaAbrev}
                className="text-xs font-bold text-neutral-400 dark:text-neutral-500 py-1"
              >
                {diaAbrev}
              </span>
            ))}
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espaços vazios para alinhar o 1º dia do mês */}
            {Array.from({ length: primeiroDiaSemana }).map((_, idx) => (
              <div key={`vazio-${idx}`} className="h-9 w-9" />
            ))}

            {/* Dias do Mês */}
            {Array.from({ length: diasNoMes }).map((_, idx) => {
              const dia = idx + 1;
              const dataIso = formatarIso(anoVisualizado, mesVisualizado, dia);
              const ehPassado = Boolean(min && dataIso < min);
              const ehFuturoLimite = Boolean(max && dataIso > max);
              const desabilitado = ehPassado || ehFuturoLimite;
              const estaSelecionado = dataIso === dataValida;
              const ehHoje = dataIso === hojeIso;

              return (
                <button
                  key={dia}
                  type="button"
                  disabled={desabilitado}
                  onClick={() => selecionarDia(dia)}
                  className={cn(
                    "h-9 w-9 mx-auto rounded-xl flex items-center justify-center text-sm font-semibold transition-all relative select-none",
                    estaSelecionado &&
                      "bg-[#B45A2B] text-white shadow-md font-bold scale-105",
                    !estaSelecionado &&
                      ehHoje &&
                      "border border-[#B45A2B] text-[#B45A2B] font-bold",
                    !estaSelecionado &&
                      !ehHoje &&
                      !desabilitado &&
                      "hover:bg-neutral-100 dark:hover:bg-[#252529] text-neutral-800 dark:text-neutral-200",
                    desabilitado &&
                      "opacity-25 cursor-not-allowed text-neutral-400 dark:text-neutral-600"
                  )}
                >
                  {dia}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
