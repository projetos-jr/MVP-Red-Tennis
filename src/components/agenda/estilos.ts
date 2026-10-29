import type {
  Ocupacao,
  Presenca,
  QuadraId,
  SituacaoOcupacao,
  TipoOcupacao,
} from "@/lib/banco/tipos";
import { DIAS_SEMANA_LONGO, minutosParaHora } from "@/lib/date";

/**
 * Rotulos e pequenos estilos usados nas telas da agenda. As cores dos tipos
 * vem de `ESTILO_OCUPACAO` (src/lib/theme.ts), que segue a legenda acordada
 * com a arena.
 */

/** Ordem da legenda e dos filtros: a mesma do MVP, com o bloqueio no fim. */
export const ORDEM_TIPOS_AGENDA: TipoOcupacao[] = [
  "Individual",
  "Locação Mensal",
  "Dupla",
  "LAP",
  "Locação Avulsa",
  "Ranking",
  "Plano de locação",
  "Bloqueio",
];

export const ROTULO_SITUACAO: Record<SituacaoOcupacao, string> = {
  agendada: "Agendada",
  aguardando_pagamento: "Aguardando pagamento",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const ROTULO_PRESENCA: Record<Presenca, string> = {
  a_marcar: "A marcar",
  presente: "Presente",
  falta: "Falta",
  falta_avisada: "Falta avisada",
};

export const ESTILO_PRESENCA: Record<Presenca, { cor: string; fundo: string }> = {
  a_marcar: { cor: "#6B6255", fundo: "#F4F1EC" },
  presente: { cor: "#15803D", fundo: "#F0FDF4" },
  falta: { cor: "#991B1B", fundo: "#FEF2F2" },
  falta_avisada: { cor: "#A16207", fundo: "#FEFBEB" },
};

/** "Q1" ... "Q4", "PAR" — onde o espaco e curto. */
export function rotuloCurtoDaQuadra(quadraId: QuadraId): string {
  return quadraId === "paredao" ? "PAR" : `Q${quadraId}`;
}

/** "19:00–20:00" */
export function intervalo(ocupacao: Pick<Ocupacao, "horaInicio" | "horaFim">): string {
  return `${ocupacao.horaInicio}–${ocupacao.horaFim}`;
}

/** Inicios possiveis no formulario: 07:00 a 21:30, de meia em meia hora. */
export const HORARIOS_DE_INICIO: string[] = Array.from({ length: 30 }, (_, i) =>
  minutosParaHora(7 * 60 + i * 30),
);

/** Terminos possiveis: 07:30 a 22:00. */
export const HORARIOS_DE_FIM: string[] = Array.from({ length: 30 }, (_, i) =>
  minutosParaHora(7 * 60 + 30 + i * 30),
);

/** Atalhos de duracao no formulario. */
export const DURACOES_RAPIDAS = [
  { minutos: 60, rotulo: "1h" },
  { minutos: 90, rotulo: "1h30" },
  { minutos: 120, rotulo: "2h" },
];

/** Fundo listrado do bloqueio: a quadra fechada se distingue sem depender so da cor. */
export const FUNDO_BLOQUEIO =
  "repeating-linear-gradient(135deg, rgba(107, 98, 85, 0.13) 0 6px, rgba(255, 255, 255, 0) 6px 12px)";

/** "toda quinta-feira", "todo sábado" (sábado e domingo são masculinos). */
export function repeticaoSemanal(diaSemana: number): string {
  return `${diaSemana === 0 || diaSemana === 6 ? "todo" : "toda"} ${DIAS_SEMANA_LONGO[diaSemana].toLowerCase()}`;
}

/** "todo sábado" -> "Todo sábado" */
export function comMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "1 aula", "3 aulas" */
export function plural(quantidade: number, singular: string, pluralTexto: string): string {
  return `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? singular : pluralTexto}`;
}
