"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { IconeTrofeu } from "@/components/ui/Icons";
import type { LinhaDoRanking } from "@/lib/consultas/ranking";
import { LADRILHO } from "@/lib/paleta";
import { ESTILO_CATEGORIA } from "@/lib/theme";

/**
 * Altura do degrau e ordem na tela (2º a esquerda, 1º no meio, 3º a direita).
 * Degraus em laranja vivo, do mais claro (1º, com a textura do saibro) ao mais
 * escuro; o numero e branco e grande (contraste conferido).
 */
const DEGRAU: Record<number, { altura: string; ordem: string; fundo: string }> = {
  1: { altura: "h-20 sm:h-24", ordem: "order-2", fundo: "textura-saibro" },
  2: { altura: "h-14 sm:h-16", ordem: "order-1", fundo: "bg-saibro-600" },
  3: { altura: "h-10 sm:h-12", ordem: "order-3", fundo: "bg-saibro-700" },
};

/** Os tres primeiros do ranking (ou da categoria filtrada) em destaque. */
export function PodioRanking({ linhas }: { linhas: LinhaDoRanking[] }) {
  const podio = linhas.slice(0, 3);
  if (podio.length === 0) return null;

  return (
    <ol className="flex items-end justify-center gap-2 px-3 pb-0 pt-6 sm:gap-4 sm:px-6">
      {podio.map((linha) => {
        const degrau = DEGRAU[linha.posicao];
        const categoria = linha.aluno.categoriaRanking
          ? ESTILO_CATEGORIA[linha.aluno.categoriaRanking]
          : undefined;
        const primeiro = linha.posicao === 1;
        return (
          <li key={linha.alunoId} className={`flex w-28 flex-col items-center sm:w-40 ${degrau.ordem}`}>
            <Link
              href={`/alunos/${linha.alunoId}`}
              className="group flex w-full flex-col items-center rounded-xl px-1 pb-2 text-center"
            >
              {primeiro && <IconeTrofeu className="mb-1 h-6 w-6 text-saibro-600" />}
              <Avatar
                id={linha.alunoId}
                nome={linha.aluno.nome}
                src={linha.aluno.fotoUrl}
                tamanho="lg"
                comAnel={!primeiro}
                className={`shadow-card ${primeiro ? "ring-4 ring-saibro-500 sm:h-24 sm:w-24 sm:text-2xl" : ""}`}
              />
              <span className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-areia-900 group-hover:text-saibro-700">
                {linha.aluno.nome}
              </span>
              <span className="mt-0.5 text-xs tabular-nums text-areia-600">
                <strong className="text-areia-900">{linha.pontos}</strong> pts · {linha.vitorias}V{" "}
                {linha.derrotas}D
              </span>
              {categoria && (
                <span
                  className="mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={{ color: categoria.cor, backgroundColor: categoria.fundo, borderColor: categoria.borda }}
                >
                  Cat. {linha.aluno.categoriaRanking}
                </span>
              )}
            </Link>
            <div
              data-fundo-de-contraste={primeiro ? LADRILHO.referencia : undefined}
              className={`flex w-full items-start justify-center rounded-t-xl pt-1 font-display text-2xl font-bold text-white shadow-inner ${degrau.altura} ${degrau.fundo}`}
            >
              {linha.posicao}º
            </div>
          </li>
        );
      })}
    </ol>
  );
}
