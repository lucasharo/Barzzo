/** Data `AAAA-MM-DD` no fuso do dispositivo. `toISOString()` devolveria a data em UTC, que vira o dia seguinte a partir das 21h em Brasília. */
export function dataLocalIso(data: Date = new Date()): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}
