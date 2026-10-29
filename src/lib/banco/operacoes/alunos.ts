/**
 * Operacoes do modulo de alunos: cadastro, matricula, congelamento e
 * inativacao. As de professores ficam em `operacoes/professores.ts`.
 *
 * No banco real, cada uma vira uma funcao (rpc) do Postgres: varias mexem em
 * mais de uma tabela de uma vez (congelar grava o congelamento e suspende as
 * aulas; trocar de plano encerra uma matricula e abre outra) e precisam ser
 * tudo ou nada.
 */

import { formatarData, somarDias } from "../../date";
import { definirOperacao } from "../executar";
import {
  MOTIVO_CONGELAMENTO,
  MOTIVO_INATIVACAO,
  aulasDepoisDaSaida,
  aulasParaSuspender,
  congelamentoAnulado,
  dataValida,
  devolverAulas,
  fimRealParaVolta,
  garantirDataProxima,
  garantirPodeAlterarCadastros,
  garantirSemCongelamentoSobreposto,
  garantirSemMatriculaSobreposta,
  limparNome,
  matriculaQueVoltaAValer,
  matriculaVigente,
  previaDaVolta,
  suspenderAulas,
  validarCadastroAluno,
  validarDadosDaMatricula,
  validarValorEVencimento,
  type DadosCadastroAluno,
  type DadosDaMatricula,
} from "../regras/alunos";
import { exigir, novoId } from "../regras/comum";
import type { Aluno, Banco, Congelamento, HorarioFixo, Matricula } from "../tipos";

/** Os dois registros tem os mesmos valores? (nao grava alteracao vazia na auditoria) */
export function semMudanca<T extends object>(atual: T, novo: T): boolean {
  const campos = new Set([...Object.keys(atual), ...Object.keys(novo)]) as Set<keyof T>;
  return [...campos].every((campo) => JSON.stringify(atual[campo]) === JSON.stringify(novo[campo]));
}

function buscarAlunoAtivo(banco: Banco, alunoId: string): Aluno {
  const aluno = banco.alunos.find((a) => a.id === alunoId);
  exigir(aluno, "Aluno não encontrado.");
  exigir(aluno.ativo, `${aluno.nome} está inativo. Reative o cadastro antes.`);
  return aluno;
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

/** `id` opcional: a tela pode gerar o id antes, para abrir a ficha nova em seguida. */
export const cadastrarAluno = definirOperacao(
  "Cadastrar aluno",
  (banco, dados: DadosCadastroAluno & { id?: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const cadastro = validarCadastroAluno(banco, dados, ctx.hoje);
    const id = dados.id ?? novoId("al");
    exigir(!banco.alunos.some((a) => a.id === id), "Já existe um aluno com este código.");
    const aluno: Aluno = { id, ...cadastro, ativo: true, criadoEm: ctx.agora };
    return { ...banco, alunos: [...banco.alunos, aluno] };
  },
);

export const editarAluno = definirOperacao(
  "Editar cadastro do aluno",
  (banco, dados: DadosCadastroAluno & { id: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const atual = banco.alunos.find((a) => a.id === dados.id);
    exigir(atual, "Aluno não encontrado.");
    const cadastro = validarCadastroAluno(banco, dados, ctx.hoje, atual.professorPrincipalId);
    const novo: Aluno = { ...atual, ...cadastro };
    if (semMudanca(atual, novo)) return banco;
    return { ...banco, alunos: banco.alunos.map((a) => (a.id === novo.id ? novo : a)) };
  },
);

/**
 * O aluno sai da arena. Numa operacao so:
 *  - a matricula que vale e encerrada no ultimo dia (as que ainda nao
 *    comecaram sao apagadas: nunca valeram);
 *  - o congelamento em curso termina no ultimo dia;
 *  - as aulas fixas depois do ultimo dia saem da agenda, sem gerar credito
 *    (a que era so dele e cancelada; na turma ele sai da lista);
 *  - os horarios fixos que eram so dele terminam; nos de turma ele sai.
 * Lancamentos, historico e reservas avulsas nao mudam.
 */
export const inativarAluno = definirOperacao(
  "Inativar aluno",
  (banco, dados: { alunoId: string; ultimoDia: string; motivo?: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const aluno = banco.alunos.find((a) => a.id === dados.alunoId);
    exigir(aluno, "Aluno não encontrado.");
    exigir(aluno.ativo, `${aluno.nome} já está inativo.`);
    exigir(dataValida(dados.ultimoDia), "Informe o último dia do aluno na arena.");
    exigir(
      dados.ultimoDia <= ctx.hoje,
      "O último dia não pode ser depois de hoje. Para uma saída futura, encerre a matrícula nessa data e inative o aluno quando ele sair.",
    );
    garantirDataProxima(dados.ultimoDia, ctx.hoje, "O último dia");
    const ultimoDia = dados.ultimoDia;
    const motivo = limparNome(dados.motivo ?? "");
    exigir(motivo.length <= 300, "O motivo pode ter no máximo 300 caracteres.");

    const doAluno = banco.matriculas.filter((m) => m.alunoId === aluno.id);
    const futuras = new Set(doAluno.filter((m) => m.inicio > ctx.hoje).map((m) => m.id));
    const comecouDepois = doAluno.find((m) => !futuras.has(m.id) && m.inicio > ultimoDia);
    if (comecouDepois) {
      exigir(
        false,
        `A matrícula atual começou em ${formatarData(comecouDepois.inicio)}: o último dia não pode ser antes disso.`,
      );
    }

    const idsDoAluno = new Set(doAluno.map((m) => m.id));
    const matriculas = banco.matriculas
      .filter((m) => !futuras.has(m.id))
      .map((m) =>
        idsDoAluno.has(m.id) && (!m.fim || m.fim > ultimoDia) ? { ...m, fim: ultimoDia } : m,
      );
    const congelamentos = banco.congelamentos
      .filter((c) => !futuras.has(c.matriculaId))
      .map((c) => {
        if (!idsDoAluno.has(c.matriculaId) || congelamentoAnulado(c)) return c;
        if (c.fimReal && c.fimReal <= ultimoDia) return c;
        // Em curso: termina na saida. Marcado para depois da saida: fica anulado.
        return { ...c, fimReal: c.inicio <= ultimoDia ? ultimoDia : somarDias(c.inicio, -1) };
      });

    // Horarios fixos: o que era so dele termina; nos de turma, ele sai da lista.
    const fimDoFixo = new Map<string, string>();
    const vinculosQueSaem = new Set<string>();
    banco.horarioAlunos
      .filter((vinculo) => vinculo.alunoId === aluno.id)
      .forEach((vinculo) => {
        const fixo = banco.horariosFixos.find((h) => h.id === vinculo.horarioFixoId);
        if (!fixo || (fixo.fim && fixo.fim <= ultimoDia)) return;
        const temColegas = banco.horarioAlunos.some(
          (outro) => outro.horarioFixoId === fixo.id && outro.alunoId !== aluno.id,
        );
        if (temColegas) vinculosQueSaem.add(vinculo.id);
        else fimDoFixo.set(fixo.id, fixo.inicio > ultimoDia ? fixo.inicio : ultimoDia);
      });

    const semAulas = suspenderAulas(
      banco,
      aluno.id,
      aulasDepoisDaSaida(banco, aluno.id, ultimoDia),
      MOTIVO_INATIVACAO,
      ctx.agora,
    );

    return {
      ...semAulas,
      alunos: banco.alunos.map((a) => (a.id === aluno.id ? { ...a, ativo: false } : a)),
      matriculas,
      congelamentos,
      horariosFixos:
        fimDoFixo.size === 0
          ? banco.horariosFixos
          : banco.horariosFixos.map(
              (h): HorarioFixo => (fimDoFixo.has(h.id) ? { ...h, fim: fimDoFixo.get(h.id) } : h),
            ),
      horarioAlunos:
        vinculosQueSaem.size === 0
          ? banco.horarioAlunos
          : banco.horarioAlunos.filter((vinculo) => !vinculosQueSaem.has(vinculo.id)),
      comentarios: motivo
        ? [
            ...banco.comentarios,
            {
              id: novoId("cm"),
              entidade: "aluno",
              entidadeId: aluno.id,
              texto: `Aluno inativado. Motivo: ${motivo}`,
              autorId: ctx.usuario.id,
              autorNome: ctx.usuario.nome,
              criadoEm: ctx.agora,
            },
          ]
        : banco.comentarios,
    };
  },
);

/** O aluno volta a ser ativo, sem plano: a matricula nova e feita na ficha. */
export const reativarCadastro = definirOperacao(
  "Reativar cadastro do aluno",
  (banco, dados: { alunoId: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const aluno = banco.alunos.find((a) => a.id === dados.alunoId);
    exigir(aluno, "Aluno não encontrado.");
    exigir(!aluno.ativo, `${aluno.nome} já está ativo.`);
    return {
      ...banco,
      alunos: banco.alunos.map((a) => (a.id === aluno.id ? { ...a, ativo: true } : a)),
    };
  },
);

// ---------------------------------------------------------------------------
// Matricula
// ---------------------------------------------------------------------------

export const criarMatricula = definirOperacao(
  "Nova matrícula",
  (banco, dados: DadosDaMatricula & { alunoId: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const aluno = buscarAlunoAtivo(banco, dados.alunoId);
    const valida = validarDadosDaMatricula(banco, dados, ctx.hoje);
    garantirSemMatriculaSobreposta(banco.matriculas, aluno.id, valida.inicio, undefined);
    const matricula: Matricula = { id: novoId("mt"), alunoId: aluno.id, ...valida };
    return { ...banco, matriculas: [...banco.matriculas, matricula] };
  },
);

/**
 * Troca de plano: a matricula atual termina na vespera de `inicio` e uma nova
 * comeca nesse dia, com o plano, o valor e o vencimento novos. O historico de
 * planos e a lista de matriculas do aluno.
 */
export const trocarPlano = definirOperacao(
  "Trocar de plano",
  (banco, dados: DadosDaMatricula & { matriculaId: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const atual = banco.matriculas.find((m) => m.id === dados.matriculaId);
    exigir(atual, "Matrícula não encontrada.");
    buscarAlunoAtivo(banco, atual.alunoId);
    const valida = validarDadosDaMatricula(banco, dados, ctx.hoje);
    exigir(
      valida.inicio > atual.inicio,
      `O novo plano precisa começar depois de ${formatarData(atual.inicio)}, quando começou o plano atual.`,
    );
    if (atual.fim) {
      exigir(
        valida.inicio <= somarDias(atual.fim, 1),
        `Esta matrícula terminou em ${formatarData(atual.fim)}. Para voltar, use "Nova matrícula".`,
      );
    }
    const ultimoDia = somarDias(valida.inicio, -1);
    const congelado = banco.congelamentos.some(
      (c) =>
        c.matriculaId === atual.id &&
        !congelamentoAnulado(c) &&
        (!c.fimReal || c.fimReal > ultimoDia),
    );
    exigir(
      !congelado,
      "O plano atual está congelado (ou tem congelamento marcado) nesse período. Reative ou desmarque o congelamento antes de trocar de plano.",
    );
    garantirSemMatriculaSobreposta(banco.matriculas, atual.alunoId, valida.inicio, undefined, atual.id);

    const encerrada: Matricula = atual.fim === ultimoDia ? atual : { ...atual, fim: ultimoDia };
    const nova: Matricula = { id: novoId("mt"), alunoId: atual.alunoId, ...valida };
    return {
      ...banco,
      matriculas: [...banco.matriculas.map((m) => (m.id === atual.id ? encerrada : m)), nova],
    };
  },
);

/**
 * Encerra a matricula no ultimo dia informado. O congelamento em curso
 * termina junto. As aulas da agenda nao mudam (o aluno pode continuar com
 * outra matricula); para tirar o aluno da agenda, use a inativacao.
 */
export const encerrarMatricula = definirOperacao(
  "Encerrar matrícula",
  (banco, dados: { matriculaId: string; ultimoDia: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const matricula = banco.matriculas.find((m) => m.id === dados.matriculaId);
    exigir(matricula, "Matrícula não encontrada.");
    exigir(dataValida(dados.ultimoDia), "Informe o último dia da matrícula.");
    garantirDataProxima(dados.ultimoDia, ctx.hoje, "O último dia");
    exigir(
      dados.ultimoDia >= matricula.inicio,
      `A matrícula começou em ${formatarData(matricula.inicio)}: o último dia não pode ser antes disso.`,
    );
    if (matricula.fim) {
      exigir(
        dados.ultimoDia < matricula.fim,
        `A matrícula já termina em ${formatarData(matricula.fim)}.`,
      );
    }
    const depois = banco.congelamentos.find(
      (c) =>
        c.matriculaId === matricula.id && !congelamentoAnulado(c) && c.inicio > dados.ultimoDia,
    );
    if (depois) {
      exigir(
        false,
        `Há um congelamento marcado a partir de ${formatarData(depois.inicio)}. Desmarque o congelamento antes de encerrar a matrícula nessa data.`,
      );
    }

    return {
      ...banco,
      matriculas: banco.matriculas.map((m) =>
        m.id === matricula.id ? { ...m, fim: dados.ultimoDia } : m,
      ),
      congelamentos: banco.congelamentos.map((c) =>
        c.matriculaId === matricula.id &&
        !congelamentoAnulado(c) &&
        (!c.fimReal || c.fimReal > dados.ultimoDia)
          ? { ...c, fimReal: dados.ultimoDia }
          : c,
      ),
    };
  },
);

/**
 * Cancela uma matricula que ainda nao comecou (ex.: troca de plano marcada
 * para o mes que vem). Ela sai da lista; se era uma troca, o plano anterior
 * volta a valer sem data de fim.
 */
export const cancelarMatriculaAgendada = definirOperacao(
  "Desmarcar matrícula agendada",
  (banco, dados: { matriculaId: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const matricula = banco.matriculas.find((m) => m.id === dados.matriculaId);
    exigir(matricula, "Matrícula não encontrada.");
    exigir(
      matricula.inicio > ctx.hoje,
      'Esta matrícula já começou. Para terminá-la, use "Encerrar matrícula".',
    );
    const congelamentos = banco.congelamentos.filter((c) => c.matriculaId === matricula.id);
    exigir(
      congelamentos.every(congelamentoAnulado),
      "Há um congelamento marcado nesta matrícula. Desmarque o congelamento antes.",
    );

    const reabrir = matriculaQueVoltaAValer(banco.matriculas, matricula)?.id;

    return {
      ...banco,
      matriculas: banco.matriculas
        .filter((m) => m.id !== matricula.id)
        .map((m) => (m.id === reabrir ? { ...m, fim: undefined } : m)),
      congelamentos:
        congelamentos.length === 0
          ? banco.congelamentos
          : banco.congelamentos.filter((c) => c.matriculaId !== matricula.id),
    };
  },
);

/** Corrige valor combinado ou dia de vencimento (erro de digitacao, desconto combinado). */
export const corrigirMatricula = definirOperacao(
  "Corrigir matrícula",
  (banco, dados: { matriculaId: string; valorMensal: number; diaVencimento: number }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const atual = banco.matriculas.find((m) => m.id === dados.matriculaId);
    exigir(atual, "Matrícula não encontrada.");
    const corrigida: Matricula = {
      ...atual,
      ...validarValorEVencimento(dados.valorMensal, dados.diaVencimento),
    };
    if (semMudanca(atual, corrigida)) return banco;
    return {
      ...banco,
      matriculas: banco.matriculas.map((m) => (m.id === atual.id ? corrigida : m)),
    };
  },
);

// ---------------------------------------------------------------------------
// Congelamento (Hipotese H4)
// ---------------------------------------------------------------------------

/**
 * Congela o plano de `inicio` ate `fimPrevisto`. As aulas fixas do aluno no
 * periodo ficam suspensas, sem gerar credito de reposicao: a aula que era so
 * dele e cancelada (motivo "Congelamento"); na turma ele sai da lista. O
 * congelamento guarda quais aulas suspendeu, para devolve-las na volta. A
 * mensalidade nao muda sozinha.
 */
export const congelarPlano = definirOperacao(
  "Congelar plano",
  (
    banco,
    dados: { alunoId: string; inicio: string; fimPrevisto: string; motivo: string },
    ctx,
  ) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const aluno = buscarAlunoAtivo(banco, dados.alunoId);
    exigir(dataValida(dados.inicio), "Informe o início do congelamento.");
    exigir(dataValida(dados.fimPrevisto), "Informe o fim previsto do congelamento.");
    garantirDataProxima(dados.inicio, ctx.hoje, "O início do congelamento");
    exigir(
      dados.fimPrevisto >= dados.inicio,
      "O fim previsto precisa ser no mesmo dia do início ou depois.",
    );
    const motivo = limparNome(dados.motivo ?? "");
    exigir(motivo, "Informe o motivo do congelamento.");
    exigir(motivo.length <= 200, "O motivo pode ter no máximo 200 caracteres.");

    const matricula = matriculaVigente(banco.matriculas, aluno.id, dados.inicio);
    exigir(matricula, `${aluno.nome} não tem matrícula valendo em ${formatarData(dados.inicio)}.`);
    if (matricula.fim) {
      exigir(
        dados.fimPrevisto <= matricula.fim,
        `A matrícula termina em ${formatarData(matricula.fim)}: o congelamento precisa acabar até essa data.`,
      );
    }
    garantirSemCongelamentoSobreposto(
      banco.congelamentos,
      matricula.id,
      dados.inicio,
      dados.fimPrevisto,
    );

    const suspensas = aulasParaSuspender(banco, aluno.id, dados.inicio, dados.fimPrevisto);
    const congelamento: Congelamento = {
      id: novoId("cg"),
      matriculaId: matricula.id,
      inicio: dados.inicio,
      fimPrevisto: dados.fimPrevisto,
      motivo,
      aulasSuspensas: suspensas.map(({ ocupacao, acao }) => ({ ocupacaoId: ocupacao.id, acao })),
    };
    const novo = suspenderAulas(banco, aluno.id, suspensas, MOTIVO_CONGELAMENTO, ctx.agora);
    return { ...novo, congelamentos: [...banco.congelamentos, congelamento] };
  },
);

/**
 * O aluno volta em `dataVolta` (o congelamento fica ate a vespera). As aulas
 * suspensas dessa data em diante voltam para a agenda — menos as que nao
 * podem, por exemplo porque a quadra foi ocupada nesse meio-tempo (essas
 * continuam suspensas e a tela mostra quais sao). Voltar no dia do inicio, ou
 * antes, cancela o congelamento.
 */
export const reativarPlano = definirOperacao(
  "Reativar plano",
  (banco, dados: { congelamentoId: string; dataVolta: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const congelamento = banco.congelamentos.find((c) => c.id === dados.congelamentoId);
    exigir(congelamento, "Congelamento não encontrado.");
    exigir(!congelamento.fimReal, "Este congelamento já foi encerrado.");
    const matricula = banco.matriculas.find((m) => m.id === congelamento.matriculaId);
    exigir(matricula, "Matrícula não encontrada.");
    exigir(dataValida(dados.dataVolta), "Informe a data de volta.");
    garantirDataProxima(dados.dataVolta, ctx.hoje, "A data de volta");
    if (matricula.fim) {
      exigir(
        dados.dataVolta <= somarDias(matricula.fim, 1),
        `A matrícula termina em ${formatarData(matricula.fim)}: a volta precisa ser até o dia seguinte.`,
      );
    }

    // O passado nao muda: as aulas voltam da data de volta (ou de hoje) em diante.
    // `aulasSuspensas` continua guardando o que foi suspenso; o que voltou se
    // ve pelo estado das aulas (ver `aulasAindaSuspensas`).
    const aPartirDe = dados.dataVolta > ctx.hoje ? dados.dataVolta : ctx.hoje;
    const { voltam } = previaDaVolta(banco, congelamento, matricula.alunoId, aPartirDe);
    const novo = devolverAulas(banco, matricula.alunoId, voltam);

    return {
      ...novo,
      congelamentos: banco.congelamentos.map((c) =>
        c.id === congelamento.id ? { ...c, fimReal: fimRealParaVolta(c, dados.dataVolta) } : c,
      ),
    };
  },
);
