import type { SituacaoTorneio } from "@/lib/banco/tipos";

/**
 * Cores do modulo de ranking e torneios. A situacao do torneio sempre vem
 * com o rotulo escrito ao lado: a cor nunca e o unico indicador.
 */
export const ESTILO_SITUACAO_TORNEIO: Record<
  SituacaoTorneio,
  { cor: string; fundo: string; borda: string }
> = {
  inscricoes: { cor: "#9A4720", fundo: "#FAE8DA", borda: "#F3CEAF" },
  em_andamento: { cor: "#15803D", fundo: "#F0FDF4", borda: "#9DE0B4" },
  encerrado: { cor: "#4F483E", fundo: "#F4F1EC", borda: "#D6CEC2" },
};
