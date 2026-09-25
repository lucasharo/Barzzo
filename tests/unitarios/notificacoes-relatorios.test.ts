import { describe, it, expect } from "vitest";
import {
  esquemaDispositivo,
  esquemaPreferenciasNotificacao,
  esquemaFiltroRelatorio,
} from "@barzzo/validacoes";
import {
  podeEnviarNotificacao,
  montarMensagemNotificacao,
  calcularTicketMedio,
  calcularTaxaOcupacao,
  calcularDiferencaPrevistoReal,
  calcularDatasPeriodo,
} from "@barzzo/dominio";
import type { PreferenciasNotificacao } from "@barzzo/tipos";

describe("Task 09 — Notificações, Dashboard e Relatórios", () => {
  describe("Validação de Dispositivos e Push (esquemaDispositivo)", () => {
    it("deve aceitar dispositivo válido em plataforma web, android e ios", () => {
      const resWeb = esquemaDispositivo.safeParse({
        fcm_token: "fcm_token_web_123456789",
        plataforma: "web",
        modelo: "Chrome no Windows",
      });
      expect(resWeb.success).toBe(true);

      const resAndroid = esquemaDispositivo.safeParse({
        fcm_token: "fcm_token_android_987654321",
        plataforma: "android",
        modelo: "Samsung Galaxy S24",
      });
      expect(resAndroid.success).toBe(true);

      const resIos = esquemaDispositivo.safeParse({
        fcm_token: "fcm_token_ios_abcdef",
        plataforma: "ios",
      });
      expect(resIos.success).toBe(true);
    });

    it("deve rejeitar token vazio", () => {
      const res = esquemaDispositivo.safeParse({
        fcm_token: "   ",
        plataforma: "web",
      });
      expect(res.success).toBe(false);
    });

    it("deve rejeitar plataforma não suportada", () => {
      const res = esquemaDispositivo.safeParse({
        fcm_token: "fcm_token_123",
        plataforma: "smart_tv",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("Preferências e Envio de Notificações (podeEnviarNotificacao)", () => {
    const prefPadrao: PreferenciasNotificacao = {
      usuario_id: "usr-1",
      notificacoes_transacionais: true,
      notificacoes_promocionais: true,
      notificacoes_lembretes: true,
      atualizado_em: new Date().toISOString(),
    };

    it("deve permitir notificação transacional se preferência estiver ativa", () => {
      expect(podeEnviarNotificacao("confirmacao", prefPadrao)).toBe(true);
      expect(podeEnviarNotificacao("cancelamento", prefPadrao)).toBe(true);
    });

    it("deve bloquear notificação promocional se cliente desativou promoções", () => {
      const prefSemPromo: PreferenciasNotificacao = {
        ...prefPadrao,
        notificacoes_promocionais: false,
      };

      expect(podeEnviarNotificacao("promocao", prefSemPromo)).toBe(false);
      // Mas deve continuar entregando confirmações transacionais e lembretes
      expect(podeEnviarNotificacao("confirmacao", prefSemPromo)).toBe(true);
      expect(podeEnviarNotificacao("lembrete", prefSemPromo)).toBe(true);
    });

    it("deve bloquear lembrete se cliente desativou lembretes", () => {
      const prefSemLembrete: PreferenciasNotificacao = {
        ...prefPadrao,
        notificacoes_lembretes: false,
      };

      expect(podeEnviarNotificacao("lembrete", prefSemLembrete)).toBe(false);
      expect(podeEnviarNotificacao("confirmacao", prefSemLembrete)).toBe(true);
    });

    it("notificações de sistema devem ser sempre entregues", () => {
      const prefTudoDesativado: PreferenciasNotificacao = {
        ...prefPadrao,
        notificacoes_transacionais: false,
        notificacoes_promocionais: false,
        notificacoes_lembretes: false,
      };

      expect(podeEnviarNotificacao("sistema", prefTudoDesativado)).toBe(true);
    });

    it("deve permitir envio caso o usuário não tenha registro prévio de preferências", () => {
      expect(podeEnviarNotificacao("confirmacao", null)).toBe(true);
      expect(podeEnviarNotificacao("promocao", null)).toBe(true);
    });
  });

  describe("Geração de Mensagens (montarMensagemNotificacao)", () => {
    it("deve montar mensagem de confirmação com dados da reserva", () => {
      const msg = montarMensagemNotificacao("confirmacao", {
        barbeariaNome: "Barbearia Navalha",
        servicoNome: "Corte Degradê",
        dataHoraFormatada: "25/09 às 15:30",
      });

      expect(msg.titulo).toContain("Confirmado");
      expect(msg.corpo).toContain("Corte Degradê");
      expect(msg.corpo).toContain("Barbearia Navalha");
      expect(msg.corpo).toContain("25/09 às 15:30");
    });

    it("deve montar mensagem de cancelamento com motivo quando informado", () => {
      const msg = montarMensagemNotificacao("cancelamento", {
        barbeariaNome: "Barbearia VIP",
        servicoNome: "Barba Terapia",
        motivoCancelamento: "Imprevisto de agenda do profissional",
      });

      expect(msg.titulo).toContain("Cancelado");
      expect(msg.corpo).toContain("Imprevisto de agenda");
    });
  });

  describe("Cálculo de Ticket Médio (calcularTicketMedio)", () => {
    it("deve calcular ticket médio corretamente", () => {
      const tm = calcularTicketMedio(450, 9);
      expect(tm).toBe(50);
    });

    it("deve arredondar com duas casas decimais", () => {
      const tm = calcularTicketMedio(100, 3);
      expect(tm).toBe(33.33);
    });

    it("deve retornar 0 se não houver atendimentos concluídos", () => {
      expect(calcularTicketMedio(500, 0)).toBe(0);
      expect(calcularTicketMedio(0, 10)).toBe(0);
    });
  });

  describe("Taxa de Ocupação da Jornada (calcularTaxaOcupacao)", () => {
    it("deve calcular percentual de ocupação proporcional", () => {
      // 4 horas atendidas de 8 horas de jornada = 50%
      const ocupacao = calcularTaxaOcupacao(240, 480);
      expect(ocupacao).toBe(50);
    });

    it("não deve ultrapassar 100%", () => {
      const ocupacao = calcularTaxaOcupacao(600, 480);
      expect(ocupacao).toBe(100);
    });

    it("deve retornar 0 se a jornada for nula ou não iniciada", () => {
      expect(calcularTaxaOcupacao(100, 0)).toBe(0);
      expect(calcularTaxaOcupacao(0, 480)).toBe(0);
    });
  });

  describe("Comparativo de Tempo: Previsto vs Real (calcularDiferencaPrevistoReal)", () => {
    it("deve classificar atendimento como pontual dentro da margem de 5 minutos", () => {
      const inicio = "2026-09-25T14:00:00Z";
      const fim = "2026-09-25T14:32:00Z"; // 32 min reais vs 30 min previstos (+2 min)

      const res = calcularDiferencaPrevistoReal(30, inicio, fim);
      expect(res.duracaoRealMinutos).toBe(32);
      expect(res.diferencaMinutos).toBe(2);
      expect(res.statusPontualidade).toBe("pontual");
    });

    it("deve classificar como atrasado quando ultrapassar a margem de 5 minutos", () => {
      const inicio = "2026-09-25T14:00:00Z";
      const fim = "2026-09-25T14:45:00Z"; // 45 min reais vs 30 min previstos (+15 min)

      const res = calcularDiferencaPrevistoReal(30, inicio, fim);
      expect(res.duracaoRealMinutos).toBe(45);
      expect(res.diferencaMinutos).toBe(15);
      expect(res.statusPontualidade).toBe("atrasado");
    });

    it("deve classificar como adiantado quando terminar mais de 5 minutos antes", () => {
      const inicio = "2026-09-25T14:00:00Z";
      const fim = "2026-09-25T14:48:00Z"; // 48 min reais vs 60 min previstos (-12 min)

      const res = calcularDiferencaPrevistoReal(60, inicio, fim);
      expect(res.duracaoRealMinutos).toBe(48);
      expect(res.diferencaMinutos).toBe(-12);
      expect(res.statusPontualidade).toBe("adiantado");
    });
  });

  describe("Cálculo de Datas de Período (calcularDatasPeriodo)", () => {
    it("deve retornar hoje com mesma data de início e fim", () => {
      const dataRef = new Date("2026-09-25T12:00:00Z");
      const datas = calcularDatasPeriodo("hoje", dataRef);
      expect(datas.dataInicio).toBe("2026-09-25");
      expect(datas.dataFim).toBe("2026-09-25");
    });

    it("deve calcular intervalo de 7 dias corretamente", () => {
      const dataRef = new Date("2026-09-25T12:00:00Z");
      const datas = calcularDatasPeriodo("7d", dataRef);
      expect(datas.dataFim).toBe("2026-09-25");
      expect(datas.dataInicio).toBe("2026-09-19");
    });
  });

  describe("Validação de Filtros de Relatório (esquemaFiltroRelatorio)", () => {
    it("deve aceitar datas válidas em ordem cronológica", () => {
      const res = esquemaFiltroRelatorio.safeParse({
        barbearia_id: "c84138e6-e91b-4191-8938-f1f45778a635",
        periodo: "7d",
        data_inicio: "2026-09-01",
        data_fim: "2026-09-07",
      });
      expect(res.success).toBe(true);
    });

    it("deve rejeitar data inicial posterior à data final", () => {
      const res = esquemaFiltroRelatorio.safeParse({
        barbearia_id: "c84138e6-e91b-4191-8938-f1f45778a635",
        periodo: "personalizado",
        data_inicio: "2026-09-10",
        data_fim: "2026-09-01",
      });
      expect(res.success).toBe(false);
    });
  });
});
