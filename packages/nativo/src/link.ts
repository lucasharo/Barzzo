/**
 * Converte um link recebido pelo app em uma rota interna.
 *   barzzo://cliente/barbearia/abc?x=1  ->  /barbearia/abc?x=1
 *   https://qualquer-host/painel#topo   ->  /painel#topo
 * Retorna null quando o link não é de uma rota válida do app.
 */
export function caminhoDoLink(url: string, esquemaHost?: string): string | null {
  let analisado: URL;
  try {
    analisado = new URL(url);
  } catch {
    return null;
  }

  if (analisado.protocol === "barzzo:") {
    if (esquemaHost && analisado.host !== esquemaHost) return null;
  } else if (analisado.protocol !== "https:" && analisado.protocol !== "http:") {
    return null;
  }

  const caminho = `${analisado.pathname || "/"}${analisado.search}${analisado.hash}`;
  return caminho.startsWith("/") ? caminho : `/${caminho}`;
}
