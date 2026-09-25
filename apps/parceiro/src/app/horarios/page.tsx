"use client";

import * as React from "react";
import Link from "next/link";
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
  type HorarioBarbearia,
  type Barbearia,
} from "@barzzo/tipos";
import { esquemaHorarioBarbearia } from "@barzzo/validacoes";
import {
  Clock,
  Save,
  Copy,
  CheckCircle,
  AlertTriangle,
  Store,
  ArrowRight,
} from "lucide-react";

interface HorarioFormState {
  dia_semana: DiaSemana;
  ativo: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  tem_almoco: boolean;
  hora_inicio_almoco: string;
  hora_fim_almoco: string;
}

const DIAS_ORDENADOS: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0]; // Começando por Segunda-feira para fluxo comercial natural

export default function PaginaHorariosFuncionamento() {
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);

  const [horarios, setHorarios] = React.useState<Record<DiaSemana, HorarioFormState>>({
    0: { dia_semana: 0, ativo: false, hora_abertura: "09:00", hora_fechamento: "14:00", tem_almoco: false, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
    1: { dia_semana: 1, ativo: true, hora_abertura: "09:00", hora_fechamento: "19:00", tem_almoco: true, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
    2: { dia_semana: 2, ativo: true, hora_abertura: "09:00", hora_fechamento: "19:00", tem_almoco: true, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
    3: { dia_semana: 3, ativo: true, hora_abertura: "09:00", hora_fechamento: "19:00", tem_almoco: true, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
    4: { dia_semana: 4, ativo: true, hora_abertura: "09:00", hora_fechamento: "19:00", tem_almoco: true, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
    5: { dia_semana: 5, ativo: true, hora_abertura: "09:00", hora_fechamento: "20:00", tem_almoco: true, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
    6: { dia_semana: 6, ativo: true, hora_abertura: "08:30", hora_fechamento: "18:00", tem_almoco: false, hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" },
  });

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarHorarios();
  }, []);

  async function carregarHorarios() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membro || !membro.barbearia_id) {
        setErro("Nenhuma barbearia vinculada.");
        return;
      }

      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) {
        setBarbearia(bDb as Barbearia);
      }

      // Buscar horários já salvos no banco
      const { data: horariosDb, error: erroDb } = await supabase
        .from("horarios_barbearia")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id);

      if (erroDb) {
        setErro("Não foi possível carregar os horários configurados.");
        return;
      }

      if (horariosDb && horariosDb.length > 0) {
        const novosHorarios = { ...horarios };
        horariosDb.forEach((h: HorarioBarbearia) => {
          novosHorarios[h.dia_semana] = {
            dia_semana: h.dia_semana,
            ativo: h.ativo,
            hora_abertura: h.hora_abertura.slice(0, 5),
            hora_fechamento: h.hora_fechamento.slice(0, 5),
            tem_almoco: Boolean(h.hora_inicio_almoco && h.hora_fim_almoco),
            hora_inicio_almoco: h.hora_inicio_almoco ? h.hora_inicio_almoco.slice(0, 5) : "12:00",
            hora_fim_almoco: h.hora_fim_almoco ? h.hora_fim_almoco.slice(0, 5) : "13:00",
          };
        });
        setHorarios(novosHorarios);
      }
    } catch {
      setErro("Erro inesperado ao consultar horários.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizarDia(dia: DiaSemana, campos: Partial<HorarioFormState>) {
    setHorarios((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], ...campos },
    }));
  }

  function copiarSegundaParaDiasUteis() {
    const modelo = horarios[1]; // Segunda
    setHorarios((prev) => ({
      ...prev,
      2: { ...modelo, dia_semana: 2 },
      3: { ...modelo, dia_semana: 3 },
      4: { ...modelo, dia_semana: 4 },
      5: { ...modelo, dia_semana: 5 },
    }));
    setSucesso("Horários de Segunda replicados com sucesso para Terça a Sexta!");
    setTimeout(() => setSucesso(null), 3500);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!barbearia) {
      setErro("Barbearia não identificada.");
      return;
    }

    // Validar cada dia ativo
    const dadosParaSalvar = [];
    for (const dia of DIAS_ORDENADOS) {
      const h = horarios[dia];
      const validacao = esquemaHorarioBarbearia.safeParse({
        dia_semana: h.dia_semana,
        hora_abertura: h.hora_abertura,
        hora_fechamento: h.hora_fechamento,
        hora_inicio_almoco: h.tem_almoco ? h.hora_inicio_almoco : null,
        hora_fim_almoco: h.tem_almoco ? h.hora_fim_almoco : null,
        ativo: h.ativo,
      });

      if (!validacao.success) {
        const diaNome = NOMES_DIAS_SEMANA[dia];
        const msg = validacao.error.errors[0]?.message || "Horário inválido";
        setErro(`${diaNome}: ${msg}`);
        return;
      }

      dadosParaSalvar.push({
        barbearia_id: barbearia.id,
        dia_semana: h.dia_semana,
        hora_abertura: h.hora_abertura,
        hora_fechamento: h.hora_fechamento,
        hora_inicio_almoco: h.ativo && h.tem_almoco ? h.hora_inicio_almoco : null,
        hora_fim_almoco: h.ativo && h.tem_almoco ? h.hora_fim_almoco : null,
        ativo: h.ativo,
      });
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

      // Upsert na tabela horarios_barbearia
      const { error: erroUpsert } = await supabase
        .from("horarios_barbearia")
        .upsert(dadosParaSalvar, { onConflict: "barbearia_id,dia_semana" });

      if (erroUpsert) {
        setErro("Não foi possível salvar os horários de funcionamento.");
        return;
      }

      setSucesso("Grade de horários de funcionamento atualizada com sucesso!");
    } catch {
      setErro("Erro inesperado ao salvar os horários.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando horários de funcionamento...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Horários de Funcionamento</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] font-semibold border border-[#B45A2B]/20">
              Grade Semanal
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Defina os dias e horas em que a barbearia abre e fecha para o público.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copiarSegundaParaDiasUteis}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] flex items-center gap-1.5 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-[#B45A2B]" /> Copiar Segunda p/ Ter-Sex
          </button>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="flex flex-col gap-6">
        <Card camada="primaria">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Programação Semanal</CardTitle>
            <CardDescription>
              Os horários cadastrados limitam a disponibilidade de todos os profissionais e impedem agendamentos fora do expediente.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {DIAS_ORDENADOS.map((dia) => {
              const h = horarios[dia];
              const nomeDia = NOMES_DIAS_SEMANA[dia];
              const siglaDia = NOMES_CURTOS_DIAS_SEMANA[dia];

              return (
                <div
                  key={dia}
                  className={`py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    !h.ativo ? "opacity-60 bg-neutral-100/30 dark:bg-neutral-900/30 -mx-6 px-6" : ""
                  }`}
                >
                  {/* Dia e Toggle */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        h.ativo
                          ? "bg-[#B45A2B] text-white"
                          : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      {siglaDia}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{nomeDia}</span>
                      <span className="text-xs opacity-60">
                        {h.ativo ? "Aberto ao público" : "Fechado"}
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer ml-auto md:ml-2">
                      <input
                        type="checkbox"
                        checked={h.ativo}
                        onChange={(e) => atualizarDia(dia, { ativo: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#16A34A]"></div>
                    </label>
                  </div>

                  {/* Horários de Expediente e Almoço */}
                  {h.ativo ? (
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-end gap-4 text-xs">
                      {/* Expediente */}
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">Expediente:</span>
                        <input
                          type="time"
                          value={h.hora_abertura}
                          onChange={(e) => atualizarDia(dia, { hora_abertura: e.target.value })}
                          className="px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                          required
                        />
                        <span className="opacity-50">às</span>
                        <input
                          type="time"
                          value={h.hora_fechamento}
                          onChange={(e) => atualizarDia(dia, { hora_fechamento: e.target.value })}
                          className="px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                          required
                        />
                      </div>

                      {/* Pausa Almoço */}
                      <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l border-neutral-200 dark:border-neutral-800">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={h.tem_almoco}
                            onChange={(e) => atualizarDia(dia, { tem_almoco: e.target.checked })}
                            className="rounded border-neutral-300 dark:border-neutral-700 text-[#B45A2B] focus:ring-[#B45A2B]"
                          />
                          <span className="opacity-70">Almoço:</span>
                        </label>

                        {h.tem_almoco ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={h.hora_inicio_almoco}
                              onChange={(e) => atualizarDia(dia, { hora_inicio_almoco: e.target.value })}
                              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                              required
                            />
                            <span className="opacity-50">-</span>
                            <input
                              type="time"
                              value={h.hora_fim_almoco}
                              onChange={(e) => atualizarDia(dia, { hora_fim_almoco: e.target.value })}
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
                      Não haverá atendimentos neste dia.
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Footer com Botão de Ação */}
        <div className="flex items-center justify-between">
          <Link href="/painel" className="text-xs font-semibold opacity-70 hover:opacity-100">
            Voltar para o Painel
          </Link>

          <Button variante="principal" type="submit" disabled={salvando} tamanho="lg">
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando Grade..." : "Salvar Horários de Funcionamento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
