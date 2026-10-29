/**
 * Regras do ranking.
 *
 * O ranking nao e guardado: e calculado a partir das partidas com resultado,
 * usando a pontuacao das Configuracoes (Hipotese H7). Partidas de torneio so
 * contam se `torneioContaParaRanking` estiver ligado. Partidas de duplas nao
 * contam (o ranking e individual).
 *
 * Aqui tambem fica a leitura do placar ("6/4 3/6 10/8"), usada pelas partidas
 * de ranking e pelas de torneio.
 */

import type { Banco, Partida } from "../tipos";
import { ErroDeRegra } from "./comum";

export interface LinhaRanking {
  alunoId: string;
  posicao: number;
  pontos: number;
  vitorias: number;
  derrotas: number;
  partidas: number;
}

/** A partida entra na conta do ranking? (Com resultado, simples, e torneio so se a configuracao mandar.) */
export function contaParaRanking(banco: Banco, partida: Partida, ate?: string): boolean {
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

// ---------------------------------------------------------------------------
// Placar
// ---------------------------------------------------------------------------

/** Texto gravado no placar de uma vitoria por nao comparecimento. */
export const PLACAR_WO = "W.O.";

/** Um set, sempre do ponto de vista do lado A ("6/4" = A fez 6 games, B fez 4). */
export interface SetDoPlacar {
  a: number;
  b: number;
  /** Pontos do tie-break do set, so para exibir (o "5" de 7/6(5)). */
  tieBreak?: number;
}

/**
 * Le o placar digitado. Aceita "6/4 3/6 10/8", "6x4 6x2", "6-4, 6-2" e
 * tie-break entre parenteses ("7/6(5)"). Devolve undefined se nao for um placar.
 */
export function lerPlacar(texto: string): SetDoPlacar[] | undefined {
  const pedacos: string[] = [];
  texto
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .forEach((pedaco) => {
      // "7/6 (5)": o tie-break escrito separado volta para o set anterior.
      if (pedaco.startsWith("(") && pedacos.length > 0) pedacos[pedacos.length - 1] += pedaco;
      else pedacos.push(pedaco);
    });
  if (pedacos.length === 0 || pedacos.length > 5) return undefined;

  const sets: SetDoPlacar[] = [];
  for (const pedaco of pedacos) {
    const partes = /^(\d{1,2})[/xX-](\d{1,2})(?:\((\d{1,2})\))?$/.exec(pedaco);
    if (!partes) return undefined;
    sets.push({
      a: Number(partes[1]),
      b: Number(partes[2]),
      tieBreak: partes[3] === undefined ? undefined : Number(partes[3]),
    });
  }
  return sets;
}

export function escreverPlacar(sets: SetDoPlacar[]): string {
  return sets
    .map((s) => `${s.a}/${s.b}${s.tieBreak === undefined ? "" : `(${s.tieBreak})`}`)
    .join(" ");
}

/** O mesmo placar visto pelo outro lado: "6/4 3/6" -> "4/6 6/3". */
export function inverterPlacar(placar: string): string {
  const sets = lerPlacar(placar);
  if (!sets) return placar;
  return escreverPlacar(sets.map((s) => ({ a: s.b, b: s.a, tieBreak: s.tieBreak })));
}

/**
 * Super tie-break: o set decisivo jogado ate 10 pontos ("10/8"). Conta como
 * um set e, no saldo de games, como um game so (regra da ITF).
 */
export function eSuperTieBreak(set: SetDoPlacar): boolean {
  return Math.max(set.a, set.b) >= 10;
}

export interface ResultadoDigitado {
  placar?: string;
  vencedor?: "A" | "B" | "";
  wo?: boolean;
}

export interface ResultadoValido {
  /** Placar arrumado ("6x4  6x2" vira "6/4 6/2"); "W.O." na vitoria por W.O. */
  placar: string;
  vencedor: "A" | "B";
  wo: boolean;
}

/**
 * Confere se o placar combina com o vencedor e devolve o resultado arrumado.
 * Recusa (com a mensagem para a tela): sem vencedor; sem placar (a nao ser no
 * W.O.); set empatado; placar empatado em sets; placar que da a vitoria ao
 * outro lado; ultimo set que nao e de quem venceu (a partida acaba no set
 * que decide).
 */
export function validarResultado(
  resultado: ResultadoDigitado,
  nomes: { A: string; B: string } = { A: "o lado A", B: "o lado B" },
): ResultadoValido {
  const { vencedor } = resultado;
  if (vencedor !== "A" && vencedor !== "B") {
    throw new ErroDeRegra("Escolha quem venceu a partida.");
  }
  if (resultado.wo) return { placar: PLACAR_WO, vencedor, wo: true };

  const texto = (resultado.placar ?? "").trim();
  if (!texto) {
    throw new ErroDeRegra("Informe o placar (ex.: 6/4 3/6 10/8) ou marque W.O.");
  }
  const sets = lerPlacar(texto);
  if (!sets) {
    throw new ErroDeRegra(
      `Placar "${texto}" não reconhecido. Escreva os sets separados por espaço, como 6/4 3/6 10/8.`,
    );
  }
  const empatado = sets.find((s) => s.a === s.b);
  if (empatado) {
    throw new ErroDeRegra(`Um set não termina empatado (${empatado.a}/${empatado.b}). Confira o placar.`);
  }

  const setsA = sets.filter((s) => s.a > s.b).length;
  const setsB = sets.length - setsA;
  if (setsA === setsB) {
    throw new ErroDeRegra(
      `O placar está empatado em sets (${setsA} a ${setsB}). Falta o set decisivo?`,
    );
  }
  const pelaContagem = setsA > setsB ? "A" : "B";
  if (pelaContagem !== vencedor) {
    throw new ErroDeRegra(
      `O placar não bate com o vencedor: por esse placar quem venceu foi ${nomes[pelaContagem]}.`,
    );
  }
  const ultimo = sets[sets.length - 1];
  if ((ultimo.a > ultimo.b ? "A" : "B") !== vencedor) {
    throw new ErroDeRegra(
      "O último set precisa ser de quem venceu a partida. Confira a ordem dos sets.",
    );
  }
  return { placar: escreverPlacar(sets), vencedor, wo: false };
}

export interface TotaisDaPartida {
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
}

/**
 * Sets e games de cada lado numa partida com resultado (usados no saldo da
 * classificacao). W.O. conta como 6/0 6/0 para quem venceu (Hipotese H8,
 * a confirmar); super tie-break conta como 1 game.
 */
export function totaisDaPartida(
  partida: Pick<Partida, "placar" | "vencedor" | "wo">,
): TotaisDaPartida {
  const zero = { setsA: 0, setsB: 0, gamesA: 0, gamesB: 0 };
  if (!partida.vencedor) return zero;
  if (partida.wo) {
    return partida.vencedor === "A"
      ? { setsA: 2, setsB: 0, gamesA: 12, gamesB: 0 }
      : { setsA: 0, setsB: 2, gamesA: 0, gamesB: 12 };
  }
  const sets = lerPlacar(partida.placar ?? "") ?? [];
  return sets.reduce((totais, set) => {
    const venceuA = set.a > set.b;
    const gamesA = eSuperTieBreak(set) ? (venceuA ? 1 : 0) : set.a;
    const gamesB = eSuperTieBreak(set) ? (venceuA ? 0 : 1) : set.b;
    return {
      setsA: totais.setsA + (venceuA ? 1 : 0),
      setsB: totais.setsB + (venceuA ? 0 : 1),
      gamesA: totais.gamesA + gamesA,
      gamesB: totais.gamesB + gamesB,
    };
  }, zero);
}
