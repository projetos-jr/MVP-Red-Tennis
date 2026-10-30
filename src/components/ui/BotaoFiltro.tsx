"use client";

import type { ReactNode } from "react";

/**
 * Botão-pílula de filtro (quadra, professor, categoria...). Use quando há
 * poucas opções lado a lado; para muitas opções, um `select` com a classe
 * `campo`; para trocar de visão ou aba, o `Segmentado`.
 *
 *   <div role="group" aria-label="Categoria" className="flex flex-wrap gap-1.5">
 *     <BotaoFiltro ativo={categoria === "todas"} aoClicar={() => mudar("todas")}>Todas</BotaoFiltro>
 *   </div>
 */
export function BotaoFiltro({
  ativo,
  aoClicar,
  children,
  cor,
  cores,
  title,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: ReactNode;
  /** Bolinha colorida antes do texto (ex.: a cor do professor na agenda). */
  cor?: string;
  /** Pílula com as cores próprias de uma categoria (ex.: categorias do ranking). */
  cores?: { cor: string; fundo: string; borda: string };
  title?: string;
}) {
  const base =
    "alvo-de-toque flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors";
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      title={title}
      className={
        cores
          ? `${base} border`
          : `${base} ${ativo ? "bg-saibro-600 text-white" : "bg-areia-100 text-areia-700 hover:bg-areia-200"}`
      }
      style={
        cores
          ? {
              color: ativo ? "#fff" : cores.cor,
              backgroundColor: ativo ? cores.cor : cores.fundo,
              borderColor: cores.borda,
            }
          : undefined
      }
    >
      {cor && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ativo ? "#fff" : cor }} />
      )}
      {children}
    </button>
  );
}
