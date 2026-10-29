"use client";

import { IconeTrofeu } from "@/components/ui/Icons";
import type { Aluno } from "@/lib/banco/tipos";
import { AvataresDoLado } from "./AvataresDoLado";

interface LadoDoConfronto {
  nome: string;
  alunos: Aluno[];
}

function Lado({ lado, venceu, direita }: { lado: LadoDoConfronto; venceu: boolean; direita?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center`}>
      <AvataresDoLado alunos={lado.alunos} tamanho="md" />
      <p
        className={`flex max-w-full items-center gap-1 text-sm leading-tight ${
          venceu ? "font-semibold text-areia-900" : "text-areia-700"
        } ${direita ? "flex-row-reverse" : ""}`}
      >
        <span className="truncate">{lado.nome}</span>
        {venceu && <IconeTrofeu className="h-4 w-4 shrink-0 text-saibro-600" />}
      </p>
      {venceu && <span className="sr-only">venceu</span>}
    </div>
  );
}

/** Cabecalho de uma partida: os dois lados, quem venceu e o placar. */
export function Confronto({
  a,
  b,
  vencedor,
  placar,
}: {
  a: LadoDoConfronto;
  b: LadoDoConfronto;
  vencedor?: "A" | "B";
  placar?: string;
}) {
  return (
    <div className="rounded-xl border border-areia-200 bg-areia-50/70 px-3 py-3">
      <div className="flex items-start gap-2">
        <Lado lado={a} venceu={vencedor === "A"} />
        <span className="mt-3 shrink-0 text-xs font-semibold uppercase tracking-wide text-areia-400">
          x
        </span>
        <Lado lado={b} venceu={vencedor === "B"} direita />
      </div>
      <p className="mt-2 text-center text-sm font-semibold tabular-nums text-areia-800">
        {placar ? placar : <span className="font-normal text-areia-500">Sem resultado ainda</span>}
      </p>
    </div>
  );
}
