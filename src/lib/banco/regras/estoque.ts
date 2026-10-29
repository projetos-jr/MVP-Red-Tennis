/**
 * Regras do estoque.
 *
 * O saldo de cada produto e a soma dos movimentos: entradas somam, vendas e
 * perdas subtraem, ajustes trazem o proprio sinal. Ninguem digita o saldo.
 *
 * No banco real: view `saldo_estoque` (soma dos movimentos), check
 * constraints nos precos e na quantidade, indice unico no nome do produto e
 * as funcoes `lancar_consumo`, `registrar_entrada` e `fechar_conta_consumo`
 * (ver `docs/modulos/estoque.md`).
 */

import type {
  CategoriaProduto,
  Colaborador,
  Configuracoes,
  Lancamento,
  MovimentoEstoque,
  Produto,
} from "../tipos";
import { ErroDeRegra } from "./comum";

/** Categorias do balcao, na ordem em que aparecem nas telas. */
export const CATEGORIAS_PRODUTO: CategoriaProduto[] = [
  "Bebidas",
  "Cervejas",
  "Lanches",
  "Acessórios",
];

/** Quanto o movimento muda o saldo. */
export function efeitoNoSaldo(movimento: MovimentoEstoque): number {
  switch (movimento.tipo) {
    case "entrada":
      return movimento.quantidade;
    case "venda":
    case "perda":
      return -movimento.quantidade;
    case "ajuste":
      return movimento.quantidade;
  }
}

/** Saldo de todos os produtos de uma vez. */
export function saldosDeEstoque(movimentos: MovimentoEstoque[]): Map<string, number> {
  const saldos = new Map<string, number>();
  movimentos.forEach((m) => {
    saldos.set(m.produtoId, (saldos.get(m.produtoId) ?? 0) + efeitoNoSaldo(m));
  });
  return saldos;
}

export function saldoDoProduto(movimentos: MovimentoEstoque[], produtoId: string): number {
  return movimentos.reduce(
    (soma, m) => (m.produtoId === produtoId ? soma + efeitoNoSaldo(m) : soma),
    0,
  );
}

/** Recusa saidas maiores que o saldo: o estoque nunca fica negativo. */
export function garantirSaldoDeEstoque(
  movimentos: MovimentoEstoque[],
  produtoId: string,
  nomeProduto: string,
  quantidadeSaindo: number,
): void {
  const saldo = saldoDoProduto(movimentos, produtoId);
  if (quantidadeSaindo > saldo) {
    throw new ErroDeRegra(
      saldo === 0
        ? `${nomeProduto} está esgotado.`
        : `Só há ${saldo} unidade(s) de ${nomeProduto} em estoque.`,
    );
  }
}

/** Quantidade de um movimento: numero inteiro maior que zero. */
export function garantirQuantidadeValida(quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new ErroDeRegra("A quantidade precisa ser um número inteiro maior que zero.");
  }
}

/**
 * Hipotese H9: so quem tem o modulo "estoque" no perfil grava no estoque
 * (dono e recepcao; professor so le). No banco real vira politica de RLS.
 */
export function garantirAcessoAoEstoque(
  configuracoes: Configuracoes,
  usuario: Pick<Colaborador, "perfil">,
): void {
  if (!configuracoes.permissoes[usuario.perfil]?.includes("estoque")) {
    throw new ErroDeRegra("Seu perfil não tem permissão para mexer no estoque.");
  }
}

// ---------------------------------------------------------------------------
// Cadastro de produto
// ---------------------------------------------------------------------------

/**
 * Forma do nome usada para comparar: sem acentos, sem diferenca entre
 * maiusculas e minusculas e sem espacos repetidos. "Água  Mineral" e
 * "agua mineral" sao o mesmo produto.
 */
export function nomeNormalizado(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nome unico, contando tambem os produtos inativos (o nome continua no
 * historico). `ignorarId` deixa o proprio produto de fora ao editar.
 */
export function garantirNomeDeProdutoUnico(
  produtos: Produto[],
  nome: string,
  ignorarId?: string,
): void {
  const alvo = nomeNormalizado(nome);
  const repetido = produtos.find((p) => p.id !== ignorarId && nomeNormalizado(p.nome) === alvo);
  if (!repetido) return;
  throw new ErroDeRegra(
    repetido.ativo
      ? `Já existe um produto chamado "${repetido.nome}".`
      : `Já existe um produto inativo chamado "${repetido.nome}". Reative-o em vez de cadastrar outro.`,
  );
}

/** Precos sao numeros, zero ou maiores. */
export function garantirPrecosValidos(precoCusto: number, precoVenda: number): void {
  if (!Number.isFinite(precoCusto)) throw new ErroDeRegra("Informe o preço de custo.");
  if (!Number.isFinite(precoVenda)) throw new ErroDeRegra("Informe o preço de venda.");
  if (precoCusto < 0) throw new ErroDeRegra("O preço de custo não pode ser negativo.");
  if (precoVenda < 0) throw new ErroDeRegra("O preço de venda não pode ser negativo.");
}

/**
 * Venda abaixo do custo: a tela avisa, mas deixa salvar (pode ser uma
 * promocao ou uma cortesia combinada).
 */
export function vendaAbaixoDoCusto(precoCusto: number, precoVenda: number): boolean {
  return precoVenda < precoCusto;
}

/** Produto que pode ser vendido agora: ativo e com saldo para a quantidade pedida. */
export function garantirProdutoVendavel(
  movimentos: MovimentoEstoque[],
  produto: Produto,
  quantidade: number,
): void {
  if (!produto.ativo) {
    throw new ErroDeRegra(`${produto.nome} está inativo e não pode ser vendido.`);
  }
  garantirSaldoDeEstoque(movimentos, produto.id, produto.nome, quantidade);
}

// ---------------------------------------------------------------------------
// Conta de consumo
// ---------------------------------------------------------------------------

/**
 * Cobrancas de consumo da pessoa que ainda nao foram pagas nem anuladas
 * (pendentes e em atraso). E o que o "Fechar conta" paga de uma vez.
 */
export function lancamentosDeConsumoEmAberto(
  lancamentos: Lancamento[],
  pessoaId: string,
): Lancamento[] {
  return lancamentos.filter(
    (l) =>
      l.tipo === "receber" &&
      l.categoria === "Consumo" &&
      Boolean(l.consumoId) &&
      l.pessoaId === pessoaId &&
      !l.pagoEm &&
      !l.canceladoEm,
  );
}
