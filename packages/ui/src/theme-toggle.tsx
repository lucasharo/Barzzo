"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps = {}) {
  const [tema, setTema] = React.useState<"light" | "dark">("light");
  const [montado, setMontado] = React.useState(false);

  React.useEffect(() => {
    setMontado(true);

    const lerTema = (): "light" | "dark" => {
      const salvo = localStorage.getItem("barzzo-tema");
      if (salvo === "dark" || salvo === "light") {
        return salvo;
      }
      if (document.documentElement.classList.contains("dark")) {
        return "dark";
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    };

    const sincronizarTema = () => {
      const temaAtual = lerTema();
      setTema(temaAtual);
      if (temaAtual === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    sincronizarTema();

    const aoMudarTema = (e: Event) => {
      const eventoCustom = e as CustomEvent<"light" | "dark">;
      if (eventoCustom.detail) {
        setTema(eventoCustom.detail);
      } else {
        sincronizarTema();
      }
    };

    const aoMudarStorage = (e: StorageEvent) => {
      if (e.key === "barzzo-tema") {
        sincronizarTema();
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudarMedia = () => {
      if (!localStorage.getItem("barzzo-tema")) {
        sincronizarTema();
      }
    };

    window.addEventListener("barzzo-tema-change", aoMudarTema);
    window.addEventListener("storage", aoMudarStorage);
    mediaQuery.addEventListener("change", aoMudarMedia);

    return () => {
      window.removeEventListener("barzzo-tema-change", aoMudarTema);
      window.removeEventListener("storage", aoMudarStorage);
      mediaQuery.removeEventListener("change", aoMudarMedia);
    };
  }, []);

  const alternarTema = () => {
    const proximoTema = tema === "light" ? "dark" : "light";
    setTema(proximoTema);
    if (proximoTema === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("barzzo-tema", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("barzzo-tema", "light");
    }
    window.dispatchEvent(
      new CustomEvent("barzzo-tema-change", { detail: proximoTema })
    );
  };

  const ehEscuro = montado ? tema === "dark" : false;

  return (
    <Button
      variante="fantasma"
      tamanho="icone"
      onClick={alternarTema}
      aria-label={
        ehEscuro ? "Alternar para tema claro" : "Alternar para tema escuro"
      }
      title={
        ehEscuro ? "Alternar para tema claro" : "Alternar para tema escuro"
      }
      className={className}
    >
      {ehEscuro ? (
        <Sun className="h-5 w-5 text-black dark:text-white transition-transform" />
      ) : (
        <Moon className="h-5 w-5 text-black dark:text-white transition-transform" />
      )}
    </Button>
  );
}
