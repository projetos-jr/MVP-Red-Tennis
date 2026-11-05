"use client";

import { useSyncExternalStore } from "react";

/**
 * Le uma media query (largura da tela, toque) e acompanha as mudancas, sem
 * `setState` em efeito: o React assina o `matchMedia` direto.
 *
 * Fora do navegador devolve `padrao` (as telas internas so montam no
 * navegador, mas o React pede o valor do servidor mesmo assim).
 */
export function useMidia(consulta: string, padrao: boolean): boolean {
  return useSyncExternalStore(
    assinatura(consulta),
    () => window.matchMedia(consulta).matches,
    () => padrao,
  );
}

const ASSINATURAS = new Map<string, (avisar: () => void) => () => void>();

/** Uma funcao de assinatura estavel por consulta (o React reassina se ela mudar). */
function assinatura(consulta: string): (avisar: () => void) => () => void {
  let assinar = ASSINATURAS.get(consulta);
  if (!assinar) {
    assinar = (avisar) => {
      const midia = window.matchMedia(consulta);
      midia.addEventListener("change", avisar);
      return () => midia.removeEventListener("change", avisar);
    };
    ASSINATURAS.set(consulta, assinar);
  }
  return assinar;
}

/** Tela com toque (tablet na quadra, celular): meias horas de 45px. */
export function useToque(): boolean {
  return useMidia("(pointer: coarse)", false);
}

/**
 * Largura da agenda:
 *  - "larga" (>= 1150px): Diaria com os dois dias lado a lado (10 colunas);
 *  - "media" (768 a 1149px): grade com um dia por vez;
 *  - "estreita" (< 768px, celular): lista do dia.
 */
export type LarguraDaAgenda = "larga" | "media" | "estreita";

export function useLarguraDaAgenda(): LarguraDaAgenda {
  // 1150px: o tablet deitado da arena (1180) ve os dois dias; iPad deitado
  // (1024–1112) ve um dia por vez, sem cortar o nome das quadras.
  const larga = useMidia("(min-width: 1150px)", true);
  const media = useMidia("(min-width: 768px)", true);
  return larga ? "larga" : media ? "media" : "estreita";
}
