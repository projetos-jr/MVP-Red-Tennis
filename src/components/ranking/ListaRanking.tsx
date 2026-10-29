"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconeDesceu, IconeEstavel, IconeSubiu } from "@/components/ui/Icons";
import type { LinhaDoRanking } from "@/lib/consultas/ranking";
import { ESTILO_CATEGORIA } from "@/lib/theme";

function Variacao({ variacao }: { variacao: number }) {
  const texto =
    variacao > 0
      ? `subiu ${variacao} ${variacao === 1 ? "posição" : "posições"} em 7 dias`
      : variacao < 0
        ? `caiu ${-variacao} ${variacao === -1 ? "posição" : "posições"} em 7 dias`
        : "mesma posição de 7 dias atrás";
  return (
    <span
      className={`flex w-9 shrink-0 items-center justify-end gap-0.5 text-xs font-medium tabular-nums sm:w-12 ${
        variacao > 0 ? "text-emerald-600" : variacao < 0 ? "text-tijolo-600" : "text-areia-400"
      }`}
      title={texto}
    >
      {variacao > 0 ? (
        <IconeSubiu className="h-3.5 w-3.5" />
      ) : variacao < 0 ? (
        <IconeDesceu className="h-3.5 w-3.5" />
      ) : (
        <IconeEstavel className="h-3.5 w-3.5" />
      )}
      {variacao !== 0 && Math.abs(variacao)}
      <span className="sr-only">{texto}</span>
    </span>
  );
}

/**
 * Ranking em lista: posicao, foto, nome (abre a ficha), categoria, vitorias,
 * derrotas, pontos e variacao de posicao nos ultimos 7 dias.
 */
export function ListaRanking({ linhas }: { linhas: LinhaDoRanking[] }) {
  return (
    <div>
      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-b border-areia-200 bg-areia-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-areia-500 sm:gap-3 sm:px-5"
      >
        <span className="w-6 shrink-0 text-right sm:w-7">#</span>
        <span className="flex-1">Jogador</span>
        <span className="hidden w-10 shrink-0 text-center md:block" title="Vitórias">
          V
        </span>
        <span className="hidden w-10 shrink-0 text-center md:block" title="Derrotas">
          D
        </span>
        <span className="w-10 shrink-0 text-right sm:w-14">
          <span className="sm:hidden">Pts</span>
          <span className="hidden sm:inline">Pontos</span>
        </span>
        <span className="w-9 shrink-0 text-right sm:w-12" title="Variação de posição nos últimos 7 dias">
          <span className="sm:hidden">7d</span>
          <span className="hidden sm:inline">7 dias</span>
        </span>
      </div>

      <ol className="divide-y divide-areia-100">
        {linhas.map((linha) => {
          const categoria = linha.aluno.categoriaRanking
            ? ESTILO_CATEGORIA[linha.aluno.categoriaRanking]
            : undefined;
          return (
            <li key={linha.alunoId}>
              <Link
                href={`/alunos/${linha.alunoId}`}
                className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-areia-50 sm:gap-3 sm:px-5"
              >
                <span
                  className={`w-6 shrink-0 text-right text-sm font-bold tabular-nums sm:w-7 ${
                    linha.posicao <= 3 ? "text-saibro-700" : "text-areia-400"
                  }`}
                >
                  {linha.posicao}
                  <span className="sr-only">º lugar</span>
                </span>

                <Avatar id={linha.alunoId} nome={linha.aluno.nome} src={linha.aluno.fotoUrl} tamanho="sm" />

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-areia-900">{linha.aluno.nome}</span>
                    {categoria && (
                      <Badge
                        cor={categoria.cor}
                        fundo={categoria.fundo}
                        borda={categoria.borda}
                        className="shrink-0 px-2 py-0 text-[10px]"
                        title={`${categoria.label} · ${categoria.descricao}`}
                      >
                        <span className="sr-only">Categoria </span>
                        {linha.aluno.categoriaRanking}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-areia-500">
                    <span className="md:hidden">
                      {linha.vitorias} {linha.vitorias === 1 ? "vitória" : "vitórias"} · {linha.derrotas}{" "}
                      {linha.derrotas === 1 ? "derrota" : "derrotas"}
                    </span>
                    <span className="hidden md:inline">
                      {linha.partidas === 0
                        ? "Sem partidas ainda"
                        : `${linha.partidas} ${linha.partidas === 1 ? "partida" : "partidas"}`}
                      {linha.posicaoGeral !== linha.posicao && ` · ${linha.posicaoGeral}º no geral`}
                    </span>
                  </p>
                </div>

                <span className="hidden w-10 shrink-0 text-center text-sm tabular-nums text-areia-700 md:block">
                  <span className="sr-only">Vitórias: </span>
                  {linha.vitorias}
                </span>
                <span className="hidden w-10 shrink-0 text-center text-sm tabular-nums text-areia-500 md:block">
                  <span className="sr-only">Derrotas: </span>
                  {linha.derrotas}
                </span>
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-areia-800 sm:w-14">
                  {linha.pontos}
                  <span className="sr-only"> pontos</span>
                </span>
                <Variacao variacao={linha.variacao} />
              </Link>
            </li>
          );
        })}

        {linhas.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-areia-500">
            Nenhum jogador nesta categoria.
          </li>
        )}
      </ol>
    </div>
  );
}
