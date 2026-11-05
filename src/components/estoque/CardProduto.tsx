"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { IconeProximo } from "@/components/ui/Icons";
import type { ProdutoComSaldo } from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";
import { IconeMovimentar } from "./Icones";
import { BarraDoNivel, SaldoEmDestaque, SeloDoNivel } from "./NivelDoEstoque";

interface CardProdutoProps {
  item: ProdutoComSaldo;
  /** Abre a janela "Movimentar" (Entrada, Perda, Contagem). */
  aoMovimentar: (item: ProdutoComSaldo) => void;
  aoReativar: (item: ProdutoComSaldo) => void;
}

/**
 * Cartão de um item do estoque, limpo para bater o olho: nome grande, saldo
 * em número de placar e a situação (Em dia, Atenção, Repor já, Esgotado), com
 * a barra do nível — três sinais, nunca só a cor.
 *
 * Tocar em qualquer parte do cartão abre a janela "Movimentar" (o botão
 * "Movimentar" se estende pelo cartão inteiro); o nome continua levando ao
 * detalhe do produto (cadastro, movimentos, comentários e histórico).
 */
export function CardProduto({ item, aoMovimentar, aoReativar }: CardProdutoProps) {
  const { produto, saldo, nivel } = item;

  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-4 shadow-card transition-shadow sm:p-5 ${
        produto.ativo
          ? "border-areia-200 bg-white hover:border-saibro-300 hover:shadow-card-hover"
          : "border-dashed border-areia-300 bg-areia-50"
      }`}
    >
      <h3 className="text-lg font-semibold leading-tight text-areia-900">
        {/* relative z-10: fica acima do botão que cobre o cartão. */}
        <Link
          href={`/estoque/produto?id=${produto.id}`}
          className="alvo-de-toque group relative z-10 inline-flex items-center gap-1 rounded hover:text-saibro-700"
        >
          <span className="group-hover:underline">{produto.nome}</span>
          <IconeProximo className="h-4 w-4 shrink-0 text-areia-500 group-hover:text-saibro-700" />
        </Link>
      </h3>
      <p className="text-sm text-areia-600">
        {produto.unidade} · {formatarMoeda(produto.precoVenda)}
      </p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <SaldoEmDestaque saldo={saldo} estoqueMinimo={produto.estoqueMinimo} nivel={nivel} tamanho="lg" />
        {produto.ativo ? (
          <SeloDoNivel nivel={nivel} className="shrink-0 text-sm" />
        ) : (
          <Badge className="shrink-0 text-sm">Inativo</Badge>
        )}
      </div>

      <BarraDoNivel
        saldo={saldo}
        estoqueMinimo={produto.estoqueMinimo}
        nivel={nivel}
        className="mt-3"
      />

      {produto.ativo ? (
        <button
          type="button"
          onClick={() => aoMovimentar(item)}
          aria-label={`Movimentar ${produto.nome}: entrada, perda ou contagem`}
          className="btn-secundario mt-4 w-full py-3 text-base after:absolute after:inset-0 after:rounded-2xl after:content-['']"
        >
          <IconeMovimentar className="h-5 w-5" />
          Movimentar
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-areia-600">Fora das listas de venda.</p>
          <button
            type="button"
            onClick={() => aoReativar(item)}
            className="btn-secundario px-4 py-2.5 text-base"
          >
            Reativar
          </button>
        </div>
      )}
    </article>
  );
}
