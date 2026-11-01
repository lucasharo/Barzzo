import * as React from "react";
import { Button } from "@barzzo/ui";
import { chaveDiaLocal } from "@barzzo/dominio";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface CarrosselDiasProps {
  /** Primeiro dia da janela exibida na grade. */
  inicio: Date;
  /** Quantidade de dias visíveis na grade (realçados no carrossel). */
  colunas: number;
  /** Agendamentos ativos por dia (`AAAA-MM-DD`), usados nos pontos indicadores. */
  contagens: Record<string, number>;
  /** Dias da semana (0 a 6) em que a barbearia abre. */
  diasAbertos: Record<number, boolean>;
  aoSelecionarDia: (dia: Date) => void;
  aoMudarMes: (delta: number) => void;
  aoPaginar: (delta: number) => void;
  aoIrParaHoje: () => void;
}

export function CarrosselDias({
  inicio,
  colunas,
  contagens,
  diasAbertos,
  aoSelecionarDia,
  aoMudarMes,
  aoPaginar,
  aoIrParaHoje,
}: CarrosselDiasProps) {
  const faixaRef = React.useRef<HTMLDivElement>(null);
  const ativoRef = React.useRef<HTMLButtonElement>(null);
  const primeiraRolagem = React.useRef(true);
  const hoje = chaveDiaLocal(new Date());
  const ano = inicio.getFullYear();
  const mes = inicio.getMonth();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const inicioChave = chaveDiaLocal(inicio);

  const mesAnteriorRef = React.useRef(mes);
  React.useEffect(() => {
    if (mesAnteriorRef.current !== mes) {
      mesAnteriorRef.current = mes;
      const faixa = faixaRef.current;
      if (faixa) {
        faixa.scrollTo({ left: 0, behavior: "auto" });
      }
    }
  }, [mes]);

  // Na abertura da tela ou ao trocar de mês, centraliza o dia ativo
  React.useEffect(() => {
    if (primeiraRolagem.current) {
      const faixa = faixaRef.current;
      const ativo = ativoRef.current;
      if (faixa && ativo) {
        faixa.scrollTo({
          left: Math.max(0, ativo.offsetLeft - faixa.clientWidth / 2 + ativo.clientWidth / 2),
          behavior: "auto",
        });
      }
      primeiraRolagem.current = false;
    }
  }, [inicioChave]);

  function handlePaginar(delta: number) {
    const faixa = faixaRef.current;
    if (faixa) {
      const primeiroFilho = faixa.firstElementChild as HTMLElement | null;
      const largura = primeiroFilho ? primeiroFilho.offsetWidth + 6 : 64;
      faixa.scrollBy({
        left: delta * largura,
        behavior: "smooth",
      });
    }
    aoPaginar(delta);
  }

  function handleIrParaHoje() {
    aoIrParaHoje();
    setTimeout(() => {
      const faixa = faixaRef.current;
      const ativo = ativoRef.current;
      if (faixa && ativo) {
        faixa.scrollTo({
          left: Math.max(0, ativo.offsetLeft - faixa.clientWidth / 2 + ativo.clientWidth / 2),
          behavior: "smooth",
        });
      }
    }, 50);
  }

  function handleMudarMes(delta: number) {
    aoMudarMes(delta);
    setTimeout(() => {
      const faixa = faixaRef.current;
      if (faixa) {
        faixa.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 50);
  }

  const botaoSeta = "border border-neutral-200 dark:border-neutral-800 shrink-0";

  return (
    <div
      className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#141416] p-2"
      aria-label="Dias do mês"
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-1 sm:w-auto">
        <Button
          variante="principal"
          tamanho="icone"
          className="shrink-0"
          onClick={() => handleMudarMes(-1)}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-center font-bold sm:min-w-[132px] sm:flex-none">
          {MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1)} de {ano}
        </span>
        <Button
          variante="principal"
          tamanho="icone"
          className="shrink-0"
          onClick={() => handleMudarMes(1)}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variante="secundario" tamanho="sm" onClick={handleIrParaHoje} className="ml-1 min-h-[44px] px-3 shrink-0">
          Hoje
        </Button>
      </div>

      <Button
        variante="fantasma"
        tamanho="icone"
        className={`${botaoSeta} !w-9 !min-w-[36px]`}
        onClick={() => handlePaginar(-1)}
        aria-label="Dia anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div
        ref={faixaRef}
        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-0.5 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: totalDias }, (_, i) => {
          const dia = new Date(ano, mes, i + 1);
          const chave = chaveDiaLocal(dia);
          const distancia = Math.round((dia.getTime() - inicio.getTime()) / 86400000);
          const ativo = distancia === 0;
          const naJanela = distancia > 0 && distancia < colunas;
          const fechado = !diasAbertos[dia.getDay()];
          const quantidade = contagens[chave] || 0;
          const pontos = Math.min(3, Math.ceil(quantidade / 4));
          const ehHoje = chave === hoje;

          return (
            <button
              key={chave}
              ref={ativo ? ativoRef : undefined}
              type="button"
              onClick={() => aoSelecionarDia(dia)}
              aria-label={`${i + 1} de ${MESES[mes]}, ${quantidade} agendamentos${fechado ? ", fechado" : ""}`}
              aria-current={ativo ? "date" : undefined}
              className={[
                "snap-center flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border w-[52px] sm:w-[58px] min-h-[68px] transition-colors",
                ativo
                  ? "bg-[#B45A2B] border-[#B45A2B] text-white"
                  : naJanela
                  ? "bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                  : ehHoje
                  ? "border-[#B45A2B] hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  : "border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-800",
                fechado && !ativo ? "opacity-45" : "",
              ].join(" ")}
            >
              <span className="text-[11px] font-medium uppercase opacity-70">{DIAS_CURTOS[dia.getDay()]}</span>
              <span className={`text-lg font-bold ${ehHoje && !ativo ? "text-[#B45A2B]" : ""}`}>{i + 1}</span>
              <span className="flex h-1.5 gap-[3px]" aria-hidden="true">
                {Array.from({ length: pontos }, (_, p) => (
                  <i key={p} className={`h-[5px] w-[5px] rounded-full ${ativo ? "bg-white" : "bg-[#B45A2B]"}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        variante="fantasma"
        tamanho="icone"
        className={`${botaoSeta} !w-9 !min-w-[36px]`}
        onClick={() => handlePaginar(1)}
        aria-label="Próximo dia"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
