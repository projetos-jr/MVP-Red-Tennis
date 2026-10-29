/**
 * ============================================================================
 *  CONSULTAS — financeiro
 * ============================================================================
 *  Leitura da tela do Financeiro: lista de lancamentos com filtros,
 *  indicadores do mes, detalhe do lancamento, reservas sem pagamento, previa
 *  das mensalidades, relatorio de professores, recebido por forma de
 *  pagamento e a planilha (CSV) da lista.
 *
 *  Os indicadores sao calculados pela MESMA funcao da lista
 *  (`listarLancamentos`) e cada um exporta o seu filtro: clicar no cartao
 *  aplica exatamente aquele filtro, entao o numero do cartao e sempre o da
 *  lista (o MVP mostrava 12 atrasadas no cartao e 6 na lista).
 * ============================================================================
 */

import { formatarData } from "../date";
import { rotuloDaQuadra } from "../banco/regras/agenda";
import { congelamentoVigente, planoVigente, situacaoDoAluno, type SituacaoAluno } from "../banco/regras/alunos";
import {
  diasEmAtraso,
  emReais,
  mensalidadesAGerar,
  mesCurto,
  mesTerminado,
  repasseFechado,
  repassePrevisto,
  situacaoLancamento,
  somarMesesNaCompetencia,
  type SituacaoLancamento,
} from "../banco/regras/financeiro";
import type {
  Aluno,
  Banco,
  CategoriaLancamento,
  Consumo,
  Lancamento,
  Matricula,
  Ocupacao,
  Plano,
  Professor,
  Repasse,
  TipoLancamento,
  Torneio,
} from "../banco/tipos";

export {
  CATEGORIAS_A_PAGAR,
  CATEGORIAS_A_RECEBER,
  categoriasDoTipo,
  mesCurto,
  mesTerminado,
  nomeDoMes,
  somarMesesNaCompetencia,
} from "../banco/regras/financeiro";
export type { SituacaoLancamento } from "../banco/regras/financeiro";

// ---------------------------------------------------------------------------
// Linha da lista
// ---------------------------------------------------------------------------

export interface PessoaDoLancamento {
  id: string;
  nome: string;
  fotoUrl?: string;
  tipo: "aluno" | "professor";
}

export interface LinhaLancamento {
  lancamento: Lancamento;
  situacao: SituacaoLancamento;
  diasEmAtraso: number;
  /** Aluno ou professor ligado ao lancamento. */
  pessoa?: PessoaDoLancamento;
  /** H4: mensalidade de matricula congelada no vencimento (cobrada igual, so sinalizada). */
  congelada: boolean;
}

function mapaDePessoas(banco: Banco): Map<string, PessoaDoLancamento> {
  const mapa = new Map<string, PessoaDoLancamento>();
  banco.alunos.forEach((a) =>
    mapa.set(a.id, { id: a.id, nome: a.nome, fotoUrl: a.fotoUrl, tipo: "aluno" }),
  );
  banco.professores.forEach((p) => mapa.set(p.id, { id: p.id, nome: p.nome, tipo: "professor" }));
  return mapa;
}

function montarLinha(
  banco: Banco,
  pessoas: Map<string, PessoaDoLancamento>,
  lancamento: Lancamento,
  hoje: string,
): LinhaLancamento {
  return {
    lancamento,
    situacao: situacaoLancamento(lancamento, hoje),
    diasEmAtraso: diasEmAtraso(lancamento, hoje),
    pessoa: lancamento.pessoaId ? pessoas.get(lancamento.pessoaId) : undefined,
    congelada: Boolean(
      lancamento.categoria === "Mensalidade" &&
        lancamento.matriculaId &&
        congelamentoVigente(banco.congelamentos, lancamento.matriculaId, lancamento.vencimento),
    ),
  };
}

/** Minusculas e sem acento: buscar "joao" acha "João". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Lista com filtros
// ---------------------------------------------------------------------------

/** "Em aberto" junta pendente e em atraso (tudo o que ainda falta pagar). */
export type SituacaoNoFiltro = "todas" | "em_aberto" | SituacaoLancamento;

export type OrdemDaLista = "vencimento_desc" | "vencimento_asc";

export interface FiltroLancamentos {
  tipo: TipoLancamento;
  /** Procura no nome da pessoa, em quem pagou (ou no favorecido) e no item. */
  busca?: string;
  situacao?: SituacaoNoFiltro;
  categoria?: CategoriaLancamento | "todas";
  /** Forma de pagamento; "sem_forma" = nao informada; "todas" = qualquer. */
  forma?: string;
  /** "YYYY-MM" ou "todos". O mes de cada lancamento e o de `mesDoLancamento`. */
  mes?: string;
  ordem?: OrdemDaLista;
}

/**
 * Mes em que o lancamento "cai": o do pagamento ou, enquanto nao for pago, o
 * do vencimento. Assim "recebido em outubro" e o que entrou no caixa em
 * outubro, e "a receber em outubro" e o que vence em outubro.
 */
export function mesDoLancamento(lancamento: Lancamento): string {
  return (lancamento.pagoEm ?? lancamento.vencimento).slice(0, 7);
}

function passaNaSituacao(situacao: SituacaoLancamento, filtro: SituacaoNoFiltro): boolean {
  if (filtro === "todas") return true;
  if (filtro === "em_aberto") return situacao === "pendente" || situacao === "em_atraso";
  return situacao === filtro;
}

export function listarLancamentos(
  banco: Banco,
  filtro: FiltroLancamentos,
  hoje: string,
): LinhaLancamento[] {
  const pessoas = mapaDePessoas(banco);
  const termo = normalizarBusca(filtro.busca ?? "");
  const situacao = filtro.situacao ?? "todas";
  const categoria = filtro.categoria ?? "todas";
  const forma = filtro.forma ?? "todas";
  const mes = filtro.mes ?? "todos";

  const linhas: LinhaLancamento[] = [];
  banco.lancamentos.forEach((lancamento) => {
    if (lancamento.tipo !== filtro.tipo) return;
    if (categoria !== "todas" && lancamento.categoria !== categoria) return;
    if (forma === "sem_forma" && lancamento.formaPagamento) return;
    if (forma !== "todas" && forma !== "sem_forma" && lancamento.formaPagamento !== forma) return;
    if (mes !== "todos" && mesDoLancamento(lancamento) !== mes) return;

    const linha = montarLinha(banco, pessoas, lancamento, hoje);
    if (!passaNaSituacao(linha.situacao, situacao)) return;
    if (termo) {
      const alvo = normalizarBusca(
        `${linha.pessoa?.nome ?? ""} ${lancamento.nomePagante ?? ""} ${lancamento.item}`,
      );
      if (!alvo.includes(termo)) return;
    }
    linhas.push(linha);
  });

  const sinal = filtro.ordem === "vencimento_asc" ? 1 : -1;
  const nome = (l: LinhaLancamento) => l.pessoa?.nome ?? l.lancamento.nomePagante ?? "";
  return linhas.sort(
    (a, b) =>
      sinal * a.lancamento.vencimento.localeCompare(b.lancamento.vencimento) ||
      nome(a).localeCompare(nome(b)) ||
      a.lancamento.id.localeCompare(b.lancamento.id),
  );
}

export interface Totais {
  quantidade: number;
  valor: number;
}

export function totalizar(linhas: LinhaLancamento[]): Totais {
  return {
    quantidade: linhas.length,
    valor: emReais(linhas.reduce((soma, l) => soma + l.lancamento.valor, 0)),
  };
}

// ---------------------------------------------------------------------------
// Indicadores do mes
// ---------------------------------------------------------------------------

export type ChaveIndicador = "recebido" | "aReceber" | "emAtraso" | "aPagar";

/** Filtro exato de cada indicador — a tela aplica este mesmo filtro na lista. */
export function filtroDoIndicador(chave: ChaveIndicador, mes: string): FiltroLancamentos {
  switch (chave) {
    case "recebido":
      return { tipo: "receber", situacao: "pago", mes };
    case "aReceber":
      return { tipo: "receber", situacao: "pendente", mes };
    case "emAtraso":
      // Nao depende do mes: a divida de setembro continua devida em outubro.
      return { tipo: "receber", situacao: "em_atraso", mes: "todos" };
    case "aPagar":
      return { tipo: "pagar", situacao: "em_aberto", mes };
  }
}

export interface Indicador extends Totais {
  chave: ChaveIndicador;
  filtro: FiltroLancamentos;
}

export interface IndicadoresDoMes {
  /** Recebido no mes (pago com data de pagamento no mes). */
  recebido: Indicador;
  /** Ainda dentro do prazo, com vencimento no mes. */
  aReceber: Indicador;
  /** Tudo o que venceu e nao foi pago, de qualquer mes. */
  emAtraso: Indicador;
  /** Contas a pagar em aberto com vencimento no mes. */
  aPagar: Indicador & { vencidas: number };
}

export function indicadoresDoMes(banco: Banco, mes: string, hoje: string): IndicadoresDoMes {
  const calcular = (chave: ChaveIndicador) => {
    const filtro = filtroDoIndicador(chave, mes);
    const linhas = listarLancamentos(banco, filtro, hoje);
    return { indicador: { chave, filtro, ...totalizar(linhas) }, linhas };
  };
  const aPagar = calcular("aPagar");
  return {
    recebido: calcular("recebido").indicador,
    aReceber: calcular("aReceber").indicador,
    emAtraso: calcular("emAtraso").indicador,
    aPagar: {
      ...aPagar.indicador,
      vencidas: aPagar.linhas.filter((l) => l.situacao === "em_atraso").length,
    },
  };
}

// ---------------------------------------------------------------------------
// Detalhe de um lancamento
// ---------------------------------------------------------------------------

export interface ReservaDoLancamento {
  ocupacao: Ocupacao;
  quadra: string;
  aguardandoPagamento: boolean;
}

export interface DetalheLancamento {
  linha: LinhaLancamento;
  reserva?: ReservaDoLancamento;
  matricula?: Matricula;
  plano?: Plano;
  consumo?: Consumo;
  torneio?: Torneio;
  repasse?: Repasse;
}

export function detalheDoLancamento(
  banco: Banco,
  id: string,
  hoje: string,
): DetalheLancamento | undefined {
  const lancamento = banco.lancamentos.find((l) => l.id === id);
  if (!lancamento) return undefined;

  const ocupacao = lancamento.ocupacaoId
    ? banco.ocupacoes.find((o) => o.id === lancamento.ocupacaoId)
    : undefined;
  const matricula = lancamento.matriculaId
    ? banco.matriculas.find((m) => m.id === lancamento.matriculaId)
    : undefined;

  return {
    linha: montarLinha(banco, mapaDePessoas(banco), lancamento, hoje),
    reserva: ocupacao && {
      ocupacao,
      quadra: rotuloDaQuadra(ocupacao.quadraId),
      aguardandoPagamento: ocupacao.situacao === "aguardando_pagamento",
    },
    matricula,
    plano: matricula && banco.planos.find((p) => p.id === matricula.planoId),
    consumo: lancamento.consumoId
      ? banco.consumos.find((c) => c.id === lancamento.consumoId)
      : undefined,
    torneio: lancamento.torneioId
      ? banco.torneios.find((t) => t.id === lancamento.torneioId)
      : undefined,
    repasse: lancamento.repasseId
      ? banco.repasses.find((r) => r.id === lancamento.repasseId)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Reservas sem pagamento (Hipotese H5)
// ---------------------------------------------------------------------------

export interface ReservaSemPagamento {
  ocupacao: Ocupacao;
  quadra: string;
  /** Quem reservou (primeiro participante). */
  titular?: PessoaDoLancamento;
  acompanhantes: number;
  /** Cobranca da reserva, criada pela agenda junto com ela. */
  lancamento?: LinhaLancamento;
  /** O prazo de pagamento ja passou: a recepcao decide se cede o horario (H5). */
  prazoVencido: boolean;
  prazoHoje: boolean;
}

/** Reservas "aguardando pagamento", das de prazo mais curto para as de prazo mais longo. */
export function reservasAguardandoPagamento(banco: Banco, hoje: string): ReservaSemPagamento[] {
  const aguardando = banco.ocupacoes.filter((o) => o.situacao === "aguardando_pagamento");
  if (aguardando.length === 0) return [];

  const ids = new Set(aguardando.map((o) => o.id));
  const pessoas = mapaDePessoas(banco);
  const participantes = new Map<string, string[]>();
  banco.ocupacaoAlunos.forEach((p) => {
    if (!ids.has(p.ocupacaoId)) return;
    participantes.set(p.ocupacaoId, [...(participantes.get(p.ocupacaoId) ?? []), p.alunoId]);
  });
  const cobrancas = new Map<string, Lancamento>();
  banco.lancamentos.forEach((l) => {
    if (l.ocupacaoId && ids.has(l.ocupacaoId) && !l.canceladoEm) cobrancas.set(l.ocupacaoId, l);
  });

  return aguardando
    .map((ocupacao) => {
      const alunos = participantes.get(ocupacao.id) ?? [];
      const cobranca = cobrancas.get(ocupacao.id);
      const prazo = (ocupacao.prazoPagamento ?? ocupacao.data).slice(0, 10);
      return {
        ocupacao,
        quadra: rotuloDaQuadra(ocupacao.quadraId),
        titular: alunos[0] ? pessoas.get(alunos[0]) : undefined,
        acompanhantes: Math.max(alunos.length - 1, 0),
        lancamento: cobranca && montarLinha(banco, pessoas, cobranca, hoje),
        prazoVencido: prazo < hoje,
        prazoHoje: prazo === hoje,
      };
    })
    .sort((a, b) =>
      (a.ocupacao.prazoPagamento ?? a.ocupacao.data).localeCompare(
        b.ocupacao.prazoPagamento ?? b.ocupacao.data,
      ),
    );
}

// ---------------------------------------------------------------------------
// Gerar mensalidades: previa
// ---------------------------------------------------------------------------

export interface ItemDaPrevia {
  matriculaId: string;
  aluno?: PessoaDoLancamento;
  plano?: string;
  vencimento: string;
  valor: number;
  nomePagante?: string;
  congelada: boolean;
}

export interface PreviaMensalidades {
  competencia: string;
  itens: ItemDaPrevia[];
  total: number;
  /** Matriculas que ja tinham a mensalidade do mes e ficam como estao. */
  jaGeradas: number;
  congeladas: number;
}

/** O que "Gerar mensalidades" vai criar — a mesma regra que a operacao usa. */
export function previaDasMensalidades(banco: Banco, competencia: string): PreviaMensalidades {
  const { novas, jaGeradas } = mensalidadesAGerar(banco, competencia);
  const pessoas = mapaDePessoas(banco);
  const planos = new Map(banco.planos.map((p) => [p.id, p.nome]));
  const itens = novas
    .map((n) => ({
      matriculaId: n.matricula.id,
      aluno: pessoas.get(n.matricula.alunoId),
      plano: planos.get(n.matricula.planoId),
      vencimento: n.vencimento,
      valor: n.valor,
      nomePagante: n.nomePagante,
      congelada: n.congelada,
    }))
    .sort((a, b) => (a.aluno?.nome ?? "").localeCompare(b.aluno?.nome ?? ""));
  return {
    competencia,
    itens,
    total: emReais(itens.reduce((soma, i) => soma + i.valor, 0)),
    jaGeradas,
    congeladas: itens.filter((i) => i.congelada).length,
  };
}

/** Mes sugerido para gerar: o atual, se ainda faltar alguma; senao o seguinte. */
export function mesSugeridoParaGerar(banco: Banco, hoje: string): string {
  const atual = hoje.slice(0, 7);
  return mensalidadesAGerar(banco, atual).novas.length > 0
    ? atual
    : somarMesesNaCompetencia(atual, 1);
}

// ---------------------------------------------------------------------------
// Relatorio de professores (repasse, Hipotese H6)
// ---------------------------------------------------------------------------

export type SituacaoRepasse = "em_andamento" | "a_fechar" | "a_pagar" | "pago" | "sem_aulas";

export interface LinhaRepasse {
  professor: Professor;
  /** Fechamento do mes, se ja houver: os numeros ficam congelados nele. */
  fechamento?: Repasse;
  aulasDadas: number;
  minutosDados: number;
  previsto: number;
  /** Lancamentos de repasse do mes ja pagos. */
  pago: number;
  /** Lancamentos de repasse do mes ainda em aberto. */
  emAberto: number;
  /** Previsto menos pago. */
  diferenca: number;
  situacao: SituacaoRepasse;
}

export interface RelatorioDeRepasses {
  competencia: string;
  terminado: boolean;
  linhas: LinhaRepasse[];
  totais: Omit<LinhaRepasse, "professor" | "fechamento" | "situacao">;
  /** Professores com aulas no mes e sem fechamento: o que "Fechar repasse" fecha. */
  aFechar: LinhaRepasse[];
}

/**
 * Previsto x pago de cada professor no mes. Mes aberto: previsto pela regra
 * do professor (`repassePrevisto`). Mes fechado: o valor gravado no
 * fechamento (`banco.repasses`). Pago: lancamentos "Repasse" pagos do mes.
 */
export function relatorioDeProfessores(
  banco: Banco,
  competencia: string,
  hoje: string,
): RelatorioDeRepasses {
  const terminado = mesTerminado(competencia, hoje);

  const linhas = banco.professores
    .map((professor): LinhaRepasse => {
      const fechamento = repasseFechado(banco, professor.id, competencia);
      const calculo = fechamento ?? repassePrevisto(banco, professor.id, competencia);
      const doMes = banco.lancamentos.filter(
        (l) =>
          l.categoria === "Repasse" &&
          l.pessoaId === professor.id &&
          l.competencia === competencia &&
          !l.canceladoEm,
      );
      const pago = emReais(doMes.filter((l) => l.pagoEm).reduce((s, l) => s + l.valor, 0));
      const emAberto = emReais(doMes.filter((l) => !l.pagoEm).reduce((s, l) => s + l.valor, 0));
      const diferenca = emReais(calculo.valorPrevisto - pago);

      let situacao: SituacaoRepasse;
      if (fechamento) situacao = diferenca > 0 ? "a_pagar" : "pago";
      else if (calculo.aulasDadas === 0) situacao = "sem_aulas";
      else situacao = terminado ? "a_fechar" : "em_andamento";

      return {
        professor,
        fechamento,
        aulasDadas: calculo.aulasDadas,
        minutosDados: calculo.minutosDados,
        previsto: calculo.valorPrevisto,
        pago,
        emAberto,
        diferenca,
        situacao,
      };
    })
    .filter((l) => l.professor.ativo || l.aulasDadas > 0 || l.fechamento || l.pago || l.emAberto)
    .sort((a, b) => a.professor.nome.localeCompare(b.professor.nome));

  const somar = (campo: "aulasDadas" | "minutosDados" | "previsto" | "pago" | "emAberto" | "diferenca") =>
    emReais(linhas.reduce((soma, l) => soma + l[campo], 0));

  return {
    competencia,
    terminado,
    linhas,
    totais: {
      aulasDadas: somar("aulasDadas"),
      minutosDados: somar("minutosDados"),
      previsto: somar("previsto"),
      pago: somar("pago"),
      emAberto: somar("emAberto"),
      diferenca: somar("diferenca"),
    },
    aFechar: linhas.filter((l) => l.situacao === "a_fechar"),
  };
}

/**
 * Data sugerida para pagar o repasse fechado: dia 5 do mes seguinte, como nos
 * dados de exemplo — ou hoje, se esse dia ja passou. E so a sugestao do
 * formulario; quem fecha escolhe a data.
 */
export function vencimentoSugeridoDoRepasse(competencia: string, hoje: string): string {
  const sugerido = `${somarMesesNaCompetencia(competencia, 1)}-05`;
  return sugerido < hoje ? hoje : sugerido;
}

// ---------------------------------------------------------------------------
// Recebido por forma de pagamento (relatorio simples do mes)
// ---------------------------------------------------------------------------

export interface TotalPorForma {
  forma: string;
  quantidade: number;
  valor: number;
  /** Fracao do total recebido no mes (0 a 1). */
  participacao: number;
}

export interface RecebidoPorFormas {
  formas: TotalPorForma[];
  total: number;
  quantidade: number;
  /** Parte coberta por convenio — so registro, sem integracao. */
  convenio: Totais;
}

export const SEM_FORMA = "Não informada";

/** Mesmo recorte do indicador "Recebido", dividido por forma de pagamento. */
export function recebidoPorForma(banco: Banco, mes: string, hoje: string): RecebidoPorFormas {
  const linhas = listarLancamentos(banco, filtroDoIndicador("recebido", mes), hoje);
  const { quantidade, valor: total } = totalizar(linhas);

  const porForma = new Map<string, Totais>(
    banco.configuracoes.formasPagamento.map((f) => [f, { quantidade: 0, valor: 0 }]),
  );
  let convenio: Totais = { quantidade: 0, valor: 0 };
  linhas.forEach(({ lancamento }) => {
    const forma = lancamento.formaPagamento ?? SEM_FORMA;
    const atual = porForma.get(forma) ?? { quantidade: 0, valor: 0 };
    porForma.set(forma, { quantidade: atual.quantidade + 1, valor: atual.valor + lancamento.valor });
    if (lancamento.valorConvenio) {
      convenio = {
        quantidade: convenio.quantidade + 1,
        valor: convenio.valor + lancamento.valorConvenio,
      };
    }
  });

  return {
    formas: [...porForma.entries()]
      .map(([forma, t]) => ({
        forma,
        quantidade: t.quantidade,
        valor: emReais(t.valor),
        participacao: total > 0 ? t.valor / total : 0,
      }))
      .sort((a, b) => b.valor - a.valor),
    total,
    quantidade,
    convenio: { quantidade: convenio.quantidade, valor: emReais(convenio.valor) },
  };
}

// ---------------------------------------------------------------------------
// Formulario de novo lancamento
// ---------------------------------------------------------------------------

export interface AlunoParaCobranca {
  aluno: Aluno;
  plano?: string;
  situacao: SituacaoAluno;
}

/** Alunos para o campo de busca: quem comeca com o termo vem primeiro. */
export function buscarAlunosParaCobranca(
  banco: Banco,
  termo: string,
  hoje: string,
  limite = 8,
): AlunoParaCobranca[] {
  const procurado = normalizarBusca(termo);
  if (!procurado) return [];
  return banco.alunos
    .map((aluno) => ({ aluno, nome: normalizarBusca(aluno.nome) }))
    .filter(({ nome }) => nome.includes(procurado))
    .sort(
      (a, b) =>
        Number(!a.nome.startsWith(procurado)) - Number(!b.nome.startsWith(procurado)) ||
        a.aluno.nome.localeCompare(b.aluno.nome),
    )
    .slice(0, limite)
    .map(({ aluno }) => ({
      aluno,
      plano: planoVigente(banco, aluno.id, hoje)?.nome,
      situacao: situacaoDoAluno(banco, aluno, hoje),
    }));
}

export function professoresAtivos(banco: Banco): Professor[] {
  return banco.professores
    .filter((p) => p.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---------------------------------------------------------------------------
// Planilha (CSV) da lista filtrada
// ---------------------------------------------------------------------------

const SITUACAO_NA_PLANILHA: Record<SituacaoLancamento, string> = {
  pago: "Pago",
  pendente: "Pendente",
  em_atraso: "Em atraso",
  cancelado: "Anulado",
};

/** 1234.5 -> "1.234,50" (o Excel em portugues le como numero). */
function numeroBrasileiro(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Uma celula do CSV. Texto com ponto e virgula, aspas ou quebra de linha vai
 * entre aspas. Texto livre que comeca com =, +, - ou @ ganha um apostrofo na
 * frente, para o Excel nao executar como formula.
 */
function celula(valor: string | undefined, textoLivre = false): string {
  let conteudo = valor ?? "";
  if (textoLivre && /^[=+\-@\t\r]/.test(conteudo)) conteudo = `'${conteudo}`;
  return /[";\r\n]/.test(conteudo) ? `"${conteudo.replace(/"/g, '""')}"` : conteudo;
}

const COLUNAS_DA_PLANILHA = [
  "Tipo",
  "Situação",
  "Vencimento",
  "Pago em",
  "Pessoa",
  "Quem pagou / favorecido",
  "Item",
  "Categoria",
  "Forma de pagamento",
  "Valor (R$)",
  "Parte do convênio (R$)",
  "Comprovante",
  "Mês de referência",
  "Motivo da anulação",
  "Código",
];

/**
 * CSV no formato que o Excel em portugues abre direto: separador ";", datas
 * dd/mm/aaaa, valores 1.234,56 e marca UTF-8 no inicio (para os acentos).
 */
export function gerarCsv(linhas: LinhaLancamento[]): string {
  const corpo = linhas.map(({ lancamento: l, situacao, pessoa }) =>
    [
      celula(l.tipo === "receber" ? "A receber" : "A pagar"),
      celula(SITUACAO_NA_PLANILHA[situacao]),
      celula(formatarData(l.vencimento)),
      celula(l.pagoEm ? formatarData(l.pagoEm) : ""),
      celula(pessoa?.nome, true),
      celula(l.nomePagante, true),
      celula(l.item, true),
      celula(l.categoria),
      celula(l.formaPagamento),
      celula(numeroBrasileiro(l.valor)),
      celula(l.valorConvenio !== undefined ? numeroBrasileiro(l.valorConvenio) : ""),
      celula(l.comprovante, true),
      celula(l.competencia ? mesCurto(l.competencia) : ""),
      celula(l.motivoCancelamento, true),
      celula(l.id),
    ].join(";"),
  );
  return `﻿${[COLUNAS_DA_PLANILHA.join(";"), ...corpo].join("\r\n")}\r\n`;
}
