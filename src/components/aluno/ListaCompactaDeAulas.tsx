"use client";

import { useState } from "react";
import type { Ocupacao } from "@/lib/banco/tipos";
import { rotuloDaQuadra } from "@/lib/consultas/base";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarDiaMes } from "@/lib/date";

/**
 * Lista curta de aulas (usada nas previas: o que o congelamento suspende, o
 * que volta na reativacao, o que sai na inativacao).
 */
export function ListaCompactaDeAulas({
  itens,
  limite = 5,
}: {
  itens: Array<{ ocupacao: Ocupacao; detalhe?: string }>;
  limite?: number;
}) {
  const [todas, setTodas] = useState(false);
  if (itens.length === 0) return null;
  const visiveis = todas ? itens : itens.slice(0, limite);

  return (
    <ul className="divide-y divide-areia-100 rounded-xl border border-areia-200 bg-white text-xs">
      {visiveis.map(({ ocupacao, detalhe }) => (
        <li
          key={ocupacao.id}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2"
        >
          <span className="font-medium tabular-nums text-areia-800">
            {DIAS_SEMANA_CURTO[diaDaSemana(ocupacao.data)]} {formatarDiaMes(ocupacao.data)} ·{" "}
            {ocupacao.horaInicio}–{ocupacao.horaFim}
          </span>
          <span className="text-areia-600">
            {rotuloDaQuadra(ocupacao.quadraId)} · {ocupacao.tipo}
            {detalhe && ` · ${detalhe}`}
          </span>
        </li>
      ))}
      {itens.length > limite && (
        <li>
          <button
            type="button"
            onClick={() => setTodas(!todas)}
            className="w-full px-3 py-2 text-left font-medium text-saibro-700 hover:underline"
          >
            {todas ? "Mostrar menos" : `Ver todas (${itens.length})`}
          </button>
        </li>
      )}
    </ul>
  );
}
