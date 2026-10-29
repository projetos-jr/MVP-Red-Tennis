"use client";

import { useSyncExternalStore } from "react";
import { HOJE } from "@/lib/banco/constantes";
import { agoraArena } from "@/lib/date";

/**
 * Data e hora atuais da arena ("YYYY-MM-DDTHH:mm:00"), atualizadas a cada
 * meio minuto. Serve para saber se uma reserva ja passou do prazo e para a
 * linha do "agora" na visao do dia.
 *
 * No servidor (e na hidratacao) devolve o comeco do dia de HOJE: assim o
 * HTML do servidor e o do navegador batem, e logo depois o navegador troca
 * pela hora certa — sem `new Date()` durante a renderizacao.
 */
export function useAgora(): string {
  return useSyncExternalStore(assinar, minutoAtual, () => `${HOJE}T00:00:00`);
}

function assinar(avisar: () => void): () => void {
  const relogio = window.setInterval(avisar, 30_000);
  return () => window.clearInterval(relogio);
}

/** O mesmo texto durante o minuto inteiro: o React so redesenha quando muda. */
function minutoAtual(): string {
  return `${agoraArena().slice(0, 16)}:00`;
}
