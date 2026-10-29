/**
 * Testes das operacoes do ranking e dos torneios: o que e gravado, o que e
 * recusado (com a mensagem da tela) e a pontuacao recalculada.
 */

import { describe, expect, it } from "vitest";
import { detalheDoTorneio } from "../../consultas/ranking";
import { somarDias } from "../../date";
import { HOJE } from "../constantes";
import { executarOperacao, type ContextoOperacao, type Operacao } from "../executar";
import { conflitosNaQuadra } from "../regras/agenda";
import { calcularRanking } from "../regras/ranking";
import { campeaoDoTorneio, DESEMPATE_FINAL, torneioTerminou } from "../regras/torneios";
import { gerarBancoInicial } from "../semente";
import type { Banco, Colaborador, QuadraId, Torneio } from "../tipos";
import {
  apagarResultadoDeTorneio,
  corrigirResultadoDePartida,
  corrigirResultadoDeTorneio,
  criarTorneio,
  desfazerChaveDoTorneio,
  editarTorneio,
  excluirPartida,
  gerarChaveDoTorneio,
  marcarPartida,
  registrarPartida,
  registrarResultadoDePartida,
  registrarResultadoDeTorneio,
} from "./ranking";

const inicial = gerarBancoInicial();
const [dono, recepcao, professora] = inicial.colaboradores;

function ctx(usuario: Colaborador = recepcao, hoje = HOJE): ContextoOperacao {
  return { usuario, agora: `${hoje}T10:00:00`, hoje };
}

/** Executa e exige que tenha gravado. */
function gravar<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): Banco {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (!resultado.ok) throw new Error(`Recusado sem querer: ${resultado.erro}`);
  return resultado.banco;
}

/** Executa e devolve a mensagem da recusa (falha se gravou). */
function recusa<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): string {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (resultado.ok) throw new Error("A operação deveria ter sido recusada.");
  return resultado.erro;
}

const pontos = (banco: Banco, alunoId: string) =>
  calcularRanking(banco).find((l) => l.alunoId === alunoId);

/** Primeiro horario livre (07h-21h) numa quadra de 1 a 4, na data. */
function horarioLivre(banco: Banco, data: string): { quadraId: QuadraId; horaInicio: string; horaFim: string } {
  for (const quadraId of ["1", "2", "3", "4"] as QuadraId[]) {
    for (let h = 7; h < 22; h += 1) {
      const alvo = {
        quadraId,
        data,
        horaInicio: `${String(h).padStart(2, "0")}:00`,
        horaFim: `${String(h + 1).padStart(2, "0")}:00`,
      };
      if (conflitosNaQuadra(banco.ocupacoes, alvo).length === 0) return alvo;
    }
  }
  throw new Error("Nenhum horário livre nos dados de exemplo.");
}

describe("partida de ranking", () => {
  const jogada = { jogadorA: "a01", jogadorB: "a02", data: HOJE, placar: "6/4 6/4", vencedor: "A" as const };

  it("registra o resultado e a pontuacao e recalculada (H7)", () => {
    const { pontosVitoria, pontosDerrota } = inicial.configuracoes;
    const depois = gravar(inicial, registrarPartida, jogada);
    expect(pontos(depois, "a01")?.pontos).toBe((pontos(inicial, "a01")?.pontos ?? 0) + pontosVitoria);
    expect(pontos(depois, "a02")?.pontos).toBe((pontos(inicial, "a02")?.pontos ?? 0) + pontosDerrota);
    expect(pontos(depois, "a01")?.vitorias).toBe((pontos(inicial, "a01")?.vitorias ?? 0) + 1);
    expect(depois.auditoria).toHaveLength(1);
    expect(depois.auditoria[0]).toMatchObject({
      tabela: "partidas",
      acao: "criar",
      operacao: "Registrar partida de ranking",
    });
  });

  it("recusa o mesmo jogador dos dois lados, quem nao esta no ranking e data futura", () => {
    expect(recusa(inicial, registrarPartida, { ...jogada, jogadorB: "a01" })).toBe(
      "Escolha dois jogadores diferentes.",
    );
    const foraDoRanking = inicial.alunos.find((a) => !a.inscritoRanking);
    expect(recusa(inicial, registrarPartida, { ...jogada, jogadorB: foraDoRanking?.id ?? "" })).toBe(
      `${foraDoRanking?.nome} não está inscrito no ranking.`,
    );
    expect(recusa(inicial, registrarPartida, { ...jogada, data: somarDias(HOJE, 1) })).toMatch(
      /Marcar partida/,
    );
  });

  it("recusa placar incoerente com o vencedor e nao grava nada", () => {
    const resultado = executarOperacao(inicial, registrarPartida, { ...jogada, vencedor: "B" }, ctx());
    expect(resultado).toEqual({
      ok: false,
      erro: "O placar não bate com o vencedor: por esse placar quem venceu foi Guilherme Lima.",
    });
    expect(recusa(inicial, registrarPartida, { ...jogada, placar: "6/4 3/6" })).toMatch(/empatado em sets/);
    expect(recusa(inicial, registrarPartida, { ...jogada, placar: "6 a 4" })).toMatch(/não reconhecido/);
  });

  it("W.O.: quem compareceu ganha a vitoria e quem faltou nao ganha os pontos de participacao", () => {
    const depois = gravar(inicial, registrarPartida, { ...jogada, placar: "", vencedor: "B", wo: true });
    expect(depois.partidas.at(-1)).toMatchObject({ placar: "W.O.", wo: true, vencedor: "B" });
    expect(pontos(depois, "a02")?.pontos).toBe(
      (pontos(inicial, "a02")?.pontos ?? 0) + inicial.configuracoes.pontosVitoria,
    );
    expect(pontos(depois, "a01")?.pontos).toBe(pontos(inicial, "a01")?.pontos);
    expect(pontos(depois, "a01")?.derrotas).toBe((pontos(inicial, "a01")?.derrotas ?? 0) + 1);
  });

  it("corrigir o resultado recalcula a pontuacao e fica no historico (antes e depois)", () => {
    const comPartida = gravar(inicial, registrarPartida, jogada);
    const id = comPartida.partidas.at(-1)?.id ?? "";
    const corrigido = gravar(comPartida, corrigirResultadoDePartida, {
      id,
      placar: "4/6 6/7(3)",
      vencedor: "B",
    });
    expect(pontos(corrigido, "a02")?.pontos).toBe(
      (pontos(inicial, "a02")?.pontos ?? 0) + inicial.configuracoes.pontosVitoria,
    );
    const registro = corrigido.auditoria.at(-1);
    expect(registro).toMatchObject({
      tabela: "partidas",
      acao: "alterar",
      registroId: id,
      operacao: "Corrigir resultado de partida de ranking",
      antes: { vencedor: "A", placar: "6/4 6/4" },
      depois: { vencedor: "B", placar: "4/6 6/7(3)" },
    });
    expect(recusa(comPartida, registrarResultadoDePartida, { id, placar: "6/1 6/1", vencedor: "A" })).toMatch(
      /já tem resultado/,
    );
  });

  it("perfil sem o modulo de ranking (professor, H9) e recusado", () => {
    expect(recusa(inicial, registrarPartida, jogada, ctx(professora))).toBe(
      "Seu perfil não tem acesso ao ranking e aos torneios.",
    );
    expect(gravar(inicial, registrarPartida, jogada, ctx(dono)).partidas).toHaveLength(
      inicial.partidas.length + 1,
    );
  });
});

describe("partida marcada com reserva de quadra", () => {
  const data = somarDias(HOJE, 2);
  const livre = horarioLivre(inicial, data);
  const marcada = { jogadorA: "a03", jogadorB: "a04", data, reserva: livre };

  it("cria a ocupacao do tipo Ranking, com os dois jogadores, ligada a partida", () => {
    const depois = gravar(inicial, marcarPartida, marcada);
    const partida = depois.partidas.at(-1);
    const ocupacao = depois.ocupacoes.find((o) => o.id === partida?.ocupacaoId);
    expect(partida).toMatchObject({ ladoA: ["a03"], ladoB: ["a04"], data });
    expect(partida?.vencedor).toBeUndefined();
    expect(ocupacao).toMatchObject({ ...livre, data, tipo: "Ranking", situacao: "agendada" });
    expect(
      depois.ocupacaoAlunos.filter((p) => p.ocupacaoId === ocupacao?.id).map((p) => p.alunoId),
    ).toEqual(["a03", "a04"]);
  });

  it("recusa conflito de quadra dizendo quem ja ocupa, e horario fora do funcionamento", () => {
    const depois = gravar(inicial, marcarPartida, marcada);
    expect(recusa(depois, marcarPartida, { ...marcada, jogadorA: "a05", jogadorB: "a06" })).toMatch(
      /já está ocupada .* \(Ranking · Larissa Preto e Felipe Ikeda\)/,
    );
    const ocupada = inicial.ocupacoes.find((o) => o.data === data && o.situacao === "agendada" && o.quadraId !== "paredao");
    expect(ocupada).toBeDefined();
    expect(
      recusa(inicial, marcarPartida, {
        ...marcada,
        reserva: { quadraId: ocupada?.quadraId ?? "1", horaInicio: ocupada?.horaInicio ?? "", horaFim: ocupada?.horaFim ?? "" },
      }),
    ).toMatch(/já está ocupada/);
    expect(
      recusa(inicial, marcarPartida, { ...marcada, reserva: { ...livre, horaInicio: "06:00", horaFim: "07:00" } }),
    ).toBe("A arena funciona das 07:00 às 22:00.");
  });

  it("o resultado so entra a partir do dia marcado", () => {
    const depois = gravar(inicial, marcarPartida, marcada);
    const id = depois.partidas.at(-1)?.id ?? "";
    const resultado = { id, placar: "6/3 6/2", vencedor: "A" as const };
    expect(recusa(depois, registrarResultadoDePartida, resultado)).toMatch(/o resultado entra a partir desse dia/);
    const noDia = gravar(depois, registrarResultadoDePartida, resultado, ctx(recepcao, data));
    expect(noDia.partidas.find((p) => p.id === id)).toMatchObject({ vencedor: "A", data });
  });

  it("excluir a partida cancela a reserva futura", () => {
    const depois = gravar(inicial, marcarPartida, marcada);
    const partida = depois.partidas.at(-1);
    const semPartida = gravar(depois, excluirPartida, { id: partida?.id ?? "" });
    expect(semPartida.partidas.some((p) => p.id === partida?.id)).toBe(false);
    expect(semPartida.ocupacoes.find((o) => o.id === partida?.ocupacaoId)).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: "Partida de ranking excluída",
    });
  });
});

describe("torneios de exemplo", () => {
  it("t-1 com inscricoes abertas, t-2 em andamento com parte dos resultados, t-3 encerrado", () => {
    const torneio = (id: string) => inicial.torneios.find((t) => t.id === id) as Torneio;
    const partidas = (id: string) => inicial.partidas.filter((p) => p.torneioId === id);
    const criterios = inicial.configuracoes.criteriosDesempate;

    expect(torneio("t-1").situacao).toBe("inscricoes");
    expect(partidas("t-1")).toHaveLength(0);

    expect(torneio("t-2").situacao).toBe("em_andamento");
    expect(partidas("t-2")).toHaveLength(5);
    expect(partidas("t-2").filter((p) => p.vencedor)).toHaveLength(3);
    expect(torneioTerminou(torneio("t-2"), inicial.partidas)).toBe(false);

    expect(torneio("t-3").situacao).toBe("encerrado");
    expect(partidas("t-3")).toHaveLength(10);
    expect(partidas("t-3").every((p) => p.vencedor)).toBe(true);
    expect(partidas("t-3").some((p) => p.wo)).toBe(true);
    expect(campeaoDoTorneio(torneio("t-3"), inicial.torneioInscritos, inicial.partidas, criterios)).toBeDefined();
  });
});

describe("torneios", () => {
  const ontem = somarDias(HOJE, -1);
  const jogadores = ["a01", "a02", "a03", "a04", "a05", "a06", "a07", "a08"];

  function criar(formato: "eliminatoria" | "grupos_eliminatoria" | "todos_contra_todos", quantos: number): Banco {
    return gravar(inicial, criarTorneio, {
      nome: "Torneio de teste",
      data: ontem,
      formato,
      duplas: false,
      inscricoes: jogadores.slice(0, quantos).map((alunoId, i) => ({
        alunosIds: [alunoId],
        cabecaDeChave: i < 2 ? i + 1 : undefined,
      })),
    });
  }

  const novoTorneio = (banco: Banco) => banco.torneios[banco.torneios.length - 1];
  const doTorneio = (banco: Banco) => banco.partidas.filter((p) => p.torneioId === novoTorneio(banco).id);

  /** Registra "6/4 6/4" para o lado A em toda partida pronta (dois lados) e sem resultado. */
  function jogarRodada(banco: Banco): Banco {
    return doTorneio(banco)
      .filter((p) => p.inscricaoAId && p.inscricaoBId && !p.vencedor)
      .reduce(
        (atual, p) => gravar(atual, registrarResultadoDeTorneio, { partidaId: p.id, placar: "6/4 6/4", vencedor: "A" }),
        banco,
      );
  }

  it("criar recusa dupla incompleta e cabecas de chave repetidos", () => {
    const base = { nome: "Duplas", data: ontem, formato: "eliminatoria" as const, duplas: true };
    expect(recusa(inicial, criarTorneio, { ...base, inscricoes: [{ alunosIds: ["a01"] }] })).toMatch(/dois jogadores/);
    expect(
      recusa(inicial, criarTorneio, {
        ...base,
        duplas: false,
        inscricoes: [
          { alunosIds: ["a01"], cabecaDeChave: 1 },
          { alunosIds: ["a02"], cabecaDeChave: 1 },
        ],
      }),
    ).toMatch(/sequência/);
    expect(recusa(inicial, criarTorneio, { ...base, nome: "  ", inscricoes: [] })).toBe("Dê um nome ao torneio.");
  });

  it("gerar a chave poe o torneio em andamento; desfazer so sem resultados", () => {
    const criado = criar("eliminatoria", 6);
    expect(novoTorneio(criado).situacao).toBe("inscricoes");
    const comChave = gravar(criado, gerarChaveDoTorneio, { id: novoTorneio(criado).id });
    expect(novoTorneio(comChave).situacao).toBe("em_andamento");
    expect(doTorneio(comChave)).toHaveLength(5);
    expect(recusa(comChave, gerarChaveDoTorneio, { id: novoTorneio(comChave).id })).toMatch(/já foi gerada/);
    expect(
      recusa(comChave, editarTorneio, {
        id: novoTorneio(comChave).id,
        nome: "Outro nome",
        data: ontem,
        formato: "eliminatoria",
        duplas: false,
        inscricoes: [],
      }),
    ).toMatch(/desfaça a chave/);

    const desfeito = gravar(comChave, desfazerChaveDoTorneio, { id: novoTorneio(comChave).id });
    expect(novoTorneio(desfeito).situacao).toBe("inscricoes");
    expect(doTorneio(desfeito)).toHaveLength(0);

    const jogado = jogarRodada(comChave);
    expect(recusa(jogado, desfazerChaveDoTorneio, { id: novoTorneio(jogado).id })).toMatch(/Já há resultados/);
  });

  it("eliminatoria: o vencedor avanca sozinho, a correcao trava depois da seguinte e a final encerra", () => {
    let banco = criar("eliminatoria", 6);
    banco = gravar(banco, gerarChaveDoTorneio, { id: novoTorneio(banco).id });

    banco = jogarRodada(banco); // quartas
    const quartas = doTorneio(banco).find((p) => p.rodada === 1 && p.vencedor);
    const semi = doTorneio(banco).find((p) => p.id === quartas?.proximaPartidaId);
    const lado = quartas?.ladoNaProxima === "A" ? semi?.inscricaoAId : semi?.inscricaoBId;
    expect(lado).toBe(quartas?.inscricaoAId);

    // Corrigir a quartas antes da semifinal: o novo vencedor toma o lugar.
    banco = gravar(banco, corrigirResultadoDeTorneio, { partidaId: quartas?.id ?? "", placar: "4/6 4/6", vencedor: "B" });
    const semiDepois = doTorneio(banco).find((p) => p.id === semi?.id);
    expect(quartas?.ladoNaProxima === "A" ? semiDepois?.inscricaoAId : semiDepois?.inscricaoBId).toBe(
      quartas?.inscricaoBId,
    );

    banco = jogarRodada(banco); // semifinais
    expect(
      recusa(banco, corrigirResultadoDeTorneio, { partidaId: quartas?.id ?? "", placar: "6/4 6/4", vencedor: "A" }),
    ).toBe("A partida seguinte (Semifinal) já foi jogada: este resultado não pode mais ser mudado.");
    expect(recusa(banco, apagarResultadoDeTorneio, { partidaId: quartas?.id ?? "" })).toMatch(/já foi jogada/);

    expect(novoTorneio(banco).situacao).toBe("em_andamento");
    banco = jogarRodada(banco); // final
    expect(novoTorneio(banco).situacao).toBe("encerrado");
    const final = doTorneio(banco).find((p) => !p.proximaPartidaId);
    expect(
      campeaoDoTorneio(novoTorneio(banco), banco.torneioInscritos, banco.partidas, banco.configuracoes.criteriosDesempate),
    ).toBe(final?.inscricaoAId);

    // Apagar o resultado da final reabre o torneio.
    const reaberto = gravar(banco, apagarResultadoDeTorneio, { partidaId: final?.id ?? "" });
    expect(novoTorneio(reaberto).situacao).toBe("em_andamento");
  });

  it("W.O. no torneio: quem compareceu avanca", () => {
    let banco = criar("eliminatoria", 4);
    banco = gravar(banco, gerarChaveDoTorneio, { id: novoTorneio(banco).id });
    const estreia = doTorneio(banco).find((p) => p.rodada === 1);
    banco = gravar(banco, registrarResultadoDeTorneio, { partidaId: estreia?.id ?? "", vencedor: "B", wo: true });
    const final = doTorneio(banco).find((p) => p.id === estreia?.proximaPartidaId);
    expect(doTorneio(banco).find((p) => p.id === estreia?.id)).toMatchObject({ placar: "W.O.", wo: true });
    expect(estreia?.ladoNaProxima === "A" ? final?.inscricaoAId : final?.inscricaoBId).toBe(estreia?.inscricaoBId);
  });

  it("grupos + eliminatoria: a eliminatoria e montada sozinha quando os grupos terminam", () => {
    let banco = criar("grupos_eliminatoria", 8);
    banco = gravar(banco, gerarChaveDoTorneio, { id: novoTorneio(banco).id });
    expect(doTorneio(banco)).toHaveLength(12);
    expect(banco.torneioInscritos.filter((i) => i.torneioId === novoTorneio(banco).id && i.grupo)).toHaveLength(8);

    banco = jogarRodada(banco); // todos os jogos de grupo
    const eliminatoria = doTorneio(banco).filter((p) => !p.grupo);
    expect(eliminatoria).toHaveLength(3);
    expect(eliminatoria.filter((p) => p.fase === "Semifinal").every((p) => p.inscricaoAId && p.inscricaoBId)).toBe(true);

    // A tabela que a tela mostra e a eliminatoria montada concordam sobre quem
    // passou, mesmo quando o empate e decidido pela ordem de inscricao.
    const detalhe = detalheDoTorneio(banco, novoTorneio(banco).id);
    const naTabela = (detalhe?.grupos ?? [])
      .flatMap((g) => g.classificacao.filter((l) => l.classifica).map((l) => l.inscricaoId))
      .sort();
    const naChave = eliminatoria
      .filter((p) => p.fase === "Semifinal")
      .flatMap((p) => [p.inscricaoAId, p.inscricaoBId])
      .sort();
    expect(naChave).toEqual(naTabela);
    expect(
      detalhe?.grupos.some((g) => g.classificacao.some((l) => l.desempate === DESEMPATE_FINAL)),
    ).toBe(true);

    banco = jogarRodada(jogarRodada(banco)); // semifinais e final
    expect(novoTorneio(banco).situacao).toBe("encerrado");
  });

  it("torneio so conta para o ranking se a configuracao mandar", () => {
    let banco = criar("todos_contra_todos", 3);
    banco = gravar(banco, gerarChaveDoTorneio, { id: novoTorneio(banco).id });
    banco = jogarRodada(jogarRodada(jogarRodada(banco)));
    expect(novoTorneio(banco).situacao).toBe("encerrado");

    expect(banco.configuracoes.torneioContaParaRanking).toBe(false);
    expect(calcularRanking(banco)).toEqual(calcularRanking(inicial));

    // Ligada a configuracao, entram todas as partidas simples de torneio com
    // resultado (as deste teste e as do t-3 dos dados de exemplo).
    const contando = { ...banco, configuracoes: { ...banco.configuracoes, torneioContaParaRanking: true } };
    const deTorneio = banco.partidas.filter((p) => p.torneioId && p.vencedor && p.ladoA.length === 1);
    expect(deTorneio.length).toBeGreaterThanOrEqual(doTorneio(banco).length);
    const somaDePartidas = (b: Banco) => calcularRanking(b).reduce((s, l) => s + l.partidas, 0);
    expect(somaDePartidas(contando)).toBe(somaDePartidas(banco) + deTorneio.length * 2);
    expect(pontos(contando, "a01")?.pontos).not.toBe(pontos(banco, "a01")?.pontos);
  });
});
