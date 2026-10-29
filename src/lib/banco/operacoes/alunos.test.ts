/**
 * Testes das operacoes de alunos e professores: cadastro, matricula,
 * congelamento (Hipotese H4), inativacao e regra de repasse (H6).
 *
 * Usa um banco pequeno, com datas fixas, montado sobre a semente (para ter
 * configuracoes, planos, professores e colaboradores):
 *  - Ana (x1): matricula Individual; aula individual toda terca 10h (quadra 1)
 *    e dupla com Bruno toda quinta 18h (quadra 2); uma reposicao avulsa;
 *  - Bruno (x2): matricula Dupla, na mesma dupla;
 *  - Carla (x3): sem matricula.
 * "Hoje" nos testes e terca, 10/11/2026.
 */

import { describe, expect, it } from "vitest";
import { executarOperacao, type ContextoOperacao, type Operacao } from "../executar";
import { datasDoHorarioFixo } from "../regras/agenda";
import {
  MOTIVO_CONGELAMENTO,
  MOTIVO_INATIVACAO,
  aulasAindaSuspensas,
  matriculaVigente,
  normalizarTelefone,
  situacaoDoAluno,
} from "../regras/alunos";
import { gerarBancoInicial } from "../semente";
import type {
  Aluno,
  Banco,
  HorarioAluno,
  HorarioFixo,
  Ocupacao,
  OcupacaoAluno,
} from "../tipos";
import {
  cadastrarAluno,
  cancelarMatriculaAgendada,
  congelarPlano,
  corrigirMatricula,
  criarMatricula,
  editarAluno,
  encerrarMatricula,
  inativarAluno,
  reativarCadastro,
  reativarPlano,
  trocarPlano,
} from "./alunos";
import { cadastrarProfessor, editarProfessor } from "./professores";

const HOJE_TESTE = "2026-11-10";
const SEMENTE = gerarBancoInicial();
const [DONO, RECEPCAO, PROFESSORA] = SEMENTE.colaboradores;

function ctx(hoje = HOJE_TESTE, usuario = RECEPCAO): ContextoOperacao {
  return { usuario, agora: `${hoje}T09:00:00`, hoje };
}

function aluno(id: string, nome: string): Aluno {
  return {
    id,
    nome,
    telefone: "(11) 99999-0000",
    email: `${id}@email.com`,
    ativo: true,
    inscritoRanking: false,
    criadoEm: "2026-01-01T10:00:00",
  };
}

function bancoDeTeste(): Banco {
  const horariosFixos: HorarioFixo[] = [
    { id: "hf-ind", quadraId: "1", diaSemana: 2, horaInicio: "10:00", horaFim: "11:00", tipo: "Individual", professorId: "prof-1", inicio: "2026-01-01" },
    { id: "hf-dup", quadraId: "2", diaSemana: 4, horaInicio: "18:00", horaFim: "19:00", tipo: "Dupla", professorId: "prof-2", inicio: "2026-01-01" },
  ];
  const horarioAlunos: HorarioAluno[] = [
    { id: "ha-ind-x1", horarioFixoId: "hf-ind", alunoId: "x1" },
    { id: "ha-dup-x1", horarioFixoId: "hf-dup", alunoId: "x1" },
    { id: "ha-dup-x2", horarioFixoId: "hf-dup", alunoId: "x2" },
  ];

  const ocupacoes: Ocupacao[] = [];
  const ocupacaoAlunos: OcupacaoAluno[] = [];
  horariosFixos.forEach((fixo) => {
    datasDoHorarioFixo(fixo, "2026-11-01", "2026-12-31").forEach((data) => {
      const id = `oc-${fixo.id}-${data}`;
      ocupacoes.push({
        id,
        quadraId: fixo.quadraId,
        data,
        horaInicio: fixo.horaInicio,
        horaFim: fixo.horaFim,
        tipo: fixo.tipo,
        professorId: fixo.professorId,
        horarioFixoId: fixo.id,
        situacao: data < HOJE_TESTE ? "realizada" : "agendada",
        criadoEm: "2026-10-01T06:00:00",
      });
      horarioAlunos
        .filter((ha) => ha.horarioFixoId === fixo.id)
        .forEach((ha) =>
          ocupacaoAlunos.push({
            id: `pa-${id}-${ha.alunoId}`,
            ocupacaoId: id,
            alunoId: ha.alunoId,
            presenca: data < HOJE_TESTE ? "presente" : "a_marcar",
          }),
        );
    });
  });

  // Reposicao avulsa da Ana (nao vem de horario fixo).
  ocupacoes.push({
    id: "oc-rep",
    quadraId: "3",
    data: "2026-11-20",
    horaInicio: "08:00",
    horaFim: "09:00",
    tipo: "Individual",
    professorId: "prof-1",
    descricao: "Reposição",
    situacao: "agendada",
    criadoEm: "2026-11-05T10:00:00",
  });
  ocupacaoAlunos.push({ id: "pa-rep-x1", ocupacaoId: "oc-rep", alunoId: "x1", presenca: "a_marcar" });

  return {
    ...SEMENTE,
    auditoria: [],
    comentarios: [],
    alunos: [aluno("x1", "Ana Teste"), aluno("x2", "Bruno Teste"), aluno("x3", "Carla Teste")],
    matriculas: [
      { id: "mt-x1", alunoId: "x1", planoId: "pl-ind", valorMensal: 720, diaVencimento: 5, inicio: "2026-01-01" },
      { id: "mt-x2", alunoId: "x2", planoId: "pl-dup", valorMensal: 520, diaVencimento: 10, inicio: "2026-01-01" },
    ],
    congelamentos: [],
    horariosFixos,
    horarioAlunos,
    ocupacoes,
    ocupacaoAlunos,
    reposicoes: [],
    lancamentos: [],
    repasses: [],
    consumos: [],
    partidas: [],
    torneios: [],
    torneioInscritos: [],
  };
}

/** Executa e devolve o banco novo; falha o teste se a regra recusar. */
function gravar<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): Banco {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  if (!resultado.ok) throw new Error(`Recusado sem querer: ${resultado.erro}`);
  return resultado.banco;
}

/** Executa esperando a recusa; devolve a mensagem da regra. */
function recusa<D>(banco: Banco, operacao: Operacao<D>, dados: D, contexto = ctx()): string {
  const resultado = executarOperacao(banco, operacao, dados, contexto);
  expect(resultado.ok, "a operação deveria ter sido recusada").toBe(false);
  return resultado.ok ? "" : resultado.erro;
}

const ocupacao = (banco: Banco, id: string) => banco.ocupacoes.find((o) => o.id === id)!;
const participantes = (banco: Banco, ocupacaoId: string) =>
  banco.ocupacaoAlunos.filter((p) => p.ocupacaoId === ocupacaoId).map((p) => p.alunoId).sort();

// ---------------------------------------------------------------------------

describe("cadastro de aluno", () => {
  const valido = {
    nome: "  Daniela   Souza ",
    telefone: "11 98765 4321",
    email: " Daniela@Email.COM ",
    inscritoRanking: true,
    categoriaRanking: "C" as const,
  };

  it("recusa dados inválidos sem gravar nada", () => {
    const banco = bancoDeTeste();
    expect(recusa(banco, cadastrarAluno, { ...valido, nome: " " })).toBe("Informe o nome do aluno.");
    expect(recusa(banco, cadastrarAluno, { ...valido, telefone: "1234" })).toMatch(/Telefone inválido/);
    expect(recusa(banco, cadastrarAluno, { ...valido, email: "daniela@" })).toMatch(/E-mail inválido/);
    expect(recusa(banco, cadastrarAluno, { ...valido, dataNascimento: "2030-01-01" })).toMatch(/futuro/);
    expect(recusa(banco, cadastrarAluno, { ...valido, dataNascimento: "2001-02-30" })).toMatch(/inválida/);
    expect(recusa(banco, cadastrarAluno, { ...valido, categoriaRanking: undefined })).toMatch(/categoria/);
    expect(recusa(banco, cadastrarAluno, { ...valido, professorPrincipalId: "prof-x" })).toMatch(/Professor/);
  });

  it("grava o aluno com nome, telefone e e-mail arrumados, e registra na auditoria", () => {
    const banco = gravar(bancoDeTeste(), cadastrarAluno, { ...valido, id: "x9" });
    const novo = banco.alunos.find((a) => a.id === "x9");
    expect(novo).toMatchObject({
      nome: "Daniela Souza",
      telefone: "(11) 98765-4321",
      email: "daniela@email.com",
      ativo: true,
      categoriaRanking: "C",
    });
    expect(banco.auditoria).toMatchObject([{ tabela: "alunos", registroId: "x9", acao: "criar" }]);
  });

  it("entende os formatos comuns de telefone", () => {
    expect(normalizarTelefone("+55 (11) 98765-4321")).toBe("(11) 98765-4321");
    expect(normalizarTelefone("011 3456 7890")).toBe("(11) 3456-7890");
    expect(normalizarTelefone("(11) 8765-4321")).toBeUndefined();
    expect(normalizarTelefone("(01) 98765-4321")).toBeUndefined();
  });

  it("perfil de professor só consulta (H9)", () => {
    const banco = bancoDeTeste();
    expect(recusa(banco, cadastrarAluno, valido, ctx(HOJE_TESTE, PROFESSORA))).toMatch(/professor/);
    expect(
      recusa(banco, editarAluno, { ...valido, id: "x1" }, ctx(HOJE_TESTE, PROFESSORA)),
    ).toMatch(/professor/);
  });

  it("edição sem mudança não grava alteração vazia", () => {
    const banco = bancoDeTeste();
    const ana = banco.alunos[0];
    const resultado = gravar(banco, editarAluno, {
      id: ana.id,
      nome: ana.nome,
      telefone: ana.telefone,
      email: ana.email,
      inscritoRanking: false,
    });
    expect(resultado.auditoria).toHaveLength(0);
  });
});

describe("matrícula", () => {
  it("troca de plano encerra a matrícula anterior na véspera e abre a nova", () => {
    const banco = gravar(bancoDeTeste(), trocarPlano, {
      matriculaId: "mt-x1",
      planoId: "pl-dup",
      valorMensal: 500,
      diaVencimento: 10,
      inicio: "2026-12-01",
    });
    const anterior = banco.matriculas.find((m) => m.id === "mt-x1");
    const nova = banco.matriculas.find((m) => m.alunoId === "x1" && m.id !== "mt-x1");
    expect(anterior?.fim).toBe("2026-11-30");
    expect(nova).toMatchObject({ planoId: "pl-dup", valorMensal: 500, diaVencimento: 10, inicio: "2026-12-01" });
    expect(nova?.fim).toBeUndefined();
    expect(matriculaVigente(banco.matriculas, "x1", "2026-11-30")?.id).toBe("mt-x1");
    expect(matriculaVigente(banco.matriculas, "x1", "2026-12-01")?.id).toBe(nova?.id);
    expect(banco.auditoria.map((r) => `${r.tabela}:${r.acao}`).sort()).toEqual([
      "matriculas:alterar",
      "matriculas:criar",
    ]);
  });

  it("não deixa duas matrículas valerem ao mesmo tempo", () => {
    let banco = bancoDeTeste();
    const nova = { planoId: "pl-lap", valorMensal: 380, diaVencimento: 5 };
    // Ana ja tem matricula sem fim.
    expect(recusa(banco, criarMatricula, { ...nova, alunoId: "x1", inicio: "2026-11-15" })).toMatch(
      /já tem uma matrícula/,
    );
    // Carla nao tem: a primeira entra, a segunda e recusada.
    banco = gravar(banco, criarMatricula, { ...nova, alunoId: "x3", inicio: "2026-11-10" });
    expect(recusa(banco, criarMatricula, { ...nova, alunoId: "x3", inicio: "2027-01-01" })).toMatch(
      /já tem uma matrícula/,
    );
    // Depois de encerrar, so pode comecar outra depois do ultimo dia.
    banco = gravar(banco, encerrarMatricula, { matriculaId: "mt-x1", ultimoDia: "2026-11-30" });
    expect(recusa(banco, criarMatricula, { ...nova, alunoId: "x1", inicio: "2026-11-20" })).toMatch(
      /de 01\/01\/2026 a 30\/11\/2026/,
    );
    banco = gravar(banco, criarMatricula, { ...nova, alunoId: "x1", inicio: "2026-12-01" });
    // A troca tambem nao pode comecar antes (ou no mesmo dia) da matricula atual.
    expect(
      recusa(banco, trocarPlano, { ...nova, matriculaId: "mt-x2", inicio: "2026-01-01" }),
    ).toMatch(/precisa começar depois/);
  });

  it("recusa plano inexistente, valor zerado e vencimento fora de 1 a 28", () => {
    const banco = bancoDeTeste();
    const base = { alunoId: "x3", planoId: "pl-lap", valorMensal: 380, diaVencimento: 5, inicio: "2026-11-10" };
    expect(recusa(banco, criarMatricula, { ...base, planoId: "nao-existe" })).toBe("Escolha o plano.");
    expect(recusa(banco, criarMatricula, { ...base, valorMensal: 0 })).toMatch(/maior que zero/);
    expect(recusa(banco, criarMatricula, { ...base, diaVencimento: 31 })).toMatch(/1 a 28/);
    expect(recusa(banco, criarMatricula, { ...base, inicio: "2062-11-10" })).toMatch(/um ano/);
  });

  it("corrige valor e vencimento sem mexer no período", () => {
    const banco = gravar(bancoDeTeste(), corrigirMatricula, {
      matriculaId: "mt-x1",
      valorMensal: 650,
      diaVencimento: 12,
    });
    expect(banco.matriculas[0]).toMatchObject({ valorMensal: 650, diaVencimento: 12, inicio: "2026-01-01" });
  });

  it("cancelar uma troca agendada devolve o plano anterior", () => {
    let banco = gravar(bancoDeTeste(), trocarPlano, {
      matriculaId: "mt-x1",
      planoId: "pl-lap",
      valorMensal: 380,
      diaVencimento: 5,
      inicio: "2026-12-01",
    });
    const agendada = banco.matriculas.find((m) => m.alunoId === "x1" && m.id !== "mt-x1")!;
    banco = gravar(banco, cancelarMatriculaAgendada, { matriculaId: agendada.id });
    expect(banco.matriculas.filter((m) => m.alunoId === "x1")).toHaveLength(1);
    expect(banco.matriculas[0].fim).toBeUndefined();
    // Matricula que ja comecou nao e "agendada".
    expect(recusa(banco, cancelarMatriculaAgendada, { matriculaId: "mt-x1" })).toMatch(/já começou/);
  });
});

describe("congelamento (H4)", () => {
  const congelar = { alunoId: "x1", inicio: "2026-11-12", fimPrevisto: "2026-11-30", motivo: "Viagem" };

  it("suspende as aulas fixas do período sem gerar crédito", () => {
    const antes = bancoDeTeste();
    const banco = gravar(antes, congelarPlano, congelar);

    // Aula individual (so dela) no periodo: cancelada com o motivo do congelamento.
    ["2026-11-17", "2026-11-24"].forEach((data) => {
      expect(ocupacao(banco, `oc-hf-ind-${data}`)).toMatchObject({
        situacao: "cancelada",
        motivoCancelamento: MOTIVO_CONGELAMENTO,
      });
    });
    // Aula em dupla no periodo: a aula continua, so a Ana sai.
    ["2026-11-12", "2026-11-19", "2026-11-26"].forEach((data) => {
      expect(ocupacao(banco, `oc-hf-dup-${data}`).situacao).toBe("agendada");
      expect(participantes(banco, `oc-hf-dup-${data}`)).toEqual(["x2"]);
    });
    // Fora do periodo nada muda; a reposicao avulsa tambem nao.
    expect(ocupacao(banco, "oc-hf-ind-2026-11-10").situacao).toBe("agendada");
    expect(ocupacao(banco, "oc-hf-ind-2026-12-01").situacao).toBe("agendada");
    expect(participantes(banco, "oc-hf-dup-2026-12-03")).toEqual(["x1", "x2"]);
    expect(participantes(banco, "oc-rep")).toEqual(["x1"]);
    // Sem credito de reposicao.
    expect(banco.reposicoes).toHaveLength(0);

    const congelamento = banco.congelamentos[0];
    expect(congelamento).toMatchObject({ matriculaId: "mt-x1", motivo: "Viagem", fimPrevisto: "2026-11-30" });
    expect(congelamento.aulasSuspensas).toHaveLength(5);
    expect(situacaoDoAluno(banco, banco.alunos[0], "2026-11-15")).toBe("congelado");
    expect(situacaoDoAluno(banco, banco.alunos[0], "2026-11-11")).toBe("ativo");
  });

  it("reativar devolve as aulas suspensas da data de volta em diante", () => {
    let banco = gravar(bancoDeTeste(), congelarPlano, congelar);
    const id = banco.congelamentos[0].id;
    banco = gravar(banco, reativarPlano, { congelamentoId: id, dataVolta: "2026-11-20" }, ctx("2026-11-15"));

    // Da volta em diante: a individual reagendada e a Ana de volta na dupla.
    expect(ocupacao(banco, "oc-hf-ind-2026-11-24").situacao).toBe("agendada");
    expect(ocupacao(banco, "oc-hf-ind-2026-11-24").motivoCancelamento).toBeUndefined();
    expect(participantes(banco, "oc-hf-dup-2026-11-26")).toEqual(["x1", "x2"]);
    // Antes da volta continuam suspensas.
    expect(ocupacao(banco, "oc-hf-ind-2026-11-17").situacao).toBe("cancelada");
    expect(participantes(banco, "oc-hf-dup-2026-11-19")).toEqual(["x2"]);

    const congelamento = banco.congelamentos[0];
    expect(congelamento.fimReal).toBe("2026-11-19");
    // O congelamento guarda o que suspendeu; o que continua suspenso sai do estado das aulas.
    expect(congelamento.aulasSuspensas).toHaveLength(5);
    expect(aulasAindaSuspensas(banco, congelamento, "x1").map((a) => a.ocupacaoId).sort()).toEqual([
      "oc-hf-dup-2026-11-12",
      "oc-hf-dup-2026-11-19",
      "oc-hf-ind-2026-11-17",
    ]);
    expect(situacaoDoAluno(banco, banco.alunos[0], "2026-11-20")).toBe("ativo");
    expect(recusa(banco, reativarPlano, { congelamentoId: id, dataVolta: "2026-11-20" })).toMatch(
      /já foi encerrado/,
    );
  });

  it("a aula cuja quadra foi ocupada no meio-tempo não volta", () => {
    let banco = gravar(bancoDeTeste(), congelarPlano, congelar);
    // Enquanto a aula de 24/11 estava cancelada, a quadra foi alugada.
    banco = {
      ...banco,
      ocupacoes: [
        ...banco.ocupacoes,
        { ...ocupacao(banco, "oc-hf-ind-2026-11-24"), id: "oc-av", tipo: "Locação Avulsa", horarioFixoId: undefined, professorId: undefined, situacao: "agendada", motivoCancelamento: undefined },
      ],
    };
    banco = gravar(banco, reativarPlano, { congelamentoId: banco.congelamentos[0].id, dataVolta: "2026-11-12" });
    expect(ocupacao(banco, "oc-hf-ind-2026-11-24").situacao).toBe("cancelada");
    expect(ocupacao(banco, "oc-hf-ind-2026-11-17").situacao).toBe("agendada");
    expect(aulasAindaSuspensas(banco, banco.congelamentos[0], "x1")).toEqual([
      { ocupacaoId: "oc-hf-ind-2026-11-24", acao: "cancelada" },
    ]);
  });

  it("voltar antes do início cancela o congelamento agendado e devolve tudo", () => {
    let banco = gravar(bancoDeTeste(), congelarPlano, congelar);
    banco = gravar(banco, reativarPlano, { congelamentoId: banco.congelamentos[0].id, dataVolta: HOJE_TESTE });
    expect(banco.congelamentos[0].fimReal).toBe("2026-11-11");
    expect(aulasAindaSuspensas(banco, banco.congelamentos[0], "x1")).toEqual([]);
    expect(ocupacao(banco, "oc-hf-ind-2026-11-17").situacao).toBe("agendada");
    expect(participantes(banco, "oc-hf-dup-2026-11-12")).toEqual(["x1", "x2"]);
    // Anulado, ele nao impede um congelamento novo no mesmo periodo.
    banco = gravar(banco, congelarPlano, congelar);
    expect(banco.congelamentos).toHaveLength(2);
  });

  it("recusa congelamento sem matrícula, sem motivo, com datas trocadas ou sobreposto", () => {
    let banco = bancoDeTeste();
    expect(recusa(banco, congelarPlano, { ...congelar, alunoId: "x3" })).toMatch(/não tem matrícula/);
    expect(recusa(banco, congelarPlano, { ...congelar, motivo: "  " })).toBe("Informe o motivo do congelamento.");
    expect(recusa(banco, congelarPlano, { ...congelar, fimPrevisto: "2026-11-01" })).toMatch(/fim previsto/);
    banco = gravar(banco, congelarPlano, congelar);
    expect(
      recusa(banco, congelarPlano, { ...congelar, inicio: "2026-12-10", fimPrevisto: "2026-12-20" }),
    ).toMatch(/sem volta registrada/);
    // Congelado, nao troca de plano.
    expect(
      recusa(banco, trocarPlano, { matriculaId: "mt-x1", planoId: "pl-lap", valorMensal: 380, diaVencimento: 5, inicio: "2026-11-20" }),
    ).toMatch(/congelado/);
  });

  it("encerrar a matrícula fecha o congelamento em curso", () => {
    let banco = gravar(bancoDeTeste(), congelarPlano, congelar);
    banco = gravar(banco, encerrarMatricula, { matriculaId: "mt-x1", ultimoDia: "2026-11-20" }, ctx("2026-11-15"));
    expect(banco.congelamentos[0].fimReal).toBe("2026-11-20");
    expect(banco.matriculas[0].fim).toBe("2026-11-20");
  });
});

describe("inativação", () => {
  it("encerra a matrícula, fecha o congelamento e tira o aluno das aulas fixas futuras", () => {
    let banco = gravar(bancoDeTeste(), congelarPlano, {
      alunoId: "x1",
      inicio: "2026-12-01",
      fimPrevisto: "2026-12-20",
      motivo: "Férias",
    });
    banco = gravar(banco, inativarAluno, { alunoId: "x1", ultimoDia: HOJE_TESTE, motivo: "Mudou de cidade" });

    const ana = banco.alunos[0];
    expect(ana.ativo).toBe(false);
    expect(situacaoDoAluno(banco, ana, HOJE_TESTE)).toBe("inativo");
    expect(banco.matriculas.find((m) => m.id === "mt-x1")?.fim).toBe(HOJE_TESTE);
    // O congelamento marcado para depois da saida fica anulado.
    expect(banco.congelamentos[0].fimReal).toBe("2026-11-30");

    // Hoje e o ultimo dia: a aula de hoje fica; as seguintes saem.
    expect(ocupacao(banco, "oc-hf-ind-2026-11-10").situacao).toBe("agendada");
    expect(ocupacao(banco, "oc-hf-ind-2026-11-17")).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: MOTIVO_INATIVACAO,
    });
    expect(participantes(banco, "oc-hf-dup-2026-11-12")).toEqual(["x2"]);
    // Horario so dela termina; na dupla ela sai e o Bruno continua.
    expect(banco.horariosFixos.find((h) => h.id === "hf-ind")?.fim).toBe(HOJE_TESTE);
    expect(banco.horarioAlunos.map((ha) => ha.id).sort()).toEqual(["ha-dup-x2", "ha-ind-x1"]);
    // Sem credito, e o motivo vira comentario na ficha.
    expect(banco.reposicoes).toHaveLength(0);
    expect(banco.comentarios.at(-1)).toMatchObject({ entidadeId: "x1", texto: "Aluno inativado. Motivo: Mudou de cidade" });

    expect(recusa(banco, inativarAluno, { alunoId: "x1", ultimoDia: HOJE_TESTE })).toMatch(/já está inativo/);
    expect(
      recusa(banco, criarMatricula, { alunoId: "x1", planoId: "pl-ind", valorMensal: 720, diaVencimento: 5, inicio: "2026-12-01" }),
    ).toMatch(/inativo/);

    banco = gravar(banco, reativarCadastro, { alunoId: "x1" });
    expect(situacaoDoAluno(banco, banco.alunos[0], "2026-11-20")).toBe("avulso");
  });

  it("apaga a matrícula que ainda não tinha começado e recusa último dia no futuro", () => {
    let banco = gravar(bancoDeTeste(), trocarPlano, {
      matriculaId: "mt-x1",
      planoId: "pl-lap",
      valorMensal: 380,
      diaVencimento: 5,
      inicio: "2026-12-01",
    });
    expect(recusa(banco, inativarAluno, { alunoId: "x1", ultimoDia: "2026-11-11" })).toMatch(/depois de hoje/);
    banco = gravar(banco, inativarAluno, { alunoId: "x1", ultimoDia: HOJE_TESTE });
    expect(banco.matriculas.filter((m) => m.alunoId === "x1")).toEqual([
      expect.objectContaining({ id: "mt-x1", fim: HOJE_TESTE }),
    ]);
  });
});

describe("professores", () => {
  const prof1 = SEMENTE.professores[0];
  const dados = {
    id: prof1.id,
    nome: prof1.nome,
    cor: prof1.cor,
    especialidade: prof1.especialidade,
    telefone: prof1.telefone,
    email: prof1.email,
    repasse: prof1.repasse,
  };

  it("recusa regra de repasse inválida (valor negativo, percentual acima de 100)", () => {
    const banco = bancoDeTeste();
    const dono = ctx(HOJE_TESTE, DONO);
    expect(
      recusa(banco, editarProfessor, { ...dados, repasse: { modo: "por_hora", valor: -10 } }, dono),
    ).toBe("O valor do repasse não pode ser negativo.");
    expect(
      recusa(banco, editarProfessor, { ...dados, repasse: { modo: "percentual", valor: 120 } }, dono),
    ).toBe("O percentual do repasse vai de 0 a 100.");
    expect(
      recusa(banco, editarProfessor, { ...dados, repasse: { modo: "por_hora", valor: Number.NaN } }, dono),
    ).toMatch(/hora-aula/);

    const novo = gravar(banco, editarProfessor, { ...dados, repasse: { modo: "percentual", valor: 35 } }, dono);
    expect(novo.professores[0].repasse).toEqual({ modo: "percentual", valor: 35 });
  });

  it("recepção corrige o contato, mas só o dono mexe no repasse e cadastra professor (H9)", () => {
    const banco = bancoDeTeste();
    const comTelefoneNovo = gravar(banco, editarProfessor, { ...dados, telefone: "11 97777-1234" });
    expect(comTelefoneNovo.professores[0].telefone).toBe("(11) 97777-1234");
    expect(
      recusa(banco, editarProfessor, { ...dados, repasse: { modo: "por_hora", valor: 90 } }),
    ).toMatch(/Só o dono/);

    const novo = { nome: "Paula Teste", cor: "#123abc", repasse: { modo: "por_hora" as const, valor: 70 } };
    expect(recusa(banco, cadastrarProfessor, novo)).toMatch(/Só o dono/);
    const comNovo = gravar(banco, cadastrarProfessor, { ...novo, id: "prof-9" }, ctx(HOJE_TESTE, DONO));
    expect(comNovo.professores.at(-1)).toMatchObject({ id: "prof-9", cor: "#123ABC", ativo: true });
    expect(
      recusa(comNovo, cadastrarProfessor, { ...novo, nome: "paula  teste" }, ctx(HOJE_TESTE, DONO)),
    ).toMatch(/Já existe um professor/);
    expect(
      recusa(banco, cadastrarProfessor, { ...novo, cor: "vermelho" }, ctx(HOJE_TESTE, DONO)),
    ).toMatch(/cor/);
  });
});
