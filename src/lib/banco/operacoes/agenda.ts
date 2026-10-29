/**
 * Operacoes da agenda.
 *
 * Novo horario (fixo, avulso ou de reposicao), presenca e falta, cancelar,
 * remarcar, incluir e remover alunos, usar reposicao, encerrar horario fixo,
 * bloquear quadra, cancelar por chuva e liberar reservas sem pagamento.
 *
 * Como todas as operacoes: funcoes puras (copias, nunca alteracao no lugar)
 * e "tudo ou nada" — uma regra violada recusa a operacao inteira, com a
 * mensagem pronta para a tela, e nada e gravado. A auditoria e automatica.
 *
 * Quando o Supabase entrar, cada operacao vira uma funcao do Postgres (rpc)
 * e o conflito de quadra vira a "exclusion constraint" da tabela `ocupacoes`
 * (ver docs/modulos/agenda.md).
 */

import { diaDaSemana, formatarData, formatarDiaMes } from "../../date";
import { definirOperacao, type ContextoOperacao } from "../executar";
import {
  MOTIVO_SEM_PAGAMENTO,
  SIGLA_BLOQUEIO,
  SIGLA_CHUVA,
  TIPOS_COM_PROFESSOR,
  TIPOS_DE_HORARIO_FIXO,
  aulasDepoisDoFim,
  aulasNoPeriodo,
  bloqueiosNoPeriodo,
  datasDaRecorrencia,
  descreverCarimbo,
  descreverOcupacao,
  duracaoEmMinutos,
  garantirDataFutura,
  garantirDataValida,
  garantirHorarioValido,
  garantirPodeEditarAgenda,
  garantirProfessorLivre,
  garantirQuadraLivre,
  horizonteDaAgenda,
  periodoDaChuva,
  prazoDaReserva,
  reservaVencida,
  rotuloDaQuadra,
  type PeriodoNasQuadras,
} from "../regras/agenda";
import { ErroDeRegra, exigir, novoId } from "../regras/comum";
import { precoDaLocacao } from "../regras/financeiro";
import {
  TIPOS_COM_DIREITO_A_REPOSICAO,
  buscarSigla,
  creditosPorAulaPerdida,
  efeitoDoCancelamento,
  garantirExtratoCoerente,
  garantirSaldoSuficiente,
} from "../regras/reposicao";
import type {
  Aluno,
  Banco,
  HorarioFixo,
  Lancamento,
  LancamentoReposicao,
  Ocupacao,
  OcupacaoAluno,
  Presenca,
  QuadraId,
  TipoOcupacao,
} from "../tipos";

// ---------------------------------------------------------------------------
// Pecas internas
// ---------------------------------------------------------------------------

/**
 * Como `lista.map`, mas devolve a propria lista quando nada mudou. Assim uma
 * tabela que a operacao nao tocou continua sendo o mesmo objeto, e as telas
 * nao recalculam o que depende dela.
 */
function atualizar<T>(lista: T[], mudar: (item: T) => T): T[] {
  let mudou = false;
  const nova = lista.map((item) => {
    const novo = mudar(item);
    if (novo !== item) mudou = true;
    return novo;
  });
  return mudou ? nova : lista;
}

function buscarOcupacao(banco: Banco, id: string): Ocupacao {
  const ocupacao = banco.ocupacoes.find((o) => o.id === id);
  exigir(ocupacao, "Horário não encontrado na agenda.");
  return ocupacao;
}

function garantirQuadra(banco: Banco, quadraId: QuadraId): void {
  exigir(banco.quadras.some((q) => q.id === quadraId), "Quadra não encontrada.");
}

/** Alunos de um agendamento: pelo menos um, sem repetir, todos ativos na arena. */
function validarAlunos(banco: Banco, alunosIds: string[]): string[] {
  const unicos = [...new Set(alunosIds)];
  exigir(unicos.length > 0, "Escolha pelo menos um aluno.");
  unicos.forEach((id) => {
    const aluno = banco.alunos.find((a) => a.id === id);
    exigir(aluno, "Aluno não encontrado.");
    exigir(aluno.ativo, `${aluno.nome} não está mais ativo na arena.`);
  });
  return unicos;
}

/** Aulas (Individual, Dupla, LAP) exigem professor; locacoes e ranking nao tem. */
function validarProfessor(
  banco: Banco,
  tipo: TipoOcupacao,
  professorId: string | undefined,
): string | undefined {
  if (!TIPOS_COM_PROFESSOR.includes(tipo)) return undefined;
  exigir(professorId, "Escolha o professor da aula.");
  const professor = banco.professores.find((p) => p.id === professorId);
  exigir(professor?.ativo, "Professor não encontrado.");
  return professorId;
}

function participacoes(ocupacaoId: string, alunosIds: string[]): OcupacaoAluno[] {
  return alunosIds.map((alunoId) => ({
    id: novoId("pa"),
    ocupacaoId,
    alunoId,
    presenca: "a_marcar",
  }));
}

function jaParticipa(banco: Banco, ocupacaoId: string, alunoId: string): boolean {
  return banco.ocupacaoAlunos.some((p) => p.ocupacaoId === ocupacaoId && p.alunoId === alunoId);
}

/** Uso de reposicao: lancamento negativo ligado a aula onde os minutos foram usados. */
function usoDeReposicao(
  alunoId: string,
  minutos: number,
  ocupacaoId: string,
  agora: string,
): LancamentoReposicao {
  return { id: novoId("rp"), alunoId, minutos: -minutos, ocupacaoUsoId: ocupacaoId, criadoEm: agora };
}

/** "Locação avulsa · Quadra 2 · 10/11 19:00" (mesmo texto dos dados de exemplo). */
function itemDaLocacao(ocupacao: Ocupacao): string {
  return `Locação avulsa · ${rotuloDaQuadra(ocupacao.quadraId)} · ${formatarDiaMes(ocupacao.data)} ${ocupacao.horaInicio}`;
}

/** Cobranca a receber de uma locacao avulsa: vence junto com o prazo da reserva. */
function cobrancaDaLocacao(
  banco: Banco,
  ocupacao: Ocupacao,
  titular: Aluno,
  agora: string,
): Lancamento {
  return {
    id: novoId("lc"),
    tipo: "receber",
    categoria: "Locação",
    pessoaId: titular.id,
    pessoaTipo: "aluno",
    nomePagante: titular.nome,
    item: itemDaLocacao(ocupacao),
    valor: precoDaLocacao(banco.configuracoes, ocupacao),
    vencimento: (ocupacao.prazoPagamento ?? `${ocupacao.data}T`).slice(0, 10),
    ocupacaoId: ocupacao.id,
    criadoEm: agora,
  };
}

/** Anula (lancamentos nunca se apagam) as cobrancas ainda nao pagas das ocupacoes. */
function anularCobrancas(
  lancamentos: Lancamento[],
  ocupacoesIds: Set<string>,
  motivo: string,
  agora: string,
): Lancamento[] {
  return atualizar(lancamentos, (l) =>
    l.ocupacaoId && ocupacoesIds.has(l.ocupacaoId) && !l.pagoEm && !l.canceladoEm
      ? { ...l, canceladoEm: agora, motivoCancelamento: motivo }
      : l,
  );
}

/**
 * Cancela varias ocupacoes de uma vez com o mesmo motivo (sigla ou texto):
 *  - situacao "cancelada", com o motivo e a data do cancelamento;
 *  - as presencas voltam para "a marcar", menos as faltas avisadas (que ja
 *    geraram o credito delas);
 *  - credito de reposicao para quem tem direito (regra em `efeitoDoCancelamento`);
 *  - a cobranca ainda nao paga de uma reserva e anulada.
 */
function cancelarNoBanco(
  banco: Banco,
  ids: string[],
  motivo: string,
  ctx: ContextoOperacao,
): Banco {
  const alvo = new Set(ids);
  const creditos = banco.ocupacoes
    .filter((o) => alvo.has(o.id))
    .flatMap((o) => efeitoDoCancelamento(banco, o, motivo, ctx.agora).creditos);

  return {
    ...banco,
    ocupacoes: atualizar(banco.ocupacoes, (o) =>
      alvo.has(o.id)
        ? { ...o, situacao: "cancelada", motivoCancelamento: motivo, canceladaEm: ctx.agora }
        : o,
    ),
    ocupacaoAlunos: atualizar(banco.ocupacaoAlunos, (p) =>
      alvo.has(p.ocupacaoId) && p.presenca !== "falta_avisada" && p.presenca !== "a_marcar"
        ? { ...p, presenca: "a_marcar", sigla: undefined }
        : p,
    ),
    reposicoes: creditos.length > 0 ? [...banco.reposicoes, ...creditos] : banco.reposicoes,
    lancamentos: anularCobrancas(
      banco.lancamentos,
      alvo,
      `Reserva cancelada na agenda: ${motivo}.`,
      ctx.agora,
    ),
  };
}

/**
 * Tira ocupacoes futuras da agenda (encerramento de horario fixo): saem os
 * participantes, os minutos de reposicao usados nelas voltam para o aluno e
 * os creditos que elas geraram deixam de existir. Recusa se um desses
 * creditos ja tiver sido usado (o saldo do aluno ficaria negativo).
 */
function removerOcupacoes(
  banco: Banco,
  ids: string[],
  motivo: string,
  ctx: ContextoOperacao,
): Banco {
  if (ids.length === 0) return banco;
  const alvo = new Set(ids);
  const ligadoAsAulas = (r: LancamentoReposicao) =>
    Boolean(
      (r.ocupacaoUsoId && alvo.has(r.ocupacaoUsoId)) ||
        (r.minutos > 0 && r.ocupacaoOrigemId && alvo.has(r.ocupacaoOrigemId)),
    );
  const ligados = banco.reposicoes.filter(ligadoAsAulas);
  const reposicoes =
    ligados.length > 0 ? banco.reposicoes.filter((r) => !ligadoAsAulas(r)) : banco.reposicoes;
  garantirExtratoCoerente(
    reposicoes,
    [...new Set(ligados.map((r) => r.alunoId))],
    "Um crédito de reposição gerado por uma dessas aulas já foi usado. Escolha uma data de encerramento depois dela.",
  );

  return {
    ...banco,
    ocupacoes: banco.ocupacoes.filter((o) => !alvo.has(o.id)),
    ocupacaoAlunos: banco.ocupacaoAlunos.filter((p) => !alvo.has(p.ocupacaoId)),
    reposicoes,
    lancamentos: anularCobrancas(banco.lancamentos, alvo, motivo, ctx.agora),
  };
}

// ---------------------------------------------------------------------------
// Novo horario
// ---------------------------------------------------------------------------

export interface DadosHorarioAvulso {
  quadraId: QuadraId;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: TipoOcupacao;
  professorId?: string;
  /** O primeiro aluno e o titular: e quem paga a locacao avulsa. */
  alunosIds: string[];
  descricao?: string;
}

/**
 * Agendamento de uma data so (aula avulsa, locacao avulsa, ranking).
 * Locacao avulsa nasce "aguardando pagamento", com prazo (Hipotese H5) e a
 * cobranca a receber no financeiro, ligada a ocupacao.
 */
export const criarHorarioAvulso = definirOperacao(
  "Criar horário avulso",
  (banco, dados: DadosHorarioAvulso, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    garantirQuadra(banco, dados.quadraId);
    garantirDataFutura(dados.data, ctx.hoje);
    garantirHorarioValido(dados.horaInicio, dados.horaFim);
    exigir(dados.tipo !== "Bloqueio", "Para fechar a quadra, use “Bloquear quadra”.");
    const professorId = validarProfessor(banco, dados.tipo, dados.professorId);
    const alunosIds = validarAlunos(banco, dados.alunosIds);

    const alvo = {
      quadraId: dados.quadraId,
      data: dados.data,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
    };
    garantirQuadraLivre(banco, alvo);
    garantirProfessorLivre(banco, { ...alvo, professorId });

    const locacao = dados.tipo === "Locação Avulsa";
    const ocupacao: Ocupacao = {
      id: novoId("oc"),
      ...alvo,
      tipo: dados.tipo,
      professorId,
      situacao: locacao ? "aguardando_pagamento" : "agendada",
      prazoPagamento: locacao ? prazoDaReserva(banco.configuracoes, ctx.agora, alvo) : undefined,
      descricao: dados.descricao?.trim() || undefined,
      criadoEm: ctx.agora,
    };

    const titular = banco.alunos.find((a) => a.id === alunosIds[0]);
    return {
      ...banco,
      ocupacoes: [...banco.ocupacoes, ocupacao],
      ocupacaoAlunos: [...banco.ocupacaoAlunos, ...participacoes(ocupacao.id, alunosIds)],
      lancamentos:
        locacao && titular
          ? [...banco.lancamentos, cobrancaDaLocacao(banco, ocupacao, titular, ctx.agora)]
          : banco.lancamentos,
    };
  },
);

export interface DadosHorarioFixo {
  quadraId: QuadraId;
  /** Data da primeira aula: define o dia da semana. */
  dataInicio: string;
  /** Ultima data do horario (vazio = sem fim). */
  fim?: string;
  horaInicio: string;
  horaFim: string;
  tipo: TipoOcupacao;
  professorId?: string;
  alunosIds: string[];
  /** Datas que a pessoa decidiu pular (ficam sem aula) — em geral, as que batem com outra ocupacao. */
  datasPuladas?: string[];
}

/**
 * Horario que se repete toda semana: grava o molde (`horariosFixos`), os
 * alunos dele (`horarioAlunos`) e uma ocupacao por data, ate o horizonte da
 * agenda (Hipotese H12). Datas em conflito precisam ter sido puladas.
 */
export const criarHorarioFixo = definirOperacao(
  "Criar horário fixo",
  (banco, dados: DadosHorarioFixo, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    garantirQuadra(banco, dados.quadraId);
    garantirDataFutura(dados.dataInicio, ctx.hoje);
    if (dados.fim) {
      garantirDataValida(dados.fim);
      exigir(dados.fim >= dados.dataInicio, "A data final precisa ser depois da primeira aula.");
    }
    garantirHorarioValido(dados.horaInicio, dados.horaFim);
    exigir(
      TIPOS_DE_HORARIO_FIXO.includes(dados.tipo),
      "Horário fixo é para aulas e locações mensais. Locação avulsa e ranking são marcados como avulso.",
    );
    const professorId = validarProfessor(banco, dados.tipo, dados.professorId);
    const alunosIds = validarAlunos(banco, dados.alunosIds);

    const molde: HorarioFixo = {
      id: novoId("hf"),
      quadraId: dados.quadraId,
      diaSemana: diaDaSemana(dados.dataInicio),
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      tipo: dados.tipo,
      professorId,
      inicio: dados.dataInicio,
      fim: dados.fim || undefined,
    };

    const ate = horizonteDaAgenda(banco.configuracoes, ctx.hoje);
    const datas = datasDaRecorrencia(banco, molde, ate);
    exigir(
      datas.length > 0,
      `A primeira aula precisa cair até ${formatarData(ate)}: a agenda é criada até ` +
        `${banco.configuracoes.semanasGeradasAFrente} semanas à frente.`,
    );

    const pular = new Set(dados.datasPuladas ?? []);
    const restantes = datas.filter((d) => !pular.has(d.data));
    exigir(restantes.length > 0, "Todas as datas foram puladas: não há aula para criar.");
    const naData = (data: string) => ({
      quadraId: molde.quadraId,
      data,
      horaInicio: molde.horaInicio,
      horaFim: molde.horaFim,
    });
    // A mesma regra de sempre, data a data: a primeira em conflito recusa tudo.
    restantes.forEach(({ data }) => {
      garantirQuadraLivre(banco, naData(data));
      garantirProfessorLivre(banco, { ...naData(data), professorId });
    });

    const ocupacoes: Ocupacao[] = restantes.map(({ data }) => ({
      id: novoId("oc"),
      ...naData(data),
      tipo: molde.tipo,
      professorId,
      horarioFixoId: molde.id,
      situacao: "agendada",
      criadoEm: ctx.agora,
    }));

    return {
      ...banco,
      horariosFixos: [...banco.horariosFixos, molde],
      horarioAlunos: [
        ...banco.horarioAlunos,
        ...alunosIds.map((alunoId) => ({ id: novoId("ha"), horarioFixoId: molde.id, alunoId })),
      ],
      ocupacoes: [...banco.ocupacoes, ...ocupacoes],
      ocupacaoAlunos: [
        ...banco.ocupacaoAlunos,
        ...ocupacoes.flatMap((o) => participacoes(o.id, alunosIds)),
      ],
    };
  },
);

export interface DadosAulaDeReposicao {
  alunoId: string;
  quadraId: QuadraId;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: TipoOcupacao;
  professorId?: string;
}

/** Aula nova paga com os minutos de reposicao do aluno (recusa se o saldo nao bastar). */
export const marcarAulaDeReposicao = definirOperacao(
  "Marcar aula de reposição",
  (banco, dados: DadosAulaDeReposicao, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    garantirQuadra(banco, dados.quadraId);
    garantirDataFutura(dados.data, ctx.hoje);
    garantirHorarioValido(dados.horaInicio, dados.horaFim);
    exigir(
      TIPOS_COM_DIREITO_A_REPOSICAO.includes(dados.tipo),
      "A reposição é para aulas e locações do plano.",
    );
    const professorId = validarProfessor(banco, dados.tipo, dados.professorId);
    const [alunoId] = validarAlunos(banco, [dados.alunoId]);
    const alvo = {
      quadraId: dados.quadraId,
      data: dados.data,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
    };
    const minutos = duracaoEmMinutos(alvo);
    garantirSaldoSuficiente(banco, alunoId, minutos, ctx.hoje);
    garantirQuadraLivre(banco, alvo);
    garantirProfessorLivre(banco, { ...alvo, professorId });

    const ocupacao: Ocupacao = {
      id: novoId("oc"),
      ...alvo,
      tipo: dados.tipo,
      professorId,
      situacao: "agendada",
      descricao: "Reposição",
      criadoEm: ctx.agora,
    };
    return {
      ...banco,
      ocupacoes: [...banco.ocupacoes, ocupacao],
      ocupacaoAlunos: [...banco.ocupacaoAlunos, ...participacoes(ocupacao.id, [alunoId])],
      reposicoes: [...banco.reposicoes, usoDeReposicao(alunoId, minutos, ocupacao.id, ctx.agora)],
    };
  },
);

// ---------------------------------------------------------------------------
// Alunos da aula e presenca
// ---------------------------------------------------------------------------

export interface DadosAlunoNaAula {
  ocupacaoId: string;
  alunoId: string;
}

export const incluirAluno = definirOperacao(
  "Incluir aluno na aula",
  (banco, dados: DadosAlunoNaAula, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.ocupacaoId);
    exigir(ocupacao.situacao !== "cancelada", "Esta aula está cancelada.");
    exigir(ocupacao.tipo !== "Bloqueio", "Bloqueio de quadra não tem alunos.");
    const [alunoId] = validarAlunos(banco, [dados.alunoId]);
    exigir(!jaParticipa(banco, ocupacao.id, alunoId), "Este aluno já está na aula.");
    return {
      ...banco,
      ocupacaoAlunos: [...banco.ocupacaoAlunos, ...participacoes(ocupacao.id, [alunoId])],
    };
  },
);

/**
 * Inclui o aluno numa aula que ja existe pagando com minutos de reposicao:
 * grava o uso (lancamento negativo ligado a aula) depois de conferir o saldo.
 */
export const usarReposicao = definirOperacao(
  "Usar reposição",
  (banco, dados: DadosAlunoNaAula, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.ocupacaoId);
    exigir(ocupacao.situacao !== "cancelada", "Esta aula está cancelada.");
    exigir(
      TIPOS_COM_DIREITO_A_REPOSICAO.includes(ocupacao.tipo),
      "A reposição só pode ser usada em aulas e locações do plano.",
    );
    exigir(ocupacao.data >= ctx.hoje, "A reposição precisa ser marcada numa aula de hoje em diante.");
    const [alunoId] = validarAlunos(banco, [dados.alunoId]);
    exigir(!jaParticipa(banco, ocupacao.id, alunoId), "Este aluno já está na aula.");
    const minutos = duracaoEmMinutos(ocupacao);
    garantirSaldoSuficiente(banco, alunoId, minutos, ctx.hoje);
    return {
      ...banco,
      ocupacaoAlunos: [...banco.ocupacaoAlunos, ...participacoes(ocupacao.id, [alunoId])],
      reposicoes: [...banco.reposicoes, usoDeReposicao(alunoId, minutos, ocupacao.id, ctx.agora)],
    };
  },
);

/** Tira o aluno da aula. Se ele estava ali por reposicao, os minutos voltam para o saldo. */
export const removerAluno = definirOperacao(
  "Remover aluno da aula",
  (banco, dados: DadosAlunoNaAula, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.ocupacaoId);
    exigir(ocupacao.situacao !== "cancelada", "Esta aula está cancelada.");
    const participacao = banco.ocupacaoAlunos.find(
      (p) => p.ocupacaoId === ocupacao.id && p.alunoId === dados.alunoId,
    );
    exigir(participacao, "Este aluno não está na aula.");
    const devolver = (r: LancamentoReposicao) =>
      r.minutos < 0 && r.ocupacaoUsoId === ocupacao.id && r.alunoId === dados.alunoId;
    return {
      ...banco,
      ocupacaoAlunos: banco.ocupacaoAlunos.filter((p) => p !== participacao),
      reposicoes: banco.reposicoes.some(devolver)
        ? banco.reposicoes.filter((r) => !devolver(r))
        : banco.reposicoes,
    };
  },
);

export interface DadosPresenca {
  ocupacaoId: string;
  alunoId: string;
  presenca: Presenca;
  /** Obrigatoria na falta avisada: uma sigla da lista de Configuracoes (Hipotese H1). */
  sigla?: string;
}

/**
 * Presenca, falta ou falta avisada de um aluno.
 *  - Falta avisada pede uma sigla; se ela da direito, o credito e so desse aluno.
 *  - Em aula Individual, a falta avisada cancela a aula (sem o aluno nao ha aula).
 *  - Presenca e falta so no dia da aula ou depois; a aula passa a "realizada".
 *  - Trocar a marcacao retira o credito anterior (recusa se ele ja foi usado).
 */
export const marcarPresenca = definirOperacao(
  "Marcar presença",
  (banco, dados: DadosPresenca, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.ocupacaoId);
    exigir(
      ocupacao.situacao !== "cancelada",
      "Esta aula está cancelada: não dá para marcar presença.",
    );
    const participacao = banco.ocupacaoAlunos.find(
      (p) => p.ocupacaoId === ocupacao.id && p.alunoId === dados.alunoId,
    );
    exigir(participacao, "Este aluno não está na aula.");
    if (dados.presenca === "presente" || dados.presenca === "falta") {
      exigir(
        ocupacao.data <= ctx.hoje,
        "Presença e falta só podem ser marcadas no dia da aula ou depois.",
      );
    }

    let sigla: string | undefined;
    if (dados.presenca === "falta_avisada") {
      sigla = dados.sigla?.trim();
      exigir(sigla, "Escolha a sigla da falta avisada.");
      const regra = buscarSigla(banco.configuracoes, sigla);
      exigir(regra, `A sigla ${sigla} não existe nas Configurações.`);
      exigir(regra.aplicaA !== "ocupacao", `A sigla ${sigla} é para cancelar a aula inteira, não para a falta de um aluno.`);
    }
    if (participacao.presenca === dados.presenca && participacao.sigla === sigla) return banco;

    // Credito desta aula para este aluno: nasce, troca de sigla ou e retirado.
    const creditoAtual = banco.reposicoes.find(
      (r) => r.minutos > 0 && r.ocupacaoOrigemId === ocupacao.id && r.alunoId === dados.alunoId,
    );
    const novoCredito = sigla
      ? creditosPorAulaPerdida(banco.configuracoes, ocupacao, sigla, [dados.alunoId], ctx.agora)[0]
      : undefined;
    let reposicoes = banco.reposicoes;
    if (creditoAtual && novoCredito) {
      reposicoes = atualizar(reposicoes, (r) =>
        r === creditoAtual && r.sigla !== sigla ? { ...r, sigla } : r,
      );
    } else if (creditoAtual) {
      reposicoes = reposicoes.filter((r) => r !== creditoAtual);
      garantirExtratoCoerente(
        reposicoes,
        [dados.alunoId],
        "O crédito desta falta avisada já foi usado numa reposição: não dá para desfazê-lo.",
      );
    } else if (novoCredito) {
      reposicoes = [...reposicoes, novoCredito];
    }

    const novo: Banco = {
      ...banco,
      ocupacaoAlunos: atualizar(banco.ocupacaoAlunos, (p) =>
        p === participacao ? { ...p, presenca: dados.presenca, sigla } : p,
      ),
      reposicoes,
    };

    if (dados.presenca === "falta_avisada" && sigla && ocupacao.tipo === "Individual") {
      return cancelarNoBanco(novo, [ocupacao.id], sigla, ctx);
    }
    if ((dados.presenca === "presente" || dados.presenca === "falta") && ocupacao.situacao === "agendada") {
      return {
        ...novo,
        ocupacoes: atualizar(novo.ocupacoes, (o) =>
          o.id === ocupacao.id ? { ...o, situacao: "realizada" } : o,
        ),
      };
    }
    return novo;
  },
);

// ---------------------------------------------------------------------------
// Cancelar, remarcar, encerrar
// ---------------------------------------------------------------------------

export interface DadosCancelamento {
  id: string;
  /** Sigla das Configuracoes (CH, FP, IAC, TIP...) ou texto livre. */
  motivo: string;
}

/**
 * Cancela uma ocupacao. O motivo e obrigatorio: uma sigla das Configuracoes
 * (gera credito quando da direito, Hipotese H1) ou um texto livre (sem credito).
 */
export const cancelarOcupacao = definirOperacao(
  "Cancelar aula",
  (banco, dados: DadosCancelamento, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.id);
    exigir(ocupacao.situacao !== "cancelada", "Esta aula já está cancelada.");
    const motivo = dados.motivo.trim();
    exigir(motivo, "Informe o motivo do cancelamento.");
    const sigla = buscarSigla(banco.configuracoes, motivo);
    exigir(
      !sigla || sigla.aplicaA !== "aluno",
      `A sigla ${motivo} é para a falta de um aluno: marque “Falta avisada” na lista de alunos.`,
    );
    return cancelarNoBanco(banco, [ocupacao.id], motivo, ctx);
  },
);

export interface DadosRemarcar {
  id: string;
  quadraId: QuadraId;
  data: string;
  horaInicio: string;
  horaFim: string;
}

/**
 * Muda a data, o horario ou a quadra de UMA ocupacao. O horario fixo de
 * origem continua igual nas outras semanas.
 */
export const remarcarOcupacao = definirOperacao(
  "Remarcar aula",
  (banco, dados: DadosRemarcar, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.id);
    exigir(ocupacao.situacao !== "cancelada", "Esta aula está cancelada.");
    exigir(ocupacao.situacao !== "realizada", "Esta aula já aconteceu: não dá para remarcar.");
    garantirQuadra(banco, dados.quadraId);
    garantirDataFutura(dados.data, ctx.hoje);
    garantirHorarioValido(dados.horaInicio, dados.horaFim);
    const alvo = {
      id: ocupacao.id,
      quadraId: dados.quadraId,
      data: dados.data,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
    };
    exigir(
      alvo.quadraId !== ocupacao.quadraId ||
        alvo.data !== ocupacao.data ||
        alvo.horaInicio !== ocupacao.horaInicio ||
        alvo.horaFim !== ocupacao.horaFim,
      "Escolha uma data, um horário ou uma quadra diferente.",
    );
    garantirQuadraLivre(banco, alvo);
    garantirProfessorLivre(banco, { ...alvo, professorId: ocupacao.professorId });

    // O prazo da reserva nunca passa do inicio dela (Hipotese H5).
    const inicio = `${alvo.data}T${alvo.horaInicio}:00`;
    const remarcada: Ocupacao = {
      ...ocupacao,
      ...alvo,
      prazoPagamento:
        ocupacao.prazoPagamento && ocupacao.prazoPagamento > inicio
          ? inicio
          : ocupacao.prazoPagamento,
    };

    return {
      ...banco,
      ocupacoes: atualizar(banco.ocupacoes, (o) => (o.id === ocupacao.id ? remarcada : o)),
      // A cobranca ainda nao paga da locacao acompanha a nova data e duracao.
      lancamentos: atualizar(banco.lancamentos, (l) =>
        l.ocupacaoId === ocupacao.id &&
        ocupacao.tipo === "Locação Avulsa" &&
        !l.pagoEm &&
        !l.canceladoEm
          ? {
              ...l,
              item: itemDaLocacao(remarcada),
              valor: precoDaLocacao(banco.configuracoes, remarcada),
              vencimento: (remarcada.prazoPagamento ?? l.vencimento).slice(0, 10),
            }
          : l,
      ),
    };
  },
);

export interface DadosEncerramento {
  horarioFixoId: string;
  /** Ultima data em que o horario vale. */
  fim: string;
}

/**
 * Encerra um horario fixo: `fim` passa a ser a ultima data do molde e as
 * aulas depois dela que ainda nao aconteceram saem da agenda (a auditoria
 * guarda cada uma). Aulas canceladas e as ja realizadas ficam como historico.
 */
export const encerrarHorarioFixo = definirOperacao(
  "Encerrar horário fixo",
  (banco, dados: DadosEncerramento, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const horario = banco.horariosFixos.find((h) => h.id === dados.horarioFixoId);
    exigir(horario, "Horário fixo não encontrado.");
    garantirDataValida(dados.fim);
    exigir(
      dados.fim >= horario.inicio,
      `Este horário começou em ${formatarData(horario.inicio)}: o encerramento precisa ser depois disso.`,
    );
    if (horario.fim) {
      exigir(dados.fim < horario.fim, `Este horário já termina em ${formatarData(horario.fim)}.`);
    }

    const removidas = aulasDepoisDoFim(banco, horario.id, dados.fim, ctx.hoje).map((o) => o.id);
    const semAsAulas = removerOcupacoes(banco, removidas, "Horário fixo encerrado na agenda.", ctx);
    return {
      ...semAsAulas,
      horariosFixos: atualizar(semAsAulas.horariosFixos, (h) =>
        h.id === horario.id ? { ...h, fim: dados.fim } : h,
      ),
    };
  },
);

// ---------------------------------------------------------------------------
// Bloqueio de quadra e chuva
// ---------------------------------------------------------------------------

export interface DadosBloqueio extends PeriodoNasQuadras {
  descricao: string;
}

/**
 * Fecha uma ou mais quadras num periodo (manutencao, evento, torneio). As
 * aulas do periodo sao canceladas com IAC (interesse da academia), gerando os
 * creditos, e cada quadra ganha uma ocupacao "Bloqueio" — que segue a mesma
 * regra de conflito de qualquer ocupacao.
 */
export const bloquearQuadra = definirOperacao(
  "Bloquear quadra",
  (banco, dados: DadosBloqueio, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const quadrasIds = [...new Set(dados.quadrasIds)];
    exigir(quadrasIds.length > 0, "Escolha pelo menos uma quadra.");
    quadrasIds.forEach((quadraId) => garantirQuadra(banco, quadraId));
    garantirDataFutura(dados.data, ctx.hoje);
    garantirHorarioValido(dados.horaInicio, dados.horaFim);
    const descricao = dados.descricao.trim();
    exigir(descricao, "Descreva o motivo do bloqueio (ex.: manutenção do saibro).");

    const periodo = { ...dados, quadrasIds };
    const jaBloqueada = bloqueiosNoPeriodo(banco, periodo)[0];
    if (jaBloqueada) {
      throw new ErroDeRegra(
        `${rotuloDaQuadra(jaBloqueada.quadraId)} já está bloqueada em ${formatarDiaMes(jaBloqueada.data)} ` +
          `das ${jaBloqueada.horaInicio} às ${jaBloqueada.horaFim} (${descreverOcupacao(banco, jaBloqueada)}).`,
      );
    }

    const afetadas = aulasNoPeriodo(banco, periodo).map((o) => o.id);
    const cancelado = cancelarNoBanco(banco, afetadas, SIGLA_BLOQUEIO, ctx);
    const bloqueios: Ocupacao[] = quadrasIds.map((quadraId) => ({
      id: novoId("oc"),
      quadraId,
      data: dados.data,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      tipo: "Bloqueio",
      situacao: "agendada",
      descricao,
      criadoEm: ctx.agora,
    }));
    // A regra de sempre continua valendo depois dos cancelamentos.
    bloqueios.forEach((bloqueio) => garantirQuadraLivre(cancelado, bloqueio));
    return { ...cancelado, ocupacoes: [...cancelado.ocupacoes, ...bloqueios] };
  },
);

export interface DadosChuva {
  data: string;
  quadrasIds: QuadraId[];
  /** Sem horario = dia inteiro (07:00 as 22:00). */
  horaInicio?: string;
  horaFim?: string;
}

/**
 * Cancela com CH tudo o que estiver ativo nas quadras e no periodo, gerando
 * os creditos de reposicao. Bloqueios ficam como estao.
 */
export const cancelarPorChuva = definirOperacao(
  "Cancelar por chuva",
  (banco, dados: DadosChuva, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const periodo = periodoDaChuva(dados);
    exigir(periodo.quadrasIds.length > 0, "Escolha pelo menos uma quadra.");
    periodo.quadrasIds.forEach((quadraId) => garantirQuadra(banco, quadraId));
    garantirDataValida(periodo.data);
    garantirHorarioValido(periodo.horaInicio, periodo.horaFim);
    const afetadas = aulasNoPeriodo(banco, periodo);
    exigir(afetadas.length > 0, "Não há aulas ativas nessas quadras nesse período.");
    return cancelarNoBanco(banco, afetadas.map((o) => o.id), SIGLA_CHUVA, ctx);
  },
);

// ---------------------------------------------------------------------------
// Reservas sem pagamento (Hipotese H5)
// ---------------------------------------------------------------------------

/**
 * "Liberar horario": cancela a reserva que passou do prazo sem pagamento,
 * com o motivo "Sem pagamento no prazo" (sem credito), e anula a cobranca.
 */
export const liberarReserva = definirOperacao(
  "Liberar reserva sem pagamento",
  (banco, dados: { id: string }, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const ocupacao = buscarOcupacao(banco, dados.id);
    exigir(
      ocupacao.situacao === "aguardando_pagamento",
      "Esta reserva não está aguardando pagamento.",
    );
    exigir(
      reservaVencida(ocupacao, ctx.agora),
      `O prazo desta reserva só vence em ${descreverCarimbo(ocupacao.prazoPagamento ?? "")}.`,
    );
    return cancelarNoBanco(banco, [ocupacao.id], MOTIVO_SEM_PAGAMENTO, ctx);
  },
);

/**
 * Libera de uma vez todas as reservas vencidas. Sem nenhuma vencida, nao faz
 * nada. A agenda chama esta operacao sozinha ao abrir quando a opcao
 * `liberarReservaAutomaticamente` esta ligada (Hipotese H5).
 */
export const liberarReservasVencidas = definirOperacao(
  "Liberar reservas vencidas",
  (banco, _semDados: Record<string, never>, ctx) => {
    garantirPodeEditarAgenda(ctx.usuario);
    const vencidas = banco.ocupacoes.filter((o) => reservaVencida(o, ctx.agora));
    if (vencidas.length === 0) return banco;
    return cancelarNoBanco(banco, vencidas.map((o) => o.id), MOTIVO_SEM_PAGAMENTO, ctx);
  },
);
