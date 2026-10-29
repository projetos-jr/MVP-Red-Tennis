/**
 * Testes das operacoes e regras da agenda.
 *
 * Cada teste parte dos cadastros de exemplo com a agenda vazia e monta so o
 * que precisa, com datas fixas (o "hoje" dos testes e 10/11/2026, uma
 * terca-feira). O banco e congelado: se uma operacao alterar um objeto no
 * lugar (em vez de copiar), o teste quebra — a auditoria depende disso.
 */

import { describe, expect, it } from "vitest";
import {
  FILTRO_INICIAL,
  checarHorario,
  montarAgenda,
  previaDaChuva,
  previaDoBloqueio,
  professorPelaUrl,
  reservasAguardandoPagamento,
  resumirAgenda,
} from "../../consultas/agenda";
import { HOJE } from "../constantes";
import { executarOperacao, type ContextoOperacao, type Operacao } from "../executar";
import {
  conflitosNaQuadra,
  datasDaRecorrencia,
  horizonteDaAgenda,
  ocupacaoAtiva,
} from "../regras/agenda";
import { situacaoLancamento } from "../regras/financeiro";
import { efeitoDoCancelamento, saldoDeReposicao } from "../regras/reposicao";
import { gerarBancoInicial } from "../semente";
import type { Banco, Ocupacao } from "../tipos";
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
  type DadosHorarioAvulso,
  type DadosHorarioFixo,
} from "./agenda";

/** Congela o objeto inteiro: alterar algo no lugar passa a lancar erro. */
function congelar<T>(valor: T): T {
  if (valor && typeof valor === "object" && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    Object.values(valor).forEach(congelar);
  }
  return valor;
}

const SEMENTE = gerarBancoInicial();
const [, RECEPCAO, PROFESSORA] = SEMENTE.colaboradores;

/** Cadastros de exemplo (alunos, professores, quadras, configuracoes) e agenda vazia. */
const VAZIO: Banco = congelar({
  ...SEMENTE,
  auditoria: [],
  horariosFixos: [],
  horarioAlunos: [],
  ocupacoes: [],
  ocupacaoAlunos: [],
  reposicoes: [],
  lancamentos: [],
});

function ctx(parcial: Partial<ContextoOperacao> = {}): ContextoOperacao {
  return { usuario: RECEPCAO, agora: "2026-11-10T09:00:00", hoje: "2026-11-10", ...parcial };
}

/** Executa e devolve o banco novo; falha o teste se a regra recusar. */
function rodar<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): Banco {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (!resultado.ok) throw new Error(`Operação recusada: ${resultado.erro}`);
  return congelar(resultado.banco);
}

/** Executa esperando a recusa; devolve a mensagem da regra. */
function recusa<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): string {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (resultado.ok) throw new Error("A operação deveria ter sido recusada.");
  expect(resultado).not.toHaveProperty("banco");
  return resultado.erro;
}

function aula(parcial: Partial<DadosHorarioAvulso> = {}): DadosHorarioAvulso {
  return {
    quadraId: "1",
    data: "2026-11-12",
    horaInicio: "10:00",
    horaFim: "11:00",
    tipo: "Individual",
    professorId: "prof-1",
    alunosIds: ["a01"],
    ...parcial,
  };
}

/** Atalho: cria a aula avulsa e devolve o banco e a ocupacao criada. */
function comAula(banco: Banco, parcial: Partial<DadosHorarioAvulso> = {}) {
  const novo = rodar(banco, criarHorarioAvulso, aula(parcial));
  return { banco: novo, ocupacao: novo.ocupacoes[novo.ocupacoes.length - 1] };
}

const doAluno = (banco: Banco, alunoId: string) =>
  banco.reposicoes.filter((r) => r.alunoId === alunoId);
const saldo = (banco: Banco, alunoId: string) =>
  saldoDeReposicao(banco.reposicoes, alunoId, "2026-11-10");
const buscar = (banco: Banco, id: string) => banco.ocupacoes.find((o) => o.id === id) as Ocupacao;

describe("novo horário avulso e conflito de quadra", () => {
  const { banco, ocupacao } = comAula(VAZIO);

  it("recusa outra ocupação na mesma quadra e horário, dizendo quem ocupa", () => {
    const erro = recusa(
      banco,
      criarHorarioAvulso,
      aula({
        horaInicio: "10:30",
        horaFim: "11:30",
        tipo: "Dupla",
        professorId: "prof-2",
        alunosIds: ["a03", "a08"],
      }),
    );
    expect(erro).toBe(
      "Quadra 1 já está ocupada em 12/11 das 10:00 às 11:00 (Individual · Guilherme Lima).",
    );
  });

  it("aceita a aula que começa quando a outra termina (11:00-12:00)", () => {
    const depois = rodar(
      banco,
      criarHorarioAvulso,
      aula({ horaInicio: "11:00", horaFim: "12:00", alunosIds: ["a04"] }),
    );
    expect(depois.ocupacoes.filter(ocupacaoAtiva)).toHaveLength(2);
  });

  it("grava a ocupação com data, alunos a marcar e a auditoria", () => {
    expect(ocupacao).toMatchObject({
      quadraId: "1",
      data: "2026-11-12",
      situacao: "agendada",
      tipo: "Individual",
    });
    expect(banco.ocupacaoAlunos).toEqual([
      expect.objectContaining({ ocupacaoId: ocupacao.id, alunoId: "a01", presenca: "a_marcar" }),
    ]);
    expect(banco.auditoria).toContainEqual(
      expect.objectContaining({
        tabela: "ocupacoes",
        acao: "criar",
        operacao: "Criar horário avulso",
      }),
    );
  });

  it("locação avulsa nasce aguardando pagamento, com prazo e cobrança a receber (H5)", () => {
    const { banco: comReserva, ocupacao: reserva } = comAula(VAZIO, {
      quadraId: "2",
      horaInicio: "19:00",
      horaFim: "20:00",
      tipo: "Locação Avulsa",
      professorId: "prof-1",
      alunosIds: ["a20", "a23"],
    });
    expect(reserva.situacao).toBe("aguardando_pagamento");
    expect(reserva.professorId).toBeUndefined();
    expect(reserva.prazoPagamento).toBe("2026-11-11T09:00:00");
    const [cobranca] = comReserva.lancamentos;
    expect(cobranca).toMatchObject({
      tipo: "receber",
      categoria: "Locação",
      ocupacaoId: reserva.id,
      pessoaId: "a20",
      valor: 120,
      vencimento: "2026-11-11",
    });
    expect(situacaoLancamento(cobranca, "2026-11-10")).toBe("pendente");
  });

  it("o prazo da reserva nunca passa do início dela", () => {
    const { ocupacao: emCimaDaHora } = comAula(VAZIO, {
      data: "2026-11-10",
      horaInicio: "15:00",
      horaFim: "16:00",
      tipo: "Locação Avulsa",
      alunosIds: ["a20"],
    });
    expect(emCimaDaHora.prazoPagamento).toBe("2026-11-10T15:00:00");
  });

  it("professor em duas aulas ao mesmo tempo: grava por padrão e recusa com a opção ligada (H10)", () => {
    const outraQuadra = aula({ quadraId: "2", alunosIds: ["a04"] });
    expect(executarOperacao(banco, criarHorarioAvulso, outraQuadra, ctx()).ok).toBe(true);
    const bloqueando = congelar({
      ...banco,
      configuracoes: { ...banco.configuracoes, bloquearProfessorEmDuasAulas: true },
    });
    expect(recusa(bloqueando, criarHorarioAvulso, outraQuadra)).toMatch(
      /^Alexandre Pires já tem aula em 12\/11 das 10:00 às 11:00 \(Quadra 1\)/,
    );
  });

  it("recusa data passada, horário fora do funcionamento, aula sem professor e sem aluno", () => {
    expect(recusa(VAZIO, criarHorarioAvulso, aula({ data: "2026-11-09" }))).toBe(
      "Escolha uma data a partir de hoje.",
    );
    expect(recusa(VAZIO, criarHorarioAvulso, aula({ horaInicio: "21:30", horaFim: "22:30" }))).toBe(
      "A arena funciona das 07:00 às 22:00.",
    );
    expect(recusa(VAZIO, criarHorarioAvulso, aula({ professorId: undefined }))).toBe(
      "Escolha o professor da aula.",
    );
    expect(recusa(VAZIO, criarHorarioAvulso, aula({ alunosIds: [] }))).toBe(
      "Escolha pelo menos um aluno.",
    );
  });

  it("o perfil de professor só consulta a agenda (H9)", () => {
    expect(recusa(VAZIO, criarHorarioAvulso, aula(), ctx({ usuario: PROFESSORA }))).toMatch(
      /só pode consultar a agenda/,
    );
  });
});

describe("horário fixo (recorrência)", () => {
  // Uma aula avulsa na quinta 19/11 ocupa o horario que o fixo de quinta quer usar.
  const { banco: comAvulsa } = comAula(VAZIO, {
    quadraId: "3",
    data: "2026-11-19",
    horaInicio: "18:00",
    horaFim: "19:00",
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });
  const fixo: DadosHorarioFixo = {
    quadraId: "3",
    dataInicio: "2026-11-12",
    horaInicio: "18:00",
    horaFim: "19:00",
    tipo: "Individual",
    professorId: "prof-2",
    alunosIds: ["a06"],
  };

  it("mostra antes as datas que batem com outra ocupação, e quem ocupa", () => {
    const ate = horizonteDaAgenda(comAvulsa.configuracoes, "2026-11-10");
    expect(ate).toBe("2027-01-31");
    const datas = datasDaRecorrencia(
      comAvulsa,
      { ...fixo, diaSemana: 4, inicio: fixo.dataInicio },
      ate,
    );
    expect(datas).toHaveLength(12);
    const emConflito = datas.filter((d) => d.conflito);
    expect(emConflito.map((d) => d.data)).toEqual(["2026-11-19"]);
    expect(emConflito[0].conflito?.tipo).toBe("Dupla");
  });

  it("recusa salvar sem decidir as datas em conflito", () => {
    expect(recusa(comAvulsa, criarHorarioFixo, fixo)).toMatch(
      /^Quadra 3 já está ocupada em 19\/11 das 18:00 às 19:00 \(Dupla · Larissa Preto e Samuel\)/,
    );
  });

  it("pulando a data em conflito, cria o molde, os alunos e uma aula por semana até o horizonte (H12)", () => {
    const banco = rodar(comAvulsa, criarHorarioFixo, { ...fixo, datasPuladas: ["2026-11-19"] });
    const [molde] = banco.horariosFixos;
    expect(molde).toMatchObject({
      diaSemana: 4,
      inicio: "2026-11-12",
      horaInicio: "18:00",
      tipo: "Individual",
    });
    expect(banco.horarioAlunos).toEqual([
      expect.objectContaining({ horarioFixoId: molde.id, alunoId: "a06" }),
    ]);
    const aulas = banco.ocupacoes.filter((o) => o.horarioFixoId === molde.id);
    expect(aulas).toHaveLength(11);
    expect(aulas.map((o) => o.data)).not.toContain("2026-11-19");
    expect(aulas[aulas.length - 1].data).toBe("2027-01-28");
    aulas.forEach((o) => expect(conflitosNaQuadra(banco.ocupacoes, o)).toEqual([]));
    expect(banco.ocupacaoAlunos.filter((p) => p.alunoId === "a06")).toHaveLength(11);
  });

  it("não aceita locação avulsa como horário fixo", () => {
    expect(recusa(VAZIO, criarHorarioFixo, { ...fixo, tipo: "Locação Avulsa" })).toMatch(
      /Horário fixo é para aulas e locações mensais/,
    );
  });

  describe("encerrar horário fixo", () => {
    const banco = rodar(comAvulsa, criarHorarioFixo, { ...fixo, datasPuladas: ["2026-11-19"] });
    const molde = banco.horariosFixos[0];
    const aulasDoFixo = (b: Banco) =>
      b.ocupacoes.filter((o) => o.horarioFixoId === molde.id).map((o) => o.data);

    it("define o fim e tira só as aulas futuras depois da data (auditado)", () => {
      const encerrado = rodar(banco, encerrarHorarioFixo, {
        horarioFixoId: molde.id,
        fim: "2026-12-10",
      });
      expect(encerrado.horariosFixos[0].fim).toBe("2026-12-10");
      expect(aulasDoFixo(encerrado)).toEqual([
        "2026-11-12",
        "2026-11-26",
        "2026-12-03",
        "2026-12-10",
      ]);
      expect(encerrado.ocupacaoAlunos.filter((p) => p.alunoId === "a06")).toHaveLength(4);
      const apagadas = encerrado.auditoria.filter(
        (r) =>
          r.tabela === "ocupacoes" && r.acao === "apagar" && r.operacao === "Encerrar horário fixo",
      );
      expect(apagadas).toHaveLength(7);
    });

    it("aulas que já passaram ficam como histórico", () => {
      const mais_tarde = ctx({ hoje: "2026-12-01", agora: "2026-12-01T08:00:00" });
      const encerrado = rodar(
        banco,
        encerrarHorarioFixo,
        { horarioFixoId: molde.id, fim: "2026-11-20" },
        mais_tarde,
      );
      expect(aulasDoFixo(encerrado)).toEqual(["2026-11-12", "2026-11-26"]);
    });

    it("aula cancelada fica como histórico, com o crédito dela", () => {
      const aulaDe17 = banco.ocupacoes.find(
        (o) => o.horarioFixoId === molde.id && o.data === "2026-12-17",
      )!;
      // Individual: a falta avisada cancela a aula.
      const avisou = rodar(banco, marcarPresenca, {
        ocupacaoId: aulaDe17.id,
        alunoId: "a06",
        presenca: "falta_avisada",
        sigla: "24h",
      });
      expect(buscar(avisou, aulaDe17.id).situacao).toBe("cancelada");
      const encerrado = rodar(avisou, encerrarHorarioFixo, {
        horarioFixoId: molde.id,
        fim: "2026-12-10",
      });
      expect(buscar(encerrado, aulaDe17.id)).toBeDefined();
      expect(saldo(encerrado, "a06")).toBe(60);
    });

    it("o crédito de uma falta avisada numa aula que sai da agenda sai junto; se já foi usado, recusa", () => {
      const comDupla = rodar(VAZIO, criarHorarioFixo, {
        quadraId: "1",
        dataInicio: "2026-11-13",
        horaInicio: "07:00",
        horaFim: "08:00",
        tipo: "Dupla",
        professorId: "prof-3",
        alunosIds: ["a03", "a13"],
      });
      const moldeDupla = comDupla.horariosFixos[0];
      const aulaDe18 = comDupla.ocupacoes.find((o) => o.data === "2026-12-18")!;
      const avisou = rodar(comDupla, marcarPresenca, {
        ocupacaoId: aulaDe18.id,
        alunoId: "a03",
        presenca: "falta_avisada",
        sigla: "24h",
      });
      expect(saldo(avisou, "a03")).toBe(60);

      const encerrado = rodar(avisou, encerrarHorarioFixo, {
        horarioFixoId: moldeDupla.id,
        fim: "2026-12-11",
      });
      expect(buscar(encerrado, aulaDe18.id)).toBeUndefined();
      expect(doAluno(encerrado, "a03")).toEqual([]);

      const outra = comAula(avisou, {
        quadraId: "2",
        data: "2026-11-13",
        tipo: "LAP",
        professorId: "prof-3",
        alunosIds: ["a07"],
      });
      const usou = rodar(outra.banco, usarReposicao, {
        ocupacaoId: outra.ocupacao.id,
        alunoId: "a03",
      });
      expect(
        recusa(usou, encerrarHorarioFixo, { horarioFixoId: moldeDupla.id, fim: "2026-12-11" }),
      ).toMatch(/já foi usado/);
    });

    it("recusa data antes do início do horário", () => {
      expect(
        recusa(banco, encerrarHorarioFixo, { horarioFixoId: molde.id, fim: "2026-11-01" }),
      ).toMatch(/o encerramento precisa ser depois disso/);
    });
  });
});

describe("presença e falta avisada", () => {
  const { banco: comDupla, ocupacao: dupla } = comAula(VAZIO, {
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });

  it("falta avisada numa Dupla gera crédito só daquele aluno, válido por 3 meses (H1)", () => {
    const banco = rodar(comDupla, marcarPresenca, {
      ocupacaoId: dupla.id,
      alunoId: "a03",
      presenca: "falta_avisada",
      sigla: "24h",
    });
    expect(doAluno(banco, "a03")).toEqual([
      expect.objectContaining({
        minutos: 60,
        sigla: "24h",
        ocupacaoOrigemId: dupla.id,
        validade: "2027-02-12",
      }),
    ]);
    expect(doAluno(banco, "a13")).toEqual([]);
    expect(buscar(banco, dupla.id).situacao).toBe("agendada");
    expect(banco.ocupacaoAlunos.find((p) => p.alunoId === "a03")).toMatchObject({
      presenca: "falta_avisada",
      sigla: "24h",
    });
  });

  it("em aula Individual a falta avisada cancela a aula, com um crédito só", () => {
    const { banco: comIndividual, ocupacao: individual } = comAula(VAZIO);
    const banco = rodar(comIndividual, marcarPresenca, {
      ocupacaoId: individual.id,
      alunoId: "a01",
      presenca: "falta_avisada",
      sigla: "TIP",
    });
    expect(buscar(banco, individual.id)).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: "TIP",
    });
    expect(doAluno(banco, "a01")).toHaveLength(1);
    expect(saldo(banco, "a01")).toBe(60);
  });

  it("presença e falta só no dia da aula ou depois; a aula passa a realizada", () => {
    expect(
      recusa(comDupla, marcarPresenca, {
        ocupacaoId: dupla.id,
        alunoId: "a03",
        presenca: "presente",
      }),
    ).toBe("Presença e falta só podem ser marcadas no dia da aula ou depois.");
    const noDia = ctx({ hoje: "2026-11-12", agora: "2026-11-12T10:05:00" });
    const banco = rodar(
      comDupla,
      marcarPresenca,
      { ocupacaoId: dupla.id, alunoId: "a03", presenca: "presente" },
      noDia,
    );
    expect(buscar(banco, dupla.id).situacao).toBe("realizada");
    const comFalta = rodar(
      banco,
      marcarPresenca,
      { ocupacaoId: dupla.id, alunoId: "a13", presenca: "falta" },
      noDia,
    );
    expect(comFalta.ocupacaoAlunos.find((p) => p.alunoId === "a13")?.presenca).toBe("falta");
    expect(comFalta.reposicoes).toEqual([]);
  });

  it("desfazer a falta avisada retira o crédito; se ele já foi usado, recusa", () => {
    const avisou = rodar(comDupla, marcarPresenca, {
      ocupacaoId: dupla.id,
      alunoId: "a03",
      presenca: "falta_avisada",
      sigla: "24h",
    });
    const desfeito = rodar(avisou, marcarPresenca, {
      ocupacaoId: dupla.id,
      alunoId: "a03",
      presenca: "a_marcar",
    });
    expect(doAluno(desfeito, "a03")).toEqual([]);

    const outra = comAula(avisou, { quadraId: "2", data: "2026-11-13", alunosIds: ["a04"] });
    const usou = rodar(outra.banco, usarReposicao, {
      ocupacaoId: outra.ocupacao.id,
      alunoId: "a03",
    });
    expect(
      recusa(usou, marcarPresenca, { ocupacaoId: dupla.id, alunoId: "a03", presenca: "a_marcar" }),
    ).toBe("O crédito desta falta avisada já foi usado numa reposição: não dá para desfazê-lo.");
  });

  it("falta avisada pede sigla de aluno (CH é da aula inteira)", () => {
    expect(
      recusa(comDupla, marcarPresenca, {
        ocupacaoId: dupla.id,
        alunoId: "a03",
        presenca: "falta_avisada",
      }),
    ).toBe("Escolha a sigla da falta avisada.");
    expect(
      recusa(comDupla, marcarPresenca, {
        ocupacaoId: dupla.id,
        alunoId: "a03",
        presenca: "falta_avisada",
        sigla: "CH",
      }),
    ).toMatch(/é para cancelar a aula inteira/);
  });
});

describe("cancelar aula", () => {
  const { banco, ocupacao } = comAula(VAZIO, {
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });

  it("exige motivo", () => {
    expect(recusa(banco, cancelarOcupacao, { id: ocupacao.id, motivo: "  " })).toBe(
      "Informe o motivo do cancelamento.",
    );
  });

  it("a prévia mostra os minutos de cada aluno, e é exatamente o que se grava", () => {
    const previa = efeitoDoCancelamento(banco, ocupacao, "FP", "2026-11-10T09:00:00");
    expect(previa.porAluno).toEqual([
      { alunoId: "a03", minutos: 60, jaTinhaCredito: false },
      { alunoId: "a13", minutos: 60, jaTinhaCredito: false },
    ]);
    expect(previa.minutosTotais).toBe(120);

    const cancelado = rodar(banco, cancelarOcupacao, { id: ocupacao.id, motivo: "FP" });
    expect(buscar(cancelado, ocupacao.id)).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: "FP",
      canceladaEm: "2026-11-10T09:00:00",
    });
    expect(cancelado.reposicoes.map((r) => [r.alunoId, r.minutos, r.sigla])).toEqual([
      ["a03", 60, "FP"],
      ["a13", 60, "FP"],
    ]);
    expect(recusa(cancelado, cancelarOcupacao, { id: ocupacao.id, motivo: "FP" })).toBe(
      "Esta aula já está cancelada.",
    );
  });

  it("motivo em texto livre cancela sem crédito; quem já tinha crédito não ganha de novo", () => {
    const semCredito = rodar(banco, cancelarOcupacao, {
      id: ocupacao.id,
      motivo: "Evento particular",
    });
    expect(semCredito.reposicoes).toEqual([]);

    const avisou = rodar(banco, marcarPresenca, {
      ocupacaoId: ocupacao.id,
      alunoId: "a03",
      presenca: "falta_avisada",
      sigla: "24h",
    });
    expect(efeitoDoCancelamento(avisou, ocupacao, "CH", "x").porAluno[0]).toEqual({
      alunoId: "a03",
      minutos: 0,
      jaTinhaCredito: true,
    });
    const cancelado = rodar(avisou, cancelarOcupacao, { id: ocupacao.id, motivo: "CH" });
    expect(doAluno(cancelado, "a03")).toHaveLength(1);
    expect(doAluno(cancelado, "a13")).toEqual([
      expect.objectContaining({ sigla: "CH", minutos: 60 }),
    ]);
    // A falta avisada fica registrada; o resto volta para "a marcar".
    expect(cancelado.ocupacaoAlunos.map((p) => p.presenca)).toEqual(["falta_avisada", "a_marcar"]);
  });

  it("cancelar uma locação avulsa anula a cobrança ainda não paga (sem apagar)", () => {
    const reserva = comAula(VAZIO, { tipo: "Locação Avulsa", alunosIds: ["a20"] });
    const cancelado = rodar(reserva.banco, cancelarOcupacao, {
      id: reserva.ocupacao.id,
      motivo: "Cliente desistiu",
    });
    expect(cancelado.lancamentos).toHaveLength(1);
    expect(cancelado.lancamentos[0]).toMatchObject({
      canceladoEm: "2026-11-10T09:00:00",
      motivoCancelamento: "Reserva cancelada na agenda: Cliente desistiu.",
    });
  });
});

describe("remarcar", () => {
  const primeira = comAula(VAZIO);
  const segunda = comAula(primeira.banco, {
    quadraId: "2",
    horaInicio: "15:00",
    horaFim: "16:00",
    alunosIds: ["a04"],
    professorId: "prof-2",
  });

  it("recusa remarcar para cima de outra ocupação e aceita um horário livre", () => {
    const destino = {
      quadraId: "2" as const,
      data: "2026-11-12",
      horaInicio: "15:30",
      horaFim: "16:30",
    };
    expect(
      recusa(segunda.banco, remarcarOcupacao, { id: primeira.ocupacao.id, ...destino }),
    ).toMatch(/^Quadra 2 já está ocupada em 12\/11 das 15:00 às 16:00/);
    const remarcada = rodar(segunda.banco, remarcarOcupacao, {
      id: primeira.ocupacao.id,
      ...destino,
      horaInicio: "16:00",
      horaFim: "17:00",
    });
    expect(buscar(remarcada, primeira.ocupacao.id)).toMatchObject({
      quadraId: "2",
      horaInicio: "16:00",
    });
  });

  it("a cobrança da locação acompanha a nova data e duração", () => {
    const reserva = comAula(VAZIO, { tipo: "Locação Avulsa", alunosIds: ["a20"] });
    const remarcada = rodar(reserva.banco, remarcarOcupacao, {
      id: reserva.ocupacao.id,
      quadraId: "paredao",
      data: "2026-11-14",
      horaInicio: "08:00",
      horaFim: "09:30",
    });
    expect(remarcada.lancamentos[0]).toMatchObject({
      item: "Locação avulsa · Paredão · 14/11 08:00",
      valor: 90,
    });
  });
});

describe("bloquear quadra", () => {
  let banco = VAZIO;
  const criar = (parcial: Partial<DadosHorarioAvulso>) => {
    const resultado = comAula(banco, { quadraId: "4", data: "2026-11-14", ...parcial });
    banco = resultado.banco;
    return resultado.ocupacao;
  };
  const individual = criar({ horaInicio: "08:00", horaFim: "09:00" });
  const dupla = criar({
    horaInicio: "09:00",
    horaFim: "10:00",
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });
  const locacao = criar({
    horaInicio: "07:00",
    horaFim: "08:00",
    tipo: "Locação Avulsa",
    alunosIds: ["a20"],
  });
  const depois = criar({ horaInicio: "11:00", horaFim: "12:00", alunosIds: ["a04"] });
  const dados = {
    quadrasIds: ["4" as const],
    data: "2026-11-14",
    horaInicio: "07:00",
    horaFim: "10:00",
    descricao: "Manutenção do saibro",
  };

  it("cancela as aulas do período com IAC, gera os créditos e cria o bloqueio", () => {
    const bloqueado = rodar(banco, bloquearQuadra, dados);
    [individual, dupla, locacao].forEach((o) =>
      expect(buscar(bloqueado, o.id)).toMatchObject({
        situacao: "cancelada",
        motivoCancelamento: "IAC",
      }),
    );
    expect(buscar(bloqueado, depois.id).situacao).toBe("agendada");
    // Locacao avulsa e paga por uso: nao gera credito; a cobranca e anulada.
    expect(bloqueado.reposicoes.map((r) => [r.alunoId, r.minutos, r.sigla])).toEqual([
      ["a01", 60, "IAC"],
      ["a03", 60, "IAC"],
      ["a13", 60, "IAC"],
    ]);
    expect(bloqueado.lancamentos[0].canceladoEm).toBeDefined();
    const bloqueio = bloqueado.ocupacoes.find((o) => o.tipo === "Bloqueio");
    expect(bloqueio).toMatchObject({
      quadraId: "4",
      horaInicio: "07:00",
      horaFim: "10:00",
      descricao: "Manutenção do saibro",
    });

    expect(
      recusa(
        bloqueado,
        criarHorarioAvulso,
        aula({ quadraId: "4", data: "2026-11-14", horaInicio: "08:00", horaFim: "09:00" }),
      ),
    ).toBe(
      "Quadra 4 já está ocupada em 14/11 das 07:00 às 10:00 (Bloqueio · Manutenção do saibro).",
    );
    expect(
      recusa(bloqueado, bloquearQuadra, { ...dados, horaInicio: "09:00", horaFim: "11:00" }),
    ).toMatch(/^Quadra 4 já está bloqueada em 14\/11 das 07:00 às 10:00/);
  });

  it("bloqueia várias quadras de uma vez e exige descrição", () => {
    const bloqueado = rodar(banco, bloquearQuadra, { ...dados, quadrasIds: ["2", "3"] });
    expect(bloqueado.ocupacoes.filter((o) => o.tipo === "Bloqueio").map((o) => o.quadraId)).toEqual(
      ["2", "3"],
    );
    expect(recusa(banco, bloquearQuadra, { ...dados, descricao: " " })).toMatch(
      /Descreva o motivo/,
    );
  });
});

describe("cancelar por chuva", () => {
  let banco = VAZIO;
  const criar = (parcial: Partial<DadosHorarioAvulso>) => {
    const resultado = comAula(banco, { data: "2026-11-12", ...parcial });
    banco = resultado.banco;
    return resultado.ocupacao;
  };
  const q1Tarde = criar({ quadraId: "1", horaInicio: "14:00", horaFim: "15:00" });
  const q2Tarde = criar({
    quadraId: "2",
    horaInicio: "16:00",
    horaFim: "17:00",
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });
  const q2Noite = criar({
    quadraId: "2",
    horaInicio: "19:00",
    horaFim: "20:00",
    alunosIds: ["a04"],
  });
  const q3Tarde = criar({
    quadraId: "3",
    horaInicio: "14:00",
    horaFim: "15:00",
    alunosIds: ["a06"],
    professorId: "prof-2",
  });
  banco = rodar(banco, bloquearQuadra, {
    quadrasIds: ["1"],
    data: "2026-11-12",
    horaInicio: "08:00",
    horaFim: "10:00",
    descricao: "Evento",
  });

  it("cancela com CH o que está ativo nas quadras e na faixa, e gera os créditos", () => {
    const molhado = rodar(banco, cancelarPorChuva, {
      data: "2026-11-12",
      quadrasIds: ["1", "2"],
      horaInicio: "13:00",
      horaFim: "18:00",
    });
    expect(buscar(molhado, q1Tarde.id).motivoCancelamento).toBe("CH");
    expect(buscar(molhado, q2Tarde.id).motivoCancelamento).toBe("CH");
    expect(buscar(molhado, q2Noite.id).situacao).toBe("agendada");
    expect(buscar(molhado, q3Tarde.id).situacao).toBe("agendada");
    expect(molhado.reposicoes.map((r) => [r.alunoId, r.sigla])).toEqual([
      ["a01", "CH"],
      ["a03", "CH"],
      ["a13", "CH"],
    ]);
    // O bloqueio nao e aula: fica como esta.
    expect(molhado.ocupacoes.find((o) => o.tipo === "Bloqueio")?.situacao).toBe("agendada");
  });

  it("sem horário, cancela o dia inteiro; sem aulas, recusa", () => {
    const molhado = rodar(banco, cancelarPorChuva, {
      data: "2026-11-12",
      quadrasIds: ["1", "2", "3", "4", "paredao"],
    });
    expect(molhado.ocupacoes.filter((o) => o.motivoCancelamento === "CH")).toHaveLength(4);
    expect(recusa(molhado, cancelarPorChuva, { data: "2026-11-12", quadrasIds: ["1", "2"] })).toBe(
      "Não há aulas ativas nessas quadras nesse período.",
    );
    expect(recusa(banco, cancelarPorChuva, { data: "2026-11-12", quadrasIds: [] })).toBe(
      "Escolha pelo menos uma quadra.",
    );
  });

  it("funciona sobre os dados de exemplo inteiros sem alterar nada no lugar", () => {
    const completo = congelar(gerarBancoInicial());
    const antes = completo.reposicoes.length;
    const molhado = rodar(
      completo,
      cancelarPorChuva,
      { data: HOJE, quadrasIds: ["1", "2", "3", "4", "paredao"] },
      ctx({ hoje: HOJE, agora: `${HOJE}T06:30:00` }),
    );
    expect(
      molhado.ocupacoes
        .filter((o) => o.data === HOJE && o.tipo !== "Bloqueio")
        .every((o) => !ocupacaoAtiva(o)),
    ).toBe(true);
    expect(molhado.reposicoes.length).toBeGreaterThan(antes);
  });
});

describe("usar reposição", () => {
  const destino = comAula(VAZIO, {
    quadraId: "2",
    data: "2026-11-13",
    tipo: "LAP",
    professorId: "prof-3",
    alunosIds: ["a07"],
  });

  it("sem saldo, recusa", () => {
    expect(
      recusa(destino.banco, usarReposicao, { ocupacaoId: destino.ocupacao.id, alunoId: "a05" }),
    ).toBe("Saldo de reposição insuficiente: o aluno tem 0 minutos e a aula precisa de 60.");
    expect(
      recusa(destino.banco, marcarAulaDeReposicao, {
        alunoId: "a05",
        quadraId: "3",
        data: "2026-11-13",
        horaInicio: "08:00",
        horaFim: "09:00",
        tipo: "Individual",
        professorId: "prof-1",
      }),
    ).toMatch(/^Saldo de reposição insuficiente/);
  });

  // a03 ganha 60 minutos com uma falta avisada numa dupla.
  const dupla = comAula(destino.banco, {
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });
  const comCredito = rodar(dupla.banco, marcarPresenca, {
    ocupacaoId: dupla.ocupacao.id,
    alunoId: "a03",
    presenca: "falta_avisada",
    sigla: "24h",
  });

  it("com saldo, inclui o aluno numa aula existente e debita os minutos; remover devolve", () => {
    const usou = rodar(comCredito, usarReposicao, {
      ocupacaoId: destino.ocupacao.id,
      alunoId: "a03",
    });
    expect(saldo(usou, "a03")).toBe(0);
    expect(doAluno(usou, "a03")).toContainEqual(
      expect.objectContaining({ minutos: -60, ocupacaoUsoId: destino.ocupacao.id }),
    );
    expect(
      usou.ocupacaoAlunos.some((p) => p.ocupacaoId === destino.ocupacao.id && p.alunoId === "a03"),
    ).toBe(true);
    expect(recusa(usou, usarReposicao, { ocupacaoId: destino.ocupacao.id, alunoId: "a03" })).toBe(
      "Este aluno já está na aula.",
    );

    const removido = rodar(usou, removerAluno, { ocupacaoId: destino.ocupacao.id, alunoId: "a03" });
    expect(saldo(removido, "a03")).toBe(60);
  });

  it("cria uma aula de reposição nova, marcada como Reposição", () => {
    const marcada = rodar(comCredito, marcarAulaDeReposicao, {
      alunoId: "a03",
      quadraId: "3",
      data: "2026-11-13",
      horaInicio: "08:00",
      horaFim: "09:00",
      tipo: "Individual",
      professorId: "prof-1",
    });
    const nova = marcada.ocupacoes[marcada.ocupacoes.length - 1];
    expect(nova).toMatchObject({ descricao: "Reposição", situacao: "agendada", quadraId: "3" });
    expect(saldo(marcada, "a03")).toBe(0);
  });

  it("incluir aluno sem reposição não mexe no saldo", () => {
    const incluido = rodar(comCredito, incluirAluno, {
      ocupacaoId: destino.ocupacao.id,
      alunoId: "a03",
    });
    expect(saldo(incluido, "a03")).toBe(60);
  });
});

describe("reservas sem pagamento (H5)", () => {
  const { banco, ocupacao: reserva } = comAula(VAZIO, {
    tipo: "Locação Avulsa",
    alunosIds: ["a20"],
  });
  const depoisDoPrazo = ctx({ agora: "2026-11-11T10:00:00", hoje: "2026-11-11" });

  it("antes do prazo, recusa liberar", () => {
    expect(
      recusa(banco, liberarReserva, { id: reserva.id }, ctx({ agora: "2026-11-10T20:00:00" })),
    ).toBe("O prazo desta reserva só vence em 11/11/2026 às 09:00.");
  });

  it("vencida, libera o horário sem crédito e anula a cobrança", () => {
    const liberado = rodar(banco, liberarReserva, { id: reserva.id }, depoisDoPrazo);
    expect(buscar(liberado, reserva.id)).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: "Sem pagamento no prazo",
    });
    expect(liberado.reposicoes).toEqual([]);
    expect(situacaoLancamento(liberado.lancamentos[0], "2026-11-11")).toBe("cancelado");
    // O horario fica livre para outra pessoa.
    expect(
      executarOperacao(liberado, criarHorarioAvulso, aula({ alunosIds: ["a23"] }), depoisDoPrazo)
        .ok,
    ).toBe(true);
  });

  it("liberar todas as vencidas de uma vez; sem vencidas, não muda nada", () => {
    const liberado = rodar(banco, liberarReservasVencidas, {}, depoisDoPrazo);
    expect(buscar(liberado, reserva.id).situacao).toBe("cancelada");
    const deNovo = executarOperacao(liberado, liberarReservasVencidas, {}, depoisDoPrazo);
    expect(deNovo.ok && deNovo.banco).toBe(liberado);
  });
});

describe("consultas da agenda (leitura das telas)", () => {
  // Quinta 12/11: uma Dupla na Quadra 2 as 10:00, uma Individual na Quadra 1 as 10:00
  // (cancelada por FP), uma locacao avulsa as 15:00 e um bloqueio na Quadra 4.
  let banco = VAZIO;
  const criar = (parcial: Partial<DadosHorarioAvulso>) => {
    const resultado = comAula(banco, parcial);
    banco = resultado.banco;
    return resultado.ocupacao;
  };
  const dupla = criar({
    quadraId: "2",
    tipo: "Dupla",
    professorId: "prof-3",
    alunosIds: ["a03", "a13"],
  });
  const individual = criar({ quadraId: "1" });
  const locacao = criar({
    quadraId: "3",
    horaInicio: "15:00",
    horaFim: "16:00",
    tipo: "Locação Avulsa",
    alunosIds: ["a20"],
  });
  banco = rodar(banco, cancelarOcupacao, { id: individual.id, motivo: "FP" });
  banco = rodar(banco, bloquearQuadra, {
    quadrasIds: ["4"],
    data: "2026-11-12",
    horaInicio: "07:00",
    horaFim: "09:00",
    descricao: "Manutenção",
  });
  const datas = ["2026-11-11", "2026-11-12"];
  const agora = "2026-11-10T09:00:00";

  it("agrupa por data (todas as datas pedidas aparecem) e ordena por horario e quadra", () => {
    const porData = montarAgenda(banco, datas, FILTRO_INICIAL, agora);
    expect(porData.get("2026-11-11")).toEqual([]);
    expect(
      porData.get("2026-11-12")?.map((i) => [i.ocupacao.horaInicio, i.ocupacao.quadraId]),
    ).toEqual([
      ["07:00", "4"],
      ["10:00", "1"],
      ["10:00", "2"],
      ["15:00", "3"],
    ]);
    const item = porData.get("2026-11-12")?.find((i) => i.ocupacao.id === dupla.id);
    expect(item?.participantes.map((p) => p.nome)).toEqual(["Larissa Preto", "Samuel"]);
    expect(item?.professor?.nome).toBe("Márcio Bueno");
  });

  it("filtra por quadra, professor e tipo, e esconde as canceladas quando pedido", () => {
    const porQuadra = montarAgenda(banco, datas, { ...FILTRO_INICIAL, quadraId: "2" }, agora);
    expect(porQuadra.get("2026-11-12")?.map((i) => i.ocupacao.id)).toEqual([dupla.id]);
    const porProfessor = montarAgenda(
      banco,
      datas,
      { ...FILTRO_INICIAL, professorId: "prof-1" },
      agora,
    );
    expect(porProfessor.get("2026-11-12")?.map((i) => i.ocupacao.id)).toEqual([individual.id]);
    const semCanceladas = montarAgenda(
      banco,
      datas,
      { ...FILTRO_INICIAL, mostrarCanceladas: false },
      agora,
    );
    expect(semCanceladas.get("2026-11-12")).toHaveLength(3);
    const porTipo = montarAgenda(banco, datas, { ...FILTRO_INICIAL, tipo: "Bloqueio" }, agora);
    expect(porTipo.get("2026-11-12")?.[0].ocupacao.descricao).toBe("Manutenção");
  });

  it("o resumo conta ativas, alunos, canceladas, bloqueios e reservas aguardando pagamento", () => {
    const porData = montarAgenda(banco, datas, FILTRO_INICIAL, agora);
    expect(resumirAgenda(porData, datas, 5)).toEqual({
      ativas: 2,
      alunos: 3,
      canceladas: 1,
      bloqueios: 1,
      aguardandoPagamento: 1,
      vencidas: 0,
      minutosOcupados: 60 + 60 + 120,
      minutosDisponiveis: 2 * 5 * 15 * 60,
    });
  });

  it("estado da reserva: aguardando, vencida pelo relogio e paga quando o financeiro registra", () => {
    const estado = (b: Banco, quando: string) =>
      montarAgenda(b, ["2026-11-12"], FILTRO_INICIAL, quando)
        .get("2026-11-12")
        ?.find((i) => i.ocupacao.id === locacao.id)?.estadoReserva;
    expect(estado(banco, agora)).toBe("aguardando");
    expect(estado(banco, "2026-11-11T10:00:00")).toBe("vencida");
    expect(reservasAguardandoPagamento(banco, "2026-11-11T10:00:00")[0]).toMatchObject({
      vencida: true,
      titular: "Lucas Freitas",
    });
    // O que o modulo financeiro faz ao registrar o pagamento (convencao entre modulos).
    const pago = congelar({
      ...banco,
      ocupacoes: banco.ocupacoes.map((o) =>
        o.id === locacao.id ? { ...o, situacao: "agendada" as const } : o,
      ),
      lancamentos: banco.lancamentos.map((l) =>
        l.ocupacaoId === locacao.id ? { ...l, pagoEm: "2026-11-10" } : l,
      ),
    });
    expect(estado(pago, "2026-11-11T10:00:00")).toBe("paga");
  });

  it("as previas de bloqueio e chuva listam as aulas e os minutos de cada aluno", () => {
    const bloqueio = previaDoBloqueio(
      banco,
      { quadrasIds: ["2", "3"], data: "2026-11-12", horaInicio: "09:00", horaFim: "16:00" },
      agora,
    );
    expect(bloqueio.aulas.map((a) => a.item.ocupacao.id)).toEqual([dupla.id, locacao.id]);
    expect(bloqueio.minutos).toBe(120);
    expect(bloqueio.alunos).toBe(3);
    const chuva = previaDaChuva(banco, { data: "2026-11-12", quadrasIds: ["4"] }, agora);
    expect(chuva.aulas).toEqual([]);
    expect(chuva.bloqueiosExistentes).toHaveLength(1);
  });

  it("a checagem do formulario usa a mesma mensagem da regra", () => {
    const checagem = checarHorario(banco, {
      quadraId: "2",
      data: "2026-11-12",
      horaInicio: "10:30",
      horaFim: "11:30",
      professorId: "prof-3",
    });
    expect(checagem.conflitoNaQuadra).toBe(
      "Quadra 2 já está ocupada em 12/11 das 10:00 às 11:00 (Dupla · Larissa Preto e Samuel).",
    );
    expect(checagem.professorOcupado).toMatch(/^Márcio Bueno já tem aula das 10:00 às 11:00/);
  });

  it("professor pela URL aceita o id e, por compatibilidade com o MVP, o nome", () => {
    expect(professorPelaUrl(banco, "prof-2")).toBe("prof-2");
    expect(professorPelaUrl(banco, "Renata Coelho")).toBe("prof-2");
    expect(professorPelaUrl(banco, "marcio bueno")).toBe("prof-3");
    expect(professorPelaUrl(banco, "Ninguém")).toBeUndefined();
  });
});

describe("dados de exemplo da agenda", () => {
  it("toda reserva aguardando pagamento tem prazo antes do inicio e cobranca a receber", () => {
    const aguardando = SEMENTE.ocupacoes.filter((o) => o.situacao === "aguardando_pagamento");
    expect(aguardando.length).toBeGreaterThan(0);
    aguardando.forEach((o) => {
      expect(o.prazoPagamento! <= `${o.data}T${o.horaInicio}:00`).toBe(true);
      expect(o.criadoEm < o.prazoPagamento!).toBe(true);
      expect(
        SEMENTE.lancamentos.some(
          (l) => l.ocupacaoId === o.id && !l.pagoEm && l.categoria === "Locação",
        ),
      ).toBe(true);
    });
  });
});
