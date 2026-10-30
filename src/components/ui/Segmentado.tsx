"use client";

import type React from "react";

interface Opcao<T extends string> {
  valor: T;
  rotulo: React.ReactNode;
}

interface SegmentadoProps<T extends string> {
  opcoes: Opcao<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  className?: string;
  /** Rotulo acessivel do grupo. */
  aria?: string;
}

/** Alternador em pilulas — usado para trocar visualizacoes (semana/mês, abas). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  className = "",
  aria,
}: SegmentadoProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={aria}
      className={`inline-flex items-center gap-1 rounded-xl border border-areia-200 bg-areia-100/80 p-1 ${className}`}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => aoMudar(opcao.valor)}
            className={`alvo-de-toque rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              ativo
                ? "bg-white text-saibro-800 shadow-sm"
                : "text-areia-600 hover:text-areia-900"
            }`}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
