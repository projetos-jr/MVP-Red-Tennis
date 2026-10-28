"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { IconeTrofeu } from "@/components/ui/Icons";
import { CATEGORIA_POR_LINHA } from "@/lib/arena";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { nomeCompacto } from "@/lib/selectors";
import type { PosicaoPiramide } from "@/lib/selectors";
import type { CategoriaRanking } from "@/lib/types";

interface PiramideTorneioProps {
  faixas: PosicaoPiramide[][];
  /** Quando definida, as demais categorias ficam esmaecidas. */
  categoriaEmFoco: CategoriaRanking | "todas";
}

/**
 * Chave do ranking em formato piramide.
 *
 * As faixas vao do topo (1 posicao) para a base (5 posicoes) e sao agrupadas
 * nas 4 categorias definidas com o cliente. O estado exibido e fixo — representa
 * a situacao da etapa apos as ultimas rodadas, sem logica de chaveamento por tras.
 */
export function PiramideTorneio({
  faixas,
  categoriaEmFoco,
}: PiramideTorneioProps) {
  // Agrupa faixas consecutivas que pertencem a mesma categoria.
  const grupos: Array<{ categoria: CategoriaRanking; faixas: PosicaoPiramide[][] }> =
    [];

  faixas.forEach((faixa, indice) => {
    const categoria = CATEGORIA_POR_LINHA[indice] ?? "D";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.categoria === categoria) {
      ultimo.faixas.push(faixa);
    } else {
      grupos.push({ categoria, faixas: [faixa] });
    }
  });

  return (
    /* No celular as faixas largas quebram em várias linhas — a forma de
       pirâmide se mantém no topo e nada exige rolagem lateral. */
    <div className="space-y-3 p-3 sm:p-6 md:overflow-x-auto md:rolagem-suave">
      <div className="space-y-3 md:min-w-[680px]">
        {grupos.map(({ categoria, faixas: doGrupo }) => {
          const estilo = ESTILO_CATEGORIA[categoria];
          const emFoco =
            categoriaEmFoco === "todas" || categoriaEmFoco === categoria;

          return (
            <section
              key={categoria}
              className="relative rounded-2xl border px-4 py-4 transition-opacity duration-300"
              style={{
                backgroundColor: `${estilo.fundo}66`,
                borderColor: estilo.borda,
                opacity: emFoco ? 1 : 0.32,
              }}
            >
              <header className="mb-3 flex items-center justify-center gap-2">
                <span
                  className="chip border text-[11px] font-semibold"
                  style={{
                    color: estilo.cor,
                    backgroundColor: "#fff",
                    borderColor: estilo.borda,
                  }}
                >
                  {estilo.label} · {estilo.descricao}
                </span>
              </header>

              <div className="space-y-2.5">
                {doGrupo.map((faixa, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2.5"
                  >
                    {faixa.map(({ posicao, aluno }) => (
                      <Link
                        key={aluno.id}
                        href={`/alunos/${aluno.id}`}
                        className={`group flex w-[92px] flex-col items-center rounded-xl border bg-white px-1.5 py-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover sm:w-[112px] sm:px-2 md:w-[132px] ${
                          posicao === 1
                            ? "border-saibro-400 ring-2 ring-saibro-400/30"
                            : "border-areia-200"
                        }`}
                      >
                        <span className="mb-1.5 flex items-center gap-1">
                          {posicao === 1 && (
                            <IconeTrofeu className="h-3.5 w-3.5 text-saibro-600" />
                          )}
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: estilo.cor }}
                          >
                            {posicao}º
                          </span>
                        </span>

                        <Avatar
                          id={aluno.id}
                          nome={aluno.nome}
                          src={aluno.avatarUrl}
                          tamanho={posicao === 1 ? "lg" : "md"}
                          comAnel
                        />

                        <span className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-areia-800 group-hover:text-tijolo-700">
                          {nomeCompacto(aluno.nome)}
                        </span>
                        <span className="mt-0.5 text-[10px] tabular-nums text-areia-500">
                          {aluno.rankingPontuacao} pts
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
