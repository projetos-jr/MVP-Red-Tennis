import type { CSSProperties } from "react";
import type {
  Ocupacao,
  PisoQuadra,
  Presenca,
  QuadraId,
  SituacaoOcupacao,
  TipoOcupacao,
} from "@/lib/banco/tipos";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import { DIAS_SEMANA_LONGO, minutosParaHora } from "@/lib/date";
import { BRANCO, PALETA } from "@/lib/paleta";
import { ESTILO_OCUPACAO } from "@/lib/theme";

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
  a_marcar: { cor: PALETA.areia[600], fundo: PALETA.areia[100] },
  presente: { cor: PALETA.quadra[700], fundo: PALETA.quadra[50] },
  falta: { cor: PALETA.tijolo[800], fundo: PALETA.tijolo[50] },
  falta_avisada: { cor: PALETA.saibro[800], fundo: PALETA.saibro[50] },
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

/**
 * Fundo listrado do bloqueio: a quadra fechada se distingue sem depender so
 * da cor. As listras sao do proprio neutro da paleta (areia-500, bem leve).
 */
export const FUNDO_BLOQUEIO = `repeating-linear-gradient(135deg, ${PALETA.areia[500]}21 0 6px, transparent 6px 12px)`;

/** Cor de fundo do bloqueio (o listrado vai por cima). */
export const COR_BLOQUEIO = PALETA.areia[200];

/**
 * Cor do piso de cada quadra (cabecalho da grade, etiquetas): o cimento azul
 * da Quadra 1 e o saibro laranja das outras, como no sistema antigo. Texto
 * branco por cima (tons 600, mais de 4,5:1).
 */
export const CLASSE_DO_PISO: Record<PisoQuadra, string> = {
  cimento: "bg-cimento-600 text-white",
  saibro: "bg-saibro-600 text-white",
};

/**
 * Como um horario aparece na grade (pedido do cliente: cores vivas):
 *  - normal: fundo cheio do tipo, texto branco ou escuro (`sobreCheia`);
 *  - prazo de pagamento vencido: anel duplo (branco + vermelho) e o aviso;
 *  - cancelada: fundo branco, borda tracejada na cor do tipo, nomes riscados;
 *  - bloqueio: cinza listrado com texto escuro.
 * O passado nao muda o bloco (a pelicula fica por tras, na coluna): nada de
 * transparencia no texto.
 */
export interface EstiloDoBloco {
  style: CSSProperties;
  /** Classe dos selos internos (quadra, tipo): escurece ou clareia o fundo. */
  selo: string;
  /** Texto riscado (cancelada). */
  riscado: boolean;
  /** Prazo de pagamento vencido: mostra o aviso. */
  alerta: boolean;
  /** Cor solida de referencia para a conferencia de contraste (fundo listrado). */
  fundoDeContraste?: string;
}

const SELO_SOBRE_ESCURO = "bg-black/15 text-white";
const SELO_SOBRE_CLARO = "bg-white/45 text-areia-900";

export function estiloDoBloco(item: ItemAgenda): EstiloDoBloco {
  const estilo = ESTILO_OCUPACAO[item.ocupacao.tipo];
  if (item.cancelada) {
    return {
      style: {
        backgroundColor: BRANCO,
        border: `2px dashed ${estilo.cor}`,
        color: PALETA.areia[600],
      },
      selo: "bg-areia-100 text-areia-700",
      riscado: true,
      alerta: false,
    };
  }
  if (item.ocupacao.tipo === "Bloqueio") {
    return {
      style: {
        backgroundColor: COR_BLOQUEIO,
        backgroundImage: FUNDO_BLOQUEIO,
        color: PALETA.areia[800],
        boxShadow: `inset 0 0 0 1px ${PALETA.areia[300]}`,
      },
      selo: SELO_SOBRE_CLARO,
      riscado: false,
      alerta: false,
      fundoDeContraste: COR_BLOQUEIO,
    };
  }
  const vencida = item.estadoReserva === "vencida";
  return {
    style: {
      backgroundColor: estilo.cheia,
      color: estilo.sobreCheia,
      boxShadow: vencida ? `0 0 0 2px ${BRANCO}, 0 0 0 4px ${PALETA.tijolo[700]}` : undefined,
    },
    selo: estilo.sobreCheia === BRANCO ? SELO_SOBRE_ESCURO : SELO_SOBRE_CLARO,
    riscado: false,
    alerta: vencida,
  };
}

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
