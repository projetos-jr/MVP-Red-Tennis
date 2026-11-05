"use client";

import { useEffect, useMemo, useRef } from "react";
import { montarPiramide, type LinhaDoRanking } from "@/lib/consultas/ranking";
import { PALETA } from "@/lib/paleta";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { RaqueteComFoto, type NivelDaRaquete } from "./RaqueteComFoto";

/** Espaco entre as raquetes de uma fileira. */
const VAO = "clamp(0.375rem, 2.2cqi, 1.75rem)";

/**
 * Largura de cada raquete. `cqi` = 1% da largura da area da piramide: as
 * fileiras largas encolhem ate o minimo; abaixo dele (celular), a piramide
 * rola para o lado dentro do cartao.
 */
/** Largura da raquete do 1o (o topo). */
const LARGURA_DO_TOPO = "clamp(8.5rem, 36cqi, 11rem)";

function larguraDaFileira(indice: number, maiorFileira: number): string {
  if (indice === 0) return LARGURA_DO_TOPO;
  if (indice === 1) return `clamp(6.5rem, calc((100cqi - 2 * ${VAO}) / 3 * 0.8), 9.75rem)`;
  return `clamp(4.75rem, calc((100cqi - ${maiorFileira - 1} * ${VAO}) / ${maiorFileira}), 7.75rem)`;
}

function nivelDaFileira(indice: number): NivelDaRaquete {
  return indice === 0 ? "topo" : indice === 1 ? "segunda" : "demais";
}

/**
 * O ranking geral em forma de piramide (pedido do dono da arena): o 1o no
 * topo, depois fileiras de 3, 4, 5... (H19, `FILEIRAS_DA_PIRAMIDE`). E so uma
 * forma de MOSTRAR o ranking: a ordem vem da pontuacao. A "chave em piramide"
 * (desafios e troca de posicao) e outro formato de disputa, fora do contrato.
 */
export function PiramideDoRanking({
  linhas,
  titulo,
}: {
  linhas: LinhaDoRanking[];
  /** "Ranking geral" ou "Ranking · Categoria B". */
  titulo: string;
}) {
  const fileiras = useMemo(() => montarPiramide(linhas), [linhas]);
  const maiorFileira = Math.max(1, ...fileiras.slice(2).map((f) => f.capacidade));
  const rolagem = useRef<HTMLDivElement>(null);
  const chave = linhas.map((l) => l.alunoId).join(",");

  // No celular a piramide pode ser mais larga que a tela: comeca centralizada
  // (o 1o no meio) e a pessoa arrasta para os lados.
  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, [chave]);

  return (
    <div
      className="relative"
      data-fundo-de-contraste={PALETA.saibro[100]}
      style={{ containerType: "inline-size" }}
    >
      {/* Titulo: em cima no celular e no tablet em pe; no computador, no canto
          da faixa de saibro (o 1o fica no meio). */}
      <div className="bg-saibro-100 px-4 pb-1 pt-4 sm:px-6 lg:absolute lg:left-0 lg:top-0 lg:z-10 lg:max-w-[30%] lg:bg-transparent lg:pt-6">
        <h2 className="font-display text-2xl font-bold leading-tight text-areia-900 sm:text-3xl">{titulo}</h2>
        {linhas.length > 0 && (
          <p className="mt-1 text-base text-areia-700">
            Quem soma mais pontos fica no alto. Toque numa raquete para abrir a ficha.
          </p>
        )}
        {maiorFileira >= 5 && (
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-saibro-800 sm:hidden">
            <span aria-hidden="true">←</span>
            Arraste para o lado para ver todos
            <span aria-hidden="true">→</span>
          </p>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="bg-gradient-to-b from-saibro-100 to-white px-5 py-14 text-center text-base text-areia-700">
          Nenhum jogador nesta categoria.
        </p>
      ) : (
        <div className="relative">
          {/* Toque de quadra atras do topo: faixa de saibro clara, uma luz
              suave atras do 1o e a linha branca de fundo na altura da garganta. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
            style={{ height: `calc(2rem + ${LARGURA_DO_TOPO} * 1.45)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-saibro-100 to-saibro-50" />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/70 blur-2xl"
              style={{
                top: `calc(1.5rem + ${LARGURA_DO_TOPO} * 0.05)`,
                width: `calc(${LARGURA_DO_TOPO} * 1.35)`,
                height: `calc(${LARGURA_DO_TOPO} * 1.35)`,
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white shadow-[0_1px_0_theme(colors.saibro.200)]" />
          </div>

          <div ref={rolagem} className="rolagem-suave relative overflow-x-auto overscroll-x-contain pb-2">
            <div
              role="group"
              aria-label="Pirâmide do ranking"
              className="mx-auto flex w-max min-w-full flex-col items-center gap-y-3 px-3 pb-4 pt-5 sm:gap-y-5 sm:px-6 sm:pt-7"
            >
              {fileiras.map((fileira, indice) => (
                <ol
                  key={indice}
                  start={fileira.itens[0]?.posicao}
                  aria-label={indice === 0 ? "Topo da pirâmide" : `${indice + 1}ª fileira`}
                  className="flex w-full justify-center"
                  style={{ columnGap: VAO }}
                >
                  {fileira.itens.map((linha) => (
                    <li key={linha.alunoId} className="flex">
                      <RaqueteComFoto
                        alunoId={linha.alunoId}
                        nome={linha.aluno.nome}
                        fotoUrl={linha.aluno.fotoUrl}
                        posicao={linha.posicao}
                        pontos={linha.pontos}
                        nivel={nivelDaFileira(indice)}
                        largura={larguraDaFileira(indice, maiorFileira)}
                        detalhe={
                          linha.aluno.categoriaRanking
                            ? ESTILO_CATEGORIA[linha.aluno.categoriaRanking].label
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ol>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
