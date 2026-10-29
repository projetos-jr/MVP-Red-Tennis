"use client";

import { useSyncExternalStore } from "react";
import { agoraArena } from "@/lib/date";

function assinar(avisar: () => void): () => void {
  const intervalo = window.setInterval(avisar, 20_000);
  return () => window.clearInterval(intervalo);
}

function lerHora(): string {
  return agoraArena().slice(11, 16);
}

function semHoraNoServidor(): null {
  return null;
}

/**
 * Hora atual da arena ("HH:mm"), atualizada a cada minuto.
 *
 * Vale null no servidor e durante a hidratacao: assim o HTML do servidor e o
 * primeiro desenho no navegador ficam iguais (sem `new Date()` na
 * renderizacao) e, logo em seguida, a tela recebe a hora certa.
 */
export function useHoraAtual(): string | null {
  return useSyncExternalStore(assinar, lerHora, semHoraNoServidor);
}
