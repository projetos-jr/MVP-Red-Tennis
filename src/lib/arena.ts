/**
 * Dados fixos da arena — nao vem do banco.
 *
 * Grade de funcionamento, quadras e textos de identificacao. O que muda no dia
 * a dia (alunos, agenda, pagamentos, estoque) esta no Supabase e chega via
 * `dados.ts`.
 */

import { hojeISO } from "./date";
import type { CategoriaProduto, CategoriaRanking, PisoQuadra, Quadra } from "./types";

/** Data de referencia (fuso da arena). */
export const HOJE = hojeISO();

export const HORA_ABERTURA = 7;
export const HORA_FECHAMENTO = 22;

/** Faixas horarias da grade da agenda: 07:00 ... 21:00 (ultima aula termina 22:00). */
export const FAIXAS_HORARIAS: string[] = Array.from(
  { length: HORA_FECHAMENTO - HORA_ABERTURA },
  (_, i) => `${String(HORA_ABERTURA + i).padStart(2, "0")}:00`,
);

export const QUADRAS: Quadra[] = [1, 2, 3, 4, "paredao"];

/**
 * Piso de cada area.
 * A quadra 1 e de cimento; as demais e o paredao sao de saibro.
 */
export const PISO_DAS_QUADRAS: Record<string, PisoQuadra> = {
  "1": "cimento",
  "2": "saibro",
  "3": "saibro",
  "4": "saibro",
  paredao: "saibro",
};

export function pisoDaQuadra(quadra: Quadra): PisoQuadra {
  return PISO_DAS_QUADRAS[String(quadra)] ?? "saibro";
}

export const ARENA = {
  nome: "Red Tennis",
  endereco: "3 quadras de saibro · 1 de cimento · paredão",
  horarioFuncionamento: "07h às 22h",
  gestor: "Francisco",
  equipe: "Lucas",
};

/** Usado em locações e reservas de ranking, onde não há professor alocado. */
export const SEM_PROFESSOR = "Sem professor";

/**
 * Formato da piramide do torneio: 6 faixas, do topo para a base.
 * 1 + 2 + 3 + 4 + 6 + 7 = 23 posicoes, uma para cada membro inscrito.
 * As faixas sao agrupadas nas 4 categorias definidas com o cliente:
 * A = faixas 1-2 (3 jogadores), B = faixas 3-4 (7), C = faixa 5 (6), D = faixa 6 (7).
 */
export const LINHAS_PIRAMIDE = [1, 2, 3, 4, 6, 7];

export const CATEGORIA_POR_LINHA: CategoriaRanking[] = [
  "A",
  "A",
  "B",
  "B",
  "C",
  "D",
];

export const CATEGORIAS_PRODUTO: CategoriaProduto[] = [
  "Bebidas",
  "Cervejas",
  "Lanches",
  "Acessórios",
];
