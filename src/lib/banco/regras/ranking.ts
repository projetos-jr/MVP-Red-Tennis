/**
 * Regras do ranking.
 *
 * O ranking nao e guardado: e calculado a partir das partidas com resultado,
 * usando a pontuacao das Configuracoes (Hipotese H7). Partidas de torneio so
 * contam se `torneioContaParaRanking` estiver ligado. Partidas de duplas nao
 * contam (o ranking e individual).
 */

import type { Banco, Partida } from "../tipos";

export interface LinhaRanking {
  alunoId: string;
  posicao: number;
  pontos: number;
  vitorias: number;
  derrotas: number;
  partidas: number;
}

function contaParaRanking(banco: Banco, partida: Partida, ate?: string): boolean {
  if (!partida.vencedor) return false;
  if (partida.ladoA.length !== 1 || partida.ladoB.length !== 1) return false;
  if (partida.torneioId && !banco.configuracoes.torneioContaParaRanking) return false;
  if (ate && (partida.data ?? "") > ate) return false;
  return true;
}

/**
 * Ranking de todos os alunos inscritos, ate a data `ate` (inclusive).
 * Desempate: mais vitorias, depois ordem alfabetica.
 */
export function calcularRanking(banco: Banco, ate?: string): LinhaRanking[] {
  const { pontosVitoria, pontosDerrota } = banco.configuracoes;
  const linhas = new Map<string, Omit<LinhaRanking, "posicao">>();

  banco.alunos
    .filter((a) => a.inscritoRanking)
    .forEach((a) =>
      linhas.set(a.id, { alunoId: a.id, pontos: 0, vitorias: 0, derrotas: 0, partidas: 0 }),
    );

  banco.partidas.forEach((partida) => {
    if (!contaParaRanking(banco, partida, ate)) return;
    const vencedorId = partida.vencedor === "A" ? partida.ladoA[0] : partida.ladoB[0];
    const perdedorId = partida.vencedor === "A" ? partida.ladoB[0] : partida.ladoA[0];

    const vencedor = linhas.get(vencedorId);
    if (vencedor) {
      vencedor.pontos += pontosVitoria;
      vencedor.vitorias += 1;
      vencedor.partidas += 1;
    }
    const perdedor = linhas.get(perdedorId);
    if (perdedor) {
      // W.O.: quem nao compareceu nao ganha os pontos de participacao.
      perdedor.pontos += partida.wo ? 0 : pontosDerrota;
      perdedor.derrotas += 1;
      perdedor.partidas += 1;
    }
  });

  const nomes = new Map(banco.alunos.map((a) => [a.id, a.nome]));

  return [...linhas.values()]
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.vitorias - a.vitorias ||
        (nomes.get(a.alunoId) ?? "").localeCompare(nomes.get(b.alunoId) ?? ""),
    )
    .map((linha, indice) => ({ ...linha, posicao: indice + 1 }));
}
