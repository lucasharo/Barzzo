// packages/dominio/src/disponibilidade.ts
// Motor determinístico de cálculo de slots de disponibilidade para o Barzzo.

import {
  Servico,
  HorarioBarbearia,
  JornadaProfissional,
  BloqueioAgenda,
  SlotDisponivel
} from "@barzzo/tipos";

export interface ProfissionalApto {
  id: string;
  nome: string;
  ativo: boolean;
  habilitado: boolean;
  jornada?: JornadaProfissional | null;
}

export interface AgendamentoExistente {
  profissional_id: string;
  inicio: string; // ISO string ou HH:MM
  fim: string;    // ISO string ou HH:MM
}

export interface OpcoesCalculoDisponibilidade {
  servico: Servico;
  horarioBarbearia: HorarioBarbearia | null;
  profissionais: ProfissionalApto[];
  bloqueios?: BloqueioAgenda[];
  agendamentosExistentes?: AgendamentoExistente[];
  data: string; // "YYYY-MM-DD"
  profissionalIdFiltro?: string | null;
  passoMinutos?: number; // padrão: 30
  agora?: Date;
}

/**
 * Converte string no formato "HH:MM" ou "HH:MM:SS" para total de minutos desde 00:00.
 */
export function timeParaMinutos(horaStr: string): number {
  const partes = horaStr.split(":");
  const horas = parseInt(partes[0], 10) || 0;
  const minutos = parseInt(partes[1], 10) || 0;
  return horas * 60 + minutos;
}

/**
 * Converte total de minutos para string no formato "HH:MM".
 */
export function minutosParaTime(minutosTotal: number): string {
  const horas = Math.floor(minutosTotal / 60);
  const minutos = minutosTotal % 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

/**
 * Verifica se dois intervalos [aInicio, aFim] e [bInicio, bFim] se sobrepõem.
 */
export function intervalosSobrepoem(
  aInicio: number,
  aFim: number,
  bInicio: number,
  bFim: number
): boolean {
  return aInicio < bFim && aFim > bInicio;
}

/**
 * Calcula horários disponíveis para um determinado serviço, data e profissional(is).
 */
export function calcularHorariosDisponiveis(
  opcoes: OpcoesCalculoDisponibilidade
): SlotDisponivel[] {
  const {
    servico,
    horarioBarbearia,
    profissionais,
    bloqueios = [],
    agendamentosExistentes = [],
    data,
    profissionalIdFiltro,
    passoMinutos = 30,
    agora = new Date()
  } = opcoes;

  // 1. Serviço inativo -> sem horários
  if (!servico.ativo || servico.duracao_minutos <= 0) {
    return [];
  }

  // 2. Barbearia fechada no dia -> sem horários
  if (!horarioBarbearia || !horarioBarbearia.ativo) {
    return [];
  }

  const aberturaBarbeariaMin = timeParaMinutos(horarioBarbearia.hora_abertura);
  const fechamentoBarbeariaMin = timeParaMinutos(horarioBarbearia.hora_fechamento);

  const almocoInicioMin = horarioBarbearia.hora_inicio_almoco
    ? timeParaMinutos(horarioBarbearia.hora_inicio_almoco)
    : null;
  const almocoFimMin = horarioBarbearia.hora_fim_almoco
    ? timeParaMinutos(horarioBarbearia.hora_fim_almoco)
    : null;

  // Filtrar profissionais aptos
  const profissionaisFiltrados = profissionais.filter((prof) => {
    if (!prof.ativo || !prof.habilitado) return false;
    if (profissionalIdFiltro && prof.id !== profissionalIdFiltro) return false;
    if (!prof.jornada || !prof.jornada.ativo) return false;
    return true;
  });

  const slotsEncontrados: SlotDisponivel[] = [];

  // Data de referência para checar passado
  const dataHojeStr = agora.toISOString().split("T")[0];
  const ehHoje = data === dataHojeStr;
  const agoraMinutos = agora.getHours() * 60 + agora.getMinutes();

  for (const prof of profissionaisFiltrados) {
    const jornada = prof.jornada!;
    const jornadaInicioMin = timeParaMinutos(jornada.hora_inicio);
    const jornadaFimMin = timeParaMinutos(jornada.hora_fim);

    // Limites de operação são a interseção entre o funcionamento da barbearia e a jornada do profissional
    const limiteInicioMin = Math.max(aberturaBarbeariaMin, jornadaInicioMin);
    const limiteFimMin = Math.min(fechamentoBarbeariaMin, jornadaFimMin);

    const pausaInicioMin = jornada.hora_inicio_pausa
      ? timeParaMinutos(jornada.hora_inicio_pausa)
      : null;
    const pausaFimMin = jornada.hora_fim_pausa
      ? timeParaMinutos(jornada.hora_fim_pausa)
      : null;

    let slotInicio = limiteInicioMin;

    while (slotInicio + servico.duracao_minutos <= limiteFimMin) {
      const slotFim = slotInicio + servico.duracao_minutos;
      let valido = true;

      // 1. Checagem do almoço da barbearia
      if (almocoInicioMin !== null && almocoFimMin !== null) {
        if (intervalosSobrepoem(slotInicio, slotFim, almocoInicioMin, almocoFimMin)) {
          valido = false;
        }
      }

      // 2. Checagem da pausa do profissional
      if (valido && pausaInicioMin !== null && pausaFimMin !== null) {
        if (intervalosSobrepoem(slotInicio, slotFim, pausaInicioMin, pausaFimMin)) {
          valido = false;
        }
      }

      // 3. Checagem de horário passado no dia de hoje
      if (valido && ehHoje) {
        if (slotInicio <= agoraMinutos) {
          valido = false;
        }
      }

      // 4. Checagem de bloqueios de agenda
      if (valido && bloqueios.length > 0) {
        const [ano, mes, dia] = data.split("-").map(Number);
        const [hIni, mIni] = minutosParaTime(slotInicio).split(":").map(Number);
        const [hFim, mFim] = minutosParaTime(slotFim).split(":").map(Number);
        const slotDataInicioMs = new Date(ano, mes - 1, dia, hIni, mIni, 0, 0).getTime();
        const slotDataFimMs = new Date(ano, mes - 1, dia, hFim, mFim, 0, 0).getTime();

        for (const bloq of bloqueios) {
          // Bloqueio afeta se for geral da barbearia ou do próprio profissional
          if (!bloq.profissional_id || bloq.profissional_id === prof.id) {
            let bloqInicioMs: number;
            let bloqFimMs: number;

            if (bloq.inicio.includes("T")) {
              bloqInicioMs = new Date(bloq.inicio).getTime();
              bloqFimMs = new Date(bloq.fim).getTime();
            } else {
              const [bHIni, bMIni] = bloq.inicio.split(":").map(Number);
              const [bHFim, bMFim] = bloq.fim.split(":").map(Number);
              bloqInicioMs = new Date(ano, mes - 1, dia, bHIni, bMIni, 0, 0).getTime();
              bloqFimMs = new Date(ano, mes - 1, dia, bHFim, bMFim, 0, 0).getTime();
            }

            if (intervalosSobrepoem(slotDataInicioMs, slotDataFimMs, bloqInicioMs, bloqFimMs)) {
              valido = false;
              break;
            }
          }
        }
      }

      // 5. Checagem de agendamentos existentes do profissional
      if (valido && agendamentosExistentes.length > 0) {
        const [ano, mes, dia] = data.split("-").map(Number);
        const [hIni, mIni] = minutosParaTime(slotInicio).split(":").map(Number);
        const [hFim, mFim] = minutosParaTime(slotFim).split(":").map(Number);
        const slotDataInicioMs = new Date(ano, mes - 1, dia, hIni, mIni, 0, 0).getTime();
        const slotDataFimMs = new Date(ano, mes - 1, dia, hFim, mFim, 0, 0).getTime();

        for (const ag of agendamentosExistentes) {
          if (ag.profissional_id === prof.id) {
            let agInicioMs: number;
            let agFimMs: number;

            if (ag.inicio.includes("T")) {
              agInicioMs = new Date(ag.inicio).getTime();
              agFimMs = new Date(ag.fim).getTime();
            } else {
              const [aHIni, aMIni] = ag.inicio.split(":").map(Number);
              const [aHFim, aMFim] = ag.fim.split(":").map(Number);
              agInicioMs = new Date(ano, mes - 1, dia, aHIni, aMIni, 0, 0).getTime();
              agFimMs = new Date(ano, mes - 1, dia, aHFim, aMFim, 0, 0).getTime();
            }

            if (intervalosSobrepoem(slotDataInicioMs, slotDataFimMs, agInicioMs, agFimMs)) {
              valido = false;
              break;
            }
          }
        }
      }

      if (valido) {
        slotsEncontrados.push({
          horario: minutosParaTime(slotInicio),
          duracao_minutos: servico.duracao_minutos,
          profissional_id: prof.id,
          profissional_nome: prof.nome
        });
      }

      slotInicio += passoMinutos;
    }
  }

  // Ordenar por horário e depois por nome do profissional
  return slotsEncontrados.sort((a, b) => {
    if (a.horario !== b.horario) {
      return a.horario.localeCompare(b.horario);
    }
    return a.profissional_nome.localeCompare(b.profissional_nome);
  });
}
