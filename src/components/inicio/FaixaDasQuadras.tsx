"use client";

import Link from "next/link";
import { useId } from "react";
import { IconeSeta } from "@/components/ui/Icons";
import type { QuadraNoPainel } from "@/lib/consultas/painel";
import { PALETA } from "@/lib/paleta";
import { QuadraAgora } from "./QuadraAgora";

/**
 * Faixa verde do topo do Início: as 4 quadras e o paredão desenhados, como no
 * sistema antigo, com quem esta jogando agora em cada um. Clicar numa quadra
 * abre a agenda dela (visao Quadra).
 *
 * Computador e tablet: as 5 lado a lado (o paredão um pouco menor). Celular e
 * telas medias: a faixa rola para o lado, parando em cada quadra; a pagina
 * nao rola para o lado.
 */
export function FaixaDasQuadras({
  quadras,
  agora,
  podeAbrirAgenda,
}: {
  quadras: QuadraNoPainel[];
  agora: string | null;
  podeAbrirAgenda: boolean;
}) {
  const idDoTitulo = useId();
  const emUso = quadras.filter((q) => q.emAndamento && q.emAndamento.tipo !== "Bloqueio").length;

  return (
    <section
      aria-labelledby={idDoTitulo}
      data-fundo-de-contraste={PALETA.quadra[700]}
      className="relative min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-quadra-700 to-quadra-800 text-white shadow-card"
    >
      {/* Linha de quadra decorativa no alto da faixa */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-white/25" />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 id={idDoTitulo} className="font-display text-xl font-bold leading-tight sm:text-2xl">
          Agora nas quadras
          {agora && (
            <>
              <span aria-hidden="true" className="text-quadra-200">
                {" "}
                ·{" "}
              </span>
              <time className="tabular-nums text-bola-300">{agora}</time>
            </>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <p className="rounded-full bg-quadra-900/40 px-3 py-1 text-sm font-semibold tabular-nums">
            {emUso} de {quadras.length} em uso
          </p>
          {podeAbrirAgenda && (
            <Link
              href="/agenda"
              className="btn bg-white py-1.5 text-quadra-800 shadow-sm hover:bg-quadra-50 focus-visible:outline-bola-300"
            >
              Abrir Diária
              <IconeSeta className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <ul
        aria-label="Quadras"
        className="rolagem-suave flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 pt-3 sm:scroll-px-5 sm:px-5 sm:pb-5 lg:grid lg:snap-none lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,0.8fr)] lg:overflow-visible"
      >
        {quadras.map((quadra) => (
          <li
            key={quadra.quadra.id}
            className={`shrink-0 snap-start lg:w-auto ${
              quadra.quadra.id === "paredao" ? "w-[11.5rem]" : "w-[13.5rem]"
            }`}
          >
            <QuadraAgora
              quadra={quadra}
              agora={agora}
              href={
                podeAbrirAgenda ? `/agenda?visao=quadra&quadra=${quadra.quadra.id}` : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
