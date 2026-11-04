"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { PALETA } from "@/lib/paleta";
import { abaAtiva, type Area } from "./abas";

/**
 * Abas do topo com uma pilula laranja que desliza ate a aba ativa.
 *
 * A posicao da pilula e medida no navegador (useLayoutEffect + ResizeObserver,
 * para acompanhar fontes carregando e a janela mudando de tamanho) e gravada
 * direto no DOM com `style.setProperty`: sem estado do React, sem desenhar a
 * tela de novo a cada medida. Quem pede menos movimento ve a pilula pular
 * direto, sem deslizar.
 */
export function AbasComIndicador({ abas, caminho }: { abas: Area[]; caminho: string }) {
  const lista = useRef<HTMLUListElement>(null);
  const pilula = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ul = lista.current;
    const marcador = pilula.current;
    if (!ul || !marcador) return;

    // offsetLeft do link e medido a partir da lista (o `ul` e o primeiro
    // ancestral posicionado; o `li` nao pode ser `relative`).
    function posicionar() {
      if (!ul || !marcador) return;
      const ativa = ul.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!ativa) {
        marcador.style.setProperty("opacity", "0");
        return;
      }
      marcador.style.setProperty("--x", `${ativa.offsetLeft}px`);
      marcador.style.setProperty("--w", `${ativa.offsetWidth}px`);
      marcador.style.setProperty("opacity", "1");
      // Mantem a aba ativa a vista quando a barra rola para o lado (telas medias).
      if (ativa.offsetLeft < ul.scrollLeft || ativa.offsetLeft + ativa.offsetWidth > ul.scrollLeft + ul.clientWidth) {
        ul.scrollTo({ left: ativa.offsetLeft - 16 });
      }
    }

    posicionar();
    // A primeira posicao entra sem animacao; dai em diante a pilula desliza.
    const quadro = requestAnimationFrame(() => {
      marcador.dataset.pronta = "sim";
    });

    const observador = new ResizeObserver(posicionar);
    observador.observe(ul);
    ul.querySelectorAll("a").forEach((link) => observador.observe(link));
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
    };
  }, [caminho, abas]);

  return (
    <ul ref={lista} className="rolagem-suave relative flex items-center gap-1 overflow-x-auto py-2">
      <span
        ref={pilula}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-2 h-[calc(100%-1rem)] w-[var(--w,0px)] translate-x-[var(--x,0px)] rounded-full bg-saibro-600 opacity-0 shadow-sm data-[pronta=sim]:transition-[transform,width] data-[pronta=sim]:duration-300 data-[pronta=sim]:ease-out motion-reduce:!transition-none"
      />
      {abas.map((aba) => {
        const { href, rotulo, Icone } = aba;
        const ativo = abaAtiva(caminho, aba);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={ativo ? "page" : undefined}
              // A pilula fica atras do link (irma, nao mae): a conferencia de
              // contraste precisa saber que o texto branco esta sobre o laranja.
              data-fundo-de-contraste={ativo ? PALETA.saibro[600] : undefined}
              className={`alvo-de-toque relative flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-200 sm:px-4 ${
                ativo
                  ? "text-white"
                  : "text-areia-700 hover:bg-areia-200/70 hover:text-areia-900"
              }`}
            >
              <Icone className="h-[18px] w-[18px]" />
              {rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
