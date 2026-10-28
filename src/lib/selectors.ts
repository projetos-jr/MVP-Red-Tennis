/**
 * ============================================================================
 *  SELETORES — camada de leitura dos dados
 * ============================================================================
 *  Toda a UI le dados atraves destas funcoes. Os dados vem do Supabase,
 *  carregados uma vez apos o login (`carregar.ts` -> `dados.ts`).
 * ============================================================================
 */

import {
  FAIXAS_HORARIAS,
  HOJE,
  LINHAS_PIRAMIDE,
  QUADRAS,
  SEM_PROFESSOR,
  pisoDaQuadra,
} from "./arena";
import {
  ALUNOS,
  CONSUMOS,
  DIAS_COM_CHUVA,
  HORARIOS,
  IDS_INSCRITOS_RANKING,
  MENSALIDADE_POR_ALUNO,
  MOVIMENTOS_ESTOQUE,
  PAGAMENTOS,
  PRODUTOS,
  PROFESSORES,
} from "./dados";
import { diaDaSemana, diferencaEmDias, horaParaMinutos, somarDias } from "./date";
import type {
  Aluno,
  CategoriaProduto,
  CategoriaRanking,
  Consumo,
  MovimentoEstoque,
  FormaPagamento,
  Horario,
  Pagamento,
  PisoQuadra,
  Produto,
  Professor,
  Quadra,
  TipoAlocacao,
} from "./types";

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------
export function listarAlunos(): Aluno[] {
  return ALUNOS;
}

export function buscarAluno(id: string): Aluno | undefined {
  return ALUNOS.find((a) => a.id === id);
}

export function nomeDoAluno(id: string): string {
  return buscarAluno(id)?.nome ?? "Aluno removido";
}

/** "Ana Beatriz Moraes" -> "Ana B. Moraes" (usado nos chips da agenda). */
export function nomeCompacto(nomeCompleto: string): string {
  const partes = nomeCompleto.split(" ");
  if (partes.length <= 2) return nomeCompleto;
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Professores
// ---------------------------------------------------------------------------
export function listarProfessores(): Professor[] {
  return PROFESSORES;
}

export function buscarProfessorPorNome(nome: string): Professor | undefined {
  return PROFESSORES.find((p) => p.nome === nome);
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------
export interface FiltroAgenda {
  quadra?: Quadra | "todas";
  professor?: string | "todos";
  tipo?: TipoAlocacao | "todos";
}

export function listarHorarios(
  filtro: FiltroAgenda = {},
  fonte: Horario[] = HORARIOS,
): Horario[] {
  const { quadra = "todas", professor = "todos", tipo = "todos" } = filtro;

  return fonte.filter((h) => {
    if (quadra !== "todas" && h.quadra !== quadra) return false;
    if (professor !== "todos" && h.professor !== professor) return false;
    if (tipo !== "todos" && h.tipo !== tipo) return false;
    return true;
  });
}

/** Horarios de um dia da semana (0 = domingo), ordenados por hora de inicio. */
export function horariosDoDia(
  diaSemana: number,
  filtro: FiltroAgenda = {},
  fonte: Horario[] = HORARIOS,
): Horario[] {
  return listarHorarios(filtro, fonte)
    .filter((h) => h.diaSemana === diaSemana)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

/** Horarios que comecam exatamente na faixa informada, num dado dia. */
export function horariosNaFaixa(
  diaSemana: number,
  faixa: string,
  filtro: FiltroAgenda = {},
  fonte: Horario[] = HORARIOS,
): Horario[] {
  return horariosDoDia(diaSemana, filtro, fonte)
    .filter((h) => h.horaInicio === faixa)
    .sort((a, b) => String(a.quadra).localeCompare(String(b.quadra)));
}

/** A arena e toda descoberta: em dia de chuva nao ha operacao. */
export function choveuEm(data: string): boolean {
  return DIAS_COM_CHUVA.includes(data);
}

/**
 * Horarios de uma data real.
 * Parte da grade fixa do dia da semana e aplica as excecoes daquela data
 * (hoje, apenas os dias cancelados por chuva).
 */
export function horariosDaData(
  data: string,
  filtro: FiltroAgenda = {},
  fonte: Horario[] = HORARIOS,
): Horario[] {
  if (choveuEm(data)) return [];
  return horariosDoDia(diaDaSemana(data), filtro, fonte);
}

/** Horarios de uma data real que comecam na faixa informada. */
export function horariosNaFaixaData(
  data: string,
  faixa: string,
  filtro: FiltroAgenda = {},
  fonte: Horario[] = HORARIOS,
): Horario[] {
  if (choveuEm(data)) return [];
  return horariosNaFaixa(diaDaSemana(data), faixa, filtro, fonte);
}

export function contarConflitos(
  filtro: FiltroAgenda = {},
  fonte: Horario[] = HORARIOS,
): number {
  return listarHorarios(filtro, fonte).filter((h) => h.temConflito).length;
}

/** Duracao do horario em minutos. */
export function duracaoHorario(horario: Horario): number {
  return horaParaMinutos(horario.horaFim) - horaParaMinutos(horario.horaInicio);
}

/**
 * Recalcula a marca de conflito de uma lista de horarios.
 * Usado depois de incluir um horario novo durante a sessao — no backend, a
 * regra deveria impedir a gravacao em vez de apenas sinalizar.
 */
export function marcarConflitos(lista: Horario[]): Horario[] {
  return lista.map((h) => {
    const colide = lista.some(
      (outro) =>
        outro.id !== h.id &&
        outro.quadra === h.quadra &&
        outro.diaSemana === h.diaSemana &&
        outro.horaInicio < h.horaFim &&
        h.horaInicio < outro.horaFim,
    );
    return colide === Boolean(h.temConflito) ? h : { ...h, temConflito: colide };
  });
}

/** Quadras livres num dia/faixa — alimenta o formulario de novo horário. */
export function quadrasLivres(
  diaSemana: number,
  horaInicio: string,
  horaFim: string,
  fonte: Horario[] = HORARIOS,
): Quadra[] {
  return QUADRAS.filter(
    (quadra) =>
      !fonte.some(
        (h) =>
          h.quadra === quadra &&
          h.diaSemana === diaSemana &&
          h.horaInicio < horaFim &&
          horaInicio < h.horaFim,
      ),
  );
}

// ---------------------------------------------------------------------------
// Ocupacao das quadras (Dashboard)
// ---------------------------------------------------------------------------
export interface OcupacaoQuadra {
  quadra: Quadra;
  piso: PisoQuadra;
  /** Numero de horarios marcados no dia. */
  ocupados: number;
  /** Total de faixas disponiveis no dia (07h as 22h). */
  total: number;
  /** Razao 0..1 usada para escurecer a quadra no Dashboard. */
  taxa: number;
  /** Proximo horario ainda livre, ou null se a quadra estiver lotada. */
  proximaFaixaLivre: string | null;
  /** Proximo compromisso do dia a partir de agora. */
  proximoHorario: Horario | null;
  conflitos: number;
}

/**
 * Ocupacao de cada quadra em um dia da semana.
 * `referencia` permite calcular a ocupacao de qualquer dia; por padrao, hoje.
 */
export function ocupacaoDasQuadras(
  referencia: string = HOJE,
  fonte: Horario[] = HORARIOS,
): OcupacaoQuadra[] {
  const dia = diaDaSemana(referencia);
  const total = FAIXAS_HORARIAS.length;

  return QUADRAS.map((quadra) => {
    const doDia = horariosDoDia(dia, { quadra }, fonte);
    const ocupadas = new Set(doDia.map((h) => h.horaInicio));
    const livre = FAIXAS_HORARIAS.find((f) => !ocupadas.has(f)) ?? null;

    return {
      quadra,
      piso: pisoDaQuadra(quadra),
      ocupados: ocupadas.size,
      total,
      taxa: ocupadas.size / total,
      proximaFaixaLivre: livre,
      proximoHorario: doDia[0] ?? null,
      conflitos: doDia.filter((h) => h.temConflito).length,
    };
  });
}

export interface ResumoDoDia {
  aulasHoje: number;
  alunosEmQuadra: number;
  taxaOcupacaoMedia: number;
  conflitos: number;
  quadraMaisCheia: Quadra;
}

export function resumoDoDia(
  referencia: string = HOJE,
  fonte: Horario[] = HORARIOS,
): ResumoDoDia {
  const dia = diaDaSemana(referencia);
  const doDia = horariosDoDia(dia, {}, fonte);
  const ocupacoes = ocupacaoDasQuadras(referencia, fonte);
  const maisCheia = [...ocupacoes].sort((a, b) => b.taxa - a.taxa)[0];

  return {
    aulasHoje: doDia.length,
    alunosEmQuadra: new Set(doDia.flatMap((h) => h.alunosIds)).size,
    taxaOcupacaoMedia:
      ocupacoes.reduce((soma, o) => soma + o.taxa, 0) / ocupacoes.length,
    conflitos: doDia.filter((h) => h.temConflito).length,
    quadraMaisCheia: maisCheia.quadra,
  };
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------
export function listarPagamentos(): Pagamento[] {
  return PAGAMENTOS;
}

export interface FiltroFinanceiro {
  status?: "todos" | "confirmado" | "pendente";
  forma?: FormaPagamento | "todas";
  busca?: string;
}

export function filtrarPagamentos(filtro: FiltroFinanceiro = {}): Pagamento[] {
  const { status = "todos", forma = "todas", busca = "" } = filtro;
  const termo = busca.trim().toLowerCase();

  return PAGAMENTOS.filter((p) => {
    if (status !== "todos" && p.status !== status) return false;
    if (forma !== "todas" && p.formaPagamento !== forma) return false;
    if (termo) {
      const alvo = `${nomeDoAluno(p.alunoId)} ${p.nomePagante} ${p.item}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

export interface ResumoFinanceiro {
  recebidoNoMes: number;
  aReceber: number;
  emAtraso: number;
  quantidadeEmAtraso: number;
  cobertoTotalPass: number;
  complementoTotalPass: number;
  ticketMedio: number;
}

export function resumoFinanceiro(referencia: string = HOJE): ResumoFinanceiro {
  const mes = referencia.slice(0, 7);
  const doMes = PAGAMENTOS.filter((p) => p.data.slice(0, 7) === mes);

  const confirmados = doMes.filter((p) => p.status === "confirmado");
  const pendentes = PAGAMENTOS.filter((p) => p.status === "pendente");
  const atrasados = pendentes.filter((p) => p.diasEmAtraso > 0);

  const comTotalPass = PAGAMENTOS.filter(
    (p) => p.formaPagamento === "Total Pass" && p.data.slice(0, 7) === mes,
  );

  return {
    recebidoNoMes: confirmados.reduce((s, p) => s + p.valor, 0),
    aReceber: pendentes.reduce((s, p) => s + p.valor, 0),
    emAtraso: atrasados.reduce((s, p) => s + p.valor, 0),
    quantidadeEmAtraso: atrasados.length,
    cobertoTotalPass: comTotalPass.reduce((s, p) => s + (p.valorTotalPass ?? 0), 0),
    complementoTotalPass: comTotalPass.reduce(
      (s, p) => s + (p.valor - (p.valorTotalPass ?? 0)),
      0,
    ),
    ticketMedio: confirmados.length
      ? confirmados.reduce((s, p) => s + p.valor, 0) / confirmados.length
      : 0,
  };
}

export interface EntradaFluxoCaixa {
  data: string;
  recebido: number;
  previsto: number;
}

/**
 * Fluxo de caixa dos ultimos `dias` dias, separando o que ja entrou do que
 * ainda esta previsto (boleto em aberto, credito a compensar, repasse Total Pass).
 */
export function fluxoDeCaixa(
  dias = 21,
  referencia: string = HOJE,
): EntradaFluxoCaixa[] {
  return Array.from({ length: dias }, (_, i) => {
    const data = somarDias(referencia, -(dias - 1 - i));
    const doDia = PAGAMENTOS.filter((p) => p.data === data);

    return {
      data,
      recebido: doDia
        .filter((p) => p.status === "confirmado")
        .reduce((s, p) => s + p.valor, 0),
      previsto: doDia
        .filter((p) => p.status === "pendente")
        .reduce((s, p) => s + p.valor, 0),
    };
  });
}

export interface TotalPorForma {
  forma: FormaPagamento;
  total: number;
  quantidade: number;
  participacao: number;
}

export function totaisPorForma(referencia: string = HOJE): TotalPorForma[] {
  const mes = referencia.slice(0, 7);
  const doMes = PAGAMENTOS.filter((p) => p.data.slice(0, 7) === mes);
  const geral = doMes.reduce((s, p) => s + p.valor, 0) || 1;

  const formas: FormaPagamento[] = ["Stone", "Bradesco", "Total Pass", "Dinheiro"];

  return formas
    .map((forma) => {
      const itens = doMes.filter((p) => p.formaPagamento === forma);
      const total = itens.reduce((s, p) => s + p.valor, 0);
      return {
        forma,
        total,
        quantidade: itens.length,
        participacao: total / geral,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface ResumoProfessor {
  professor: Professor;
  aulasSemana: number;
  alunosAtendidos: number;
  horasSemana: number;
  comissaoSemana: number;
  comissaoMes: number;
}

/**
 * Resumo agregado de comissao dos professores.
 * Nao e um modulo de folha de pagamento — e o panorama que o gestor pediu
 * para saber quanto sai por professor no fechamento.
 */
export function resumoProfessores(): ResumoProfessor[] {
  return PROFESSORES.map((professor) => {
    const aulas = HORARIOS.filter((h) => h.professor === professor.nome);
    const horas = aulas.reduce((s, h) => s + duracaoHorario(h) / 60, 0);

    return {
      professor,
      aulasSemana: aulas.length,
      alunosAtendidos: new Set(aulas.flatMap((h) => h.alunosIds)).size,
      horasSemana: horas,
      comissaoSemana: horas * professor.valorHoraAula,
      comissaoMes: horas * professor.valorHoraAula * 4.3,
    };
  }).sort((a, b) => b.comissaoMes - a.comissaoMes);
}

/** Receita recorrente contratada (soma das mensalidades ativas). */
export function receitaRecorrente(): number {
  return ALUNOS.filter((a) => !a.planoCongelado).reduce(
    (s, a) => s + (MENSALIDADE_POR_ALUNO[a.id] ?? 0),
    0,
  );
}

/** Reservas confirmadas na agenda que ainda estao sem pagamento quitado. */
export function reservasSemPagamento(): Pagamento[] {
  return PAGAMENTOS.filter(
    (p) => p.status === "pendente" && p.diasEmAtraso > 0,
  ).sort((a, b) => b.diasEmAtraso - a.diasEmAtraso);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
export function rankingGeral(): Aluno[] {
  return [...ALUNOS].sort((a, b) => b.rankingPontuacao - a.rankingPontuacao);
}

export function rankingPorCategoria(categoria: CategoriaRanking): Aluno[] {
  return rankingGeral().filter((a) => a.categoriaRanking === categoria);
}

export interface PosicaoPiramide {
  posicao: number;
  aluno: Aluno;
}

/**
 * Piramide da etapa atual do ranking.
 *
 * Disputam a etapa os 20 inscritos; os demais matriculados continuam
 * pontuando no ranking geral e entram nas proximas etapas.
 */
export function piramideDaEtapa(): PosicaoPiramide[][] {
  return montarPiramide(LINHAS_PIRAMIDE, inscritosNoRanking());
}

export function inscritosNoRanking(): Aluno[] {
  return rankingGeral().filter((a) => IDS_INSCRITOS_RANKING.includes(a.id));
}

/** Distribui uma lista ordenada nas faixas da piramide, do topo para a base. */
export function montarPiramide(
  linhas: number[],
  jogadores: Aluno[] = rankingGeral(),
): PosicaoPiramide[][] {
  const ordenados = jogadores;
  const faixas: PosicaoPiramide[][] = [];
  let cursor = 0;

  linhas.forEach((tamanho) => {
    const faixa: PosicaoPiramide[] = [];
    for (let i = 0; i < tamanho && cursor < ordenados.length; i += 1) {
      faixa.push({ posicao: cursor + 1, aluno: ordenados[cursor] });
      cursor += 1;
    }
    faixas.push(faixa);
  });

  return faixas;
}

// ---------------------------------------------------------------------------
// Ficha do aluno
// ---------------------------------------------------------------------------
export interface ResumoAluno {
  aulasRealizadas: number;
  faltas: number;
  reagendadas: number;
  frequencia: number;
  temDireitoReagendamento: boolean;
  diasParaVencerSaldo: number;
  totalPago: number;
  emAberto: number;
  proximoHorario: Horario | null;
}

export function resumoAluno(
  aluno: Aluno,
  fonte: Horario[] = HORARIOS,
): ResumoAluno {
  const realizadas = aluno.historicoAulas.filter(
    (a) => a.status === "realizada",
  ).length;
  const faltas = aluno.historicoAulas.filter((a) => a.status === "falta").length;
  const reagendadas = aluno.historicoAulas.filter(
    (a) => a.status === "reagendada",
  ).length;

  const proximos = fonte
    .filter((h) => h.alunosIds.includes(aluno.id) && h.professor !== SEM_PROFESSOR)
    .sort(
      (a, b) =>
        a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
    );

  return {
    aulasRealizadas: realizadas,
    faltas,
    reagendadas,
    frequencia: aluno.historicoAulas.length
      ? realizadas / aluno.historicoAulas.length
      : 0,
    temDireitoReagendamento: aluno.saldoMinutosReposicao > 0,
    diasParaVencerSaldo: diferencaEmDias(HOJE, aluno.validadeReposicao),
    totalPago: aluno.historicoPagamentos
      .filter((p) => p.status === "confirmado")
      .reduce((s, p) => s + p.valor, 0),
    emAberto: aluno.historicoPagamentos
      .filter((p) => p.status === "pendente")
      .reduce((s, p) => s + p.valor, 0),
    proximoHorario: proximos[0] ?? null,
  };
}

/** Horarios fixos do aluno na grade semanal. */
export function horariosDoAluno(
  alunoId: string,
  fonte: Horario[] = HORARIOS,
): Horario[] {
  return fonte.filter((h) => h.alunosIds.includes(alunoId)).sort(
    (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
  );
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------
export function listarProdutos(fonte: Produto[] = PRODUTOS): Produto[] {
  return fonte;
}

export function buscarProduto(
  id: string,
  fonte: Produto[] = PRODUTOS,
): Produto | undefined {
  return fonte.find((p) => p.id === id);
}

/** Situacao do saldo de um item, usada para colorir o cartao. */
export type NivelEstoque = "esgotado" | "critico" | "atencao" | "saudavel";

export function nivelDoEstoque(produto: Produto): NivelEstoque {
  if (produto.quantidade === 0) return "esgotado";
  if (produto.quantidade < produto.estoqueMinimo) return "critico";
  if (produto.quantidade < produto.estoqueMinimo * 1.35) return "atencao";
  return "saudavel";
}

export interface FiltroEstoque {
  categoria?: CategoriaProduto | "todas";
  busca?: string;
  /** Mostra apenas o que precisa de reposicao. */
  apenasAlerta?: boolean;
}

export function filtrarProdutos(
  filtro: FiltroEstoque = {},
  fonte: Produto[] = PRODUTOS,
): Produto[] {
  const { categoria = "todas", busca = "", apenasAlerta = false } = filtro;
  const termo = busca.trim().toLowerCase();

  return fonte.filter((produto) => {
    if (categoria !== "todas" && produto.categoria !== categoria) return false;
    if (termo && !produto.nome.toLowerCase().includes(termo)) return false;
    if (apenasAlerta) {
      const nivel = nivelDoEstoque(produto);
      if (nivel !== "esgotado" && nivel !== "critico") return false;
    }
    return true;
  });
}

export interface ResumoEstoque {
  itensCadastrados: number;
  unidadesEmEstoque: number;
  valorDeCusto: number;
  valorDeVenda: number;
  precisamRepor: number;
  esgotados: number;
  vendasNoMes: number;
  margemPotencial: number;
}

export function resumoEstoque(
  fonte: Produto[] = PRODUTOS,
  consumos: Consumo[] = CONSUMOS,
  referencia: string = HOJE,
): ResumoEstoque {
  const mes = referencia.slice(0, 7);
  const doMes = consumos.filter((c) => c.data.slice(0, 7) === mes);

  const valorDeCusto = fonte.reduce(
    (s, p) => s + p.precoCusto * p.quantidade,
    0,
  );
  const valorDeVenda = fonte.reduce(
    (s, p) => s + p.precoVenda * p.quantidade,
    0,
  );

  return {
    itensCadastrados: fonte.length,
    unidadesEmEstoque: fonte.reduce((s, p) => s + p.quantidade, 0),
    valorDeCusto,
    valorDeVenda,
    precisamRepor: fonte.filter((p) => {
      const nivel = nivelDoEstoque(p);
      return nivel === "critico" || nivel === "esgotado";
    }).length,
    esgotados: fonte.filter((p) => p.quantidade === 0).length,
    vendasNoMes: doMes.reduce((s, c) => s + c.valorUnitario * c.quantidade, 0),
    margemPotencial: valorDeVenda - valorDeCusto,
  };
}

export function listarMovimentos(
  fonte: MovimentoEstoque[] = MOVIMENTOS_ESTOQUE,
): MovimentoEstoque[] {
  return fonte;
}

/** Itens mais vendidos no periodo — orienta a reposicao. */
export function maisVendidos(
  quantidade = 5,
  consumos: Consumo[] = CONSUMOS,
): Array<{ produtoId: string; nome: string; unidades: number; total: number }> {
  const mapa = new Map<string, { nome: string; unidades: number; total: number }>();

  consumos.forEach((c) => {
    const atual = mapa.get(c.produtoId) ?? {
      nome: c.produtoNome,
      unidades: 0,
      total: 0,
    };
    atual.unidades += c.quantidade;
    atual.total += c.quantidade * c.valorUnitario;
    mapa.set(c.produtoId, atual);
  });

  return [...mapa.entries()]
    .map(([produtoId, dados]) => ({ produtoId, ...dados }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, quantidade);
}

// ---------------------------------------------------------------------------
// Consumo (ficha do aluno e do professor)
// ---------------------------------------------------------------------------
export function consumosDaPessoa(
  pessoaId: string,
  fonte: Consumo[] = CONSUMOS,
): Consumo[] {
  return fonte
    .filter((c) => c.pessoaId === pessoaId)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
}

export interface ResumoConsumo {
  lancamentos: number;
  totalEmAberto: number;
  totalPago: number;
  ultimoConsumo: Consumo | null;
}

export function resumoConsumo(
  pessoaId: string,
  fonte: Consumo[] = CONSUMOS,
): ResumoConsumo {
  const lista = consumosDaPessoa(pessoaId, fonte);
  const valor = (c: Consumo) => c.valorUnitario * c.quantidade;

  return {
    lancamentos: lista.length,
    totalEmAberto: lista
      .filter((c) => c.status === "em aberto")
      .reduce((s, c) => s + valor(c), 0),
    totalPago: lista
      .filter((c) => c.status === "pago")
      .reduce((s, c) => s + valor(c), 0),
    ultimoConsumo: lista[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Professores (ficha individual)
// ---------------------------------------------------------------------------
export function buscarProfessor(id: string): Professor | undefined {
  return PROFESSORES.find((p) => p.id === id);
}

export interface AgendaProfessor {
  horarios: Horario[];
  aulasSemana: number;
  horasSemana: number;
  alunosAtendidos: string[];
}

export function agendaDoProfessor(
  nome: string,
  fonte: Horario[] = HORARIOS,
): AgendaProfessor {
  const horarios = fonte
    .filter((h) => h.professor === nome)
    .sort(
      (a, b) =>
        a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
    );

  return {
    horarios,
    aulasSemana: horarios.length,
    horasSemana: horarios.reduce((s, h) => s + duracaoHorario(h) / 60, 0),
    alunosAtendidos: [...new Set(horarios.flatMap((h) => h.alunosIds))],
  };
}
