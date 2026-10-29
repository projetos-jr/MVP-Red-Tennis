/**
 * Testes das regras de torneio: geradores de chave, avanco do vencedor,
 * W.O. e classificacao com desempate. Viram testes do banco real (pgTAP)
 * quando as funcoes forem para o Postgres.
 */

import { describe, expect, it } from "vitest";
import type { FormatoTorneio, Partida, Torneio, TorneioInscrito } from "../tipos";
import { ErroDeRegra } from "./comum";
import { lerPlacar, totaisDaPartida, validarResultado } from "./ranking";
import {
  aplicarResultado,
  atualizarFaseEliminatoria,
  bloqueioDeCorrecao,
  campeaoDoTorneio,
  classificar,
  desfazerResultado,
  gerarChave,
  montarFaseEliminatoria,
  ordemDosCabecas,
  previaDaChave,
  rodadasTodosContraTodos,
  sortearInscritos,
  tamanhosDosGrupos,
  torneioTerminou,
  validarInscricoes,
} from "./torneios";

const CRITERIOS = ["Vitórias", "Confronto direto", "Saldo de sets", "Saldo de games"];

function torneio(formato: FormatoTorneio): Torneio {
  return {
    id: "t-x",
    nome: "Teste",
    data: "2026-11-10",
    formato,
    duplas: false,
    situacao: "em_andamento",
    criadoEm: "2026-11-01T10:00:00",
  };
}

/** n inscricoes "i1".."in"; as `cabecas` primeiras sao cabecas de chave 1, 2... */
function inscritos(n: number, cabecas = 0): TorneioInscrito[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i + 1}`,
    torneioId: "t-x",
    alunosIds: [`a${i + 1}`],
    cabecaDeChave: i < cabecas ? i + 1 : undefined,
  }));
}

const OPCOES = { prefixoId: "pt", criadoEm: "2026-11-01T10:00:00", classificadosPorGrupo: 2 };

function eliminatoria(n: number, cabecas = 0): Partida[] {
  return gerarChave(torneio("eliminatoria"), inscritos(n, cabecas), OPCOES).partidas;
}

function partida(partidas: Partida[], rodada: number, ordem: number): Partida {
  const encontrada = partidas.find((p) => p.rodada === rodada && p.ordem === ordem);
  expect(encontrada, `partida da rodada ${rodada}, ordem ${ordem}`).toBeDefined();
  return encontrada as Partida;
}

/** Quem ja nasce numa partida da 2a rodada recebeu folga. */
function comFolga(partidas: Partida[]): string[] {
  const alimentados = new Set(
    partidas.filter((p) => p.proximaPartidaId).map((p) => `${p.proximaPartidaId}|${p.ladoNaProxima}`),
  );
  return partidas
    .filter((p) => p.rodada === 2)
    .flatMap((p) => [
      !alimentados.has(`${p.id}|A`) ? p.inscricaoAId : undefined,
      !alimentados.has(`${p.id}|B`) ? p.inscricaoBId : undefined,
    ])
    .filter((id): id is string => Boolean(id))
    .sort();
}

/**
 * Ligacoes da chave: uma final so; cada partida aponta para uma partida da
 * rodada seguinte; cada lado de cada partida tem exatamente uma origem
 * (inscrito colocado na geracao OU vencedor de uma partida anterior).
 */
function conferirLigacoes(partidas: Partida[]): void {
  const porId = new Map(partidas.map((p) => [p.id, p]));
  expect(partidas.filter((p) => !p.proximaPartidaId)).toHaveLength(1);
  const chegadas = partidas
    .filter((p) => p.proximaPartidaId)
    .map((p) => {
      const seguinte = porId.get(p.proximaPartidaId ?? "");
      expect(seguinte).toBeDefined();
      expect(seguinte?.rodada).toBe((p.rodada ?? 0) + 1);
      return `${p.proximaPartidaId}|${p.ladoNaProxima}`;
    });
  expect(new Set(chegadas).size).toBe(chegadas.length);
  partidas.forEach((p) => {
    expect(Boolean(p.inscricaoAId) !== chegadas.includes(`${p.id}|A`)).toBe(true);
    expect(Boolean(p.inscricaoBId) !== chegadas.includes(`${p.id}|B`)).toBe(true);
  });
}

/** Metade da chave (0 = de cima, 1 = de baixo) da primeira partida do inscrito. */
function metadeDaChave(partidas: Partida[], inscricaoId: string): number {
  const total = Math.max(...partidas.map((p) => p.rodada ?? 0));
  const estreia = partidas
    .filter((p) => p.inscricaoAId === inscricaoId || p.inscricaoBId === inscricaoId)
    .sort((a, b) => (a.rodada ?? 0) - (b.rodada ?? 0))[0];
  const partidasNaRodada = 2 ** (total - (estreia.rodada ?? 0));
  return (estreia.ordem ?? 1) - 1 < partidasNaRodada / 2 ? 0 : 1;
}

function resultado(vencedor: "A" | "B", placar = "6/4 6/4") {
  return { placar, vencedor, wo: false } as const;
}

describe("ordem dos cabecas de chave", () => {
  it("coloca o 1 no topo e o 2 na base, e cada um estreia contra o numero espelhado", () => {
    expect(ordemDosCabecas(2)).toEqual([1, 2]);
    expect(ordemDosCabecas(4)).toEqual([1, 4, 3, 2]);
    expect(ordemDosCabecas(8)).toEqual([1, 8, 5, 4, 3, 6, 7, 2]);
    expect(ordemDosCabecas(16)).toHaveLength(16);
  });
});

describe("eliminatoria simples", () => {
  it("2 inscritos: uma partida so, a final", () => {
    const partidas = eliminatoria(2);
    expect(partidas).toHaveLength(1);
    expect(partidas[0]).toMatchObject({ fase: "Final", inscricaoAId: "i1", inscricaoBId: "i2" });
    expect(partidas[0].proximaPartidaId).toBeUndefined();
  });

  it("5 inscritos: chave de 8, 3 folgas e 4 partidas", () => {
    const partidas = eliminatoria(5, 2);
    expect(partidas).toHaveLength(4);
    expect(partidas.filter((p) => p.rodada === 1)).toHaveLength(1);
    expect(comFolga(partidas)).toEqual(["i1", "i2", "i3"]);
    // A unica partida da estreia e entre os dois ultimos (4 x 5).
    const estreia = partidas.find((p) => p.rodada === 1);
    expect([estreia?.inscricaoAId, estreia?.inscricaoBId].sort()).toEqual(["i4", "i5"]);
    conferirLigacoes(partidas);
  });

  it("6 inscritos: chave de 8, os 2 cabecas de chave passam direto e ficam em lados opostos", () => {
    const partidas = eliminatoria(6, 2);
    expect(partidas).toHaveLength(5);
    expect(partidas.filter((p) => p.rodada === 1)).toHaveLength(2);
    expect(comFolga(partidas)).toEqual(["i1", "i2"]);
    expect(partida(partidas, 2, 1).inscricaoAId).toBe("i1");
    expect(partida(partidas, 2, 2).inscricaoBId).toBe("i2");
    expect(metadeDaChave(partidas, "i1")).not.toBe(metadeDaChave(partidas, "i2"));
    expect(partidas.map((p) => p.fase)).toEqual([
      "Quartas de final",
      "Quartas de final",
      "Semifinal",
      "Semifinal",
      "Final",
    ]);
    conferirLigacoes(partidas);
  });

  it("8 inscritos: 7 partidas, sem folga, 1 x 8 na estreia e cabecas 1 e 2 em metades opostas", () => {
    const partidas = eliminatoria(8, 4);
    expect(partidas).toHaveLength(7);
    expect(comFolga(partidas)).toEqual([]);
    expect(partida(partidas, 1, 1)).toMatchObject({ inscricaoAId: "i1", inscricaoBId: "i8" });
    expect(metadeDaChave(partidas, "i1")).not.toBe(metadeDaChave(partidas, "i2"));
    expect(metadeDaChave(partidas, "i3")).not.toBe(metadeDaChave(partidas, "i4"));
    conferirLigacoes(partidas);
  });

  it("16 inscritos: 15 partidas em 4 rodadas, das oitavas a final", () => {
    const partidas = eliminatoria(16, 2);
    expect(partidas).toHaveLength(15);
    const porFase = (fase: string) => partidas.filter((p) => p.fase === fase).length;
    expect([porFase("Oitavas de final"), porFase("Quartas de final"), porFase("Semifinal"), porFase("Final")]).toEqual([8, 4, 2, 1]);
    expect(metadeDaChave(partidas, "i1")).not.toBe(metadeDaChave(partidas, "i2"));
    conferirLigacoes(partidas);
  });

  it("menos de 2 inscricoes nao gera chave", () => {
    expect(() => eliminatoria(1)).toThrowError(ErroDeRegra);
    expect(previaDaChave("eliminatoria", 6, 2)).toMatchObject({ valida: true, partidas: 5, folgas: 2 });
  });

  it("o sorteio mexe so em quem nao e cabeca de chave e e repetivel", () => {
    const sorteados = sortearInscritos(inscritos(8, 2), "semente");
    expect(sorteados.slice(0, 2).map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(sorteados.map((i) => i.id).sort()).toEqual(inscritos(8).map((i) => i.id).sort());
    expect(sortearInscritos(inscritos(8, 2), "semente")).toEqual(sorteados);
  });
});

describe("avanco do vencedor", () => {
  const base = eliminatoria(6, 2);
  // Quartas 2 (estreia de i4 x i5 ou i5 x i4) alimenta o lado B da semifinal 1.
  const quartas = partida(base, 1, 2);

  it("o vencedor vai sozinho para o lado certo da partida seguinte", () => {
    const depois = aplicarResultado(base, quartas.id, resultado("A"));
    const semi = partida(depois, 2, 1);
    expect(quartas.ladoNaProxima).toBe("B");
    expect(semi.inscricaoBId).toBe(quartas.inscricaoAId);
    expect(semi.ladoB).toEqual(quartas.ladoA);
    // Nada foi alterado no lugar.
    expect(partida(base, 2, 1).inscricaoBId).toBeUndefined();
  });

  it("corrigir antes da seguinte ser jogada troca o vencedor na seguinte", () => {
    const primeiro = aplicarResultado(base, quartas.id, resultado("A"));
    const corrigido = aplicarResultado(primeiro, quartas.id, resultado("B", "4/6 4/6"));
    expect(partida(corrigido, 2, 1).inscricaoBId).toBe(quartas.inscricaoBId);
  });

  it("depois que a seguinte foi jogada, nao corrige nem apaga", () => {
    let partidas = aplicarResultado(base, quartas.id, resultado("A"));
    partidas = aplicarResultado(partidas, partida(partidas, 2, 1).id, resultado("A"));
    expect(() => aplicarResultado(partidas, quartas.id, resultado("B", "4/6 4/6"))).toThrowError(
      /partida seguinte \(Semifinal\) já foi jogada/,
    );
    expect(() => desfazerResultado(partidas, quartas.id)).toThrowError(ErroDeRegra);
    const t = torneio("eliminatoria");
    expect(bloqueioDeCorrecao(t, partidas, partida(partidas, 1, 2))).toMatch(/já foi jogada/);
  });

  it("partida sem os dois lados definidos nao recebe resultado", () => {
    expect(() => aplicarResultado(base, partida(base, 3, 1).id, resultado("A"))).toThrowError(
      /espera o vencedor/,
    );
  });

  it("apagar o resultado tira o vencedor da partida seguinte", () => {
    const comResultado = aplicarResultado(base, quartas.id, resultado("A"));
    const desfeito = desfazerResultado(comResultado, quartas.id);
    expect(partida(desfeito, 1, 2).vencedor).toBeUndefined();
    expect(partida(desfeito, 2, 1).inscricaoBId).toBeUndefined();
    expect(partida(desfeito, 2, 1).ladoB).toEqual([]);
  });

  it("W.O.: quem compareceu vence e avanca; a final decidida encerra o torneio", () => {
    const t = torneio("eliminatoria");
    let partidas = aplicarResultado(base, quartas.id, { placar: "W.O.", vencedor: "B", wo: true });
    expect(partida(partidas, 1, 2)).toMatchObject({ placar: "W.O.", vencedor: "B", wo: true });
    expect(partida(partidas, 2, 1).inscricaoBId).toBe(quartas.inscricaoBId);

    partidas = aplicarResultado(partidas, partida(partidas, 1, 3).id, resultado("A"));
    partidas = aplicarResultado(partidas, partida(partidas, 2, 1).id, resultado("A"));
    expect(torneioTerminou(t, partidas)).toBe(false);
    partidas = aplicarResultado(partidas, partida(partidas, 2, 2).id, resultado("B"));
    partidas = aplicarResultado(partidas, partida(partidas, 3, 1).id, resultado("B", "3/6 6/3 8/10"));
    expect(torneioTerminou(t, partidas)).toBe(true);
    expect(campeaoDoTorneio(t, inscritos(6, 2), partidas, CRITERIOS)).toBe("i2");
  });
});

describe("grupos + eliminatoria", () => {
  it("separa em grupos de 3 ou 4", () => {
    expect(tamanhosDosGrupos(6)).toEqual([3, 3]);
    expect(tamanhosDosGrupos(7)).toEqual([4, 3]);
    expect(tamanhosDosGrupos(8)).toEqual([4, 4]);
    expect(tamanhosDosGrupos(9)).toEqual([3, 3, 3]);
    expect(tamanhosDosGrupos(13)).toEqual([4, 3, 3, 3]);
    expect(previaDaChave("grupos_eliminatoria", 5, 2).valida).toBe(false);
  });

  it("7 inscritos: grupos de 4 e 3, 9 jogos, cabecas em grupos diferentes e eliminatoria so no fim", () => {
    const t = torneio("grupos_eliminatoria");
    const chave = gerarChave(t, inscritos(7, 2), OPCOES);
    const grupoDe = new Map(chave.inscritos.map((i) => [i.id, i.grupo]));
    expect(chave.inscritos.filter((i) => i.grupo === "A")).toHaveLength(4);
    expect(chave.inscritos.filter((i) => i.grupo === "B")).toHaveLength(3);
    expect(grupoDe.get("i1")).not.toBe(grupoDe.get("i2"));
    expect(chave.partidas).toHaveLength(6 + 3);
    expect(chave.partidas.every((p) => p.grupo && !p.proximaPartidaId)).toBe(true);

    // Cada par do mesmo grupo se enfrenta exatamente uma vez.
    const pares = chave.partidas.map((p) => [p.inscricaoAId, p.inscricaoBId].sort().join("x"));
    expect(new Set(pares).size).toBe(pares.length);
    chave.partidas.forEach((p) => expect(grupoDe.get(p.inscricaoAId ?? "")).toBe(grupoDe.get(p.inscricaoBId ?? "")));

    // Enquanto falta jogo de grupo, nao ha eliminatoria.
    let partidas = aplicarResultado(chave.partidas, chave.partidas[0].id, resultado("A"));
    partidas = atualizarFaseEliminatoria(t, chave.inscritos, partidas, 2, CRITERIOS, "ko", OPCOES.criadoEm);
    expect(partidas.some((p) => !p.grupo)).toBe(false);

    // Terminados os grupos (vence sempre quem tem numero menor), monta 1A x 2B e 2A x 1B.
    const numero = (id?: string) => Number((id ?? "i0").slice(1));
    partidas = chave.partidas;
    chave.partidas.forEach((p) => {
      partidas = aplicarResultado(partidas, p.id, resultado(numero(p.inscricaoAId) < numero(p.inscricaoBId) ? "A" : "B"));
    });
    partidas = atualizarFaseEliminatoria(t, chave.inscritos, partidas, 2, CRITERIOS, "ko", OPCOES.criadoEm);
    const fase = partidas.filter((p) => !p.grupo);
    expect(fase).toHaveLength(3);
    const tabelaA = classificar(chave.inscritos.filter((i) => i.grupo === "A"), partidas, CRITERIOS);
    const tabelaB = classificar(chave.inscritos.filter((i) => i.grupo === "B"), partidas, CRITERIOS);
    const [primeiroA, segundoA] = tabelaA.map((l) => l.inscricaoId);
    const [primeiroB, segundoB] = tabelaB.map((l) => l.inscricaoId);
    expect(partida(fase, 1, 1)).toMatchObject({ fase: "Semifinal", inscricaoAId: primeiroA, inscricaoBId: segundoB });
    expect(partida(fase, 1, 2)).toMatchObject({ inscricaoAId: segundoA, inscricaoBId: primeiroB });
    conferirLigacoes(fase);

    // Com a eliminatoria comecada, os grupos ficam travados.
    const comSemi = aplicarResultado(partidas, partida(fase, 1, 1).id, resultado("A"));
    expect(() =>
      atualizarFaseEliminatoria(t, chave.inscritos, comSemi, 2, CRITERIOS, "ko2", OPCOES.criadoEm),
    ).toThrowError(/fase eliminatória já começou/);
    expect(bloqueioDeCorrecao(t, comSemi, chave.partidas[0])).toMatch(/fase eliminatória já começou/);
  });

  it("8 inscritos: dois grupos de 4 e 12 jogos de grupo", () => {
    const chave = gerarChave(torneio("grupos_eliminatoria"), inscritos(8, 2), OPCOES);
    expect(chave.inscritos.filter((i) => i.grupo === "A")).toHaveLength(4);
    expect(chave.inscritos.filter((i) => i.grupo === "B")).toHaveLength(4);
    expect(chave.partidas).toHaveLength(12);
    expect(previaDaChave("grupos_eliminatoria", 8, 2)).toMatchObject({ valida: true, partidas: 15, grupos: [4, 4] });
  });

  it("3 grupos: eliminatoria de 6 com folga para 1A e 1B e ninguem enfrenta o proprio grupo na estreia", () => {
    const t = torneio("grupos_eliminatoria");
    const chave = gerarChave(t, inscritos(9, 3), OPCOES);
    let partidas = chave.partidas;
    chave.partidas.forEach((p) => {
      partidas = aplicarResultado(partidas, p.id, resultado("A"));
    });
    const fase = montarFaseEliminatoria(t, chave.inscritos, partidas, 2, CRITERIOS, "ko", OPCOES.criadoEm);
    expect(fase).toHaveLength(5);
    conferirLigacoes(fase);
    const grupoDe = new Map(chave.inscritos.map((i) => [i.id, i.grupo]));
    fase
      .filter((p) => p.inscricaoAId && p.inscricaoBId)
      .forEach((p) => expect(grupoDe.get(p.inscricaoAId ?? "")).not.toBe(grupoDe.get(p.inscricaoBId ?? "")));
    expect(comFolga(fase).map((id) => grupoDe.get(id)).sort()).toEqual(["A", "B"]);
  });
});

describe("todos contra todos", () => {
  it("4 inscritos: 6 partidas em 3 rodadas, cada um joga uma vez por rodada", () => {
    const partidas = gerarChave(torneio("todos_contra_todos"), inscritos(4), OPCOES).partidas;
    expect(partidas).toHaveLength(6);
    expect(new Set(partidas.map((p) => p.rodada)).size).toBe(3);
    [1, 2, 3].forEach((rodada) => {
      const naRodada = partidas.filter((p) => p.rodada === rodada).flatMap((p) => [p.inscricaoAId, p.inscricaoBId]);
      expect(new Set(naRodada).size).toBe(4);
    });
  });

  it("5 inscritos: 10 partidas, todos os pares uma vez, um de folga por rodada", () => {
    const partidas = gerarChave(torneio("todos_contra_todos"), inscritos(5), OPCOES).partidas;
    expect(partidas).toHaveLength(10);
    const pares = partidas.map((p) => [p.inscricaoAId, p.inscricaoBId].sort().join("x"));
    expect(new Set(pares).size).toBe(10);
    expect(rodadasTodosContraTodos([1, 2, 3, 4, 5]).map((r) => r.length)).toEqual([2, 2, 2, 2, 2]);
  });

  it("termina quando todas as partidas foram jogadas, e o campeao e o 1o da classificacao", () => {
    const t = torneio("todos_contra_todos");
    let partidas = gerarChave(t, inscritos(4), OPCOES).partidas;
    partidas.forEach((p) => {
      expect(torneioTerminou(t, partidas)).toBe(false);
      // i3 vence todos os seus jogos; nos outros, vence o lado A.
      partidas = aplicarResultado(partidas, p.id, resultado(p.inscricaoBId === "i3" ? "B" : "A"));
    });
    expect(torneioTerminou(t, partidas)).toBe(true);
    expect(campeaoDoTorneio(t, inscritos(4), partidas, CRITERIOS)).toBe("i3");
  });
});

describe("classificacao com desempate (H8)", () => {
  /** Partida ja jogada entre duas inscricoes; o placar e do lado A. */
  function jogo(a: string, b: string, vencedor: "A" | "B", placar: string): Partida {
    return {
      id: `${a}x${b}`,
      torneioId: "t-x",
      ladoA: [a],
      ladoB: [b],
      inscricaoAId: a,
      inscricaoBId: b,
      vencedor,
      placar,
      criadoEm: "2026-11-01T10:00:00",
    };
  }
  const grupo = (ids: string[]): TorneioInscrito[] =>
    ids.map((id) => ({ id, torneioId: "t-x", alunosIds: [id] }));

  it("empate em vitorias decidido pelo confronto direto, mesmo com saldo de sets pior", () => {
    const partidas = [
      jogo("A", "B", "A", "7/6 7/6"),
      jogo("A", "D", "A", "7/5 4/6 10/8"),
      jogo("C", "A", "A", "6/0 6/0"),
      jogo("B", "C", "A", "6/0 6/0"),
      jogo("B", "D", "A", "6/0 6/0"),
      jogo("D", "C", "A", "7/6 4/6 10/7"),
    ];
    const tabela = classificar(grupo(["A", "B", "C", "D"]), partidas, CRITERIOS);
    expect(tabela.map((l) => l.inscricaoId)).toEqual(["A", "B", "D", "C"]);
    const b = tabela.find((l) => l.inscricaoId === "B");
    const a = tabela.find((l) => l.inscricaoId === "A");
    expect((b?.setsPro ?? 0) - (b?.setsContra ?? 0)).toBeGreaterThan((a?.setsPro ?? 0) - (a?.setsContra ?? 0));
    expect(tabela[0]).toMatchObject({ vitorias: 2, derrotas: 1, desempate: "Confronto direto" });
    expect(tabela[2].desempate).toBe("Confronto direto");
  });

  it("empate triplo (cada um venceu um) decidido pelo saldo de sets", () => {
    const partidas = [
      jogo("X", "Y", "A", "6/0 6/0"),
      jogo("Y", "Z", "A", "6/4 3/6 10/8"),
      jogo("Z", "X", "A", "6/4 6/4"),
    ];
    const tabela = classificar(grupo(["X", "Y", "Z"]), partidas, CRITERIOS);
    expect(tabela.map((l) => l.inscricaoId)).toEqual(["Z", "X", "Y"]);
    expect(tabela.map((l) => l.setsPro - l.setsContra)).toEqual([1, 0, -1]);
    expect(tabela.every((l) => l.desempate === "Saldo de sets")).toBe(true);
  });

  it("com o mesmo saldo de sets, decide o saldo de games", () => {
    const partidas = [
      jogo("X", "Y", "A", "6/4 6/4"),
      jogo("Y", "Z", "A", "6/4 6/4"),
      jogo("Z", "X", "A", "6/2 6/2"),
    ];
    const tabela = classificar(grupo(["X", "Y", "Z"]), partidas, CRITERIOS);
    expect(tabela.map((l) => l.inscricaoId)).toEqual(["Z", "Y", "X"]);
    expect(tabela.map((l) => l.gamesPro - l.gamesContra)).toEqual([4, 0, -4]);
    expect(tabela[0].desempate).toBe("Saldo de games");
  });

  it("segue a ordem dos criterios das Configuracoes", () => {
    const partidas = [
      jogo("A", "B", "A", "7/6 7/6"),
      jogo("A", "D", "A", "7/5 4/6 10/8"),
      jogo("C", "A", "A", "6/0 6/0"),
      jogo("B", "C", "A", "6/0 6/0"),
      jogo("B", "D", "A", "6/0 6/0"),
      jogo("D", "C", "A", "7/6 4/6 10/7"),
    ];
    const saldoPrimeiro = ["Vitórias", "Saldo de sets", "Confronto direto"];
    expect(classificar(grupo(["A", "B", "C", "D"]), partidas, saldoPrimeiro)[0].inscricaoId).toBe("B");
  });

  it("W.O. conta como vitoria por 6/0 6/0 no saldo", () => {
    const wo = { ...jogo("A", "B", "B", "W.O."), wo: true };
    expect(totaisDaPartida(wo)).toEqual({ setsA: 0, setsB: 2, gamesA: 0, gamesB: 12 });
    const tabela = classificar(grupo(["A", "B"]), [wo], CRITERIOS);
    expect(tabela[0]).toMatchObject({ inscricaoId: "B", vitorias: 1, setsPro: 2, gamesPro: 12 });
  });
});

describe("placar", () => {
  it("le os jeitos comuns de escrever e o super tie-break vale 1 game", () => {
    expect(lerPlacar("6x4 6-2")).toEqual([
      { a: 6, b: 4, tieBreak: undefined },
      { a: 6, b: 2, tieBreak: undefined },
    ]);
    expect(lerPlacar("7/6 (5) 6/3")?.[0]).toEqual({ a: 7, b: 6, tieBreak: 5 });
    expect(lerPlacar("seis a quatro")).toBeUndefined();
    expect(totaisDaPartida({ placar: "6/4 3/6 10/8", vencedor: "A" })).toEqual({
      setsA: 2,
      setsB: 1,
      gamesA: 10,
      gamesB: 10,
    });
  });

  it("aceita placar coerente e arruma o texto", () => {
    expect(validarResultado({ placar: "6x4  3x6 10x8", vencedor: "A" })).toEqual({
      placar: "6/4 3/6 10/8",
      vencedor: "A",
      wo: false,
    });
    expect(validarResultado({ vencedor: "B", wo: true })).toEqual({ placar: "W.O.", vencedor: "B", wo: true });
  });

  it("recusa placar incoerente com o vencedor", () => {
    const nomes = { A: "Ana", B: "Bia" };
    expect(() => validarResultado({ placar: "6/4 6/3", vencedor: "B" }, nomes)).toThrowError(
      "O placar não bate com o vencedor: por esse placar quem venceu foi Ana.",
    );
    expect(() => validarResultado({ placar: "6/4 3/6", vencedor: "A" })).toThrowError(/empatado em sets/);
    expect(() => validarResultado({ placar: "6/6", vencedor: "A" })).toThrowError(/não termina empatado/);
    expect(() => validarResultado({ placar: "6/4 6/3 2/6", vencedor: "A" })).toThrowError(/último set/);
    expect(() => validarResultado({ placar: "", vencedor: "A" })).toThrowError(/Informe o placar/);
    expect(() => validarResultado({ placar: "6/4 6/4" })).toThrowError(/Escolha quem venceu/);
  });
});

describe("inscricoes", () => {
  const alunos = ["a1", "a2", "a3"].map((id) => ({
    id,
    nome: `Aluno ${id}`,
    telefone: "",
    email: "",
    ativo: id !== "a3",
    inscritoRanking: true,
    criadoEm: "2026-01-01T00:00:00",
  }));

  it("recusa dupla incompleta, aluno repetido, aluno inativo e cabecas fora de sequencia", () => {
    expect(() => validarInscricoes(alunos, true, [{ alunosIds: ["a1"] }])).toThrowError(/dois jogadores/);
    expect(() => validarInscricoes(alunos, true, [{ alunosIds: ["a1", "a1"] }])).toThrowError(/diferentes/);
    expect(() =>
      validarInscricoes(alunos, false, [{ alunosIds: ["a1"] }, { alunosIds: ["a1"] }]),
    ).toThrowError("Aluno a1 aparece em duas inscrições.");
    expect(() => validarInscricoes(alunos, false, [{ alunosIds: ["a3"] }])).toThrowError(/não está ativo/);
    expect(() =>
      validarInscricoes(alunos, false, [
        { alunosIds: ["a1"], cabecaDeChave: 1 },
        { alunosIds: ["a2"], cabecaDeChave: 3 },
      ]),
    ).toThrowError(/sequência/);
    expect(() =>
      validarInscricoes(alunos, false, [
        { alunosIds: ["a1"], cabecaDeChave: 1 },
        { alunosIds: ["a2"], cabecaDeChave: 2 },
      ]),
    ).not.toThrow();
  });
});
