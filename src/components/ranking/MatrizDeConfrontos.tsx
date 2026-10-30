"use client";

import type { LinhaDaMatriz } from "@/lib/consultas/ranking";
import { AvataresDoLado } from "./AvataresDoLado";

/**
 * Matriz do todos contra todos: cada linha mostra os jogos daquela inscricao
 * contra cada coluna, do ponto de vista da linha (V = venceu, D = perdeu).
 * Clicar numa celula abre o jogo.
 */
export function MatrizDeConfrontos({
  matriz,
  aoAbrir,
}: {
  matriz: LinhaDaMatriz[];
  aoAbrir: (partidaId: string) => void;
}) {
  return (
    <div className="overflow-x-auto p-4 rolagem-suave">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th scope="col" className="w-44 text-left text-[11px] font-semibold uppercase tracking-wide text-areia-500">
              <span className="sr-only">Inscrição</span>
            </th>
            {matriz.map((coluna, i) => (
              <th
                key={coluna.inscricao.inscricao.id}
                scope="col"
                className="min-w-[92px] px-1 pb-1 text-center align-bottom font-semibold text-areia-700"
              >
                <span className="block text-[10px] font-medium text-areia-500">{i + 1}º</span>
                <span className="block truncate" title={coluna.inscricao.nome}>
                  {coluna.inscricao.nome}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matriz.map((linha, i) => (
            <tr key={linha.inscricao.inscricao.id}>
              <th scope="row" className="pr-2 text-left font-medium text-areia-900">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-areia-500">
                    {i + 1}º
                  </span>
                  <AvataresDoLado alunos={linha.inscricao.alunos} />
                  <span className="truncate">{linha.inscricao.nome}</span>
                </span>
              </th>
              {linha.celulas.map((celula, j) => {
                if (!celula) {
                  return (
                    <td
                      key={j}
                      aria-hidden="true"
                      className="rounded-lg bg-[repeating-linear-gradient(135deg,#F4F1EC,#F4F1EC_6px,#E8E3DB_6px,#E8E3DB_7px)]"
                    />
                  );
                }
                const situacao =
                  celula.venceu === undefined ? "pendente" : celula.venceu ? "venceu" : "perdeu";
                const estilo = {
                  venceu: "border-emerald-200 bg-emerald-50 text-emerald-900",
                  perdeu: "border-tijolo-200 bg-tijolo-50 text-tijolo-900",
                  pendente: "border-dashed border-areia-300 bg-white text-areia-500",
                }[situacao];
                return (
                  <td key={j} className="p-0">
                    <button
                      type="button"
                      onClick={() => aoAbrir(celula.partidaId)}
                      aria-label={`${linha.inscricao.nome} contra ${matriz[j].inscricao.nome}: ${
                        situacao === "pendente"
                          ? `jogo ${celula.numero}, sem resultado`
                          : `${situacao}, ${celula.placar ?? ""}`
                      }`}
                      className={`flex h-12 w-full flex-col items-center justify-center rounded-lg border px-1 transition-colors hover:border-saibro-400 ${estilo}`}
                    >
                      {situacao === "pendente" ? (
                        <span>Jogo {celula.numero}</span>
                      ) : (
                        <>
                          <span className="font-bold">{celula.venceu ? "V" : "D"}</span>
                          <span className="tabular-nums">{celula.placar}</span>
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
