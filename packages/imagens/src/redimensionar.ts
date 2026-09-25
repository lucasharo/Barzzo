export interface ResultadoValidacaoImagem {
  valido: boolean;
  erro?: string;
}

export const TIPOS_IMAGEM_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB

export function validarArquivoImagem(arquivo: File): ResultadoValidacaoImagem {
  if (!arquivo) {
    return { valido: false, erro: "Nenhum arquivo fornecido" };
  }

  if (!TIPOS_IMAGEM_PERMITIDOS.includes(arquivo.type)) {
    return {
      valido: false,
      erro: "Formato inválido. Envie uma imagem JPEG, PNG ou WebP.",
    };
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return {
      valido: false,
      erro: "A imagem excede o tamanho máximo permitido de 5MB.",
    };
  }

  return { valido: true };
}

export function calcularDimensoesRedimensionamento(
  larguraOriginal: number,
  alturaOriginal: number,
  maxDimensao = 800
): { largura: number; altura: number } {
  if (larguraOriginal <= 0 || alturaOriginal <= 0) {
    return { largura: maxDimensao, altura: maxDimensao };
  }

  if (larguraOriginal <= maxDimensao && alturaOriginal <= maxDimensao) {
    return { largura: larguraOriginal, altura: alturaOriginal };
  }

  const proporcao = larguraOriginal / alturaOriginal;

  if (larguraOriginal > alturaOriginal) {
    const novaLargura = maxDimensao;
    const novaAltura = Math.round(maxDimensao / proporcao);
    return { largura: novaLargura, altura: novaAltura };
  } else {
    const novaAltura = maxDimensao;
    const novaLargura = Math.round(maxDimensao * proporcao);
    return { largura: novaLargura, altura: novaAltura };
  }
}

/**
 * Redimensiona e comprime uma imagem no navegador utilizando HTML Canvas.
 * Referência de perfil: máx 800x800 com compressão WebP ou JPEG.
 */
export async function redimensionarEComprimirImagem(
  arquivo: File,
  maxDimensao = 800,
  qualidade = 0.85
): Promise<Blob> {
  const validacao = validarArquivoImagem(arquivo);
  if (!validacao.valido) {
    throw new Error(validacao.erro || "Arquivo inválido");
  }

  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onload = (evento) => {
      const img = new Image();
      img.onload = () => {
        const { largura, altura } = calcularDimensoesRedimensionamento(
          img.width,
          img.height,
          maxDimensao
        );

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao obter contexto 2D do Canvas"));
          return;
        }

        // Suavização para melhor qualidade de interpolação
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(img, 0, 0, largura, altura);

        // Preferir WebP com fallback para JPEG
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              canvas.toBlob(
                (blobJpeg) => {
                  if (blobJpeg) {
                    resolve(blobJpeg);
                  } else {
                    reject(new Error("Falha ao comprimir imagem"));
                  }
                },
                "image/jpeg",
                qualidade
              );
            }
          },
          "image/webp",
          qualidade
        );
      };

      img.onerror = () => reject(new Error("Falha ao carregar a imagem"));
      img.src = evento.target?.result as string;
    };

    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}
