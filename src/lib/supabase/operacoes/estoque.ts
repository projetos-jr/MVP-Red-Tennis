/**
 * Estoque e consumo no balcao: cadastro de produtos, entradas, perdas,
 * inventario, consumo e fechamento da conta.
 *
 * Todas as operacoes viram funcoes do banco (`supabase/migrations/
 * 20261030120300_funcoes_financeiro_estoque.sql`). Ninguem grava saldo: o
 * banco grava movimentos e o saldo e a soma deles. Mapa completo em
 * `docs/modulos/estoque.md`, secao "No banco (funções)".
 */

import {
  ajustarInventario,
  cadastrarProduto,
  editarProduto,
  fecharContaDeConsumo,
  inativarProduto,
  lancarConsumo,
  reativarProduto,
  registrarEntrada,
  registrarPerda,
} from "@/lib/banco/operacoes/estoque";
import { ligar, porFuncao } from "../gravar";

/** Id de um retorno em JSON (`{ "movimento_id": ... }`). */
function campoDoRetorno(campo: string) {
  return (retorno: unknown): string | undefined => {
    if (!retorno || typeof retorno !== "object") return undefined;
    const valor = (retorno as Record<string, unknown>)[campo];
    return typeof valor === "string" ? valor : undefined;
  };
}

// Devolve o id do produto criado (diferente do que a tela gerou).
ligar(
  cadastrarProduto,
  porFuncao(
    "cadastrar_produto",
    (d) => ({
      p_nome: d.nome,
      p_categoria: d.categoria,
      p_unidade: d.unidade,
      p_preco_custo: d.precoCusto,
      p_preco_venda: d.precoVenda,
      p_estoque_minimo: d.estoqueMinimo,
    }),
    ["produtos"],
  ),
);

ligar(
  editarProduto,
  porFuncao(
    "editar_produto",
    (d) => ({
      p_id: d.id,
      p_nome: d.nome,
      p_categoria: d.categoria,
      p_unidade: d.unidade,
      p_preco_custo: d.precoCusto,
      p_preco_venda: d.precoVenda,
      p_estoque_minimo: d.estoqueMinimo,
    }),
    ["produtos"],
  ),
);

ligar(inativarProduto, porFuncao("inativar_produto", (d) => ({ p_id: d.id }), ["produtos"]));

ligar(reativarProduto, porFuncao("reativar_produto", (d) => ({ p_id: d.id }), ["produtos"]));

// Com conta a pagar, o banco grava na mesma transacao o lancamento ao
// fornecedor (exige tambem "financeiro_pagar").
ligar(
  registrarEntrada,
  porFuncao(
    "registrar_entrada",
    (d) => ({
      p_produto_id: d.produtoId,
      p_quantidade: d.quantidade,
      p_observacao: d.observacao,
      p_conta_a_pagar: d.contaAPagar
        ? {
            favorecido: d.contaAPagar.favorecido,
            valor: d.contaAPagar.valor,
            vencimento: d.contaAPagar.vencimento,
          }
        : undefined,
    }),
    ["movimentosEstoque", "lancamentos"],
    campoDoRetorno("movimento_id"),
  ),
);

ligar(
  registrarPerda,
  porFuncao(
    "registrar_perda",
    (d) => ({ p_produto_id: d.produtoId, p_quantidade: d.quantidade, p_motivo: d.motivo }),
    ["movimentosEstoque"],
  ),
);

ligar(
  ajustarInventario,
  porFuncao(
    "ajustar_inventario",
    (d) => ({
      p_produto_id: d.produtoId,
      p_saldo_contado: d.saldoContado,
      p_observacao: d.observacao,
    }),
    ["movimentosEstoque"],
    campoDoRetorno("movimento_id"),
  ),
);

// Consumo + baixa no estoque + conta a receber, numa transacao so.
ligar(
  lancarConsumo,
  porFuncao(
    "lancar_consumo",
    (d) => ({
      p_pessoa_id: d.pessoaId,
      p_pessoa_tipo: d.pessoaTipo,
      p_produto_id: d.produtoId,
      p_quantidade: d.quantidade,
    }),
    ["consumos", "movimentosEstoque", "lancamentos"],
  ),
);

ligar(
  fecharContaDeConsumo,
  porFuncao(
    "fechar_conta_de_consumo",
    (d) => ({
      p_pessoa_id: d.pessoaId,
      p_pago_em: d.pagoEm || undefined,
      p_forma_pagamento: d.formaPagamento,
    }),
    ["lancamentos"],
  ),
);
