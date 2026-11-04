import { BRANCO, PALETA } from "@/lib/paleta";

/**
 * Faixa laranja de saibro com uma linha branca no meio, como a linha pintada
 * na quadra. Fica embaixo da barra do topo e no alto do login. Decorativa.
 */
export function FaixaDeQuadra({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-[5px] w-full ${className}`}
      style={{
        backgroundImage: `linear-gradient(to bottom, ${PALETA.saibro[600]} 0 2px, ${BRANCO} 2px 3px, ${PALETA.saibro[600]} 3px 5px)`,
      }}
    />
  );
}
