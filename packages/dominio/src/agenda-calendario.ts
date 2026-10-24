// Funções puras da agenda em formato de calendário (grade de horários por dia).
import { minutosParaTime, timeParaMinutos } from "./disponibilidade";

export interface IntervaloEmMinutos {
  inicioMin: number;
  fimMin: number;
}

export interface BlocoPosicionado<T extends IntervaloEmMinutos> {
  item: T;
  /** Faixa (coluna interna) do bloco quando há sobreposição no mesmo dia. */
  faixa: number;
  totalFaixas: number;
}

/** Chave `AAAA-MM-DD` no fuso do dispositivo. */
export function chaveDiaLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Minutos desde 00:00 locais de um instante ISO (ex.: `inicio_previsto`). */
export function minutosDoDiaLocal(instanteIso: string | Date): number {
  const data = new Date(instanteIso);
  return data.getHours() * 60 + data.getMinutes();
}

/** Quantos dias cabem lado a lado: um por vez no celular, vários em telas largas. */
export function quantidadeColunasAgenda(larguraPx: number): 1 | 3 | 5 | 7 {
  if (larguraPx < 640) return 1;
  if (larguraPx < 900) return 3;
  if (larguraPx < 1250) return 5;
  return 7;
}

/**
 * Distribui blocos que se sobrepõem em faixas lado a lado (um grupo por intervalo
 * contínuo de sobreposição), preservando a largura total quando não há conflito.
 */
export function posicionarSobrepostos<T extends IntervaloEmMinutos>(itens: T[]): BlocoPosicionado<T>[] {
  const ordenados = [...itens].sort((a, b) => a.inicioMin - b.inicioMin || a.fimMin - b.fimMin);
  const grupos: { fim: number; itens: T[] }[] = [];

  for (const item of ordenados) {
    let grupo = grupos.find((g) => g.fim > item.inicioMin);
    if (!grupo) {
      grupo = { fim: 0, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(item);
    grupo.fim = Math.max(grupo.fim, item.fimMin);
  }

  const resultado: BlocoPosicionado<T>[] = [];
  for (const grupo of grupos) {
    const fimPorFaixa: number[] = [];
    const faixaDe = new Map<T, number>();
    for (const item of grupo.itens) {
      let faixa = fimPorFaixa.findIndex((fim) => fim <= item.inicioMin);
      if (faixa < 0) {
        faixa = fimPorFaixa.length;
        fimPorFaixa.push(0);
      }
      fimPorFaixa[faixa] = item.fimMin;
      faixaDe.set(item, faixa);
    }
    for (const item of grupo.itens) {
      resultado.push({ item, faixa: faixaDe.get(item)!, totalFaixas: fimPorFaixa.length });
    }
  }
  return resultado;
}

/**
 * Faixa de horas exibida: do menor horário de abertura ao maior de fechamento entre os
 * dias visíveis, com meia hora de folga arredondada para a hora cheia.
 */
export function calcularFaixaHoras(
  funcionamento: Array<{ abertura: number; fechamento: number } | null>,
  padrao: { abertura: number; fechamento: number } = { abertura: 9 * 60, fechamento: 19 * 60 }
): { inicioMin: number; fimMin: number } {
  let abertura = Infinity;
  let fechamento = -Infinity;
  for (const f of funcionamento) {
    if (!f) continue;
    abertura = Math.min(abertura, f.abertura);
    fechamento = Math.max(fechamento, f.fechamento);
  }
  if (!Number.isFinite(abertura)) {
    abertura = padrao.abertura;
    fechamento = padrao.fechamento;
  }
  return {
    inicioMin: Math.max(0, Math.floor((abertura - 30) / 60) * 60),
    fimMin: Math.min(24 * 60, Math.ceil((fechamento + 30) / 60) * 60),
  };
}

function pluralizar(valor: number, singular: string, plural: string): string {
  return `${valor} ${valor === 1 ? singular : plural}`;
}

function duracaoCurta(minutos: number): string {
  if (minutos < 60) return pluralizar(minutos, "min", "min");
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Texto curto sobre o momento do agendamento em relação a `agora` (ex.: "Hoje · começa em 35 min"). */
export function descreverMomentoAgendamento(
  inicio: string | Date,
  fim: string | Date,
  status: string,
  agora: Date = new Date()
): string {
  const ini = new Date(inicio);
  const termino = new Date(fim);
  const horaInicio = minutosParaTime(minutosDoDiaLocal(ini));

  if (status === "em_atendimento") return `Em andamento desde ${horaInicio}`;
  if (status === "concluido") return `Concluído · ${chaveDiaLocal(ini) === chaveDiaLocal(agora) ? "hoje" : "em outro dia"}`;
  if (status === "cancelado" || status === "nao_compareceu") return "Não será realizado";

  const hoje = chaveDiaLocal(agora);
  const diaAg = chaveDiaLocal(ini);
  if (diaAg === hoje) {
    const faltam = Math.round((ini.getTime() - agora.getTime()) / 60000);
    if (faltam > 0) return `Hoje · começa em ${duracaoCurta(faltam)}`;
    if (agora.getTime() < termino.getTime()) return "Hoje · no horário de atendimento";
    return `Hoje · estava marcado para ${horaInicio}`;
  }
  const dias = Math.round(
    (new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()).getTime() -
      new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()) / 86400000
  );
  if (dias === 1) return "Amanhã";
  if (dias > 1) return `Daqui a ${dias} dias`;
  if (dias === -1) return "Ontem";
  return `Há ${Math.abs(dias)} dias`;
}

export interface FuncionamentoCelula {
  abertura: number;
  fechamento: number;
  almocoInicio?: number | null;
  almocoFim?: number | null;
}

export interface JornadaCelula {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  hora_inicio_pausa: string | null;
  hora_fim_pausa: string | null;
  ativo: boolean;
}

export interface EntradaProfissionaisLivres {
  /** Dia exibido na coluna (data local). */
  dia: Date;
  /** Início da célula, em minutos desde 00:00 locais. */
  minutos: number;
  /** Duração da célula (padrão: 15 min, o passo da grade). */
  duracaoMin?: number;
  funcionamento: FuncionamentoCelula | null;
  profissionais: Array<{ id: string; jornadas: JornadaCelula[] }>;
  bloqueios: Array<{ inicio: string; fim: string; profissional_id: string | null }>;
  agendamentos: Array<{ profissional_id: string; inicio_previsto: string; fim_previsto: string; status: string }>;
  agora?: Date;
}

/**
 * Profissionais que podem receber um agendamento a partir da célula clicada na grade:
 * barbearia aberta (fora do almoço), horário futuro, dentro da jornada do profissional
 * (fora da pausa), sem bloqueio e sem agendamento ativo sobreposto.
 */
export function profissionaisLivresNaCelula(entrada: EntradaProfissionaisLivres): string[] {
  const { dia, minutos, funcionamento, profissionais, bloqueios, agendamentos } = entrada;
  const duracao = entrada.duracaoMin ?? 15;
  const agora = entrada.agora ?? new Date();
  const fimMin = minutos + duracao;

  if (!funcionamento || minutos < funcionamento.abertura || fimMin > funcionamento.fechamento) return [];
  if (
    funcionamento.almocoInicio != null &&
    funcionamento.almocoFim != null &&
    minutos < funcionamento.almocoFim &&
    fimMin > funcionamento.almocoInicio
  ) {
    return [];
  }

  const inicioMs = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, minutos).getTime();
  const fimMs = inicioMs + duracao * 60000;
  if (inicioMs <= agora.getTime()) return [];

  return profissionais
    .filter((prof) => {
      const jornada = prof.jornadas.find((j) => j.ativo && j.dia_semana === dia.getDay());
      if (!jornada) return false;
      if (minutos < timeParaMinutos(jornada.hora_inicio) || fimMin > timeParaMinutos(jornada.hora_fim)) return false;
      if (jornada.hora_inicio_pausa && jornada.hora_fim_pausa) {
        if (minutos < timeParaMinutos(jornada.hora_fim_pausa) && fimMin > timeParaMinutos(jornada.hora_inicio_pausa)) {
          return false;
        }
      }

      const bloqueado = bloqueios.some(
        (b) =>
          (b.profissional_id === null || b.profissional_id === prof.id) &&
          new Date(b.inicio).getTime() < fimMs &&
          new Date(b.fim).getTime() > inicioMs
      );
      if (bloqueado) return false;

      const ocupado = agendamentos.some(
        (a) =>
          a.profissional_id === prof.id &&
          a.status !== "cancelado" &&
          a.status !== "nao_compareceu" &&
          new Date(a.inicio_previsto).getTime() < fimMs &&
          new Date(a.fim_previsto).getTime() > inicioMs
      );
      return !ocupado;
    })
    .map((prof) => prof.id);
}
