"use client";

import type { ReactNode } from "react";

/** Quantos itens as listas longas mostram de cada vez. */
export const ITENS_POR_PAGINA = 20;

/**
 * Rodapé das listas longas: "Mostrando 20 de 93" à esquerda e o botão
 * "Mostrar mais 20" à direita. Some quando a lista inteira já está na tela,
 * a não ser que haja um resumo (`children`) para mostrar.
 *
 *   const [limite, setLimite] = useState(ITENS_POR_PAGINA);
 *   const visiveis = linhas.slice(0, limite);
 *   ...
 *   <MostrarMais
 *     mostrando={visiveis.length}
 *     total={linhas.length}
 *     aoMostrarMais={() => setLimite((atual) => atual + ITENS_POR_PAGINA)}
 *   />
 *
 * Volte o limite para `ITENS_POR_PAGINA` quando um filtro mudar.
 */
export function MostrarMais({
  mostrando,
  total,
  passo = ITENS_POR_PAGINA,
  aoMostrarMais,
  children,
}: {
  mostrando: number;
  total: number;
  /** Quantos itens o botão acrescenta. */
  passo?: number;
  aoMostrarMais: () => void;
  /** Resumo opcional antes da contagem (ex.: "519 lançamentos · total R$ ..."). */
  children?: ReactNode;
}) {
  const restantes = total - mostrando;
  if (restantes <= 0 && !children) return null;

  return (
    <footer className="flex flex-col gap-2 border-t border-areia-200 px-5 py-3 text-xs text-areia-600 sm:flex-row sm:items-center sm:justify-between">
      <p>
        {children}
        {restantes > 0 && `${children ? " · mostrando" : "Mostrando"} ${mostrando} de ${total}`}
      </p>
      {restantes > 0 && (
        <button type="button" onClick={aoMostrarMais} className="btn-secundario px-3 py-1.5 text-xs">
          Mostrar mais {Math.min(passo, restantes)}
        </button>
      )}
    </footer>
  );
}
