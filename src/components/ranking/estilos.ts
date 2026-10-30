import { TONS } from "@/components/ui/EtiquetaDeSituacao";
import type { SituacaoTorneio } from "@/lib/banco/tipos";

/**
 * Cores do modulo de ranking e torneios. A situacao do torneio sempre vem
 * com o rotulo escrito ao lado: a cor nunca e o unico indicador.
 */
export const ESTILO_SITUACAO_TORNEIO: Record<
  SituacaoTorneio,
  { cor: string; fundo: string; borda: string }
> = {
  inscricoes: TONS.destaque,
  em_andamento: TONS.positivo,
  encerrado: TONS.neutro,
};
