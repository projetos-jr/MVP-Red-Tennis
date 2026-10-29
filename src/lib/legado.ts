/**
 * ============================================================================
 *  CAMADA DE COMPATIBILIDADE — temporaria
 * ============================================================================
 *  Traduz o banco de exemplo (modelo novo, `src/lib/banco/`) para o formato
 *  antigo do MVP (`src/lib/types.ts`), para que as telas que ainda nao foram
 *  migradas continuem funcionando sem mudanca.
 *
 *  Cada modulo, ao migrar as suas telas para `src/lib/consultas/` e
 *  `src/lib/banco/operacoes/`, deixa de depender daqui. Quando nenhuma tela
 *  usar mais o formato antigo, este arquivo, `mock-data.ts`, `selectors.ts` e
 *  `types.ts` sao apagados.
 *
 *  Os dados aqui sao uma fotografia do banco INICIAL: o que for gravado
 *  durante a sessao pelas operacoes novas nao aparece nas telas antigas.
 * ============================================================================
 */

import { somarDias } from "./date";
import { HOJE } from "./banco/constantes";
import { matriculaVigente, congelamentoVigente, planoVigente, situacaoDoAluno } from "./banco/regras/alunos";
import { diasEmAtraso } from "./banco/regras/financeiro";
import { saldosDeEstoque } from "./banco/regras/estoque";
import { calcularRanking } from "./banco/regras/ranking";
import { extratoReposicao } from "./banco/regras/reposicao";
import { BANCO_INICIAL } from "./banco/semente";
import type { Banco, Lancamento, QuadraId, TipoOcupacao } from "./banco/tipos";
import type {
  Aluno,
  Consumo,
  FormaPagamento,
  HistoricoAula,
  Horario,
  MotivoFalta,
  MovimentoEstoque,
  Pagamento,
  PlanoAluno,
  Produto,
  Professor,
  Quadra,
  TipoAlocacao,
  Torneio,
} from "./types";

const SEM_PROFESSOR = "Sem professor";

export function quadraLegada(id: QuadraId): Quadra {
  return id === "paredao" ? "paredao" : (Number(id) as 1 | 2 | 3 | 4);
}

const MOTIVO_LEGADO: Record<string, MotivoFalta> = {
  CH: "CH",
  "24h": "aviso_24h",
  FP: "falta_professor",
  IAC: "IAC",
  TIP: "TIP",
};

/** Dias ate o dinheiro entrar no caixa, por forma de pagamento (informativo). */
const PRAZO_COMPENSACAO: Record<string, number> = {
  Stone: 2,
  Bradesco: 1,
  "Total Pass": 25,
  Dinheiro: 0,
};

function tipoLegado(tipo: TipoOcupacao): TipoAlocacao {
  return tipo === "Bloqueio" ? "Locação Avulsa" : tipo;
}

export function professoresLegados(banco: Banco): Professor[] {
  return banco.professores.map((p) => ({
    id: p.id,
    nome: p.nome,
    cor: p.cor,
    especialidade: p.especialidade,
    valorHoraAula: p.repasse.valor,
  }));
}

/** Grade semanal: os horarios fixos que valem hoje. */
export function horariosLegados(banco: Banco): Horario[] {
  const nomeDoProfessor = new Map(banco.professores.map((p) => [p.id, p.nome]));
  const alunos = new Map<string, string[]>();
  banco.horarioAlunos.forEach((ha) => {
    alunos.set(ha.horarioFixoId, [...(alunos.get(ha.horarioFixoId) ?? []), ha.alunoId]);
  });

  return banco.horariosFixos
    .filter((h) => h.inicio <= HOJE && (!h.fim || h.fim >= HOJE))
    .map((h) => ({
      id: h.id,
      quadra: quadraLegada(h.quadraId),
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFim: h.horaFim,
      tipo: tipoLegado(h.tipo),
      alunosIds: alunos.get(h.id) ?? [],
      professor: h.professorId ? (nomeDoProfessor.get(h.professorId) ?? SEM_PROFESSOR) : SEM_PROFESSOR,
    }));
}

function pagamentoLegado(lancamento: Lancamento): Pagamento {
  const forma = (lancamento.formaPagamento ?? "Stone") as FormaPagamento;
  return {
    id: lancamento.id,
    alunoId: lancamento.pessoaId ?? "",
    data: lancamento.vencimento,
    dataCompensacao: lancamento.pagoEm
      ? somarDias(lancamento.pagoEm, PRAZO_COMPENSACAO[forma] ?? 0)
      : somarDias(lancamento.vencimento, 7),
    nomePagante: lancamento.nomePagante ?? "",
    item: lancamento.item,
    valor: lancamento.valor,
    formaPagamento: forma,
    status: lancamento.pagoEm ? "confirmado" : "pendente",
    valorTotalPass: lancamento.valorConvenio,
    participantesConfirmados: Boolean(lancamento.pagoEm),
    diasEmAtraso: diasEmAtraso(lancamento, HOJE),
  };
}

/** Lancamentos a receber de alunos (sem consumo), no formato antigo. */
export function pagamentosLegados(banco: Banco): Pagamento[] {
  return banco.lancamentos
    .filter(
      (l) =>
        l.tipo === "receber" &&
        l.pessoaTipo === "aluno" &&
        l.categoria !== "Consumo" &&
        !l.canceladoEm,
    )
    .map(pagamentoLegado)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
}

export function alunosLegados(banco: Banco): Aluno[] {
  const nomeDoProfessor = new Map(banco.professores.map((p) => [p.id, p.nome]));
  const ocupacaoPorId = new Map(banco.ocupacoes.map((o) => [o.id, o]));
  const ranking = calcularRanking(banco);
  const rankingSemanaPassada = calcularRanking(banco, somarDias(HOJE, -7));
  const posicaoAnterior = new Map(rankingSemanaPassada.map((l) => [l.alunoId, l.posicao]));
  const linhaDoRanking = new Map(ranking.map((l) => [l.alunoId, l]));
  const pagamentos = pagamentosLegados(banco);
  const creditoPorOrigem = new Map(
    banco.reposicoes
      .filter((r) => r.minutos > 0 && r.ocupacaoOrigemId)
      .map((r) => [`${r.ocupacaoOrigemId}|${r.alunoId}`, r.minutos]),
  );

  const participacoes = new Map<string, typeof banco.ocupacaoAlunos>();
  banco.ocupacaoAlunos.forEach((p) => {
    participacoes.set(p.alunoId, [...(participacoes.get(p.alunoId) ?? []), p]);
  });

  return banco.alunos.map((aluno) => {
    const plano = planoVigente(banco, aluno.id, HOJE);
    const matricula = matriculaVigente(banco.matriculas, aluno.id, HOJE);
    const congelamento = matricula
      ? congelamentoVigente(banco.congelamentos, matricula.id, HOJE)
      : undefined;
    const extrato = extratoReposicao(banco.reposicoes, aluno.id, HOJE);
    const linha = linhaDoRanking.get(aluno.id);

    const historicoAulas: HistoricoAula[] = (participacoes.get(aluno.id) ?? [])
      .map((p) => ({ participacao: p, ocupacao: ocupacaoPorId.get(p.ocupacaoId) }))
      .filter(({ ocupacao }) => ocupacao && ocupacao.data <= HOJE && ocupacao.tipo !== "Ranking")
      .filter(({ participacao, ocupacao }) => ocupacao?.situacao === "cancelada" || participacao.presenca !== "a_marcar")
      .sort((a, b) => (a.ocupacao!.data < b.ocupacao!.data ? 1 : -1))
      .slice(0, 14)
      .map(({ participacao, ocupacao }) => {
        const o = ocupacao!;
        const cancelada = o.situacao === "cancelada";
        const sigla = cancelada ? o.motivoCancelamento : participacao.sigla;
        return {
          data: o.data,
          quadra: quadraLegada(o.quadraId),
          professor: o.professorId
            ? (nomeDoProfessor.get(o.professorId) ?? SEM_PROFESSOR)
            : SEM_PROFESSOR,
          horario: o.horaInicio,
          status: cancelada ? "reagendada" : participacao.presenca === "presente" ? "realizada" : "falta",
          motivoFalta: sigla ? MOTIVO_LEGADO[sigla] : undefined,
          minutosRepostos: creditoPorOrigem.get(`${o.id}|${aluno.id}`),
        } satisfies HistoricoAula;
      });

    return {
      id: aluno.id,
      nome: aluno.nome,
      avatarUrl: aluno.fotoUrl,
      telefone: aluno.telefone,
      email: aluno.email,
      plano: (plano ? (plano.tipo === "Plano de locação" ? "Locação Mensal" : plano.tipo) : "Locação Avulsa") as PlanoAluno,
      dataInicio: aluno.criadoEm.slice(0, 10),
      professorPrincipal: aluno.professorPrincipalId
        ? (nomeDoProfessor.get(aluno.professorPrincipalId) ?? SEM_PROFESSOR)
        : SEM_PROFESSOR,
      saldoMinutosReposicao: extrato.saldo,
      validadeReposicao: extrato.proximoVencimento?.data ?? HOJE,
      planoCongelado: situacaoDoAluno(banco, aluno, HOJE) === "congelado",
      motivoCongelamento: congelamento?.motivo,
      rankingPontuacao: linha?.pontos ?? 0,
      categoriaRanking: aluno.categoriaRanking ?? "D",
      variacaoRanking: linha ? (posicaoAnterior.get(aluno.id) ?? linha.posicao) - linha.posicao : 0,
      historicoAulas,
      historicoPagamentos: pagamentos.filter((p) => p.alunoId === aluno.id),
      comentarios: banco.comentarios
        .filter((c) => c.entidade === "aluno" && c.entidadeId === aluno.id)
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map((c) => ({ id: c.id, data: c.criadoEm.slice(0, 16), autor: c.autorNome, texto: c.texto })),
    };
  });
}

export function mensalidadePorAluno(banco: Banco): Record<string, number> {
  return Object.fromEntries(
    banco.alunos.map((a) => [a.id, matriculaVigente(banco.matriculas, a.id, HOJE)?.valorMensal ?? 0]),
  );
}

export function produtosLegados(banco: Banco): Produto[] {
  const saldos = saldosDeEstoque(banco.movimentosEstoque);
  return banco.produtos.map((p) => {
    const ultimaEntrada = banco.movimentosEstoque
      .filter((m) => m.produtoId === p.id && (m.tipo === "entrada" || m.tipo === "ajuste"))
      .map((m) => m.data.slice(0, 10))
      .sort()
      .pop();
    return {
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      unidade: p.unidade,
      precoCusto: p.precoCusto,
      precoVenda: p.precoVenda,
      quantidade: saldos.get(p.id) ?? 0,
      estoqueMinimo: p.estoqueMinimo,
      ultimaEntrada: ultimaEntrada ?? HOJE,
    };
  });
}

export function consumosLegados(banco: Banco): Consumo[] {
  const pagos = new Set(
    banco.lancamentos.filter((l) => l.consumoId && l.pagoEm).map((l) => l.consumoId),
  );
  return banco.consumos.map((c) => ({
    id: c.id,
    pessoaId: c.pessoaId,
    tipoPessoa: c.pessoaTipo,
    data: c.data.slice(0, 16),
    produtoId: c.produtoId,
    produtoNome: c.produtoNome,
    quantidade: c.quantidade,
    valorUnitario: c.valorUnitario,
    status: pagos.has(c.id) ? "pago" : "em aberto",
  }));
}

export function movimentosLegados(banco: Banco): MovimentoEstoque[] {
  return banco.movimentosEstoque.map((m) => ({
    id: m.id,
    produtoId: m.produtoId,
    data: m.data.slice(0, 16),
    tipo: m.tipo,
    quantidade: Math.abs(m.quantidade),
    responsavel: m.responsavel,
    observacao: m.observacao,
  }));
}

const ROTULO_FORMATO: Record<string, string> = {
  eliminatoria: "Eliminatória simples",
  grupos_eliminatoria: "Grupos + eliminatória",
  todos_contra_todos: "Todos contra todos",
};

const SITUACAO_LEGADA: Record<string, Torneio["status"]> = {
  inscricoes: "inscrições abertas",
  em_andamento: "em andamento",
  encerrado: "encerrado",
};

export function torneiosLegados(banco: Banco): Torneio[] {
  return banco.torneios.map((t) => ({
    id: t.id,
    nome: t.nome,
    data: t.data,
    formato: [
      t.duplas ? "Duplas" : undefined,
      ROTULO_FORMATO[t.formato],
      t.categoria ? `Categoria ${t.categoria}` : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
    inscritos: banco.torneioInscritos.filter((i) => i.torneioId === t.id).length,
    status: SITUACAO_LEGADA[t.situacao],
  }));
}

// ---------------------------------------------------------------------------
// Fotografia do banco inicial no formato antigo (consumida por mock-data.ts)
// ---------------------------------------------------------------------------

export const LEGADO = {
  professores: professoresLegados(BANCO_INICIAL),
  horarios: horariosLegados(BANCO_INICIAL),
  pagamentos: pagamentosLegados(BANCO_INICIAL),
  alunos: alunosLegados(BANCO_INICIAL),
  mensalidadePorAluno: mensalidadePorAluno(BANCO_INICIAL),
  produtos: produtosLegados(BANCO_INICIAL),
  consumos: consumosLegados(BANCO_INICIAL),
  movimentos: movimentosLegados(BANCO_INICIAL),
  torneios: torneiosLegados(BANCO_INICIAL),
  idsInscritosRanking: BANCO_INICIAL.alunos.filter((a) => a.inscritoRanking).map((a) => a.id),
};
