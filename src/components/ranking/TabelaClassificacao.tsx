"use client";

import { IconeCheck } from "@/components/ui/Icons";
import type { LinhaNaTela } from "@/lib/consultas/ranking";
import { AvataresDoLado } from "./AvataresDoLado";

function saldo(valor: number): string {
  if (valor > 0) return `+${valor}`;
  if (valor < 0) return `−${Math.abs(valor)}`;
  return "0";
}

/**
 * Classificacao de um grupo ou do todos contra todos. Os criterios de
 * desempate sao os das Configuracoes (H8); quando um empate foi decidido, o
 * criterio aparece embaixo do nome. As linhas em destaque sao a zona de
 * classificacao; o sinal de confirmado so aparece quando acabam os jogos.
 */
export function TabelaClassificacao({
  linhas,
  rotuloDestaque,
  definido,
}: {
  linhas: LinhaNaTela[];
  /** O que significa a linha em destaque ("passa para a eliminatória", "campeão"). */
  rotuloDestaque: string;
  /** Todos os jogos terminaram: o destaque deixa de ser provisorio. */
  definido: boolean;
}) {
  return (
    <>
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-areia-200 text-[11px] font-semibold uppercase tracking-wide text-areia-500">
            <th scope="col" className="w-10 py-2 pl-3 text-left sm:w-12 sm:pl-4">
              <abbr title="Posição" className="no-underline">
                #
              </abbr>
            </th>
            <th scope="col" className="py-2 text-left">
              Inscrição
            </th>
            {/* No celular, jogos e saldo de games saem para o nome caber. */}
            <th scope="col" className="hidden w-8 py-2 text-center sm:table-cell">
              <abbr title="Jogos" className="no-underline">
                J
              </abbr>
            </th>
            <th scope="col" className="w-8 py-2 text-center">
              <abbr title="Vitórias" className="no-underline">
                V
              </abbr>
            </th>
            <th scope="col" className="w-8 py-2 text-center">
              <abbr title="Derrotas" className="no-underline">
                D
              </abbr>
            </th>
            <th scope="col" className="w-14 py-2 pr-3 text-center sm:w-11 sm:pr-0">
              <abbr title="Saldo de sets (ganhos menos perdidos)" className="no-underline">
                Sets
              </abbr>
            </th>
            <th scope="col" className="hidden w-14 py-2 pr-3 text-center sm:table-cell sm:pr-4">
              <abbr title="Saldo de games (ganhos menos perdidos)" className="no-underline">
                Games
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-areia-100">
          {linhas.map((linha) => (
            <tr key={linha.inscricaoId} className={linha.classifica ? "bg-saibro-50/60" : undefined}>
              <td className="py-2 pl-3 sm:pl-4">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    linha.classifica ? "bg-saibro-600 text-white" : "bg-areia-100 text-areia-600"
                  }`}
                >
                  {linha.posicao}
                </span>
              </td>
              <td className="py-2 pr-2">
                <div className="flex min-w-0 items-center gap-2">
                  <AvataresDoLado alunos={linha.inscricao.alunos} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate font-medium text-areia-900">
                      <span className="truncate">{linha.inscricao.nome}</span>
                      {linha.classifica && definido && (
                        <IconeCheck className="h-3.5 w-3.5 shrink-0 text-saibro-600" />
                      )}
                      {linha.classifica && (
                        <span className="sr-only">
                          ({definido ? rotuloDestaque : `por enquanto: ${rotuloDestaque}`})
                        </span>
                      )}
                    </p>
                    {linha.desempate && (
                      <p className="truncate text-[11px] text-areia-500">
                        Desempate: {linha.desempate.toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="hidden py-2 text-center tabular-nums text-areia-600 sm:table-cell">
                {linha.jogos}
              </td>
              <td className="py-2 text-center font-semibold tabular-nums text-areia-900">
                {linha.vitorias}
              </td>
              <td className="py-2 text-center tabular-nums text-areia-600">{linha.derrotas}</td>
              <td className="py-2 pr-3 text-center tabular-nums text-areia-700 sm:pr-0">
                {saldo(linha.setsPro - linha.setsContra)}
              </td>
              <td className="hidden py-2 pr-3 text-center tabular-nums text-areia-700 sm:table-cell sm:pr-4">
                {saldo(linha.gamesPro - linha.gamesContra)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-areia-100 px-3 py-2 text-[11px] text-areia-500 sm:px-4">
        {definido
          ? `Com o sinal de confirmado: ${rotuloDestaque}.`
          : `Em destaque, por enquanto: ${rotuloDestaque}. Fica definido quando acabarem os jogos.`}
      </p>
    </>
  );
}
