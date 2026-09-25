"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

export function ThemeToggle() {
  const [tema, setTema] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const salvo = localStorage.getItem("barzzo-tema");
    const prefereEscuro = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    if (salvo === "dark" || (!salvo && prefereEscuro)) {
      setTema("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTema("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const alternarTema = () => {
    if (tema === "light") {
      setTema("dark");
      document.documentElement.classList.add("dark");
      localStorage.setItem("barzzo-tema", "dark");
    } else {
      setTema("light");
      document.documentElement.classList.remove("dark");
      localStorage.setItem("barzzo-tema", "light");
    }
  };

  return (
    <Button
      variante="fantasma"
      tamanho="icone"
      onClick={alternarTema}
      aria-label={
        tema === "light" ? "Alternar para tema escuro" : "Alternar para tema claro"
      }
      title={
        tema === "light" ? "Alternar para tema escuro" : "Alternar para tema claro"
      }
    >
      {tema === "light" ? (
        <Moon className="h-5 w-5 text-black" />
      ) : (
        <Sun className="h-5 w-5 text-white" />
      )}
    </Button>
  );
}
