import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";

/** Reagenda pela RPC e devolve a mensagem de erro (em português) ou null quando deu certo. */
export async function reagendarAgendamento(
  agendamentoId: string,
  novo: { inicioIso: string; fimIso: string; profissionalId: string }
): Promise<string | null> {
  try {
    const supabase = criarClienteSupabaseBrowser();
    const { error } = await supabase.rpc("reagendar_agendamento", {
      p_agendamento_id: agendamentoId,
      p_novo_inicio: novo.inicioIso,
      p_novo_fim: novo.fimIso,
      p_novo_profissional_id: novo.profissionalId,
    });

    if (error) {
      if (error.message.includes("conflitante") || error.message.includes("exclusion_violation")) {
        return "Conflito de horário: o profissional já tem um agendamento neste horário.";
      }
      return traduzirErro(error, "Não foi possível reagendar o atendimento.");
    }
    return null;
  } catch {
    return "Erro inesperado ao reagendar.";
  }
}
