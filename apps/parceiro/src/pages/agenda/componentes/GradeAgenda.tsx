import * as React from "react";
import {
  calcularFaixaHoras,
  chaveDiaLocal,
  minutosDoDiaLocal,
  minutosParaTime,
  posicionarSobrepostos,
} from "@barzzo/dominio";
import type { AgendamentoComDetalhes, StatusAgendamento } from "@barzzo/tipos";

const HORA_PX = 72;
const MINUTOS_PASSO = 15;
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface FuncionamentoDia {
  abertura: number;
  fechamento: number;
  almocoInicio?: number | null;
  almocoFim?: number | null;
}

interface GradeAgendaProps {
  dias: Date[];
  agendamentos: AgendamentoComDetalhes[];
  /** Funcionamento por dia da semana (0 a 6); ausente significa fechado. */
  funcionamento: Record<number, FuncionamentoDia | null>;
  aoSelecionarAgendamento: (agendamento: AgendamentoComDetalhes) => void;
  /** Clique numa célula livre (ver `celulaLivre`). */
  aoSelecionarHorario: (dia: Date, minutos: number) => void;
  /** Diz se a célula de 15 min comporta um novo agendamento. */
  celulaLivre: (dia: Date, minutos: number) => boolean;
  /** Clique numa célula vazia, mas sem disponibilidade (fora do expediente, passado, pausa, bloqueio). */
  aoSelecionarHorarioIndisponivel?: () => void;
}

const ESTILO_STATUS: Record<string, string> = {
  confirmado: "border-l-[#2563EB] bg-[#2563EB]/15",
  em_atendimento: "border-l-[#EAB308] bg-[#EAB308]/20",
  concluido: "border-l-[#16A34A] bg-[#16A34A]/15",
  cancelado: "border-l-[#DC2626] bg-neutral-200 dark:bg-neutral-800 opacity-60 line-through",
  nao_compareceu: "border-l-[#DC2626] bg-neutral-200 dark:bg-neutral-800 opacity-60 line-through",
};

const HACHURA_FECHADO = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(128,128,128,0.16) 0 6px, transparent 6px 12px)",
};

function estiloStatus(status: StatusAgendamento | string) {
  return ESTILO_STATUS[status] || "border-l-neutral-400 bg-neutral-200 dark:bg-neutral-800";
}

export function GradeAgenda({
  dias,
  agendamentos,
  funcionamento,
  aoSelecionarAgendamento,
  aoSelecionarHorario,
  celulaLivre,
  aoSelecionarHorarioIndisponivel,
}: GradeAgendaProps) {
  const rolagemRef = React.useRef<HTMLDivElement>(null);
  const [fantasma, setFantasma] = React.useState<{ chave: string; minutos: number } | null>(null);
  const [agora, setAgora] = React.useState(() => new Date());

  React.useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(intervalo);
  }, []);

  const colunas = dias.length;
  const faixa = calcularFaixaHoras(dias.map((d) => funcionamento[d.getDay()] ?? null));
  const alturaTotal = ((faixa.fimMin - faixa.inicioMin) / 60) * HORA_PX;
  const px = (minutos: number) => ((minutos - faixa.inicioMin) / 60) * HORA_PX;
  const chaveHoje = chaveDiaLocal(agora);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const primeiroDia = chaveDiaLocal(dias[0]);
  const templateColunas = `56px repeat(${colunas}, minmax(${colunas === 1 ? 0 : 150}px, 1fr))`;

  const porDia = React.useMemo(() => {
    const mapa: Record<string, AgendamentoComDetalhes[]> = {};
    for (const ag of agendamentos) {
      const chave = chaveDiaLocal(new Date(ag.inicio_previsto));
      (mapa[chave] ||= []).push(ag);
    }
    return mapa;
  }, [agendamentos]);

  // Ao trocar a janela de dias, rola até o horário atual (ou o início do expediente).
  React.useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const incluiHoje = dias.some((d) => chaveDiaLocal(d) === chaveHoje);
    const alvo = incluiHoje ? agoraMin - 60 : faixa.inicioMin;
    el.scrollTop = Math.max(0, px(alvo));
  }, [primeiroDia, colunas]);

  // Início (múltiplo de 15 min) da célula sob o cursor, medido a partir do topo da coluna.
  function minutosDaCelula(evento: React.MouseEvent<HTMLDivElement>): number {
    const topo = evento.currentTarget.getBoundingClientRect().top;
    return (
      faixa.inicioMin + Math.floor(((evento.clientY - topo) / HORA_PX) * 60 / MINUTOS_PASSO) * MINUTOS_PASSO
    );
  }

  const horasCheias: number[] = [];
  for (let m = faixa.inicioMin; m < faixa.fimMin; m += 60) horasCheias.push(m);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#141416] overflow-hidden">
      <div ref={rolagemRef} className="relative max-h-[calc(100vh-330px)] min-h-[420px] overflow-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
        <div
          className="sticky top-0 z-10 grid border-b border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#141416]"
          style={{ gridTemplateColumns: templateColunas }}
        >
          <div className="border-r border-neutral-200 dark:border-neutral-800" />
          {dias.map((dia) => {
            const ehHoje = chaveDiaLocal(dia) === chaveHoje;
            return (
              <div
                key={chaveDiaLocal(dia)}
                className="border-r border-neutral-200 dark:border-neutral-800 last:border-r-0 px-1.5 py-2 text-center text-sm font-medium"
              >
                {DIAS_CURTOS[dia.getDay()]}
                <b className={`block text-base ${ehHoje ? "text-[#B45A2B]" : ""}`}>{dia.getDate()}</b>
                {MESES_CURTOS[dia.getMonth()]}
              </div>
            );
          })}
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: templateColunas }}>
          <div className="border-r border-neutral-200 dark:border-neutral-800" style={{ height: alturaTotal }}>
            {horasCheias.map((m) => (
              <div
                key={m}
                className="px-1.5 text-right text-[11px] opacity-70"
                style={{ height: HORA_PX, transform: "translateY(-7px)" }}
              >
                {minutosParaTime(m)}
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const chave = chaveDiaLocal(dia);
            const func = funcionamento[dia.getDay()];
            // Tudo que já passou fica "fechado": o dia inteiro se for anterior a hoje, até agora se for hoje.
            const alturaPassado =
              chave < chaveHoje
                ? alturaTotal
                : chave === chaveHoje
                ? Math.min(alturaTotal, Math.max(0, px(agoraMin)))
                : 0;
            const blocos = posicionarSobrepostos(
              (porDia[chave] || []).map((ag) => {
                const inicioMin = minutosDoDiaLocal(ag.inicio_previsto);
                const duracao = ag.duracao_total_minutos || 30;
                const fimMin = ag.fim_previsto
                  ? Math.min(24 * 60, minutosDoDiaLocal(ag.fim_previsto) || 24 * 60)
                  : inicioMin + duracao;
                return { ag, inicioMin, fimMin: Math.max(fimMin, inicioMin + 15) };
              })
            );

            return (
              <div
                key={chave}
                role="group"
                aria-label={`Horários de ${dia.getDate()} de ${MESES_CURTOS[dia.getMonth()]}`}
                className="relative border-r border-neutral-200 dark:border-neutral-800 last:border-r-0"
                style={{ height: alturaTotal, cursor: fantasma?.chave === chave ? "copy" : "default" }}
                onMouseMove={(evento) => {
                  const minutos = minutosDaCelula(evento);
                  if (!celulaLivre(dia, minutos)) {
                    if (fantasma) setFantasma(null);
                    return;
                  }
                  if (fantasma?.chave !== chave || fantasma.minutos !== minutos) setFantasma({ chave, minutos });
                }}
                onMouseLeave={() => setFantasma(null)}
                onClick={(evento) => {
                  const minutos = minutosDaCelula(evento);
                  if (celulaLivre(dia, minutos)) aoSelecionarHorario(dia, minutos);
                  else aoSelecionarHorarioIndisponivel?.();
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(128,128,128,0.35) 1px, transparent 1px), linear-gradient(rgba(128,128,128,0.15) 1px, transparent 1px)",
                    backgroundSize: `100% ${HORA_PX}px, 100% ${HORA_PX / 4}px`,
                  }}
                />

                {!func ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: alturaTotal, ...HACHURA_FECHADO }} />
                ) : (
                  <>
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0"
                      style={{ height: Math.max(0, px(func.abertura)), ...HACHURA_FECHADO }}
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0"
                      style={{
                        top: px(func.fechamento),
                        height: Math.max(0, alturaTotal - px(func.fechamento)),
                        ...HACHURA_FECHADO,
                      }}
                    />
                  </>
                )}

                {alturaPassado > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0"
                    style={{ height: alturaPassado, ...HACHURA_FECHADO }}
                    aria-hidden="true"
                  />
                )}

                {fantasma?.chave === chave && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-[1] flex items-center rounded-md border border-dashed border-[#B45A2B] bg-[#B45A2B]/10 px-1.5 text-[11px] font-semibold text-[#B45A2B]"
                    style={{ top: px(fantasma.minutos), height: (HORA_PX * MINUTOS_PASSO) / 60 }}
                    aria-hidden="true"
                  >
                    + Agendar às {minutosParaTime(fantasma.minutos)}
                  </div>
                )}

                {blocos.map(({ item, faixa: coluna, totalFaixas }) => {
                  const { ag, inicioMin, fimMin } = item;
                  const largura = 100 / totalFaixas;
                  const servicos = ag.servicos?.map((s) => s.nome_servico).join(", ") || "Serviço";
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={(evento) => {
                        evento.stopPropagation();
                        aoSelecionarAgendamento(ag);
                      }}
                      className={`absolute z-[2] overflow-hidden rounded-lg border border-transparent border-l-4 px-1.5 py-1 text-left leading-tight hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] ${estiloStatus(ag.status)}`}
                      style={{
                        top: px(inicioMin),
                        height: Math.max(((fimMin - inicioMin) / 60) * HORA_PX - 2, 26),
                        left: `calc(${coluna * largura}% + 2px)`,
                        width: `calc(${largura}% - 4px)`,
                      }}
                      aria-label={`${minutosParaTime(inicioMin)}, ${ag.cliente_nome}, ${servicos}`}
                    >
                      <div className="text-[11px] font-bold">
                        {minutosParaTime(inicioMin)} · {fimMin - inicioMin}min
                      </div>
                      <div className="truncate text-xs font-medium">{ag.cliente_nome}</div>
                      <div className="truncate text-[11px] opacity-80">
                        {servicos}
                        {ag.profissional_nome ? ` · ${ag.profissional_nome}` : ""}
                      </div>
                    </button>
                  );
                })}

                {chave === chaveHoje && agoraMin >= faixa.inicioMin && agoraMin <= faixa.fimMin && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[3] h-0.5 bg-[#DC2626]"
                    style={{ top: px(agoraMin) }}
                    aria-hidden="true"
                  >
                    <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[#DC2626]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
