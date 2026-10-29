import { formatarDiaMes } from "@/lib/date";

/**
 * Formatos usados nas telas do estoque e do consumo.
 */

/** "2026-10-29T11:27:00" -> "29/10 às 11:27" */
export function diaEHora(carimbo: string): string {
  const [data, hora] = carimbo.split("T");
  return hora ? `${formatarDiaMes(data)} às ${hora.slice(0, 5)}` : formatarDiaMes(data);
}

/**
 * Le um valor em reais digitado do jeito brasileiro ("5,50", "1.234,90",
 * "R$ 12") ou com ponto decimal ("5.50"). Devolve NaN se nao for um numero.
 */
export function lerValor(texto: string): number {
  let limpo = texto.replace(/R\$/g, "").replace(/\s/g, "");
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : NaN;
}

/** 5.5 -> "5,50", para preencher um campo de valor. */
export function valorParaCampo(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

/** Le um numero inteiro digitado ("12"); NaN se nao for. */
export function lerInteiro(texto: string): number {
  const limpo = texto.trim();
  return /^-?\d+$/.test(limpo) ? Number(limpo) : NaN;
}

/** +3, −2 (com o sinal de menos tipografico). */
export function comSinal(numero: number): string {
  if (numero > 0) return `+${numero}`;
  if (numero < 0) return `−${Math.abs(numero)}`;
  return "0";
}
