"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  NOMES_DIAS_SEMANA,
  NOMES_CURTOS_DIAS_SEMANA,
  type DiaSemana,
  type JornadaProfissional,
  type HorarioBarbearia,
  type Profissional,
} from "@barzzo/tipos";
import { esquemaJornadaProfissional } from "@barzzo/validacoes";
import {
  Clock,
  Save,
  Copy,
  ArrowLeft,
  Calendar,
  User,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface JornadaFormState {
  dia_semana: DiaSemana;
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
  tem_pausa: boolean;
  hora_inicio_pausa: string;
  hora_fim_pausa: string;
}

const DIAS_ORDENADOS: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];

export default function PaginaJornadaProfissional() {
  const params = useParams();
  const router = useRouter();
  const profissionalId = params.id as string;

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [profissional, setProfissional] = React.useState<Profissional | null>(null);
  const [horariosBarbearia, setHorariosBarbearia] = React.useState<Record<DiaSemana, HorarioBarbearia | null>>({
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  });

  const [jornadas, setJornadas] = React.useState<Record<DiaSemana, JornadaFormState>>({
    0: { dia_semana: 0, ativo: false, hora_inicio: "09:00", hora_fim: "14:00", tem_pausa: false, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
    1: { dia_semana: 1, ativo: true, hora_inicio: "09:00", hora_fim: "19:00", tem_pausa: true, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
    2: { dia_semana: 2, ativo: true, hora_inicio: "09:00", hora_fim: "19:00", tem_pausa: true, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
    3: { dia_semana: 3, ativo: true, hora_inicio: "09:00", hora_fim: "19:00", tem_pausa: true, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
    4: { dia_semana: 4, ativo: true, hora_inicio: "09:00", hora_fim: "19:00", tem_pausa: true, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
    5: { dia_semana: 5, ativo: true, hora_inicio: "09:00", hora_fim: "20:00", tem_pausa: true, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
    6: { dia_semana: 6, ativo: true, hora_inicio: "08:30", hora_fim: "18:00", tem_pausa: false, hora_inicio_pausa: "12:00", hora_fim_pausa: "13:00" },
  });

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarDados();
  }, [profissionalId]);

  async function carregarDados() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      // Carregar profissional
      const { data: profDb, error: erroProf } = await supabase
        .from("profissionais")
        .select("*")
        .eq("id", profissionalId)
        .single();

      if (erroProf || !profDb) {
        setErro("Profissional não encontrado.");
        return;
      }

      const p = profDb as Profissional;
      setProfissional(p);

      // Carregar horários gerais da barbearia
      const { data: hbDb } = await supabase
        .from("horarios_barbearia")
        .select("*")
        .eq("barbearia_id", p.barbearia_id);

      if (hbDb) {
        const mapaHb: Record<DiaSemana, HorarioBarbearia | null> = {
          0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
        };
        hbDb.forEach((h: HorarioBarbearia) => {
          mapaHb[h.dia_semana] = h;
        });
        setHorariosBarbearia(mapaHb);
      }

      // Carregar jornadas já cadastradas do profissional
      const { data: jDb, error: erroJ } = await supabase
        .from("jornadas_profissionais")
        .select("*")
        .eq("profissional_id", profissionalId);

      if (erroJ) {
        setErro("Não foi possível carregar a jornada configurada.");
        return;
      }

      if (jDb && jDb.length > 0) {
        const novasJornadas = { ...jornadas };
        jDb.forEach((j: JornadaProfissional) => {
          novasJornadas[j.dia_semana] = {
            dia_semana: j.dia_semana,
            ativo: j.ativo,
            hora_inicio: j.hora_inicio.slice(0, 5),
            hora_fim: j.hora_fim.slice(0, 5),
            tem_pausa: Boolean(j.hora_inicio_pausa && j.hora_fim_pausa),
            hora_inicio_pausa: j.hora_inicio_pausa ? j.hora_inicio_pausa.slice(0, 5) : "12:00",
            hora_fim_pausa: j.hora_fim_pausa ? j.hora_fim_pausa.slice(0, 5) : "13:00",
          };
        });
        setJornadas(novasJornadas);
      }
    } catch {
      setErro("Erro ao inicializar página de jornada.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizarDia(dia: DiaSemana, campos: Partial<JornadaFormState>) {
    setJornadas((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], ...campos },
    }));
  }

  function copiarSegundaParaDiasUteis() {
    const modelo = jornadas[1];
    setJornadas((prev) => ({
      ...prev,
      2: { ...modelo, dia_semana: 2 },
      3: { ...modelo, dia_semana: 3 },
      4: { ...modelo, dia_semana: 4 },
      5: { ...modelo, dia_semana: 5 },
    }));
    setSucesso("Horários de Segunda replicados para Terça a Sexta!");
    setTimeout(() => setSucesso(null), 3500);
  }

  function preencherComHorariosBarbearia() {
    const novasJornadas = { ...jornadas };
    DIAS_ORDENADOS.forEach((dia) => {
      const hb = horariosBarbearia[dia];
      if (hb) {
        novasJornadas[dia] = {
          dia_semana: dia,
          ativo: hb.ativo,
          hora_inicio: hb.hora_abertura.slice(0, 5),
          hora_fim: hb.hora_fechamento.slice(0, 5),
          tem_pausa: Boolean(hb.hora_inicio_almoco && hb.hora_fim_almoco),
          hora_inicio_pausa: hb.hora_inicio_almoco ? hb.hora_inicio_almoco.slice(0, 5) : "12:00",
          hora_fim_pausa: hb.hora_fim_almoco ? hb.hora_fim_almoco.slice(0, 5) : "13:00",
        };
      }
    });
    setJornadas(novasJornadas);
    setSucesso("Jornada preenchida com a grade de funcionamento da barbearia!");
    setTimeout(() => setSucesso(null), 3500);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const dadosParaSalvar = [];
    for (const dia of DIAS_ORDENADOS) {
      const j = jornadas[dia];
      const validacao = esquemaJornadaProfissional.safeParse({
        dia_semana: j.dia_semana,
        hora_inicio: j.hora_inicio,
        hora_fim: j.hora_fim,
        hora_inicio_pausa: j.tem_pausa ? j.hora_inicio_pausa : null,
        hora_fim_pausa: j.tem_pausa ? j.hora_fim_pausa : null,
        ativo: j.ativo,
      });

      if (!validacao.success) {
        const diaNome = NOMES_DIAS_SEMANA[dia];
        const msg = validacao.error.errors[0]?.message || "Horário inválido";
        setErro(`${diaNome}: ${msg}`);
        return;
      }

      dadosParaSalvar.push({
        profissional_id: profissionalId,
        dia_semana: j.dia_semana,
        hora_inicio: j.hora_inicio,
        hora_fim: j.hora_fim,
        hora_inicio_pausa: j.ativo && j.tem_pausa ? j.hora_inicio_pausa : null,
        hora_fim_pausa: j.ativo && j.tem_pausa ? j.hora_fim_pausa : null,
        ativo: j.ativo,
      });
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { error: erroUpsert } = await supabase
        .from("jornadas_profissionais")
        .upsert(dadosParaSalvar, { onConflict: "profissional_id,dia_semana" });

      if (erroUpsert) {
        setErro("Erro ao salvar a jornada semanal.");
        return;
      }

      setSucesso("Jornada de trabalho atualizada com sucesso!");
    } catch {
      setErro("Erro inesperado ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando jornada do profissional...</p>
      </div>
    );
  }

  if (!profissional) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-10 w-10 text-[#DC2626]" />
        <h2 className="text-xl font-bold">Profissional não encontrado</h2>
        <Link href="/equipe">
          <Button variante="secundario">Voltar para a Equipe</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Link
          href={`/equipe/${profissional.id}`}
          className="text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Perfil do Profissional
        </Link>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] font-bold text-lg">
            {profissional.nome.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Jornada de {profissional.nome}</h1>
            <p className="text-sm opacity-70">
              Defina os dias da semana e horários em que o profissional estará disponível para atendimento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={preencherComHorariosBarbearia}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#B45A2B]" /> Usar Horário Barbearia
          </button>
          <button
            type="button"
            onClick={copiarSegundaParaDiasUteis}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] flex items-center gap-1.5 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-[#B45A2B]" /> Copiar Seg p/ Ter-Sex
          </button>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="flex flex-col gap-6">
        <Card camada="primaria">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Escala Semanal de Trabalho</CardTitle>
            <CardDescription>
              A jornada do profissional deve coincidir ou estar contida dentro do horário de funcionamento geral da barbearia.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {DIAS_ORDENADOS.map((dia) => {
              const j = jornadas[dia];
              const hb = horariosBarbearia[dia];
              const nomeDia = NOMES_DIAS_SEMANA[dia];
              const siglaDia = NOMES_CURTOS_DIAS_SEMANA[dia];

              // Alerta caso a barbearia esteja fechada neste dia
              const barbeariaFechadaNoDia = hb ? !hb.ativo : false;

              return (
                <div
                  key={dia}
                  className={`py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    !j.ativo ? "opacity-60 bg-neutral-100/30 dark:bg-neutral-900/30 -mx-6 px-6" : ""
                  }`}
                >
                  {/* Dia e Toggle */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        j.ativo
                          ? "bg-[#B45A2B] text-white"
                          : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      {siglaDia}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{nomeDia}</span>
                      <span className="text-xs opacity-60">
                        {j.ativo ? "Escalado para atender" : "Folga"}
                      </span>
                      {barbeariaFechadaNoDia && (
                        <span className="text-[11px] text-[#DC2626] font-medium">
                          Barbearia fechada neste dia
                        </span>
                      )}
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer ml-auto md:ml-2">
                      <input
                        type="checkbox"
                        checked={j.ativo}
                        onChange={(e) => atualizarDia(dia, { ativo: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#16A34A]"></div>
                    </label>
                  </div>

                  {/* Horários */}
                  {j.ativo ? (
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-end gap-4 text-xs">
                      {/* Horário de Trabalho */}
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Jornada:</span>
                        <input
                          type="time"
                          value={j.hora_inicio}
                          onChange={(e) => atualizarDia(dia, { hora_inicio: e.target.value })}
                          className="px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                          required
                        />
                        <span className="opacity-50">às</span>
                        <input
                          type="time"
                          value={j.hora_fim}
                          onChange={(e) => atualizarDia(dia, { hora_fim: e.target.value })}
                          className="px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                          required
                        />
                      </div>

                      {/* Pausa */}
                      <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l border-neutral-200 dark:border-neutral-800">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={j.tem_pausa}
                            onChange={(e) => atualizarDia(dia, { tem_pausa: e.target.checked })}
                            className="rounded border-neutral-300 dark:border-neutral-700 text-[#B45A2B] focus:ring-[#B45A2B]"
                          />
                          <span className="opacity-70">Pausa:</span>
                        </label>

                        {j.tem_pausa ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={j.hora_inicio_pausa}
                              onChange={(e) => atualizarDia(dia, { hora_inicio_pausa: e.target.value })}
                              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                              required
                            />
                            <span className="opacity-50">-</span>
                            <input
                              type="time"
                              value={j.hora_fim_pausa}
                              onChange={(e) => atualizarDia(dia, { hora_fim_pausa: e.target.value })}
                              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                              required
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] opacity-40">Sem pausa</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs opacity-50 italic">
                      Profissional não realiza atendimentos neste dia.
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Link href={`/equipe/${profissional.id}`} className="text-xs font-semibold opacity-70 hover:opacity-100">
            Voltar para o Perfil
          </Link>

          <Button variante="principal" type="submit" disabled={salvando} tamanho="lg">
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar Jornada do Profissional"}
          </Button>
        </div>
      </form>
    </div>
  );
}
