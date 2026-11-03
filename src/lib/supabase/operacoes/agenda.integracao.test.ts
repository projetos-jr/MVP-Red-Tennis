import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOJE } from "@/lib/banco/constantes";
import {
  bloquearQuadra,
  cancelarOcupacao,
  cancelarPorChuva,
  criarHorarioAvulso,
  criarHorarioFixo,
  encerrarHorarioFixo,
  incluirAluno,
  liberarReserva,
  liberarReservasVencidas,
  marcarAulaDeReposicao,
  marcarPresenca,
  remarcarOcupacao,
  removerAluno,
  usarReposicao,
} from "@/lib/banco/operacoes/agenda";
import {
  MOTIVO_SEM_PAGAMENTO,
  conflitosNaQuadra,
  horizonteDaAgenda,
} from "@/lib/banco/regras/agenda";
import type { Banco, QuadraId } from "@/lib/banco/tipos";
import { previaDaRecorrencia, saldoDoAluno } from "@/lib/consultas/agenda";
import { agoraArena, diaDaSemana, somarDias } from "@/lib/date";
import {
  EXECUCAO,
  SEM_BANCO_DE_TESTE,
  dataDeTeste,
  entrar,
  executar,
  reler,
  type Sessao,
} from "../integracao/ambiente";

/**
 * Agenda e reposicao gravando no Supabase de teste. Cada teste usa as proprias
 * datas (`dataDeTeste(0..99)`; o teste do ranking usa 200+) e os proprios
 * alunos, e cancela no fim o que criou perto de hoje (cancelada nao ocupa a
 * quadra).
 */

const QUADRAS: QuadraId[] = ["paredao", "4", "3", "2", "1"];
const PROFESSOR = "prof-1";

const hora = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** A quadra esta livre nesse intervalo em todas as datas? */
function livre(banco: Banco, quadraId: QuadraId, datas: string[], inicio: string, fim: string) {
  return datas.every(
    (data) =>
      conflitosNaQuadra(banco.ocupacoes, { quadraId, data, horaInicio: inicio, horaFim: fim })
        .length === 0,
  );
}

/** Primeira quadra e hora cheia (1 hora) livres em todas as datas, entre `deHora` e `ateHora`. */
function horarioLivre(banco: Banco, datas: string[], deHora = 7, ateHora = 21) {
  for (const quadraId of QUADRAS) {
    for (let h = deHora; h <= ateHora; h++) {
      if (livre(banco, quadraId, datas, hora(h), hora(h + 1))) {
        return { quadraId, horaInicio: hora(h), horaFim: hora(h + 1) };
      }
    }
  }
  return undefined;
}

// Cada gravacao le de novo as tabelas que mudaram: os testes daqui fazem varias.
describe.skipIf(SEM_BANCO_DE_TESTE)("agenda e reposição no banco real", { timeout: 180_000 }, () => {
  let recepcao: Sessao;
  let professor: Sessao;
  let dono: Sessao;
  /** Alunos desta execucao: o saldo de reposicao deles so muda por estes testes. */
  let ana: string;
  let bruno: string;

  async function criarAluno(nome: string): Promise<string> {
    const { data, error } = await recepcao.cliente
      .from("alunos")
      .insert({ nome: `${nome} (teste agenda ${EXECUCAO})` })
      .select("id")
      .single();
    if (error) throw new Error(`Criar aluno de teste: ${error.message}`);
    return (data as { id: string }).id;
  }

  const ocupacao = (id: string | undefined) => recepcao.banco.ocupacoes.find((o) => o.id === id);
  const alunosDa = (id: string | undefined) =>
    recepcao.banco.ocupacaoAlunos.filter((p) => p.ocupacaoId === id).map((p) => p.alunoId);
  const saldo = (alunoId: string) => saldoDoAluno(recepcao.banco, alunoId, HOJE);

  beforeAll(async () => {
    recepcao = await entrar("recepcao");
    professor = await entrar("professor");
    dono = await entrar("dono");
    ana = await criarAluno("Ana");
    bruno = await criarAluno("Bruno");
    await reler(recepcao);
  }, 180_000);

  // Limpeza: cancela (motivo em texto, sem credito) o que ainda ocupa a quadra
  // com os alunos desta execucao, para as proximas execucoes acharem as datas livres.
  afterAll(async () => {
    if (!recepcao) return;
    const banco = await reler(recepcao);
    const nossas = new Set(
      banco.ocupacaoAlunos.filter((p) => p.alunoId === ana || p.alunoId === bruno).map((p) => p.ocupacaoId),
    );
    for (const o of banco.ocupacoes) {
      if (o.situacao !== "cancelada" && nossas.has(o.id)) {
        await recepcao.cliente.rpc("cancelar_ocupacao", { p_id: o.id, p_motivo: "Limpeza do teste" });
      }
    }
  }, 180_000);

  it("locação avulsa: cria com a cobrança, remarca (a cobrança acompanha) e cancela (a cobrança é anulada)", async () => {
    const data = dataDeTeste(1);
    const criado = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "2",
      data,
      horaInicio: "19:00",
      horaFim: "20:00",
      tipo: "Locação Avulsa",
      alunosIds: [ana, bruno],
      descricao: `Locação ${EXECUCAO}`,
    });
    expect(criado).toMatchObject({ ok: true });
    const id = criado.ok ? criado.id : undefined;
    expect(ocupacao(id)).toMatchObject({
      quadraId: "2",
      data,
      horaInicio: "19:00",
      horaFim: "20:00",
      situacao: "aguardando_pagamento",
      descricao: `Locação ${EXECUCAO}`,
    });
    expect(ocupacao(id)?.prazoPagamento).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(alunosDa(id).sort()).toEqual([ana, bruno].sort());
    const cobranca = () => recepcao.banco.lancamentos.find((l) => l.ocupacaoId === id);
    expect(cobranca()).toMatchObject({ tipo: "receber", categoria: "Locação", pessoaId: ana });
    const valorDeUmaHora = cobranca()!.valor;
    expect(valorDeUmaHora).toBeGreaterThan(0);
    // O historico (que so o dono le) guarda o nome da operacao.
    const historico = await dono.cliente
      .from("auditoria")
      .select("operacao")
      .eq("tabela", "ocupacoes")
      .eq("registro_id", id!);
    expect(historico.data).toContainEqual({ operacao: "Criar horário avulso" });

    const remarcado = await executar(recepcao, remarcarOcupacao, {
      id: id!,
      quadraId: "3",
      data: somarDias(data, 1),
      horaInicio: "18:00",
      horaFim: "20:00",
    });
    expect(remarcado.ok).toBe(true);
    expect(ocupacao(id)).toMatchObject({ quadraId: "3", data: somarDias(data, 1), horaInicio: "18:00" });
    expect(cobranca()?.item).toContain("Quadra 3");
    expect(cobranca()?.valor).toBeCloseTo(valorDeUmaHora * 2, 2);

    const cancelado = await executar(recepcao, cancelarOcupacao, { id: id!, motivo: "Desistiu da reserva" });
    expect(cancelado.ok).toBe(true);
    expect(ocupacao(id)).toMatchObject({ situacao: "cancelada", motivoCancelamento: "Desistiu da reserva" });
    expect(cobranca()?.canceladoEm).toBeDefined();
  });

  it("o banco recusa duas ocupações na mesma quadra e horário, e aceita a que começa quando a outra termina", async () => {
    const data = dataDeTeste(2);
    const primeira = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "3",
      data,
      horaInicio: "10:00",
      horaFim: "11:00",
      tipo: "Individual",
      professorId: PROFESSOR,
      alunosIds: [ana],
    });
    expect(primeira.ok).toBe(true);

    // Burlando a tela: chamando a funcao do banco direto.
    const { error } = await recepcao.cliente.rpc("criar_horario_avulso", {
      p_quadra_id: "3",
      p_data: data,
      p_hora_inicio: "10:30",
      p_hora_fim: "11:30",
      p_tipo: "Locação Avulsa",
      p_alunos_ids: [bruno],
    });
    expect(error?.message).toContain("Quadra 3 já está ocupada");

    const seguinte = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "3",
      data,
      horaInicio: "11:00",
      horaFim: "12:00",
      tipo: "Ranking",
      alunosIds: [bruno],
    });
    expect(seguinte.ok).toBe(true);
    expect(ocupacao(seguinte.ok ? seguinte.id : undefined)).toMatchObject({ tipo: "Ranking", situacao: "agendada" });
  });

  it("reposição: falta avisada gera crédito, aula de reposição usa, tirar da aula devolve, usar em aula existente e incluir aluno", async () => {
    // Aula individual da Ana; a falta avisada (24h) cancela a aula e da 60 min.
    const original = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "4",
      data: dataDeTeste(3),
      horaInicio: "08:00",
      horaFim: "09:00",
      tipo: "Individual",
      professorId: PROFESSOR,
      alunosIds: [ana],
    });
    const originalId = original.ok ? original.id : undefined;
    const falta = await executar(recepcao, marcarPresenca, {
      ocupacaoId: originalId!,
      alunoId: ana,
      presenca: "falta_avisada",
      sigla: "24h",
    });
    expect(falta.ok).toBe(true);
    expect(ocupacao(originalId)).toMatchObject({ situacao: "cancelada", motivoCancelamento: "24h" });
    expect(
      recepcao.banco.reposicoes.find((r) => r.ocupacaoOrigemId === originalId && r.alunoId === ana),
    ).toMatchObject({ minutos: 60, sigla: "24h" });
    expect(saldo(ana)).toBe(60);

    // Aula nova paga com os 60 minutos.
    const reposicao = await executar(recepcao, marcarAulaDeReposicao, {
      alunoId: ana,
      quadraId: "4",
      data: dataDeTeste(4),
      horaInicio: "08:00",
      horaFim: "09:00",
      tipo: "Individual",
      professorId: PROFESSOR,
    });
    expect(reposicao).toMatchObject({ ok: true });
    const reposicaoId = reposicao.ok ? reposicao.id : undefined;
    expect(ocupacao(reposicaoId)).toMatchObject({ descricao: "Reposição", situacao: "agendada" });
    expect(recepcao.banco.reposicoes.find((r) => r.ocupacaoUsoId === reposicaoId)).toMatchObject({
      alunoId: ana,
      minutos: -60,
    });
    expect(saldo(ana)).toBe(0);

    // Sem saldo, o banco recusa mesmo burlando a tela.
    const { error } = await recepcao.cliente.rpc("marcar_aula_de_reposicao", {
      p_aluno_id: ana,
      p_quadra_id: "4",
      p_data: dataDeTeste(4),
      p_hora_inicio: "10:00",
      p_hora_fim: "11:00",
      p_tipo: "Individual",
      p_professor_id: PROFESSOR,
    });
    expect(error?.message).toContain("Saldo de reposição insuficiente");

    // Tirar a Ana da aula de reposicao devolve os minutos.
    const removido = await executar(recepcao, removerAluno, { ocupacaoId: reposicaoId!, alunoId: ana });
    expect(removido.ok).toBe(true);
    expect(alunosDa(reposicaoId)).toEqual([]);
    expect(recepcao.banco.reposicoes.some((r) => r.ocupacaoUsoId === reposicaoId)).toBe(false);
    expect(saldo(ana)).toBe(60);

    // Dupla do Bruno: a Ana entra usando reposicao; um aluno da arena entra sem.
    const dupla = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "4",
      data: dataDeTeste(5),
      horaInicio: "08:00",
      horaFim: "09:00",
      tipo: "Dupla",
      professorId: PROFESSOR,
      alunosIds: [bruno],
    });
    const duplaId = dupla.ok ? dupla.id : undefined;
    const usou = await executar(recepcao, usarReposicao, { ocupacaoId: duplaId!, alunoId: ana });
    expect(usou.ok).toBe(true);
    expect(alunosDa(duplaId)).toContain(ana);
    expect(saldo(ana)).toBe(0);

    const outro = recepcao.banco.alunos.find((a) => a.ativo && a.id !== ana && a.id !== bruno)!;
    const incluido = await executar(recepcao, incluirAluno, { ocupacaoId: duplaId!, alunoId: outro.id });
    expect(incluido).toMatchObject({ ok: true });
    expect(alunosDa(duplaId).sort()).toEqual([ana, bruno, outro.id].sort());
    expect(
      recepcao.banco.ocupacaoAlunos.find((p) => p.id === (incluido.ok ? incluido.id : ""))?.alunoId,
    ).toBe(outro.id);

    // O banco recusa incluir de novo quem ja esta na aula.
    const repetido = await recepcao.cliente.rpc("incluir_aluno", {
      p_ocupacao_id: duplaId,
      p_aluno_id: outro.id,
    });
    expect(repetido.error?.message).toBe("Este aluno já está na aula.");
  });

  it("horário fixo: pula as datas em conflito escolhidas na tela e encerra tirando as aulas seguintes", async () => {
    await reler(recepcao);
    // Tres semanas perto do limite da agenda (H12): o horario fixo so cria aulas ate la.
    const ate = horizonteDaAgenda(recepcao.banco.configuracoes, HOJE);
    const datas = [somarDias(ate, -20), somarDias(ate, -13), somarDias(ate, -6)];
    const vaga = horarioLivre(recepcao.banco, datas);
    expect(vaga).toBeDefined();
    const { quadraId, horaInicio, horaFim } = vaga!;

    // Alguem ocupa a segunda data.
    const ocupante = await executar(recepcao, criarHorarioAvulso, {
      quadraId,
      data: datas[1],
      horaInicio,
      horaFim,
      tipo: "Locação Avulsa",
      alunosIds: [bruno],
    });
    expect(ocupante.ok).toBe(true);
    const ocupanteId = ocupante.ok ? ocupante.id : undefined;

    // A tela mostra as datas em conflito; a pessoa decide pular (como no ModalNovoHorario).
    const previa = previaDaRecorrencia(
      recepcao.banco,
      {
        quadraId,
        dataInicio: datas[0],
        fim: datas[2],
        horaInicio,
        horaFim,
        diaSemana: diaDaSemana(datas[0]),
      },
      HOJE,
    );
    const datasPuladas = previa.datas.filter((d) => d.conflito).map((d) => d.data);
    expect(datasPuladas).toEqual([datas[1]]);

    const dados = {
      quadraId,
      dataInicio: datas[0],
      fim: datas[2],
      horaInicio,
      horaFim,
      tipo: "Locação Mensal" as const,
      alunosIds: [ana, bruno],
    };

    // Sem pular, o banco recusa (burlando a tela).
    const { error } = await recepcao.cliente.rpc("criar_horario_fixo", {
      p_quadra_id: quadraId,
      p_data_inicio: datas[0],
      p_hora_inicio: horaInicio,
      p_hora_fim: horaFim,
      p_tipo: "Locação Mensal",
      p_alunos_ids: [ana],
      p_fim: datas[2],
    });
    expect(error?.message).toContain("já está ocupada");

    const criado = await executar(recepcao, criarHorarioFixo, { ...dados, datasPuladas });
    expect(criado).toMatchObject({ ok: true });
    const moldeId = criado.ok ? criado.id : undefined;
    const molde = recepcao.banco.horariosFixos.find((h) => h.id === moldeId);
    expect(molde).toMatchObject({ quadraId, horaInicio, horaFim, inicio: datas[0], fim: datas[2] });
    expect(
      recepcao.banco.horarioAlunos.filter((h) => h.horarioFixoId === moldeId).map((h) => h.alunoId).sort(),
    ).toEqual([ana, bruno].sort());
    const aulas = () => recepcao.banco.ocupacoes.filter((o) => o.horarioFixoId === moldeId);
    expect(aulas().map((o) => o.data).sort()).toEqual([datas[0], datas[2]]);
    aulas().forEach((o) => expect(alunosDa(o.id).sort()).toEqual([ana, bruno].sort()));

    // Encerrar na primeira data tira a ultima aula da agenda.
    const encerrado = await executar(recepcao, encerrarHorarioFixo, { horarioFixoId: moldeId!, fim: datas[0] });
    expect(encerrado.ok).toBe(true);
    expect(recepcao.banco.horariosFixos.find((h) => h.id === moldeId)?.fim).toBe(datas[0]);
    expect(aulas().map((o) => o.data)).toEqual([datas[0]]);

    // Limpeza: cancela o que ficou (perto de hoje, as datas se repetem entre execucoes).
    for (const id of [aulas()[0].id, ocupanteId!]) {
      expect((await executar(recepcao, cancelarOcupacao, { id, motivo: "Limpeza do teste" })).ok).toBe(true);
    }
  });

  it("bloqueio de quadra cancela as aulas do período com IAC e não aceita outro bloqueio por cima", async () => {
    const data = dataDeTeste(6);
    const aula = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "1",
      data,
      horaInicio: "08:00",
      horaFim: "09:30",
      tipo: "Individual",
      professorId: PROFESSOR,
      alunosIds: [bruno],
    });
    const aulaId = aula.ok ? aula.id : undefined;

    const bloqueio = await executar(recepcao, bloquearQuadra, {
      quadrasIds: ["1"],
      data,
      horaInicio: "07:00",
      horaFim: "10:00",
      descricao: `Manutenção ${EXECUCAO}`,
    });
    expect(bloqueio).toMatchObject({ ok: true });
    const bloqueioId = bloqueio.ok ? bloqueio.id : undefined;
    expect(ocupacao(bloqueioId)).toMatchObject({ tipo: "Bloqueio", quadraId: "1", descricao: `Manutenção ${EXECUCAO}` });
    expect(ocupacao(aulaId)).toMatchObject({ situacao: "cancelada", motivoCancelamento: "IAC" });
    expect(
      recepcao.banco.reposicoes.find((r) => r.ocupacaoOrigemId === aulaId && r.alunoId === bruno)?.minutos,
    ).toBe(90);

    const { error } = await recepcao.cliente.rpc("bloquear_quadra", {
      p_quadras_ids: ["1"],
      p_data: data,
      p_hora_inicio: "09:00",
      p_hora_fim: "11:00",
      p_descricao: "Outro bloqueio",
    });
    expect(error?.message).toContain("Quadra 1 já está bloqueada");

    // Cancelar o bloqueio libera a quadra.
    expect((await executar(recepcao, cancelarOcupacao, { id: bloqueioId!, motivo: "Manutenção adiada" })).ok).toBe(true);
    expect(ocupacao(bloqueioId)?.situacao).toBe("cancelada");
  });

  it("chuva cancela com CH só as aulas da faixa escolhida e gera os créditos", async () => {
    const data = dataDeTeste(7);
    const dentro = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "paredao",
      data,
      horaInicio: "15:00",
      horaFim: "16:00",
      tipo: "LAP",
      professorId: PROFESSOR,
      alunosIds: [ana, bruno],
    });
    const fora = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "paredao",
      data,
      horaInicio: "18:00",
      horaFim: "19:00",
      tipo: "Ranking",
      alunosIds: [ana],
    });
    const dentroId = dentro.ok ? dentro.id : undefined;
    const foraId = fora.ok ? fora.id : undefined;

    const chuva = await executar(recepcao, cancelarPorChuva, {
      data,
      quadrasIds: ["paredao"],
      horaInicio: "14:00",
      horaFim: "17:00",
    });
    expect(chuva.ok).toBe(true);
    expect(ocupacao(dentroId)).toMatchObject({ situacao: "cancelada", motivoCancelamento: "CH" });
    expect(ocupacao(foraId)?.situacao).toBe("agendada");
    expect(
      recepcao.banco.reposicoes.filter((r) => r.ocupacaoOrigemId === dentroId).map((r) => r.alunoId).sort(),
    ).toEqual([ana, bruno].sort());

    // Sem nada ativo na faixa, o banco recusa.
    const { error } = await recepcao.cliente.rpc("cancelar_por_chuva", {
      p_data: data,
      p_quadras_ids: ["paredao"],
      p_hora_inicio: "14:00",
      p_hora_fim: "17:00",
    });
    expect(error?.message).toBe("Não há aulas ativas nessas quadras nesse período.");
  });

  it("presença só no dia da aula ou depois: marca hoje e o banco recusa uma aula futura", async () => {
    await reler(recepcao);
    const vaga = horarioLivre(recepcao.banco, [HOJE]);
    expect(vaga).toBeDefined();
    const hoje = await executar(recepcao, criarHorarioAvulso, {
      ...vaga!,
      data: HOJE,
      tipo: "Ranking",
      alunosIds: [bruno],
    });
    expect(hoje.ok).toBe(true);
    const hojeId = hoje.ok ? hoje.id : undefined;

    const presente = await executar(recepcao, marcarPresenca, {
      ocupacaoId: hojeId!,
      alunoId: bruno,
      presenca: "presente",
    });
    expect(presente.ok).toBe(true);
    expect(ocupacao(hojeId)?.situacao).toBe("realizada");
    expect(recepcao.banco.ocupacaoAlunos.find((p) => p.ocupacaoId === hojeId)?.presenca).toBe("presente");

    const futura = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "2",
      data: dataDeTeste(8),
      horaInicio: "09:00",
      horaFim: "10:00",
      tipo: "Ranking",
      alunosIds: [bruno],
    });
    const { error } = await recepcao.cliente.rpc("marcar_presenca", {
      p_ocupacao_id: futura.ok ? futura.id : "",
      p_aluno_id: bruno,
      p_presenca: "presente",
    });
    expect(error?.message).toBe("Presença e falta só podem ser marcadas no dia da aula ou depois.");

    // Limpeza: a aula de hoje sai da grade (cancelar continua possivel depois de realizada).
    expect((await executar(recepcao, cancelarOcupacao, { id: hojeId!, motivo: "Limpeza do teste" })).ok).toBe(true);
  });

  // Uma reserva de hoje que ja comecou nasce vencida: o prazo nunca passa do inicio (H5).
  const horaAgora = Number(agoraArena().slice(11, 13));

  it.skipIf(horaAgora < 9)("liberar reserva vencida: cancela sem crédito e anula a cobrança; o banco recusa a que não venceu", async () => {
    await reler(recepcao);
    const vaga = horarioLivre(recepcao.banco, [HOJE], 7, horaAgora - 2);
    expect(vaga).toBeDefined();
    const reserva = await executar(recepcao, criarHorarioAvulso, {
      ...vaga!,
      data: HOJE,
      tipo: "Locação Avulsa",
      alunosIds: [ana],
    });
    expect(reserva.ok).toBe(true);
    const id = reserva.ok ? reserva.id : undefined;
    expect(ocupacao(id)?.situacao).toBe("aguardando_pagamento");

    const liberada = await executar(recepcao, liberarReserva, { id: id! });
    expect(liberada.ok).toBe(true);
    expect(ocupacao(id)).toMatchObject({ situacao: "cancelada", motivoCancelamento: MOTIVO_SEM_PAGAMENTO });
    expect(recepcao.banco.lancamentos.find((l) => l.ocupacaoId === id)?.canceladoEm).toBeDefined();
    expect(recepcao.banco.reposicoes.some((r) => r.ocupacaoOrigemId === id)).toBe(false);

    // Reserva com prazo ainda valendo: o banco recusa (burlando a tela).
    const futura = await executar(recepcao, criarHorarioAvulso, {
      quadraId: "1",
      data: dataDeTeste(9),
      horaInicio: "20:00",
      horaFim: "21:00",
      tipo: "Locação Avulsa",
      alunosIds: [ana],
    });
    const { error } = await recepcao.cliente.rpc("liberar_reserva", { p_id: futura.ok ? futura.id : "" });
    expect(error?.message).toContain("O prazo desta reserva só vence em");
  });

  // Atencao: libera TODAS as reservas vencidas do banco de teste (inclusive as
  // dos dados de exemplo), como a agenda faz ao abrir com a opcao ligada.
  it.skipIf(horaAgora < 9)("liberar todas as reservas vencidas de uma vez", async () => {
    await reler(recepcao);
    const vaga = horarioLivre(recepcao.banco, [HOJE], 7, horaAgora - 2);
    expect(vaga).toBeDefined();
    const reserva = await executar(recepcao, criarHorarioAvulso, {
      ...vaga!,
      data: HOJE,
      tipo: "Locação Avulsa",
      alunosIds: [bruno],
    });
    const id = reserva.ok ? reserva.id : undefined;

    const resultado = await executar(recepcao, liberarReservasVencidas, {});
    expect(resultado.ok).toBe(true);
    expect(ocupacao(id)).toMatchObject({ situacao: "cancelada", motivoCancelamento: MOTIVO_SEM_PAGAMENTO });
    expect(
      recepcao.banco.ocupacoes.some(
        (o) => o.situacao === "aguardando_pagamento" && o.prazoPagamento && o.prazoPagamento < agoraArena(),
      ),
    ).toBe(false);
  });

  it("professor só consulta: a tela recusa e o banco também", async () => {
    const pelaTela = await executar(professor, criarHorarioAvulso, {
      quadraId: "1",
      data: dataDeTeste(10),
      horaInicio: "07:00",
      horaFim: "08:00",
      tipo: "Individual",
      professorId: PROFESSOR,
      alunosIds: [professor.banco.alunos[0]?.id ?? ana],
    });
    expect(pelaTela).toMatchObject({
      ok: false,
      erro: "O seu perfil só pode consultar a agenda. Peça à recepção para fazer a alteração.",
    });

    const { error } = await professor.cliente.rpc("criar_horario_avulso", {
      p_quadra_id: "1",
      p_data: dataDeTeste(10),
      p_hora_inicio: "07:00",
      p_hora_fim: "08:00",
      p_tipo: "Ranking",
      p_alunos_ids: [ana],
    });
    expect(error).not.toBeNull();

    // Nem cancelar uma aula dele mesmo.
    const daAgenda = professor.banco.ocupacoes.find((o) => o.situacao === "agendada" && o.data >= HOJE);
    if (daAgenda) {
      const cancelar = await professor.cliente.rpc("cancelar_ocupacao", { p_id: daAgenda.id, p_motivo: "CH" });
      expect(cancelar.error).not.toBeNull();
    }
  });
});
