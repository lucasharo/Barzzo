import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { salvarCupomIndicado } from "../lib/cupom-indicado";

/** Guarda o `?cupom=` de qualquer página (ex.: link de influenciador do Barzzo, que não aponta para uma barbearia). */
export function CapturaCupomIndicado() {
  const [searchParams] = useSearchParams();
  const cupom = searchParams.get("cupom");

  React.useEffect(() => {
    salvarCupomIndicado(cupom);
  }, [cupom]);

  return null;
}
