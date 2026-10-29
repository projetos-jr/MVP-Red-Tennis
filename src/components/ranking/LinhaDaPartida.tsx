"use client";

import { Badge } from "@/components/ui/Badge";
import { IconeProximo, IconeTrofeu } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { lerPlacar } from "@/lib/banco/regras/ranking";
import { rotuloDaQuadra } from "@/lib/consultas/base";
import type { LadoDaPartida, PartidaNaLista } from "@/lib/consultas/ranking";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarDiaMes } from "@/lib/date";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { AvataresDoLado } from "./AvataresDoLado";

function Lado({
  lado,
  venceu,
  games,
  gamesDoOutro,
  wo,
}: {
  lado: LadoDaPartida;
  venceu: boolean;
  games: number[];
  gamesDoOutro: number[];
  wo: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AvataresDoLado alunos={lado.alunos} />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          venceu ? "font-semibold text-areia-900" : "text-areia-700"
        }`}
      >
        {lado.nome}
      </span>
      {venceu && <IconeTrofeu className="h-3.5 w-3.5 shrink-0 text-saibro-600" />}
      {venceu && <span className="sr-only">(venceu)</span>}
      {wo
        ? venceu && <span className="shrink-0 text-xs font-bold text-saibro-700">W.O.</span>
        : games.length > 0 && (
            <span className="flex shrink-0 gap-1 tabular-nums">
              {games.map((g, i) => (
                <span
                  key={i}
                  className={`w-5 text-center text-sm ${
                    g > (gamesDoOutro[i] ?? 0) ? "font-bold text-areia-900" : "text-areia-500"
                  }`}
                >
                  {g}
                </span>
              ))}
            </span>
          )}
    </span>
  );
}

/**
 * Uma partida na lista (historico e proximas): data, quem jogou, placar em
 * colunas e de onde ela e (ranking ou torneio). Clicar abre os detalhes.
 * `larga`: em telas largas, as etiquetas vao para uma coluna a direita.
 */
export function LinhaDaPartida({
  item,
  aoAbrir,
  larga,
}: {
  item: PartidaNaLista;
  aoAbrir: (item: PartidaNaLista) => void;
  larga?: boolean;
}) {
  const { partida, torneio, reserva } = item;
  const sets = partida.wo ? [] : (lerPlacar(partida.placar ?? "") ?? []);
  const data = partida.data ?? reserva?.data;
  const pendente = !partida.vencedor && Boolean(data) && (data ?? "") < HOJE;
  const ranking = ESTILO_OCUPACAO.Ranking;

  const etiquetas = (
    <>
      {torneio ? (
        <Badge className="max-w-full px-2 py-0.5 text-[10px]">
          <span className="truncate">
            {torneio.nome}
            {partida.fase ? ` · ${partida.fase}` : ""}
          </span>
        </Badge>
      ) : (
        <Badge cor={ranking.texto} fundo={ranking.fundo} borda={ranking.borda} className="px-2 py-0.5 text-[10px]">
          Ranking
        </Badge>
      )}
      {pendente && (
        <Badge cor="#8A2118" fundo="#FDF3F2" borda="#F6C4BE" className="px-2 py-0.5 text-[10px]">
          Resultado pendente
        </Badge>
      )}
      {!partida.vencedor && !pendente && <Badge className="px-2 py-0.5 text-[10px]">Marcada</Badge>}
    </>
  );

  return (
    <button
      type="button"
      onClick={() => aoAbrir(item)}
      className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-areia-50 sm:gap-3 sm:px-5"
    >
      <span className="w-14 shrink-0 sm:w-24">
        <span className="block text-sm font-semibold tabular-nums text-areia-900">
          {data ? (data === HOJE ? "Hoje" : formatarDiaMes(data)) : "A definir"}
        </span>
        <span className="block text-[11px] text-areia-500">
          {reserva
            ? `${reserva.horaInicio} · ${rotuloDaQuadra(reserva.quadraId).replace("Quadra ", "Q")}`
            : data
              ? DIAS_SEMANA_CURTO[diaDaSemana(data)]
              : ""}
        </span>
      </span>

      <span className={`min-w-0 flex-1 space-y-1 ${larga ? "md:max-w-md" : ""}`}>
        <Lado
          lado={item.a}
          venceu={partida.vencedor === "A"}
          games={sets.map((s) => s.a)}
          gamesDoOutro={sets.map((s) => s.b)}
          wo={Boolean(partida.wo)}
        />
        <Lado
          lado={item.b}
          venceu={partida.vencedor === "B"}
          games={sets.map((s) => s.b)}
          gamesDoOutro={sets.map((s) => s.a)}
          wo={Boolean(partida.wo)}
        />
        <span className={`flex flex-wrap items-center gap-1.5 pt-0.5 ${larga ? "md:hidden" : ""}`}>
          {etiquetas}
        </span>
      </span>

      {larga && (
        <span className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 md:flex">
          {etiquetas}
        </span>
      )}

      <IconeProximo className="h-4 w-4 shrink-0 text-areia-400" />
    </button>
  );
}
