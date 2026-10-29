/**
 * Regras do estoque.
 *
 * O saldo de cada produto e a soma dos movimentos: entradas somam, vendas e
 * perdas subtraem, ajustes trazem o proprio sinal. Ninguem digita o saldo.
 */

import type { MovimentoEstoque } from "../tipos";
import { ErroDeRegra } from "./comum";

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
