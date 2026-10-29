/**
 * Consultas do estoque e do consumo no balcao.
 *
 * O saldo de cada produto sai sempre da soma dos movimentos
 * (`saldosDeEstoque`); a situacao de cada consumo (em aberto, em atraso,
 * pago) sai do lancamento a receber ligado a ele.
 */

import { somarDias } from "../date";
import {
  CATEGORIAS_PRODUTO,
  efeitoNoSaldo,
  nomeNormalizado,
  saldoDoProduto,
  saldosDeEstoque,
} from "../banco/regras/estoque";
import { situacaoLancamento } from "../banco/regras/financeiro";
import type {
  Banco,
  CategoriaProduto,
  Consumo,
  Lancamento,
  MovimentoEstoque,
  Produto,
} from "../banco/tipos";
import { nomeDaPessoa } from "./base";

export { CATEGORIAS_PRODUTO };

// ---------------------------------------------------------------------------
// Produtos e saldo
// ---------------------------------------------------------------------------

export type NivelEstoque = "esgotado" | "critico" | "atencao" | "saudavel";

/**
 * Situacao do saldo, mostrada no cartao (cor + rotulo + barra):
 *  - esgotado: nada na prateleira;
 *  - critico ("Repor já"): abaixo do minimo;
 *  - atencao: ate 35% acima do minimo;
 *  - saudavel ("Em dia"): o resto.
 */
export function nivelDoEstoque(saldo: number, estoqueMinimo: number): NivelEstoque {
  if (saldo <= 0) return "esgotado";
  if (saldo < estoqueMinimo) return "critico";
  if (saldo < estoqueMinimo * 1.35) return "atencao";
  return "saudavel";
}

export interface ProdutoComSaldo {
  produto: Produto;
  saldo: number;
  nivel: NivelEstoque;
}

function comSaldo(produto: Produto, saldo: number): ProdutoComSaldo {
  return { produto, saldo, nivel: nivelDoEstoque(saldo, produto.estoqueMinimo) };
}

/** Todos os produtos (ativos e inativos) com o saldo, por categoria e nome. */
export function produtosComSaldo(banco: Banco): ProdutoComSaldo[] {
  const saldos = saldosDeEstoque(banco.movimentosEstoque);
  const ordem = (categoria: CategoriaProduto) => CATEGORIAS_PRODUTO.indexOf(categoria);
  return banco.produtos
    .map((produto) => comSaldo(produto, saldos.get(produto.id) ?? 0))
    .sort(
      (a, b) =>
        ordem(a.produto.categoria) - ordem(b.produto.categoria) ||
        a.produto.nome.localeCompare(b.produto.nome, "pt-BR"),
    );
}

/** Um produto com o saldo de agora. */
export function produtoComSaldo(banco: Banco, produtoId: string): ProdutoComSaldo | undefined {
  const produto = banco.produtos.find((p) => p.id === produtoId);
  if (!produto) return undefined;
  return comSaldo(produto, saldoDoProduto(banco.movimentosEstoque, produto.id));
}

/** O que aparece para venda: so produtos ativos (os esgotados aparecem desabilitados). */
export function produtosParaVenda(banco: Banco): ProdutoComSaldo[] {
  return produtosComSaldo(banco).filter((item) => item.produto.ativo);
}

/** Produto ativo esgotado ou abaixo do minimo: entra na lista de compras. */
export function precisaRepor(item: ProdutoComSaldo): boolean {
  return item.produto.ativo && (item.nivel === "esgotado" || item.nivel === "critico");
}

export interface FiltroEstoque {
  categoria: CategoriaProduto | "todas";
  busca: string;
  apenasRepor: boolean;
  incluirInativos: boolean;
}

/** A busca ignora acentos e maiusculas ("agua" acha "Água mineral"). */
export function filtrarProdutos(
  lista: ProdutoComSaldo[],
  filtro: FiltroEstoque,
): ProdutoComSaldo[] {
  const termo = nomeNormalizado(filtro.busca);
  return lista.filter((item) => {
    if (!filtro.incluirInativos && !item.produto.ativo) return false;
    if (filtro.categoria !== "todas" && item.produto.categoria !== filtro.categoria) return false;
    if (termo && !nomeNormalizado(item.produto.nome).includes(termo)) return false;
    if (filtro.apenasRepor && !precisaRepor(item)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Indicadores, lista de compras e mais vendidos
// ---------------------------------------------------------------------------

/** Lancamento a receber de cada consumo, pelo id do consumo. */
function cobrancasPorConsumo(lancamentos: Lancamento[]): Map<string, Lancamento> {
  const indice = new Map<string, Lancamento>();
  lancamentos.forEach((l) => {
    if (l.consumoId) indice.set(l.consumoId, l);
  });
  return indice;
}

function valorDoConsumo(consumo: Consumo): number {
  return Math.round(consumo.quantidade * consumo.valorUnitario * 100) / 100;
}

export interface ResumoEstoque {
  produtosAtivos: number;
  produtosInativos: number;
  /** Unidades dos produtos ativos. */
  unidades: number;
  valorDeCusto: number;
  valorDeVenda: number;
  precisamRepor: number;
  esgotados: number;
  /** Consumo lancado no mes de `hoje` (sem os anulados no financeiro). */
  vendasNoMes: number;
  /** Consumo ainda nao pago nas contas das pessoas, de qualquer mes. */
  consumoEmAberto: number;
}

export function resumoDoEstoque(
  banco: Banco,
  lista: ProdutoComSaldo[],
  hoje: string,
): ResumoEstoque {
  const ativos = lista.filter((item) => item.produto.ativo);
  const mes = hoje.slice(0, 7);
  const cobrancas = cobrancasPorConsumo(banco.lancamentos);

  let vendasNoMes = 0;
  let consumoEmAberto = 0;
  banco.consumos.forEach((consumo) => {
    const cobranca = cobrancas.get(consumo.id);
    if (cobranca?.canceladoEm) return;
    if (consumo.data.slice(0, 7) === mes) vendasNoMes += valorDoConsumo(consumo);
    if (cobranca && !cobranca.pagoEm) consumoEmAberto += cobranca.valor;
  });

  return {
    produtosAtivos: ativos.length,
    produtosInativos: lista.length - ativos.length,
    unidades: ativos.reduce((soma, item) => soma + Math.max(item.saldo, 0), 0),
    valorDeCusto: ativos.reduce((soma, item) => soma + item.produto.precoCusto * Math.max(item.saldo, 0), 0),
    valorDeVenda: ativos.reduce((soma, item) => soma + item.produto.precoVenda * Math.max(item.saldo, 0), 0),
    precisamRepor: ativos.filter(precisaRepor).length,
    esgotados: ativos.filter((item) => item.nivel === "esgotado").length,
    vendasNoMes,
    consumoEmAberto,
  };
}

export interface ItemDaListaDeCompras extends ProdutoComSaldo {
  /** Quanto comprar para voltar ao dobro do minimo (regra do MVP). */
  sugerido: number;
}

/** Itens a repor, do mais urgente (proporcionalmente mais longe do minimo) ao menos. */
export function listaDeCompras(lista: ProdutoComSaldo[]): ItemDaListaDeCompras[] {
  const urgencia = (item: ProdutoComSaldo) =>
    Math.max(item.saldo, 0) / Math.max(item.produto.estoqueMinimo, 1);
  return lista
    .filter(precisaRepor)
    .map((item) => ({
      ...item,
      sugerido: Math.max(
        item.produto.estoqueMinimo * 2 - Math.max(item.saldo, 0),
        item.produto.estoqueMinimo,
        1,
      ),
    }))
    .sort(
      (a, b) =>
        urgencia(a) - urgencia(b) || a.produto.nome.localeCompare(b.produto.nome, "pt-BR"),
    );
}

export interface ItemMaisVendido {
  produtoId: string;
  nome: string;
  unidades: number;
  total: number;
}

/**
 * Mais vendidos nos ultimos `dias` dias (contando hoje). Conta as unidades
 * que sairam no balcao, o que orienta a reposicao.
 */
export function maisVendidos(
  banco: Banco,
  hoje: string,
  dias = 30,
  limite = 5,
): ItemMaisVendido[] {
  const desde = somarDias(hoje, -(dias - 1));
  const nomeAtual = new Map(banco.produtos.map((p) => [p.id, p.nome]));
  const porProduto = new Map<string, ItemMaisVendido>();

  banco.consumos.forEach((consumo) => {
    const dia = consumo.data.slice(0, 10);
    if (dia < desde || dia > hoje) return;
    const item = porProduto.get(consumo.produtoId) ?? {
      produtoId: consumo.produtoId,
      nome: nomeAtual.get(consumo.produtoId) ?? consumo.produtoNome,
      unidades: 0,
      total: 0,
    };
    porProduto.set(consumo.produtoId, {
      ...item,
      unidades: item.unidades + consumo.quantidade,
      total: item.total + valorDoConsumo(consumo),
    });
  });

  return [...porProduto.values()]
    .sort((a, b) => b.unidades - a.unidades || b.total - a.total)
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// Movimentos
// ---------------------------------------------------------------------------

export interface MovimentoDetalhado {
  movimento: MovimentoEstoque;
  produtoNome: string;
  /** Quanto o movimento mudou o saldo (+ entra, - sai). */
  efeito: number;
  /** Nas vendas: quem consumiu. */
  pessoaNome?: string;
}

function detalhar(
  banco: Banco,
  movimento: MovimentoEstoque,
  nomes: Map<string, string>,
  consumos: Map<string, Consumo>,
): MovimentoDetalhado {
  const consumo = movimento.consumoId ? consumos.get(movimento.consumoId) : undefined;
  return {
    movimento,
    produtoNome: nomes.get(movimento.produtoId) ?? "Produto removido",
    efeito: efeitoNoSaldo(movimento),
    pessoaNome: consumo ? nomeDaPessoa(banco, consumo.pessoaId) : undefined,
  };
}

/**
 * Do mais recente para o mais antigo. Movimentos gravados no mesmo segundo
 * ficam na ordem inversa da gravacao (o ultimo gravado primeiro).
 */
function maisRecentesPrimeiro(movimentos: MovimentoEstoque[]): MovimentoEstoque[] {
  return [...movimentos].reverse().sort((a, b) => b.data.localeCompare(a.data));
}

export function movimentacoesRecentes(banco: Banco, limite = 10): MovimentoDetalhado[] {
  const nomes = new Map(banco.produtos.map((p) => [p.id, p.nome]));
  const recentes = maisRecentesPrimeiro(banco.movimentosEstoque).slice(0, limite);
  const ids = new Set(recentes.map((m) => m.consumoId).filter(Boolean));
  const consumos = new Map(banco.consumos.filter((c) => ids.has(c.id)).map((c) => [c.id, c]));
  return recentes.map((m) => detalhar(banco, m, nomes, consumos));
}

export interface LinhaDoExtrato extends MovimentoDetalhado {
  /** Saldo do produto logo depois deste movimento. */
  saldoApos: number;
  /** Nas entradas: a conta a pagar ao fornecedor gravada junto. */
  contaAPagar?: Lancamento;
}

/** Todos os movimentos de um produto, do mais recente ao mais antigo, com o saldo de cada momento. */
export function extratoDoProduto(banco: Banco, produtoId: string): LinhaDoExtrato[] {
  const nomes = new Map(banco.produtos.map((p) => [p.id, p.nome]));
  const doProduto = banco.movimentosEstoque.filter((m) => m.produtoId === produtoId);
  const consumos = new Map(
    banco.consumos.filter((c) => c.produtoId === produtoId).map((c) => [c.id, c]),
  );
  const contas = new Map(
    banco.lancamentos
      .filter((l) => l.movimentoEstoqueId)
      .map((l) => [l.movimentoEstoqueId as string, l]),
  );

  // Ordem cronologica para acumular o saldo; depois inverte para a tela.
  const cronologica = maisRecentesPrimeiro(doProduto).reverse();
  let saldo = 0;
  return cronologica
    .map((movimento) => {
      saldo += efeitoNoSaldo(movimento);
      return {
        ...detalhar(banco, movimento, nomes, consumos),
        saldoApos: saldo,
        contaAPagar: contas.get(movimento.id),
      };
    })
    .reverse();
}

export interface DetalheDoProduto extends ProdutoComSaldo {
  extrato: LinhaDoExtrato[];
  vendidos30Dias: { unidades: number; total: number };
  perdas30Dias: number;
  ultimaEntrada?: MovimentoEstoque;
}

export function detalheDoProduto(
  banco: Banco,
  produtoId: string,
  hoje: string,
): DetalheDoProduto | undefined {
  const item = produtoComSaldo(banco, produtoId);
  if (!item) return undefined;
  const extrato = extratoDoProduto(banco, produtoId);
  const desde = somarDias(hoje, -29);
  const ultimos30 = extrato.filter((linha) => linha.movimento.data.slice(0, 10) >= desde);
  const vendas = banco.consumos.filter(
    (c) => c.produtoId === produtoId && c.data.slice(0, 10) >= desde,
  );
  return {
    ...item,
    extrato,
    vendidos30Dias: {
      unidades: vendas.reduce((soma, c) => soma + c.quantidade, 0),
      total: vendas.reduce((soma, c) => soma + valorDoConsumo(c), 0),
    },
    perdas30Dias: ultimos30
      .filter((linha) => linha.movimento.tipo === "perda")
      .reduce((soma, linha) => soma + linha.movimento.quantidade, 0),
    ultimaEntrada: extrato.find((linha) => linha.movimento.tipo === "entrada")?.movimento,
  };
}

/** Fornecedores ja usados em contas a pagar (sugestoes no formulario de entrada). */
export function fornecedoresConhecidos(banco: Banco): string[] {
  const nomes = new Set<string>();
  banco.lancamentos.forEach((l) => {
    if (l.categoria === "Fornecedor" && l.nomePagante) nomes.add(l.nomePagante);
  });
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Fornecedor da ultima compra deste produto que gerou conta a pagar. */
export function ultimoFornecedorDoProduto(banco: Banco, produtoId: string): string | undefined {
  const entradas = new Map(
    banco.movimentosEstoque
      .filter((m) => m.produtoId === produtoId && m.tipo === "entrada")
      .map((m) => [m.id, m.data]),
  );
  return banco.lancamentos
    .filter((l) => l.movimentoEstoqueId && entradas.has(l.movimentoEstoqueId) && l.nomePagante)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0]?.nomePagante;
}

// ---------------------------------------------------------------------------
// Conta de consumo de uma pessoa (fichas de aluno e de professor)
// ---------------------------------------------------------------------------

export type SituacaoDoConsumo = "em_aberto" | "em_atraso" | "pago" | "anulado";

export interface ConsumoNaConta {
  consumo: Consumo;
  /** Lancamento a receber gerado junto com o consumo. */
  cobranca?: Lancamento;
  situacao: SituacaoDoConsumo;
  valor: number;
}

function situacaoDoConsumo(cobranca: Lancamento | undefined, hoje: string): SituacaoDoConsumo {
  if (!cobranca) return "em_aberto";
  switch (situacaoLancamento(cobranca, hoje)) {
    case "pago":
      return "pago";
    case "cancelado":
      return "anulado";
    case "em_atraso":
      return "em_atraso";
    default:
      return "em_aberto";
  }
}

/** Consumo da pessoa, do mais recente ao mais antigo, com a situacao de cada um. */
export function consumosDaPessoa(banco: Banco, pessoaId: string, hoje: string): ConsumoNaConta[] {
  const cobrancas = cobrancasPorConsumo(
    banco.lancamentos.filter((l) => l.pessoaId === pessoaId),
  );
  return banco.consumos
    .filter((c) => c.pessoaId === pessoaId)
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((consumo) => {
      const cobranca = cobrancas.get(consumo.id);
      return {
        consumo,
        cobranca,
        situacao: situacaoDoConsumo(cobranca, hoje),
        valor: cobranca?.valor ?? valorDoConsumo(consumo),
      };
    });
}

export interface ResumoDaConta {
  /** Tudo o que falta pagar (pendente + em atraso). */
  emAberto: number;
  quantidadeEmAberto: number;
  /** Parte do em aberto que ja passou do vencimento. */
  emAtraso: number;
  /** Vencimento mais antigo entre os consumos em atraso. */
  vencimentoMaisAntigo?: string;
  pago: number;
}

export function resumoDaConta(lista: ConsumoNaConta[]): ResumoDaConta {
  const abertos = lista.filter((c) => c.situacao === "em_aberto" || c.situacao === "em_atraso");
  const atrasados = lista.filter((c) => c.situacao === "em_atraso");
  return {
    emAberto: abertos.reduce((soma, c) => soma + c.valor, 0),
    quantidadeEmAberto: abertos.length,
    emAtraso: atrasados.reduce((soma, c) => soma + c.valor, 0),
    vencimentoMaisAntigo: atrasados
      .map((c) => c.cobranca?.vencimento ?? "")
      .filter(Boolean)
      .sort()[0],
    pago: lista.filter((c) => c.situacao === "pago").reduce((soma, c) => soma + c.valor, 0),
  };
}

/** Vencimento de um consumo lancado hoje (Hipotese H13). */
export function vencimentoDoConsumo(banco: Banco, hoje: string): string {
  return somarDias(hoje, banco.configuracoes.prazoPagamentoConsumoDias);
}

export interface PessoaDoBalcao {
  id: string;
  tipo: "aluno" | "professor";
  nome: string;
  fotoUrl?: string;
}

/** Quem pode ter consumo lancado: alunos e professores ativos, por nome. */
export function pessoasDoBalcao(banco: Banco): PessoaDoBalcao[] {
  return [
    ...banco.alunos
      .filter((a) => a.ativo)
      .map((a) => ({ id: a.id, tipo: "aluno" as const, nome: a.nome, fotoUrl: a.fotoUrl })),
    ...banco.professores
      .filter((p) => p.ativo)
      .map((p) => ({ id: p.id, tipo: "professor" as const, nome: p.nome })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Busca por nome, sem diferenca de acentos e maiusculas. */
export function buscarPessoasDoBalcao(
  pessoas: PessoaDoBalcao[],
  busca: string,
  limite = 8,
): PessoaDoBalcao[] {
  const termo = nomeNormalizado(busca);
  if (!termo) return [];
  return pessoas.filter((p) => nomeNormalizado(p.nome).includes(termo)).slice(0, limite);
}
