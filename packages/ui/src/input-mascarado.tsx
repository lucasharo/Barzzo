import * as React from "react";
import { Input, type InputProps } from "./input";

export interface InputMascaradoProps extends Omit<InputProps, "value" | "onChange"> {
  value: string;
  mascara: (valor: string) => string;
  onChangeValor: (valor: string) => void;
}

export function posicaoCursorMascarado(valor: string, cursor: number, mascara: (valor: string) => string): number {
  return Math.min(mascara(valor.slice(0, cursor)).length, mascara(valor).length);
}

export function apagarSeparadorMascarado(
  valor: string,
  cursor: number,
  tecla: "Backspace" | "Delete",
  mascara: (valor: string) => string
): { valor: string; cursor: number } | null {
  const anterior = tecla === "Backspace" && cursor > 0 && /\D/.test(valor[cursor - 1]);
  const seguinte = tecla === "Delete" && cursor < valor.length && /\D/.test(valor[cursor]);
  if (!anterior && !seguinte) return null;

  const digitos = valor.replace(/\D/g, "");
  const anteriores = valor.slice(0, cursor).replace(/\D/g, "").length;
  const indice = anterior ? Math.max(0, anteriores - 1) : anteriores;
  if (indice >= digitos.length) return null;

  const proximoValor = mascara(digitos.slice(0, indice) + digitos.slice(indice + 1));
  return { valor: proximoValor, cursor: Math.min(mascara(digitos.slice(0, indice)).length, proximoValor.length) };
}

/** Mantém o cursor próximo ao caractere editado, inclusive ao apagar separadores. */
export function InputMascarado({ value, mascara, onChangeValor, onKeyDown, ...props }: InputMascaradoProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function posicionarCursor(posicao: number) {
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(posicao, posicao));
  }

  return (
    <Input
      {...props}
      ref={inputRef}
      value={mascara(value)}
      onChange={(evento) => {
        const valorDigitado = evento.currentTarget.value;
        const cursor = evento.currentTarget.selectionStart ?? valorDigitado.length;
        const proximoValor = mascara(valorDigitado);
        const proximoCursor = posicaoCursorMascarado(valorDigitado, cursor, mascara);
        onChangeValor(proximoValor);
        posicionarCursor(proximoCursor);
      }}
      onKeyDown={(evento) => {
        onKeyDown?.(evento);
        if (
          evento.defaultPrevented || evento.ctrlKey || evento.altKey || evento.metaKey ||
          (evento.key !== "Backspace" && evento.key !== "Delete")
        ) return;

        const campo = evento.currentTarget;
        const cursor = campo.selectionStart;
        if (cursor === null || cursor !== campo.selectionEnd) return;

        const resultado = apagarSeparadorMascarado(campo.value, cursor, evento.key, mascara);
        if (!resultado) return;

        evento.preventDefault();
        onChangeValor(resultado.valor);
        posicionarCursor(resultado.cursor);
      }}
    />
  );
}
