"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { IconeEntrada, IconeLixeira, IconeProximo } from "@/components/ui/Icons";
import type { ProdutoComSaldo } from "@/lib/consultas/estoque";
import { ESTILO_CATEGORIA_PRODUTO, formatarMoeda } from "@/lib/theme";
import { IconeContagem } from "./Icones";
import { BarraDoNivel, SaldoEmDestaque, SeloDoNivel } from "./NivelDoEstoque";

export type AcaoRapida = "entrada" | "perda" | "inventario" | "reativar";

interface CardProdutoProps {
  item: ProdutoComSaldo;
  aoAgir: (acao: AcaoRapida, item: ProdutoComSaldo) => void;
}

/**
 * Cartao de um item do estoque.
 *
 * A leitura rapida vem da combinacao de tres sinais — barra de nivel, numero
 * grande e rotulo de situacao — para nao depender so da cor. O nome leva ao
 * detalhe do produto (cadastro, movimentos, comentarios e historico).
 */
export function CardProduto({ item, aoAgir }: CardProdutoProps) {
  const { produto, saldo, nivel } = item;
  const categoria = ESTILO_CATEGORIA_PRODUTO[produto.categoria];

  return (
    <article
      className={`flex flex-col rounded-2xl border p-4 shadow-card transition-shadow hover:shadow-card-hover ${
        produto.ativo ? "border-areia-200 bg-white" : "border-dashed border-areia-300 bg-areia-50"
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight text-areia-900">
            <Link
              href={`/estoque/produto?id=${produto.id}`}
              className="group inline-flex items-start gap-1 rounded hover:text-tijolo-700"
            >
              <span className="group-hover:underline">{produto.nome}</span>
              <IconeProximo className="mt-px h-3.5 w-3.5 shrink-0 text-areia-400 group-hover:text-tijolo-700" />
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-areia-500">{produto.unidade}</p>
        </div>
        <Badge
          cor={categoria.cor}
          fundo={categoria.fundo}
          borda={categoria.borda}
          className="shrink-0 text-[10px]"
        >
          {produto.categoria}
        </Badge>
      </header>

      <div className="mt-3 flex items-end justify-between gap-2">
        <SaldoEmDestaque saldo={saldo} estoqueMinimo={produto.estoqueMinimo} nivel={nivel} />
        {produto.ativo ? (
          <SeloDoNivel nivel={nivel} className="text-[11px]" />
        ) : (
          <Badge className="text-[11px]">Inativo</Badge>
        )}
      </div>

      <BarraDoNivel
        saldo={saldo}
        estoqueMinimo={produto.estoqueMinimo}
        nivel={nivel}
        className="mt-2.5"
      />

      <p className="mt-2.5 text-xs text-areia-600">
        Venda <strong className="font-semibold">{formatarMoeda(produto.precoVenda)}</strong>
        <span className="text-areia-500"> · custo {formatarMoeda(produto.precoCusto)}</span>
      </p>

      {produto.ativo ? (
        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => aoAgir("entrada", item)}
            className="btn-secundario flex-1 px-2 py-1.5 text-xs"
          >
            <IconeEntrada className="h-3.5 w-3.5" />
            Entrada
          </button>
          <button
            type="button"
            onClick={() => aoAgir("perda", item)}
            disabled={saldo <= 0}
            className="btn-secundario px-2.5 py-1.5 text-xs"
            title="Registrar perda (quebra, vencimento, cortesia)"
          >
            <IconeLixeira className="h-3.5 w-3.5" />
            Perda
          </button>
          <button
            type="button"
            onClick={() => aoAgir("inventario", item)}
            className="btn-secundario px-2.5 py-1.5 text-xs"
            title="Ajuste de inventário: informe quanto há na prateleira"
          >
            <IconeContagem className="h-3.5 w-3.5" />
            Contagem
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-areia-500">Fora das listas de venda.</p>
          <button
            type="button"
            onClick={() => aoAgir("reativar", item)}
            className="btn-secundario px-2.5 py-1.5 text-xs"
          >
            Reativar
          </button>
        </div>
      )}
    </article>
  );
}
