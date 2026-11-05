"use client";

import type { ReactNode } from "react";

/**
 * Botão grande com ícone, título e uma linha explicando o que ele faz. Usado
 * dentro de "Mais opções" (Gerar mensalidades, Exportar planilha) e na janela
 * "Movimentar" do estoque (Entrada, Perda, Contagem): quem abre a opção vê de
 * uma vez o que cada botão faz, sem precisar adivinhar pelo ícone.
 */
export function BotaoGrande({
  icone,
  titulo,
  descricao,
  aoClicar,
  primario = false,
  disabled = false,
  className = "",
}: {
  icone: ReactNode;
  titulo: string;
  descricao?: ReactNode;
  aoClicar: () => void;
  primario?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={disabled}
      className={`${primario ? "btn-primario" : "btn-secundario"} w-full justify-start gap-3.5 px-4 py-3.5 text-left ${className}`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          primario ? "bg-saibro-700" : "bg-areia-100 text-areia-800"
        } ${disabled ? "bg-areia-100 text-areia-500" : ""}`}
      >
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight">{titulo}</span>
        {descricao && (
          <span
            className={`mt-0.5 block text-sm font-normal leading-snug ${
              primario && !disabled ? "" : "text-areia-600"
            }`}
          >
            {descricao}
          </span>
        )}
      </span>
    </button>
  );
}
