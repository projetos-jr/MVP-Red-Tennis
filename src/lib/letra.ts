/**
 * Tamanho das letras do sistema, escolhido por aparelho ("Letras maiores" no
 * menu do usuário). Fica guardado no navegador (localStorage) e vale para
 * todas as telas: tudo que é medido em rem cresce junto.
 *
 * O atributo `data-letra="grande"` vai no <html>; o CSS em globals.css faz o
 * resto. Um script curto em app/layout.tsx aplica a escolha antes da
 * primeira pintura, para a tela não "pular".
 */

export const CHAVE_DA_LETRA = "red-tennis:letra";
const EVENTO = "red-tennis:letra";

/** Script que roda antes da pintura (texto puro, sem imports). */
export const SCRIPT_DA_LETRA = `try{if(localStorage.getItem("${CHAVE_DA_LETRA}")==="grande")document.documentElement.dataset.letra="grande"}catch(e){}`;

export function letraGrande(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.letra === "grande";
}

export function mudarLetra(grande: boolean): void {
  if (grande) document.documentElement.dataset.letra = "grande";
  else delete document.documentElement.dataset.letra;
  try {
    if (grande) window.localStorage.setItem(CHAVE_DA_LETRA, "grande");
    else window.localStorage.removeItem(CHAVE_DA_LETRA);
  } catch {
    // Sem localStorage (navegação privada): vale só até fechar a aba.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Para useSyncExternalStore. */
export function assinarLetra(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
}
