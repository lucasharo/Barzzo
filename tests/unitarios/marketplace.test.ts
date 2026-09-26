import { describe, it, expect, beforeEach } from "vitest";
import {
  calcularDistanciaKm,
  salvarRascunhoReserva,
  obterRascunhoReserva,
  limparRascunhoReserva,
  obterPrecoCorte,
  calcularDestinoAposAuth,
  CHAVE_RASCUNHO_RESERVA,
} from "../../packages/dominio/src/marketplace";
import { esquemaRascunhoReserva } from "../../packages/validacoes/src/marketplace";
import type { RascunhoReserva } from "../../packages/tipos/src/marketplace";

describe("TASK-05: Marketplace e Jornada do Cliente", () => {
  describe("1. Validação de Rascunho de Reserva Pré-Login", () => {
    const rascunhoValido: RascunhoReserva = {
      barbearia_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      barbearia_nome: "Barbearia Vintage Club",
      barbearia_slug: "vintage-club",
      servico_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      servico_nome: "Corte Degradê + Barba Terapia",
      preco: 75,
      duracao_minutos: 45,
      profissional_id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
      profissional_nome: "Carlos Barbeiro",
      data: "2026-10-15",
      horario: "14:30",
      observacoes: "Prefiro navalha e toalha quente",
      codigo_cupom: "PRIMEIRACOMPRA10",
    };

    it("deve validar com sucesso um rascunho completo e preenchido corretamente", () => {
      const resultado = esquemaRascunhoReserva.safeParse(rascunhoValido);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.barbearia_slug).toBe("vintage-club");
        expect(resultado.data.preco).toBe(75);
        expect(resultado.data.codigo_cupom).toBe("PRIMEIRACOMPRA10");
      }
    });

    it("deve aceitar rascunho sem profissional definido ('Qualquer Profissional')", () => {
      const rascunhoSemProfissional = {
        ...rascunhoValido,
        profissional_id: null,
        profissional_nome: null,
      };

      const resultado = esquemaRascunhoReserva.safeParse(rascunhoSemProfissional);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.profissional_id).toBeNull();
      }
    });

    it("deve rejeitar data no formato incorreto (diferente de AAAA-MM-DD)", () => {
      const rascunhoDataInvalida = {
        ...rascunhoValido,
        data: "15/10/2026", // formato brasileiro não aceito no schema ISO
      };

      const resultado = esquemaRascunhoReserva.safeParse(rascunhoDataInvalida);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("Formato de data inválido");
      }
    });

    it("deve rejeitar horário no formato incorreto ou fora dos limites de 24h", () => {
      const rascunhoHoraInvalida1 = { ...rascunhoValido, horario: "25:00" };
      const rascunhoHoraInvalida2 = { ...rascunhoValido, horario: "14:65" };
      const rascunhoHoraInvalida3 = { ...rascunhoValido, horario: "2pm" };

      expect(esquemaRascunhoReserva.safeParse(rascunhoHoraInvalida1).success).toBe(false);
      expect(esquemaRascunhoReserva.safeParse(rascunhoHoraInvalida2).success).toBe(false);
      expect(esquemaRascunhoReserva.safeParse(rascunhoHoraInvalida3).success).toBe(false);
    });

    it("deve rejeitar duração menor que 1 minuto", () => {
      const rascunhoDuracaoInvalida = { ...rascunhoValido, duracao_minutos: 0 };
      const resultado = esquemaRascunhoReserva.safeParse(rascunhoDuracaoInvalida);
      expect(resultado.success).toBe(false);
    });

    it("deve rejeitar IDs que não sejam UUIDs válidos", () => {
      const rascunhoIdInvalido = { ...rascunhoValido, barbearia_id: "id-invalido-123" };
      const resultado = esquemaRascunhoReserva.safeParse(rascunhoIdInvalido);
      expect(resultado.success).toBe(false);
    });
  });

  describe("2. Cálculo de Distância Geográfica (Haversine)", () => {
    it("deve retornar 0 km se origem e destino forem exatamente as mesmas coordenadas", () => {
      const distancia = calcularDistanciaKm(-23.55052, -46.633308, -23.55052, -46.633308);
      expect(distancia).toBe(0);
    });

    it("deve calcular com precisão a distância entre dois pontos urbanos conhecidos", () => {
      // Ponto A: Masp (Av. Paulista): -23.561494, -46.655881
      // Ponto B: Praça da Sé (Centro SP): -23.55052, -46.633308
      // Distância em linha reta: aprox. 2.6 km
      const distancia = calcularDistanciaKm(
        -23.561494,
        -46.655881,
        -23.55052,
        -46.633308
      );

      expect(distancia).toBeGreaterThanOrEqual(2.3);
      expect(distancia).toBeLessThanOrEqual(2.9);
    });

    it("deve calcular a distância interestadual de longa distância (São Paulo a Rio de Janeiro)", () => {
      // São Paulo: -23.5505, -46.6333
      // Rio de Janeiro: -22.9068, -43.1729
      // Distância em linha reta: ~357 km
      const distancia = calcularDistanciaKm(
        -23.5505,
        -46.6333,
        -22.9068,
        -43.1729
      );

      expect(distancia).toBeGreaterThanOrEqual(350);
      expect(distancia).toBeLessThanOrEqual(370);
    });
  });

  describe("3. Persistência de Rascunho Pré-Login no Navegador", () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      // Mock global do localStorage para testes em ambiente Node/Vitest
      global.localStorage = {
        getItem: (chave: string) => mockStorage[chave] || null,
        setItem: (chave: string, valor: string) => {
          mockStorage[chave] = valor;
        },
        removeItem: (chave: string) => {
          delete mockStorage[chave];
        },
        clear: () => {
          mockStorage = {};
        },
        key: (idx: number) => Object.keys(mockStorage)[idx] || null,
        length: Object.keys(mockStorage).length,
      } as any;

      // Mock de window
      (global as any).window = {};
    });

    it("deve salvar o rascunho de reserva com a chave padronizada @barzzo:rascunho_reserva", () => {
      const rascunho: RascunhoReserva = {
        barbearia_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        barbearia_nome: "Barbearia Central",
        barbearia_slug: "central",
        servico_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        servico_nome: "Barba",
        preco: 40,
        duracao_minutos: 30,
        profissional_id: null,
        profissional_nome: null,
        data: "2026-10-20",
        horario: "10:00",
      };

      salvarRascunhoReserva(rascunho);
      expect(mockStorage[CHAVE_RASCUNHO_RESERVA]).toBeDefined();

      const rascunhoRecuperado = obterRascunhoReserva();
      expect(rascunhoRecuperado).not.toBeNull();
      expect(rascunhoRecuperado?.barbearia_slug).toBe("central");
      expect(rascunhoRecuperado?.horario).toBe("10:00");
    });

    it("deve limpar o rascunho ao invocar limparRascunhoReserva", () => {
      mockStorage[CHAVE_RASCUNHO_RESERVA] = JSON.stringify({ barbearia_slug: "teste" });
      expect(obterRascunhoReserva()).not.toBeNull();

      limparRascunhoReserva();
      expect(obterRascunhoReserva()).toBeNull();
      expect(mockStorage[CHAVE_RASCUNHO_RESERVA]).toBeUndefined();
    });

    it("deve retornar null se o storage estiver vazio ou com json corrompido", () => {
      mockStorage[CHAVE_RASCUNHO_RESERVA] = "JSON_CORROMPIDO{";
      expect(obterRascunhoReserva()).toBeNull();
    });
  });

  describe("4. Extração do Preço do Corte para Filtros do Marketplace", () => {
    it("deve priorizar o menor preço de corte avulso ignorando serviços secundários mais baratos como sobrancelha", () => {
      const servicos = [
        { nome: "Sobrancelha / Pezinho", preco: 15, ativo: true },
        { nome: "Corte Tradicional", preco: 35, ativo: true },
        { nome: "Corte Degradê Navalhado", preco: 45, ativo: true },
        { nome: "Corte + Barba Terapia", preco: 70, ativo: true },
      ];

      const precoCorte = obterPrecoCorte(servicos);
      expect(precoCorte).toBe(35);
    });

    it("deve ignorar serviços inativos", () => {
      const servicos = [
        { nome: "Corte Antigo Promocional", preco: 20, ativo: false },
        { nome: "Corte Masculino", preco: 40, ativo: true },
      ];

      const precoCorte = obterPrecoCorte(servicos);
      expect(precoCorte).toBe(40);
    });

    it("deve aceitar combo de corte se for o único serviço de corte disponível na barbearia", () => {
      const servicos = [
        { nome: "Barba Terapia", preco: 30, ativo: true },
        { nome: "Corte e Barba Completo", preco: 65, ativo: true },
      ];

      const precoCorte = obterPrecoCorte(servicos);
      expect(precoCorte).toBe(65);
    });

    it("deve realizar fallback para o menor preço geral caso nenhum serviço tenha o nome corte", () => {
      const servicos = [
        { nome: "Estilo Clássico", preco: 50, ativo: true },
        { nome: "Barboterapia", preco: 35, ativo: true },
      ];

      const precoCorte = obterPrecoCorte(servicos);
      expect(precoCorte).toBe(35);
    });

    it("deve retornar null se a barbearia não tiver serviços ativos cadastrados", () => {
      expect(obterPrecoCorte([])).toBeNull();
      expect(obterPrecoCorte([{ nome: "Corte", preco: 40, ativo: false }])).toBeNull();
    });
  });

  describe("5. Resolução de Destino Pós-Autenticação e Preservação de Rascunho", () => {
    const draftExemplo: RascunhoReserva = {
      barbearia_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      barbearia_nome: "Barbearia Vintage Club",
      barbearia_slug: "vintage-club",
      servico_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      servico_nome: "Corte Degradê",
      preco: 50,
      duracao_minutos: 30,
      profissional_id: null,
      data: "2026-10-20",
      horario: "15:00",
    };

    it("deve retornar o retornoUrl quando fornecido e seguro (começando com /)", () => {
      expect(calcularDestinoAposAuth("/reservar/vintage-club", draftExemplo)).toBe("/reservar/vintage-club");
      expect(calcularDestinoAposAuth("/agendamentos", null)).toBe("/agendamentos");
      expect(calcularDestinoAposAuth("/barbearias/vintage-club", null)).toBe("/barbearias/vintage-club");
    });

    it("deve ignorar retornoUrl malicioso (open redirect) e fazer fallback para o rascunho", () => {
      expect(calcularDestinoAposAuth("https://malicious.com", draftExemplo)).toBe("/reservar/vintage-club");
      expect(calcularDestinoAposAuth("//evil.com", draftExemplo)).toBe("/reservar/vintage-club");
      expect(calcularDestinoAposAuth("javascript:alert(1)", draftExemplo)).toBe("/reservar/vintage-club");
    });

    it("deve retornar a página de reserva da barbearia do rascunho quando não houver retornoUrl", () => {
      expect(calcularDestinoAposAuth(null, draftExemplo)).toBe("/reservar/vintage-club");
      expect(calcularDestinoAposAuth("", draftExemplo)).toBe("/reservar/vintage-club");
      expect(calcularDestinoAposAuth(undefined, draftExemplo)).toBe("/reservar/vintage-club");
    });

    it("deve retornar /perfil se não houver retornoUrl nem rascunho ativo", () => {
      expect(calcularDestinoAposAuth(null, null)).toBe("/perfil");
      expect(calcularDestinoAposAuth(undefined, undefined)).toBe("/perfil");
      expect(calcularDestinoAposAuth("", null)).toBe("/perfil");
    });

    it("deve retornar /perfil se o rascunho não contiver barbearia_slug", () => {
      const draftSemSlug = { ...draftExemplo, barbearia_slug: "" };
      expect(calcularDestinoAposAuth(null, draftSemSlug)).toBe("/perfil");
    });
  });
});
