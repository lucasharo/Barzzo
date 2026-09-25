import { describe, it, expect } from "vitest";
import {
  validarArquivoImagem,
  calcularDimensoesRedimensionamento,
  TAMANHO_MAXIMO_BYTES,
} from "@barzzo/imagens";

describe("Processamento e Redimensionamento de Imagens", () => {
  describe("validarArquivoImagem", () => {
    it("deve aceitar imagem JPEG com tamanho válido", () => {
      const mockFile = {
        name: "foto.jpg",
        type: "image/jpeg",
        size: 1024 * 1024, // 1MB
      } as File;

      const resultado = validarArquivoImagem(mockFile);
      expect(resultado.valido).toBe(true);
    });

    it("deve aceitar imagem WebP com tamanho válido", () => {
      const mockFile = {
        name: "foto.webp",
        type: "image/webp",
        size: 500 * 1024,
      } as File;

      const resultado = validarArquivoImagem(mockFile);
      expect(resultado.valido).toBe(true);
    });

    it("deve rejeitar formato não suportado (ex: gif ou executável)", () => {
      const mockFile = {
        name: "animacao.gif",
        type: "image/gif",
        size: 1024 * 1024,
      } as File;

      const resultado = validarArquivoImagem(mockFile);
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain("Formato inválido");
    });

    it("deve rejeitar imagem acima de 5MB", () => {
      const mockFile = {
        name: "foto_pesada.jpg",
        type: "image/jpeg",
        size: TAMANHO_MAXIMO_BYTES + 1000,
      } as File;

      const resultado = validarArquivoImagem(mockFile);
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain("5MB");
    });
  });

  describe("calcularDimensoesRedimensionamento", () => {
    it("não deve alterar dimensões se menores que 800x800", () => {
      const { largura, altura } = calcularDimensoesRedimensionamento(600, 400, 800);
      expect(largura).toBe(600);
      expect(altura).toBe(400);
    });

    it("deve redimensionar proporcionalmente imagem horizontal maior que 800px", () => {
      // 1600x800 (proporção 2:1) -> 800x400
      const { largura, altura } = calcularDimensoesRedimensionamento(1600, 800, 800);
      expect(largura).toBe(800);
      expect(altura).toBe(400);
    });

    it("deve redimensionar proporcionalmente imagem vertical maior que 800px", () => {
      // 600x1200 (proporção 1:2) -> 400x800
      const { largura, altura } = calcularDimensoesRedimensionamento(600, 1200, 800);
      expect(largura).toBe(400);
      expect(altura).toBe(800);
    });

    it("deve manter proporção 1:1 para imagens quadradas grandes", () => {
      // 2000x2000 -> 800x800
      const { largura, altura } = calcularDimensoesRedimensionamento(2000, 2000, 800);
      expect(largura).toBe(800);
      expect(altura).toBe(800);
    });
  });
});
