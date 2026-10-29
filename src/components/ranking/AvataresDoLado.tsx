"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { Aluno } from "@/lib/banco/tipos";

/**
 * Foto de quem joga num lado da partida: uma (simples) ou duas sobrepostas
 * (duplas). Lado ainda a definir mostra um circulo tracejado.
 */
export function AvataresDoLado({
  alunos,
  tamanho = "xs",
}: {
  alunos: Aluno[];
  tamanho?: "xs" | "sm" | "md";
}) {
  if (alunos.length === 0) {
    const medida = tamanho === "xs" ? "h-6 w-6" : tamanho === "sm" ? "h-8 w-8" : "h-11 w-11";
    return (
      <span
        aria-hidden="true"
        className={`${medida} shrink-0 rounded-full border border-dashed border-areia-300 bg-areia-50`}
      />
    );
  }
  return (
    <span className="flex shrink-0 -space-x-2">
      {alunos.map((aluno) => (
        <Avatar
          key={aluno.id}
          id={aluno.id}
          nome={aluno.nome}
          src={aluno.fotoUrl}
          tamanho={tamanho}
          comAnel={alunos.length > 1}
        />
      ))}
    </span>
  );
}
