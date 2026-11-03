import { beforeAll, describe, expect, it } from "vitest";
import { HOJE } from "@/lib/banco/constantes";
import { executarOperacao, type Operacao } from "@/lib/banco/executar";
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
  type DadosTorneio,
} from "@/lib/banco/operacoes/ranking";
import type { Banco, FormatoTorneio, Partida, TabelaDoBanco } from "@/lib/banco/tipos";
import { agoraArena } from "@/lib/date";
import { carregarTabelas } from "../carregar";
import { gravacaoDe } from "../gravar";
import {
  EXECUCAO,
  SEM_BANCO_DE_TESTE,
  dataDeTeste,
  entrar,
  executar,
  type Sessao,
} from "../integracao/ambiente";

// Datas deste arquivo: dataDeTeste(200) a dataDeTeste(299).

const TABELAS_DO_TORNEIO: TabelaDoBanco[] = ["torneios", "torneioInscritos", "partidas"];
/** Torneios lancam dezenas de resultados, cada um conferido no banco. */
const DEMORADO = 180_000;

/**
 * A chave de um torneio como a tela a desenha, sem os ids das partidas (que
 * o banco cria com outro comeco): cada partida pela posicao (grupo, rodada,
 * ordem), com quem joga de cada lado e para onde vai o vencedor.
 */
function chave(banco: Banco, torneioId: string) {
  const partidas = banco.partidas.filter((p) => p.torneioId === torneioId);
  const lugar = (p?: Partida) => (p ? `${p.grupo ?? "-"}|${p.rodada}|${p.ordem}` : undefined);
  const porId = new Map(partidas.map((p) => [p.id, p]));
  return {
    situacao: banco.torneios.find((t) => t.id === torneioId)?.situacao,
    grupos: banco.torneioInscritos
      .filter((i) => i.torneioId === torneioId)
      .map((i) => `${i.id}:${i.grupo ?? "-"}`)
      .sort(),
    partidas: partidas
      .map((p) => ({
        lugar: lugar(p),
        fase: p.fase,
        inscricaoA: p.inscricaoAId,
        inscricaoB: p.inscricaoBId,
        ladoA: p.ladoA,
        ladoB: p.ladoB,
        proxima: p.proximaPartidaId ? lugar(porId.get(p.proximaPartidaId)) ?? "?" : undefined,
        ladoNaProxima: p.ladoNaProxima,
        data: p.data,
        placar: p.placar,
        vencedor: p.vencedor,
        wo: Boolean(p.wo),
      }))
      .sort((a, b) => String(a.lugar).localeCompare(String(b.lugar))),
  };
}

/**
 * Faz o que `executarNoSupabase` faz, guardando o banco da tela calculado
 * (`ctx.depois`), e confere que a chave relida do banco e IGUAL a que a tela
 * calculou. Devolve o id retornado pela gravacao.
 */
async function executarConferindo<Dados>(
  sessao: Sessao,
  operacao: Operacao<Dados>,
  dados: Dados,
  torneioId: string,
): Promise<string | undefined> {
  const local = executarOperacao(sessao.banco, operacao, dados, {
    usuario: sessao.colaborador,
    agora: agoraArena(),
    hoje: HOJE,
  });
  if (!local.ok) throw new Error(local.erro);
  const retorno = await gravacaoDe(operacao)!.gravar(dados, {
    cliente: sessao.cliente,
    antes: sessao.banco,
    depois: local.banco,
    operacao: operacao.nome,
  });
  // So as tabelas do torneio (reler tudo a cada jogo deixa o teste lento).
  sessao.banco = { ...sessao.banco, ...(await carregarTabelas(sessao.cliente, TABELAS_DO_TORNEIO)) };
  expect(chave(sessao.banco, torneioId)).toEqual(chave(local.banco, torneioId));
  return retorno?.id ?? undefined;
}

/** Placar coerente com o vencedor, variando para os desempates terem o que usar. */
function resultadoDoJogo(n: number) {
  const opcoes = [
    { vencedor: "A" as const, placar: "6/4 6/3" },
    { vencedor: "B" as const, placar: "6/4 3/6 8/10" },
    { vencedor: "A" as const, placar: "7/6(5) 6/2" },
    { vencedor: "B" as const, placar: "2/6 1/6" },
    { vencedor: "A" as const, placar: "", wo: true },
  ];
  return opcoes[n % opcoes.length];
}

/** Lanca, em ordem, o resultado de todas as partidas prontas do torneio, conferindo cada uma. */
async function jogarTudo(sessao: Sessao, torneioId: string, ate?: (p: Partida) => boolean) {
  for (let n = 0; n < 200; n += 1) {
    const pronta = sessao.banco.partidas
      .filter((p) => p.torneioId === torneioId && !p.vencedor && p.inscricaoAId && p.inscricaoBId)
      .filter((p) => !ate || ate(p))
      .sort((a, b) => `${a.grupo ?? "~"}|${a.rodada}|${a.ordem}`.localeCompare(`${b.grupo ?? "~"}|${b.rodada}|${b.ordem}`))[0];
    if (!pronta) return;
    await executarConferindo(
      sessao,
      registrarResultadoDeTorneio,
      { partidaId: pronta.id, data: HOJE, ...resultadoDoJogo(n) },
      torneioId,
    );
  }
}

describe.skipIf(SEM_BANCO_DE_TESTE)("ranking e torneios no banco real", () => {
  let recepcao: Sessao;
  let professor: Sessao;
  /** Alunos ativos e inscritos no ranking (dados de exemplo). */
  let jogadores: string[];

  beforeAll(async () => {
    recepcao = await entrar("recepcao");
    professor = await entrar("professor");
    jogadores = recepcao.banco.alunos.filter((a) => a.ativo && a.inscritoRanking).map((a) => a.id);
    expect(jogadores.length).toBeGreaterThanOrEqual(10);
  });

  async function novoTorneio(formato: FormatoTorneio, quantos: number, cabecas: number, extra = "") {
    const dados: DadosTorneio = {
      nome: `Torneio ${formato} ${EXECUCAO}${extra}`,
      data: dataDeTeste(250),
      formato,
      duplas: false,
      inscricoes: jogadores.slice(0, quantos).map((id, n) => ({
        alunosIds: [id],
        cabecaDeChave: n < cabecas ? cabecas - n : undefined,
      })),
    };
    const criado = await executar(recepcao, criarTorneio, dados);
    expect(criado).toMatchObject({ ok: true });
    const torneio = recepcao.banco.torneios.find((t) => t.nome === dados.nome)!;
    // A tela abre o torneio pelo id que o banco devolveu.
    expect(criado.ok && criado.id).toBe(torneio.id);
    return torneio.id;
  }

  // -------------------------------------------------------------------------
  // Partidas de ranking
  // -------------------------------------------------------------------------

  it("registra, corrige e exclui uma partida jogada", async () => {
    const [a, b] = jogadores;
    const criada = await executar(recepcao, registrarPartida, {
      jogadorA: a,
      jogadorB: b,
      data: HOJE,
      vencedor: "B",
      placar: "6x4  3-6 8/10",
    });
    expect(criada).toMatchObject({ ok: true });
    const id = criada.ok ? criada.id! : "";
    expect(recepcao.banco.partidas.find((p) => p.id === id)).toMatchObject({
      ladoA: [a],
      ladoB: [b],
      data: HOJE,
      placar: "6/4 3/6 8/10",
      vencedor: "B",
    });

    expect((await executar(recepcao, corrigirResultadoDePartida, { id, vencedor: "A", wo: true })).ok).toBe(true);
    expect(recepcao.banco.partidas.find((p) => p.id === id)).toMatchObject({ placar: "W.O.", vencedor: "A", wo: true });

    expect((await executar(recepcao, excluirPartida, { id })).ok).toBe(true);
    expect(recepcao.banco.partidas.some((p) => p.id === id)).toBe(false);
  });

  it("marca partida para hoje sem reserva e registra o resultado depois", async () => {
    const [, , a, b] = jogadores;
    const marcada = await executar(recepcao, marcarPartida, { jogadorA: a, jogadorB: b, data: HOJE });
    expect(marcada).toMatchObject({ ok: true });
    const id = marcada.ok ? marcada.id! : "";
    expect(recepcao.banco.partidas.find((p) => p.id === id)).toMatchObject({ data: HOJE, ladoA: [a], ladoB: [b] });
    expect(recepcao.banco.partidas.find((p) => p.id === id)?.vencedor).toBeUndefined();

    expect(
      (await executar(recepcao, registrarResultadoDePartida, { id, vencedor: "A", placar: "6/1 6/1", data: HOJE })).ok,
    ).toBe(true);
    expect(recepcao.banco.partidas.find((p) => p.id === id)).toMatchObject({ placar: "6/1 6/1", vencedor: "A" });
    // O banco recusa "registrar" de novo uma partida que ja tem resultado.
    const { error } = await recepcao.cliente.rpc("registrar_resultado_de_partida", {
      p_id: id,
      p_vencedor: "B",
      p_placar: "1/6 1/6",
    });
    expect(error?.message).toBe("Esta partida já tem resultado: use a correção.");

    expect((await executar(recepcao, excluirPartida, { id })).ok).toBe(true);
  });

  it("marca partida com reserva de quadra: cria a ocupação Ranking e o banco recusa conflito", async () => {
    const [, , , , a, b, c, d] = jogadores;
    const data = dataDeTeste(200);
    const reserva = { quadraId: "2" as const, horaInicio: "10:00", horaFim: "11:00" };
    const marcada = await executar(recepcao, marcarPartida, { jogadorA: a, jogadorB: b, data, reserva });
    expect(marcada).toMatchObject({ ok: true });
    const partida = recepcao.banco.partidas.find((p) => p.id === (marcada.ok && marcada.id))!;
    const ocupacao = recepcao.banco.ocupacoes.find((o) => o.id === partida.ocupacaoId)!;
    expect(ocupacao).toMatchObject({ ...reserva, data, tipo: "Ranking", situacao: "agendada" });
    expect(
      recepcao.banco.ocupacaoAlunos
        .filter((oa) => oa.ocupacaoId === ocupacao.id)
        .map((oa) => oa.alunoId)
        .sort(),
    ).toEqual([a, b].sort());

    // Mesmo horario na mesma quadra: a tela recusa e o banco tambem.
    const pelaTela = await executar(recepcao, marcarPartida, {
      jogadorA: c,
      jogadorB: d,
      data,
      reserva: { quadraId: "2", horaInicio: "10:30", horaFim: "11:30" },
    });
    expect(pelaTela.ok).toBe(false);
    const { error } = await recepcao.cliente.rpc("marcar_partida", {
      p_jogador_a: c,
      p_jogador_b: d,
      p_data: data,
      p_reserva: { quadraId: "2", horaInicio: "10:30", horaFim: "11:30" },
    });
    expect(error?.message).toMatch(/^Quadra 2 já está ocupada em .* das 10:00 às 11:00 \(Ranking/);

    // Partida futura com reserva: resultado so a partir do dia.
    const { error: cedo } = await recepcao.cliente.rpc("registrar_resultado_de_partida", {
      p_id: partida.id,
      p_vencedor: "A",
      p_placar: "6/1 6/1",
    });
    expect(cedo?.message).toMatch(/^A partida está marcada para .*: o resultado entra a partir desse dia\.$/);

    // Excluir a partida cancela a reserva futura.
    expect((await executar(recepcao, excluirPartida, { id: partida.id })).ok).toBe(true);
    expect(recepcao.banco.partidas.some((p) => p.id === partida.id)).toBe(false);
    expect(recepcao.banco.ocupacoes.find((o) => o.id === ocupacao.id)).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: "Partida de ranking excluída",
    });
  });

  it("o banco recusa placar que não bate com o vencedor e jogador fora do ranking", async () => {
    const [a, b] = jogadores;
    const { error } = await recepcao.cliente.rpc("registrar_partida", {
      p_jogador_a: a,
      p_jogador_b: b,
      p_data: HOJE,
      p_vencedor: "A",
      p_placar: "4/6 3/6",
    });
    expect(error?.message).toMatch(/^O placar não bate com o vencedor/);

    const fora = recepcao.banco.alunos.find((x) => x.ativo && !x.inscritoRanking);
    if (fora) {
      const { error: foraDoRanking } = await recepcao.cliente.rpc("registrar_partida", {
        p_jogador_a: fora.id,
        p_jogador_b: b,
        p_data: HOJE,
        p_vencedor: "A",
        p_placar: "6/4 6/3",
      });
      expect(foraDoRanking?.message).toBe(`${fora.nome} não está inscrito no ranking.`);
    }
  });

  it("professor não grava no ranking, nem pela tela nem direto no banco", async () => {
    const [a, b] = jogadores;
    const dados = { jogadorA: a, jogadorB: b, data: HOJE, vencedor: "A" as const, placar: "6/4 6/3" };
    expect(await executar(professor, registrarPartida, dados)).toMatchObject({
      ok: false,
      erro: "Seu perfil não tem acesso ao ranking e aos torneios.",
    });
    const { error } = await professor.cliente.rpc("registrar_partida", {
      p_jogador_a: a,
      p_jogador_b: b,
      p_data: HOJE,
      p_vencedor: "A",
      p_placar: "6/4 6/3",
    });
    expect(error?.message).toBe("Seu perfil não tem permissão para esta operação.");

    const { error: torneio } = await professor.cliente.rpc("criar_torneio", {
      p_nome: `Invasão ${EXECUCAO}`,
      p_data: HOJE,
      p_formato: "eliminatoria",
      p_duplas: false,
    });
    expect(torneio?.message).toBe("Seu perfil não tem permissão para esta operação.");
  });

  // -------------------------------------------------------------------------
  // Torneios
  // -------------------------------------------------------------------------

  it("cria e edita o torneio: o banco guarda as mesmas inscrições, na mesma ordem", async () => {
    const id = await novoTorneio("eliminatoria", 4, 1, " (edição)");
    const inscritas = recepcao.banco.torneioInscritos.filter((i) => i.torneioId === id);
    expect(inscritas.map((i) => i.alunosIds)).toEqual(jogadores.slice(0, 4).map((x) => [x]));
    expect(inscritas.map((i) => i.cabecaDeChave)).toEqual([1, undefined, undefined, undefined]);

    // Tira a 2a inscricao, poe o 5o jogador como cabeca 2 e muda o nome.
    const torneio = recepcao.banco.torneios.find((t) => t.id === id)!;
    const editado = await executar(recepcao, editarTorneio, {
      id,
      nome: `${torneio.nome} editado`,
      data: torneio.data,
      formato: torneio.formato,
      duplas: false,
      categoria: "B",
      inscricoes: [
        ...inscritas.filter((_, n) => n !== 1).map((i) => ({ id: i.id, alunosIds: i.alunosIds, cabecaDeChave: i.cabecaDeChave })),
        { alunosIds: [jogadores[4]], cabecaDeChave: 2 },
      ],
    });
    expect(editado).toMatchObject({ ok: true });
    expect(recepcao.banco.torneios.find((t) => t.id === id)).toMatchObject({
      nome: `${torneio.nome} editado`,
      categoria: "B",
    });
    const depois = recepcao.banco.torneioInscritos.filter((i) => i.torneioId === id);
    // As mantidas continuam com o mesmo id e na mesma posicao; a nova vai para o fim.
    expect(depois.map((i) => i.id).slice(0, 3)).toEqual([inscritas[0].id, inscritas[2].id, inscritas[3].id]);
    expect(depois.map((i) => [i.alunosIds[0], i.cabecaDeChave])).toEqual([
      [jogadores[0], 1],
      [jogadores[2], undefined],
      [jogadores[3], undefined],
      [jogadores[4], 2],
    ]);

    // O banco recusa cabecas fora de sequencia (burlando a tela).
    const { error } = await recepcao.cliente.rpc("editar_torneio", {
      p_id: id,
      p_nome: "x",
      p_data: torneio.data,
      p_formato: "eliminatoria",
      p_duplas: false,
      p_inscricoes: [{ alunosIds: [jogadores[0]], cabecaDeChave: 2 }],
    });
    expect(error?.message).toBe("Numere os cabeças de chave em sequência (1, 2, 3…), sem repetir nem pular.");
  });

  it("eliminatória com folgas: a chave gravada é a sorteada na tela; avanço, correção e apagar", async () => {
    const id = await novoTorneio("eliminatoria", 6, 2);
    await executarConferindo(recepcao, gerarChaveDoTorneio, { id }, id);
    const partidas = () => recepcao.banco.partidas.filter((p) => p.torneioId === id);
    // 6 inscritos: chave de 8, 2 folgas para os cabecas, 5 partidas.
    expect(partidas()).toHaveLength(5);
    expect(recepcao.banco.torneios.find((t) => t.id === id)?.situacao).toBe("em_andamento");

    // O banco recusa gerar de novo.
    const { error: deNovo } = await recepcao.cliente.rpc("gerar_chave_do_torneio", { p_id: id });
    expect(deNovo?.message).toBe("A chave deste torneio já foi gerada.");

    // 1a rodada: os dois jogos.
    const estreias = partidas().filter((p) => p.rodada === 1);
    for (const [n, p] of estreias.entries()) {
      await executarConferindo(
        recepcao,
        registrarResultadoDeTorneio,
        { partidaId: p.id, data: HOJE, ...resultadoDoJogo(n) },
        id,
      );
    }
    // Corrigir troca o vencedor na semifinal; apagar tira.
    const primeira = estreias[0];
    await executarConferindo(
      recepcao,
      corrigirResultadoDeTorneio,
      { partidaId: primeira.id, data: HOJE, vencedor: "B", placar: "0/6 0/6" },
      id,
    );
    await executarConferindo(recepcao, apagarResultadoDeTorneio, { partidaId: primeira.id }, id);
    await executarConferindo(
      recepcao,
      registrarResultadoDeTorneio,
      { partidaId: primeira.id, data: HOJE, vencedor: "A", placar: "6/0 6/0" },
      id,
    );

    // Semifinal jogada: a estreia nao pode mais ser corrigida (tela e banco).
    const semi = partidas().find((p) => p.id === recepcao.banco.partidas.find((x) => x.id === primeira.id)!.proximaPartidaId)!;
    await executarConferindo(
      recepcao,
      registrarResultadoDeTorneio,
      { partidaId: semi.id, data: HOJE, vencedor: "A", placar: "6/2 6/2" },
      id,
    );
    expect(
      (await executar(recepcao, corrigirResultadoDeTorneio, { partidaId: primeira.id, data: HOJE, vencedor: "B", placar: "0/6 0/6" })).ok,
    ).toBe(false);
    const { error: bloqueada } = await recepcao.cliente.rpc("corrigir_resultado_de_torneio", {
      p_partida_id: primeira.id,
      p_vencedor: "B",
      p_placar: "0/6 0/6",
    });
    expect(bloqueada?.message).toBe(
      "A partida seguinte (Semifinal) já foi jogada: este resultado não pode mais ser mudado.",
    );
    const { error: desfazer } = await recepcao.cliente.rpc("desfazer_chave_do_torneio", { p_id: id });
    expect(desfazer?.message).toBe("Já há resultados registrados: a chave não pode mais ser desfeita.");

    // Ate a final: o torneio encerra.
    await jogarTudo(recepcao, id);
    expect(recepcao.banco.torneios.find((t) => t.id === id)?.situacao).toBe("encerrado");
  }, DEMORADO);

  it("todos contra todos: gera, desfaz, gera de novo e joga tudo", async () => {
    const id = await novoTorneio("todos_contra_todos", 5, 1);
    await executarConferindo(recepcao, gerarChaveDoTorneio, { id }, id);
    expect(recepcao.banco.partidas.filter((p) => p.torneioId === id)).toHaveLength(10);

    await executarConferindo(recepcao, desfazerChaveDoTorneio, { id }, id);
    expect(recepcao.banco.partidas.some((p) => p.torneioId === id)).toBe(false);
    expect(recepcao.banco.torneios.find((t) => t.id === id)?.situacao).toBe("inscricoes");

    await executarConferindo(recepcao, gerarChaveDoTorneio, { id }, id);
    await jogarTudo(recepcao, id);
    expect(recepcao.banco.torneios.find((t) => t.id === id)?.situacao).toBe("encerrado");
  }, DEMORADO);

  it("grupos + eliminatória: o banco monta a mesma fase eliminatória que a tela", async () => {
    // 10 inscritos: grupos de 4, 3 e 3; passam 2 de cada (6 na eliminatoria, 2 folgas).
    const id = await novoTorneio("grupos_eliminatoria", 10, 3);
    await executarConferindo(recepcao, gerarChaveDoTorneio, { id }, id);
    expect(new Set(recepcao.banco.torneioInscritos.filter((i) => i.torneioId === id).map((i) => i.grupo))).toEqual(
      new Set(["A", "B", "C"]),
    );

    await jogarTudo(recepcao, id, (p) => Boolean(p.grupo));
    const eliminatoria = recepcao.banco.partidas.filter((p) => p.torneioId === id && !p.grupo);
    expect(eliminatoria).toHaveLength(5);

    // Corrigir um jogo de grupo antes da eliminatoria comecar remonta (ou mantem) a eliminatoria.
    const jogoDeGrupo = recepcao.banco.partidas.find((p) => p.torneioId === id && p.grupo === "A")!;
    await executarConferindo(
      recepcao,
      corrigirResultadoDeTorneio,
      {
        partidaId: jogoDeGrupo.id,
        data: HOJE,
        vencedor: jogoDeGrupo.vencedor === "A" ? "B" : "A",
        placar: jogoDeGrupo.vencedor === "A" ? "0/6 0/6" : "6/0 6/0",
      },
      id,
    );

    await jogarTudo(recepcao, id);
    expect(recepcao.banco.torneios.find((t) => t.id === id)?.situacao).toBe("encerrado");

    // Eliminatoria comecou: o banco recusa mudar resultado de grupo.
    const { error } = await recepcao.cliente.rpc("apagar_resultado_de_torneio", { p_partida_id: jogoDeGrupo.id });
    expect(error?.message).toBe(
      "A fase eliminatória já começou: os resultados dos grupos não podem mais ser mudados.",
    );
  }, DEMORADO);
});
