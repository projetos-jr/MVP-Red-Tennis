/**
 * Leitura do Supabase e conversao para os tipos de `types.ts`.
 *
 * O banco usa colunas em snake_case e chaves estrangeiras (professor_id,
 * quadra_id); as telas trabalham com os tipos do MVP (nome do professor,
 * `Quadra` numerica). A traducao entre os dois fica toda aqui.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { HOJE, SEM_PROFESSOR } from "./arena";
import type { BaseDeDados } from "./dados";
import { diferencaEmDias } from "./date";
import type {
  Aluno,
  CategoriaProduto,
  CategoriaRanking,
  Comentario,
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
  StatusAula,
  StatusPagamento,
  TipoAlocacao,
  TipoMovimento,
  Torneio,
} from "./types";

type Linha = Record<string, unknown>;

/** O PostgREST devolve no maximo 1000 linhas por chamada: pagina ate o fim. */
async function todas(
  supabase: SupabaseClient,
  tabela: string,
  colunas: string,
  ordem: Array<[string, boolean]>,
): Promise<Linha[]> {
  const tamanho = 1000;
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    let consulta = supabase.from(tabela).select(colunas);
    for (const [coluna, crescente] of ordem) {
      consulta = consulta.order(coluna, { ascending: crescente });
    }
    const { data, error } = await consulta.range(inicio, inicio + tamanho - 1);
    if (error) throw new Error(`Erro ao ler ${tabela}: ${error.message}`);
    const pagina = (data ?? []) as unknown as Linha[];
    linhas.push(...pagina);
    if (pagina.length < tamanho) return linhas;
  }
}

const texto = (v: unknown) => (v == null ? "" : String(v));
const opcional = (v: unknown) => (v == null ? undefined : String(v));
const numero = (v: unknown) => (v == null ? 0 : Number(v));
/** "07:00:00" -> "07:00" */
const hora = (v: unknown) => texto(v).slice(0, 5);

export function paraQuadra(id: unknown): Quadra {
  const valor = texto(id);
  return valor === "paredao" ? "paredao" : (Number(valor) as Quadra);
}

const formatoLocal = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** timestamptz -> "YYYY-MM-DDTHH:mm" no fuso da arena. */
export function paraDataHoraLocal(valor: unknown): string {
  return formatoLocal.format(new Date(texto(valor))).replace(" ", "T");
}

/**
 * Dias de atraso calculados na leitura, a partir do prazo: guardar o numero
 * no banco faria ele ficar desatualizado no dia seguinte. Mesma regra do MVP
 * (2 dias de tolerancia).
 */
function diasEmAtraso(status: StatusPagamento, dataLimite: string): number {
  if (status !== "pendente") return 0;
  const dias = diferencaEmDias(dataLimite, HOJE);
  return dias > 2 ? dias : 0;
}

export async function carregarBase(
  supabase: SupabaseClient,
): Promise<BaseDeDados> {
  const [
    linhasProfessores,
    linhasAlunos,
    linhasAulas,
    linhasComentarios,
    linhasPagamentos,
    linhasHorarios,
    linhasHorarioAlunos,
    linhasDias,
    linhasTorneios,
    linhasProdutos,
    linhasMovimentos,
    linhasConsumos,
  ] = await Promise.all([
    todas(supabase, "professores", "*", [["nome", true]]),
    todas(supabase, "alunos", "*", [["criado_em", true], ["id", true]]),
    todas(supabase, "aulas", "*", [["data", false], ["horario", false]]),
    todas(supabase, "comentarios", "*", [["criado_em", false]]),
    todas(supabase, "pagamentos", "*", [["data", false], ["id", true]]),
    todas(supabase, "horarios", "*", [["dia_semana", true], ["hora_inicio", true], ["id", true]]),
    todas(supabase, "horario_alunos", "*", [["horario_id", true], ["ordem", true]]),
    todas(supabase, "dias_sem_aula", "data", [["data", true]]),
    todas(supabase, "torneios", "*", [["data", false]]),
    todas(supabase, "produtos", "*", [["id", true]]),
    todas(supabase, "movimentos_estoque", "*", [["criado_em", false]]),
    todas(supabase, "consumos", "*", [["criado_em", false]]),
  ]);

  const professores: Professor[] = linhasProfessores.map((p) => ({
    id: texto(p.id),
    nome: texto(p.nome),
    cor: texto(p.cor),
    especialidade: texto(p.especialidade),
    valorHoraAula: numero(p.valor_hora_aula),
  }));
  const nomeProfessor = new Map(professores.map((p) => [p.id, p.nome]));
  const professorPorId = (id: unknown) =>
    id == null ? SEM_PROFESSOR : (nomeProfessor.get(String(id)) ?? SEM_PROFESSOR);

  const pagamentos: Pagamento[] = linhasPagamentos.map((p) => {
    const status = texto(p.status) as StatusPagamento;
    return {
      id: texto(p.id),
      alunoId: texto(p.aluno_id),
      data: texto(p.data),
      dataCompensacao: texto(p.data_compensacao),
      nomePagante: texto(p.nome_pagante),
      item: texto(p.item),
      valor: numero(p.valor),
      formaPagamento: texto(p.forma_pagamento) as FormaPagamento,
      status,
      valorTotalPass: p.valor_total_pass == null ? undefined : numero(p.valor_total_pass),
      participantesConfirmados: Boolean(p.participantes_confirmados),
      diasEmAtraso: diasEmAtraso(status, texto(p.data_limite)),
    };
  });

  const aulasPorAluno = agrupar(linhasAulas, "aluno_id", (a): HistoricoAula => ({
    data: texto(a.data),
    quadra: paraQuadra(a.quadra_id),
    professor: professorPorId(a.professor_id),
    horario: hora(a.horario),
    status: texto(a.status) as StatusAula,
    motivoFalta: opcional(a.motivo_falta) as MotivoFalta | undefined,
    minutosRepostos: a.minutos_repostos == null ? undefined : numero(a.minutos_repostos),
  }));

  const comentariosPorAluno = agrupar(linhasComentarios, "aluno_id", (c): Comentario => ({
    id: texto(c.id),
    data: paraDataHoraLocal(c.criado_em),
    autor: texto(c.autor),
    texto: texto(c.texto),
  }));

  const pagamentosPorAluno = new Map<string, Pagamento[]>();
  for (const p of pagamentos) {
    const lista = pagamentosPorAluno.get(p.alunoId);
    if (lista) lista.push(p);
    else pagamentosPorAluno.set(p.alunoId, [p]);
  }

  const alunos: Aluno[] = linhasAlunos.map((a) => {
    const id = texto(a.id);
    return {
      id,
      nome: texto(a.nome),
      avatarUrl: opcional(a.avatar_url),
      telefone: texto(a.telefone),
      email: texto(a.email),
      plano: texto(a.plano) as PlanoAluno,
      dataInicio: texto(a.data_inicio),
      professorPrincipal: professorPorId(a.professor_principal_id),
      saldoMinutosReposicao: numero(a.saldo_minutos_reposicao),
      validadeReposicao: texto(a.validade_reposicao) || HOJE,
      planoCongelado: Boolean(a.plano_congelado),
      motivoCongelamento: opcional(a.motivo_congelamento),
      rankingPontuacao: numero(a.ranking_pontuacao),
      categoriaRanking: texto(a.categoria_ranking) as CategoriaRanking,
      variacaoRanking: numero(a.variacao_ranking),
      historicoAulas: aulasPorAluno.get(id) ?? [],
      historicoPagamentos: pagamentosPorAluno.get(id) ?? [],
      comentarios: comentariosPorAluno.get(id) ?? [],
    };
  });

  const alunosPorHorario = agrupar(linhasHorarioAlunos, "horario_id", (h) => texto(h.aluno_id));

  const horarios: Horario[] = linhasHorarios.map((h) => ({
    id: texto(h.id),
    quadra: paraQuadra(h.quadra_id),
    diaSemana: numero(h.dia_semana),
    horaInicio: hora(h.hora_inicio),
    horaFim: hora(h.hora_fim),
    tipo: texto(h.tipo) as TipoAlocacao,
    alunosIds: alunosPorHorario.get(texto(h.id)) ?? [],
    professor: professorPorId(h.professor_id),
  }));

  const torneios: Torneio[] = linhasTorneios.map((t) => ({
    id: texto(t.id),
    nome: texto(t.nome),
    data: texto(t.data),
    formato: texto(t.formato),
    inscritos: numero(t.inscritos),
    status: texto(t.status) as Torneio["status"],
  }));

  const produtos: Produto[] = linhasProdutos.map((p) => ({
    id: texto(p.id),
    nome: texto(p.nome),
    categoria: texto(p.categoria) as CategoriaProduto,
    unidade: texto(p.unidade),
    precoCusto: numero(p.preco_custo),
    precoVenda: numero(p.preco_venda),
    quantidade: numero(p.quantidade),
    estoqueMinimo: numero(p.estoque_minimo),
    ultimaEntrada: texto(p.ultima_entrada),
  }));

  const movimentos: MovimentoEstoque[] = linhasMovimentos.map((m) => ({
    id: texto(m.id),
    produtoId: texto(m.produto_id),
    data: paraDataHoraLocal(m.criado_em),
    tipo: texto(m.tipo) as TipoMovimento,
    quantidade: numero(m.quantidade),
    responsavel: texto(m.responsavel),
    observacao: opcional(m.observacao),
  }));

  const consumos: Consumo[] = linhasConsumos.map((c) => ({
    id: texto(c.id),
    pessoaId: texto(c.aluno_id ?? c.professor_id),
    tipoPessoa: c.aluno_id != null ? "aluno" : "professor",
    data: paraDataHoraLocal(c.criado_em),
    produtoId: texto(c.produto_id),
    produtoNome: texto(c.produto_nome),
    quantidade: numero(c.quantidade),
    valorUnitario: numero(c.valor_unitario),
    status: texto(c.status) as Consumo["status"],
  }));

  return {
    alunos,
    professores,
    horarios,
    pagamentos,
    produtos,
    consumos,
    movimentos,
    torneios,
    diasComChuva: linhasDias.map((d) => texto(d.data)),
    idsInscritosRanking: linhasAlunos
      .filter((a) => a.inscrito_ranking)
      .map((a) => texto(a.id)),
    mensalidadePorAluno: Object.fromEntries(
      linhasAlunos.map((a) => [texto(a.id), numero(a.mensalidade)]),
    ),
  };
}

function agrupar<T>(
  linhas: Linha[],
  chave: string,
  converter: (linha: Linha) => T,
): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) {
    const id = texto(linha[chave]);
    const lista = grupos.get(id);
    if (lista) lista.push(converter(linha));
    else grupos.set(id, [converter(linha)]);
  }
  return grupos;
}
