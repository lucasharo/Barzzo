export interface EnderecoPorCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export type ResultadoBuscaCep =
  | { ok: true; endereco: EnderecoPorCep }
  | { ok: false; motivo: "invalido" | "nao_encontrado" | "indisponivel" };

/**
 * Consulta o CEP na BrasilAPI (v2). Nunca lança: falhas de rede ou do serviço
 * voltam como `indisponivel`, e quem chama decide a mensagem exibida.
 */
export async function buscarEnderecoPorCep(
  cep: string,
  sinal?: AbortSignal
): Promise<ResultadoBuscaCep> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return { ok: false, motivo: "invalido" };

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`, { signal: sinal });
    if (resposta.status === 404) return { ok: false, motivo: "nao_encontrado" };
    if (!resposta.ok) return { ok: false, motivo: "indisponivel" };

    const dados = await resposta.json();
    return {
      ok: true,
      endereco: {
        cep: digitos,
        logradouro: dados.street || "",
        bairro: dados.neighborhood || "",
        cidade: dados.city || "",
        estado: dados.state || "",
      },
    };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}
