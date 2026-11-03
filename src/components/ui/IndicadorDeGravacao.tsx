"use client";

import { useEffect } from "react";
import { useApp } from "@/store/AppStore";

/**
 * Enquanto uma gravacao vai para o banco: um aviso discreto "Salvando…" no
 * canto e os botoes de confirmar ficam travados (classe `gravando` no
 * `<body>`, ver `globals.css`), para ninguem clicar duas vezes.
 */
export function IndicadorDeGravacao() {
  const { gravando } = useApp();

  useEffect(() => {
    document.body.classList.toggle("gravando", gravando);
    document.body.setAttribute("aria-busy", gravando ? "true" : "false");
  }, [gravando]);

  if (!gravando) return null;
  return (
    <div
      role="status"
      className="fixed bottom-20 right-4 z-[100] rounded-full bg-areia-900 px-4 py-2 text-xs font-semibold text-white shadow-lg md:bottom-4"
    >
      Salvando…
    </div>
  );
}
