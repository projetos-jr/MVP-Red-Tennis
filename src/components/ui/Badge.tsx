import type { ReactNode } from "react";
import { PALETA } from "@/lib/paleta";

interface BadgeProps {
  children: ReactNode;
  cor?: string;
  fundo?: string;
  borda?: string;
  className?: string;
  title?: string;
}

/** Chip de status/rotulo. Aceita cores livres para refletir a legenda do cliente. */
export function Badge({
  children,
  cor = PALETA.areia[700],
  fundo = PALETA.areia[100],
  borda,
  className = "",
  title,
}: BadgeProps) {
  return (
    <span
      className={`chip border ${className}`}
      style={{
        color: cor,
        backgroundColor: fundo,
        borderColor: borda ?? "transparent",
      }}
      title={title}
    >
      {children}
    </span>
  );
}

interface PontoProps {
  cor: string;
  className?: string;
}

export function Ponto({ cor, className = "" }: PontoProps) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: cor }}
    />
  );
}
