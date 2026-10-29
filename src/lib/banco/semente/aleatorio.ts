/**
 * Gerador pseudoaleatorio deterministico (mulberry32).
 * Garante que os dados de exemplo sejam sempre os mesmos — no servidor e no
 * navegador, em todo carregamento.
 */

export type Sorteio = () => number;

export function criarRng(semente: number): Sorteio {
  let estado = semente >>> 0;
  return function proximo(): number {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function escolher<T>(rng: Sorteio, lista: readonly T[]): T {
  return lista[Math.floor(rng() * lista.length)];
}

export function inteiro(rng: Sorteio, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function embaralhar<T>(rng: Sorteio, lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}
