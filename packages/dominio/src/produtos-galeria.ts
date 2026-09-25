// packages/dominio/src/produtos-galeria.ts
// Pipeline e regras de negócio para imagens, catálogo de produtos e galeria.

import {
  esquemaArquivoMidia,
  FORMATOS_IMAGEM_PERMITIDOS,
  TAMANHO_MAXIMO_IMAGEM_BYTES,
} from "@barzzo/validacoes";

export const DIMENSAO_MAXIMA_PRODUTO_PX = 800;
export const DIMENSAO_MAXIMA_GALERIA_PX = 1200;

/**
 * Calcula dimensões mantendo a proporção original dentro dos limites máximos especificados.
 */
export function calcularDimensoesRedimensionamento(
  largura: number,
  altura: number,
  maxDimensao: number
): { largura: number; altura: number } {
  if (largura <= maxDimensao && altura <= maxDimensao) {
    return { largura, altura };
  }

  if (largura >= altura) {
    const ratio = altura / largura;
    return {
      largura: maxDimensao,
      altura: Math.round(maxDimensao * ratio),
    };
  } else {
    const ratio = largura / altura;
    return {
      largura: Math.round(maxDimensao * ratio),
      altura: maxDimensao,
    };
  }
}

/**
 * Valida formato e peso máximo do arquivo de imagem antes de qualquer envio.
 */
export function validarArquivoMidia(arquivo: {
  tipo: string;
  tamanhoBytes: number;
}): { valido: boolean; erro?: string } {
  const resultado = esquemaArquivoMidia.safeParse(arquivo);
  if (!resultado.success) {
    return {
      valido: false,
      erro: resultado.error.errors[0]?.message || "Arquivo inválido.",
    };
  }
  return { valido: true };
}

/**
 * Gera caminho padronizado e seguro para salvamento no Supabase Storage.
 * Exemplo: 'barbearia_123/produtos/1727280000000_abc12.webp'
 */
export function gerarCaminhoStorage(
  barbeariaId: string,
  prefixo: "produtos" | "galeria",
  extensao: string = "webp"
): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extLimpa = extensao.replace(/^\./, "");
  return `${barbeariaId}/${prefixo}/${timestamp}_${randomStr}.${extLimpa}`;
}
