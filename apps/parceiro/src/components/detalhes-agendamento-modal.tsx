import * as React from "react";
import { Button, Input, Label, Modal, Seletor, SeletorData, obterBadgePadrao } from "@barzzo/ui";
import {
  calcularComparativoTempo,
  descreverMomentoAgendamento,
  minutosDoDiaLocal,
  minutosParaTime,
} from "@barzzo/dominio";
import { dataLocalIso, formatarTelefone } from "@barzzo/utilitarios";
import type { AgendamentoComDetalhes, Profissional, StatusAgendamento } from "@barzzo/tipos";
import { MessageCircle, Phone, RotateCcw } from "lucide-react";

interface DetalhesAgendamentoModalProps {
  agendamento: AgendamentoComDetalhes | null;
  aoFechar: () => void;
  carregandoAcao: boolean;
  aoAlterarStatus: (id: string, status: StatusAgendamento) => void;
  /** Profissionais ativos, usados na troca de profissional ao reagendar. */
  profissionais: Profissional[];
  /** Devolve a mensagem de erro (em português) ou null quando o reagendamento deu certo. */
  aoReagendar: (
    id: string,
    novo: { inicioIso: string; fimIso: string; profissionalId: string }
  ) => Promise<string | null>;
}

const ORIGEM: Record<string, string> = {
  parceiro: "Agendado pelo parceiro",
  cliente: "Agendado pelo cliente (app)",
  marketplace: "Agendado pelo marketplace",
};

const moeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);

function dataPorExtenso(data: Date) {
  const texto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function dataHoraCurta(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${dia} às ${minutosParaTime(d.getHours() * 60 + d.getMinutes())}`;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-65">{titulo}</h3>
      {children}
    </section>
  );
}

const CARTAO = "flex flex-col gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#1C1C1F] p-3";

function Linha({ rotulo, children }: { rotulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0">{rotulo}</span>
      <span className="shrink-0 text-right">{children}</span>
    </div>
  );
}

export function DetalhesAgendamentoModal({
  agendamento,
  aoFechar,
  carregandoAcao,
  aoAlterarStatus,
  profissionais,
  aoReagendar,
}: DetalhesAgendamentoModalProps) {
  const [confirmandoCancelamento, setConfirmandoCancelamento] = React.useState(false);
  const [reagendando, setReagendando] = React.useState(false);
  const [salvandoReagendamento, setSalvandoReagendamento] = React.useState(false);
  const [erroReagendamento, setErroReagendamento] = React.useState<string | null>(null);
  const [novaData, setNovaData] = React.useState("");
  const [novoHorario, setNovoHorario] = React.useState("");
  const [novoProfissionalId, setNovoProfissionalId] = React.useState("");

  React.useEffect(() => {
    setConfirmandoCancelamento(false);
    setReagendando(false);
    setErroReagendamento(null);
  }, [agendamento?.id]);

  function abrirReagendamento(atual: AgendamentoComDetalhes) {
    const inicioAtual = new Date(atual.inicio_previsto);
    setNovaData(dataLocalIso(inicioAtual));
    setNovoHorario(minutosParaTime(minutosDoDiaLocal(inicioAtual)));
    setNovoProfissionalId(atual.profissional_id);
    setErroReagendamento(null);
    setReagendando(true);
  }

  async function confirmarReagendamento(atual: AgendamentoComDetalhes) {
    const [ano, mes, dia] = novaData.split("-").map(Number);
    const [hora, minuto] = novoHorario.split(":").map(Number);
    if (!ano || !mes || !dia || Number.isNaN(hora) || Number.isNaN(minuto)) {
      setErroReagendamento("Informe a nova data e o novo horário.");
      return;
    }
    const inicio = new Date(ano, mes - 1, dia, hora, minuto);
    if (inicio.getTime() < Date.now()) {
      setErroReagendamento("Escolha um horário que ainda não passou.");
      return;
    }
    const fim = new Date(inicio.getTime() + atual.duracao_total_minutos * 60000);

    setSalvandoReagendamento(true);
    setErroReagendamento(null);
    const erro = await aoReagendar(atual.id, {
      inicioIso: inicio.toISOString(),
      fimIso: fim.toISOString(),
      profissionalId: novoProfissionalId,
    });
    setSalvandoReagendamento(false);
    if (erro) setErroReagendamento(erro);
  }

  if (!agendamento) {
    return <Modal aberto={false} aoFechar={aoFechar}>{null}</Modal>;
  }

  const ag = agendamento;
  const inicio = new Date(ag.inicio_previsto);
  const fim = new Date(ag.fim_previsto);
  const badge = obterBadgePadrao(ag.status);
  const servicos = ag.servicos && ag.servicos.length > 0 ? ag.servicos : null;
  const total = Number(ag.preco_total);
  const temCupom = !!ag.codigo_cupom_snapshot;
  const desconto = Number(ag.desconto_snapshot || 0);
  const subtotal = ag.valor_bruto_servicos_snapshot != null ? Number(ag.valor_bruto_servicos_snapshot) : total + desconto;
  const digitosTelefone = (ag.cliente_telefone || "").replace(/\D/g, "");
  const numeroWhatsapp = digitosTelefone.startsWith("55") && digitosTelefone.length >= 12 ? digitosTelefone : `55${digitosTelefone}`;
  const ativo = ag.status === "confirmado" || ag.status === "em_atendimento" || ag.status === "pendente";
  const fimMin = minutosDoDiaLocal(fim);
  const comparativo = calcularComparativoTempo(ag.inicio_previsto, ag.fim_previsto, ag.inicio_real, ag.fim_real);
  const horaReal = (iso: string) => minutosParaTime(minutosDoDiaLocal(iso));

  const podeReagendar = ag.status === "confirmado";
  const botaoAcao = "w-full min-h-[44px]";

  const rodapeReagendamento = (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variante="fantasma"
        tamanho="md"
        className={`${botaoAcao} border border-neutral-300 dark:border-neutral-700`}
        disabled={salvandoReagendamento}
        onClick={() => setReagendando(false)}
      >
        Voltar
      </Button>
      <Button
        variante="principal"
        tamanho="md"
        className={botaoAcao}
        carregando={salvandoReagendamento}
        onClick={() => confirmarReagendamento(ag)}
      >
        Confirmar
      </Button>
    </div>
  );

  const rodapeDetalhes = (
    <div className="flex flex-col gap-2">
      {ativo && (
        <div className="grid grid-cols-2 gap-2">
          {ag.status === "confirmado" && (
            <Button
              variante="principal"
              tamanho="md"
              className={botaoAcao}
              disabled={carregandoAcao}
              onClick={() => aoAlterarStatus(ag.id, "em_atendimento")}
            >
              Iniciar
            </Button>
          )}

          {ag.status === "em_atendimento" && (
            <Button
              variante="principal"
              tamanho="md"
              className={`${botaoAcao} bg-[#16A34A] text-white hover:bg-[#15803D]`}
              disabled={carregandoAcao}
              onClick={() => aoAlterarStatus(ag.id, "concluido")}
            >
              Concluir
            </Button>
          )}

          {podeReagendar && (
            <Button
              variante="secundario"
              tamanho="md"
              className={botaoAcao}
              disabled={carregandoAcao}
              onClick={() => abrirReagendamento(ag)}
            >
              <RotateCcw className="mr-1.5 h-4 w-4 shrink-0" /> Reagendar
            </Button>
          )}

          {ag.status === "confirmado" && (
            <Button
              variante="cancelar-destrutivo"
              tamanho="md"
              className={`${botaoAcao} whitespace-nowrap px-2`}
              disabled={carregandoAcao}
              onClick={() => aoAlterarStatus(ag.id, "nao_compareceu")}
            >
              Não compareceu
            </Button>
          )}

          <Button
            variante={confirmandoCancelamento ? "cancelar-destrutivo" : "cancelar-simples"}
            tamanho="md"
            className={botaoAcao}
            disabled={carregandoAcao}
            onClick={() => {
              if (!confirmandoCancelamento) {
                setConfirmandoCancelamento(true);
                return;
              }
              aoAlterarStatus(ag.id, "cancelado");
            }}
          >
            {confirmandoCancelamento ? "Confirmar cancelamento" : "Cancelar"}
          </Button>
        </div>
      )}

    </div>
  );

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={reagendando ? "Reagendar" : "Agendamento"}
      tamanho="lg"
      posicao="centralizado"
      acaoCabecalho={
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.classe}`}>
          {badge.label}
        </span>
      }
      rodape={reagendando ? rodapeReagendamento : ativo ? rodapeDetalhes : undefined}
    >
      {reagendando ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm opacity-80">
            Reagendar <b>{ag.cliente_nome}</b> ({ag.duracao_total_minutos} min). O horário atual é{" "}
            {dataPorExtenso(inicio)}, {minutosParaTime(minutosDoDiaLocal(inicio))}.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reagendar-data">Nova data</Label>
            <SeletorData id="reagendar-data" valor={novaData} aoMudar={setNovaData} min={dataLocalIso()} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reagendar-hora">Novo horário de início</Label>
            <Input
              id="reagendar-hora"
              type="time"
              step={900}
              value={novoHorario}
              onChange={(e) => setNovoHorario(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reagendar-prof">Profissional</Label>
            <Seletor
              className="w-full"
              valor={novoProfissionalId}
              aoMudar={setNovoProfissionalId}
              placeholder="Selecione o profissional"
              opcoes={profissionais.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            />
          </div>

          {erroReagendamento && (
            <div role="alert" className="rounded-lg border border-[#DC2626] bg-[#DC2626]/10 p-3 text-sm text-[#DC2626]">
              {erroReagendamento}
            </div>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#1C1C1F] p-3 max-sm:flex-col max-sm:items-start">
          <div className="min-w-[84px] rounded-lg bg-neutral-200 dark:bg-[#252529] px-2 py-1.5 text-center">
            <b className="block text-2xl font-bold tracking-tight">{minutosParaTime(minutosDoDiaLocal(inicio))}</b>
            <span className="text-[11px] opacity-70">até {minutosParaTime(fimMin || 24 * 60)}</span>
          </div>
          <div>
            <div className="text-[15px] font-bold">{dataPorExtenso(inicio)}</div>
            <div className="mt-0.5 text-sm opacity-75">
              {descreverMomentoAgendamento(ag.inicio_previsto, ag.fim_previsto, ag.status)}
            </div>
            <div className="text-sm opacity-75">Duração total: {ag.duracao_total_minutos} min</div>
          </div>
        </div>

        <Secao titulo="Cliente">
          <div className={CARTAO}>
            <div className="text-lg font-bold">{ag.cliente_nome || "Cliente sem nome"}</div>
            {ag.cliente_telefone && (
              <Linha rotulo={<span className="opacity-70">Telefone</span>}>{formatarTelefone(ag.cliente_telefone)}</Linha>
            )}
            {ag.cliente_email && (
              <Linha rotulo={<span className="opacity-70">E-mail</span>}>
                <span className="break-all">{ag.cliente_email}</span>
              </Linha>
            )}
            {ag.cliente_telefone && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${digitosTelefone}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <Phone className="h-4 w-4" /> Ligar
                </a>
                <a
                  href={`https://wa.me/${numeroWhatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            )}
          </div>
        </Secao>

        <Secao titulo="Serviços">
          <div className={CARTAO}>
            {servicos ? (
              servicos.map((s) => (
                <Linha
                  key={s.id}
                  rotulo={
                    <>
                      {s.nome_servico} <span className="opacity-70">· {s.duracao_minutos} min</span>
                    </>
                  }
                >
                  {moeda(Number(s.preco))}
                </Linha>
              ))
            ) : (
              <Linha rotulo="Serviço">{moeda(subtotal)}</Linha>
            )}
            {temCupom && (
              <>
                <Linha rotulo={<span className="opacity-70">Subtotal</span>}>{moeda(subtotal)}</Linha>
                <Linha
                  rotulo={
                    <span className="font-medium text-[#16A34A]">
                      Cupom {ag.codigo_cupom_snapshot}
                      {ag.influenciador_nome_snapshot && (
                        <span className="opacity-70"> ({ag.influenciador_nome_snapshot})</span>
                      )}
                    </span>
                  }
                >
                  <span className="font-medium text-[#16A34A]">− {moeda(desconto)}</span>
                </Linha>
              </>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-neutral-300 dark:border-neutral-700 pt-2 text-[15px] font-bold">
              <span>Total</span>
              <span className="text-[#B45A2B]">{moeda(total)}</span>
            </div>
          </div>
        </Secao>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className={`${CARTAO} !gap-0.5`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">Profissional</span>
            <b>{ag.profissional_nome || "Profissional"}</b>
          </div>
          <div className={`${CARTAO} !gap-0.5`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">Origem</span>
            <b>{ORIGEM[ag.origem] || "Agendamento"}</b>
            <span className="text-xs opacity-70">Criado em {dataHoraCurta(ag.criado_em)}</span>
          </div>
        </div>

        <Secao titulo="Execução real">
          <div className={CARTAO}>
            {ag.inicio_real ? (
              <>
                <div className="text-sm font-semibold">
                  Iniciado às {horaReal(ag.inicio_real)}
                  {ag.fim_real ? ` · Fim às ${horaReal(ag.fim_real)}` : " (em andamento)"}
                </div>
                {comparativo.duracaoRealMinutos !== null && (
                  <div className="text-xs opacity-70">
                    Duração real: {comparativo.duracaoRealMinutos} min
                    {comparativo.diferencaDuracaoMinutos !== null && comparativo.diferencaDuracaoMinutos !== 0 && (
                      <span>
                        {" "}
                        ({comparativo.diferencaDuracaoMinutos > 0 ? "+" : ""}
                        {comparativo.diferencaDuracaoMinutos} min)
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <span className="text-sm italic opacity-60">Atendimento ainda não iniciado.</span>
            )}
          </div>
        </Secao>

        {ag.observacoes && (
          <Secao titulo="Observações">
            <div className={`${CARTAO} whitespace-pre-wrap text-sm`}>{ag.observacoes}</div>
          </Secao>
        )}
      </div>
      )}
    </Modal>
  );
}
