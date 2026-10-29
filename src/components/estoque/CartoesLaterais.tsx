"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { IconeEntrada, IconeEstoque, IconeSubiu } from "@/components/ui/Icons";
import type {
  ItemDaListaDeCompras,
  ItemMaisVendido,
  MovimentoDetalhado,
} from "@/lib/consultas/estoque";
import { ESTILO_MOVIMENTO, formatarMoeda } from "@/lib/theme";
import { comSinal, diaEHora } from "./formatos";
import { IconeCarrinho } from "./Icones";
import { SeloDoNivel } from "./NivelDoEstoque";

/**
 * Cartoes da coluna lateral do estoque: lista de compras, mais vendidos e
 * movimentacoes recentes.
 */

export function CartaoListaDeCompras({
  itens,
  aoDarEntrada,
}: {
  itens: ItemDaListaDeCompras[];
  /** Sem esta funcao (perfil so de leitura), a lista nao tem botao. */
  aoDarEntrada?: (item: ItemDaListaDeCompras) => void;
}) {
  return (
    <Card>
      <CardHeader
        titulo="Lista de compras"
        descricao="Itens esgotados ou abaixo do mínimo, do mais urgente ao menos."
        icone={<IconeCarrinho className="h-5 w-5" />}
      />
      <ul className="divide-y divide-areia-100">
        {itens.map((item) => (
          <li key={item.produto.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-areia-900">{item.produto.nome}</p>
              <p className="text-xs text-areia-500">
                Tem {item.saldo} · mín. {item.produto.estoqueMinimo} ·{" "}
                <span className="font-medium text-areia-700">comprar ~{item.sugerido}</span>
              </p>
            </div>
            <SeloDoNivel nivel={item.nivel} className="shrink-0 text-[10px]" />
            {aoDarEntrada && (
              <button
                type="button"
                onClick={() => aoDarEntrada(item)}
                className="btn-secundario shrink-0 px-2 py-1.5"
                aria-label={`Registrar entrada de ${item.produto.nome}`}
                title="Registrar a chegada da mercadoria"
              >
                <IconeEntrada className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}

        {itens.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-areia-500">
            Todo o estoque está acima do mínimo.
          </li>
        )}
      </ul>
    </Card>
  );
}

export function CartaoMaisVendidos({ itens }: { itens: ItemMaisVendido[] }) {
  return (
    <Card>
      <CardHeader
        titulo="Mais vendidos"
        descricao="Últimos 30 dias."
        icone={<IconeSubiu className="h-5 w-5" />}
      />
      <ol className="divide-y divide-areia-100">
        {itens.map((item, i) => (
          <li key={item.produtoId} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-5 shrink-0 text-right text-sm font-bold text-areia-400">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-areia-900">{item.nome}</p>
              <p className="text-xs text-areia-500">{item.unidades} unidades</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-areia-800">
              {formatarMoeda(item.total)}
            </span>
          </li>
        ))}
        {itens.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-areia-500">
            Nenhuma venda nos últimos 30 dias.
          </li>
        )}
      </ol>
    </Card>
  );
}

/** Uma linha de movimento: produto, quantidade com sinal, tipo, data e responsavel. */
export function LinhaDeMovimento({
  item,
  mostrarProduto = true,
  saldoApos,
}: {
  item: MovimentoDetalhado;
  mostrarProduto?: boolean;
  /** No extrato do produto: saldo logo depois do movimento. */
  saldoApos?: number;
}) {
  const { movimento, produtoNome, efeito, pessoaNome } = item;
  const estilo = ESTILO_MOVIMENTO[movimento.tipo];
  const nota = pessoaNome ? `Consumo de ${pessoaNome}` : movimento.observacao;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-areia-900">
          {mostrarProduto ? (
            produtoNome
          ) : (
            <span className="font-medium" style={{ color: estilo.cor }}>
              {estilo.label}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: estilo.cor }}>
          {comSinal(efeito)}
        </span>
      </div>
      <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-areia-500">
        <span className="min-w-0 truncate">
          {mostrarProduto && `${estilo.label} · `}
          {diaEHora(movimento.data)} · {movimento.responsavel}
        </span>
        {saldoApos !== undefined && (
          <span className="shrink-0 tabular-nums">saldo {saldoApos}</span>
        )}
      </p>
      {nota && <p className="mt-0.5 truncate text-xs text-areia-600">{nota}</p>}
    </div>
  );
}

export function CartaoMovimentacoes({ itens }: { itens: MovimentoDetalhado[] }) {
  return (
    <Card>
      <CardHeader
        titulo="Movimentações recentes"
        descricao="Entradas, vendas, perdas e ajustes, com quem registrou."
        icone={<IconeEstoque className="h-5 w-5" />}
      />
      <ul className="divide-y divide-areia-100">
        {itens.map((item) => (
          <li key={item.movimento.id} className="px-4 py-2.5">
            <LinhaDeMovimento item={item} />
          </li>
        ))}
        {itens.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-areia-500">
            Nenhuma movimentação registrada.
          </li>
        )}
      </ul>
    </Card>
  );
}
