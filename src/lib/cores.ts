/**
 * Contas de cor: contraste (WCAG) e mistura.
 *
 * Usadas para escolher a cor do texto sobre um fundo vivo (branco ou escuro,
 * o que for mais legivel) e pelo teste `cores.test.ts`, que confere que todo
 * par de cores do sistema passa do minimo de leitura.
 */

import { BRANCO, TINTA } from "./paleta";

function canais(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const cheio = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminancia relativa (0 = preto, 1 = branco). */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre duas cores (1 a 21). Texto pequeno precisa de 4,5; grande, de 3. */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** A cor de texto mais legivel sobre o fundo (por padrao, branco ou a tinta escura). */
export function textoLegivelSobre(fundo: string, opcoes: string[] = [BRANCO, TINTA]): string {
  return opcoes.reduce((melhor, cor) => (contraste(cor, fundo) > contraste(melhor, fundo) ? cor : melhor));
}

/** Mistura duas cores (t = 0 da a primeira, t = 1 da a segunda), em "rgb(...)". */
export function misturar(inicio: string, fim: string, t: number): string {
  const p = Math.min(1, Math.max(0, t));
  const a = canais(inicio);
  const b = canais(fim);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * p));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
