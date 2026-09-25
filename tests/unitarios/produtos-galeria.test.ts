import { describe, it, expect } from "vitest";
import {
  esquemaProduto,
  esquemaFotoGaleria,
  esquemaArquivoMidia,
} from "@barzzo/validacoes";
import {
  calcularDimensoesRedimensionamento,
  validarArquivoMidia,
  gerarCaminhoStorage,
  DIMENSAO_MAXIMA_PRODUTO_PX,
  DIMENSAO_MAXIMA_GALERIA_PX,
} from "@barzzo/dominio";

describe("Task 07 — Produtos, Galeria e Pipeline de Imagens", () => {
  describe("Validação de Produtos (esquemaProduto)", () => {
    it("deve aceitar produto válido com todos os campos preenchidos", () => {
      const res = esquemaProduto.safeParse({
        nome: "Pomada Modeladora Efeito Seco",
        descricao: "Fixação forte sem brilho para o dia todo.",
        preco: 49.9,
        foto_url: "https://exemplo.com/fotos/pomada.webp",
        ativo: true,
        destaque: true,
        ordem: 1,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.nome).toBe("Pomada Modeladora Efeito Seco");
        expect(res.data.preco).toBe(49.9);
        expect(res.data.destaque).toBe(true);
      }
    });

    it("deve aceitar produto sem foto e sem descrição", () => {
      const res = esquemaProduto.safeParse({
        nome: "Óleo para Barba 30ml",
        preco: "35.00",
        foto_url: "",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.preco).toBe(35);
        expect(res.data.ativo).toBe(true);
      }
    });

    it("deve rejeitar nome com menos de 2 caracteres", () => {
      const res = esquemaProduto.safeParse({
        nome: "A",
        preco: 20,
      });

      expect(res.success).toBe(false);
    });

    it("deve rejeitar preço negativo", () => {
      const res = esquemaProduto.safeParse({
        nome: "Shampoo Anticaspa",
        preco: -15,
      });

      expect(res.success).toBe(false);
    });
  });

  describe("Validação de Fotos da Galeria (esquemaFotoGaleria)", () => {
    it("deve validar foto válida com URL e destaque capa", () => {
      const res = esquemaFotoGaleria.safeParse({
        titulo: "Corte Fade Degradê com Navalha",
        foto_url: "https://exemplo.com/galeria/corte.webp",
        destaque_capa: true,
        ordem: 0,
      });

      expect(res.success).toBe(true);
    });

    it("deve validar foto sem título opcional", () => {
      const res = esquemaFotoGaleria.safeParse({
        foto_url: "https://exemplo.com/galeria/ambiente.webp",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.destaque_capa).toBe(false);
      }
    });

    it("deve rejeitar foto sem URL válida", () => {
      const res = esquemaFotoGaleria.safeParse({
        foto_url: "caminho-local-invalido",
      });

      expect(res.success).toBe(false);
    });
  });

  describe("Pipeline de Validação de Arquivo de Mídia (validarArquivoMidia)", () => {
    it("deve aprovar formatos suportados dentro do limite de 5MB", () => {
      expect(
        validarArquivoMidia({ tipo: "image/webp", tamanhoBytes: 1024 * 1024 }).valido
      ).toBe(true);

      expect(
        validarArquivoMidia({ tipo: "image/jpeg", tamanhoBytes: 3 * 1024 * 1024 }).valido
      ).toBe(true);

      expect(
        validarArquivoMidia({ tipo: "image/png", tamanhoBytes: 2 * 1024 * 1024 }).valido
      ).toBe(true);
    });

    it("deve reprovar formatos não autorizados (ex: GIF, BMP, SVG, PDF)", () => {
      const res = validarArquivoMidia({
        tipo: "image/gif",
        tamanhoBytes: 500 * 1024,
      });

      expect(res.valido).toBe(false);
      expect(res.erro).toBeDefined();
    });

    it("deve reprovar imagens acima de 5MB", () => {
      const res = validarArquivoMidia({
        tipo: "image/jpeg",
        tamanhoBytes: 6 * 1024 * 1024,
      });

      expect(res.valido).toBe(false);
      expect(res.erro).toContain("5 MB");
    });
  });

  describe("Cálculo de Redimensionamento Proporcional (calcularDimensoesRedimensionamento)", () => {
    it("deve redimensionar proporcionalmente imagem horizontal para catálogo de produtos (máx 800px)", () => {
      const dim = calcularDimensoesRedimensionamento(1600, 1200, DIMENSAO_MAXIMA_PRODUTO_PX);
      expect(dim.largura).toBe(800);
      expect(dim.altura).toBe(600);
    });

    it("deve redimensionar proporcionalmente imagem vertical para galeria (máx 1200px)", () => {
      const dim = calcularDimensoesRedimensionamento(1200, 2400, DIMENSAO_MAXIMA_GALERIA_PX);
      expect(dim.largura).toBe(600);
      expect(dim.altura).toBe(1200);
    });

    it("não deve alterar dimensões se imagem já for menor que o limite máximo", () => {
      const dim = calcularDimensoesRedimensionamento(500, 400, DIMENSAO_MAXIMA_PRODUTO_PX);
      expect(dim.largura).toBe(500);
      expect(dim.altura).toBe(400);
    });

    it("deve redimensionar corretamente imagem quadrada", () => {
      const dim = calcularDimensoesRedimensionamento(2000, 2000, DIMENSAO_MAXIMA_PRODUTO_PX);
      expect(dim.largura).toBe(800);
      expect(dim.altura).toBe(800);
    });
  });

  describe("Geração de Caminhos de Armazenamento (gerarCaminhoStorage)", () => {
    it("deve gerar caminho isolado por barbearia e prefixo com extensão limpa", () => {
      const caminhoProd = gerarCaminhoStorage("barb_abc", "produtos", ".webp");
      expect(caminhoProd.startsWith("barb_abc/produtos/")).toBe(true);
      expect(caminhoProd.endsWith(".webp")).toBe(true);

      const caminhoGal = gerarCaminhoStorage("barb_abc", "galeria", "png");
      expect(caminhoGal.startsWith("barb_abc/galeria/")).toBe(true);
      expect(caminhoGal.endsWith(".png")).toBe(true);
    });
  });
});
