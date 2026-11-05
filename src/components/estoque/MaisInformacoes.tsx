"use client";

import { SecaoRecolhida } from "@/components/financeiro/SecaoRecolhida";
import { IconeSubiu } from "@/components/ui/Icons";
import type { ItemMaisVendido, MovimentoDetalhado } from "@/lib/consultas/estoque";
import { ESTILO_MOVIMENTO, formatarMoeda } from "@/lib/theme";
import { comSinal, diaEHora } from "./formatos";

/**
 * "Ver mais informações" do estoque: mais vendidos (30 dias) e movimentações
 * recentes. Começa fechado: é apoio, não é do dia a dia.
 */
export function MaisInformacoes({
  maisVendidos,
  movimentacoes,
}: {
  maisVendidos: ItemMaisVendido[];
  movimentacoes: MovimentoDetalhado[];
}) {
  return (
    <SecaoRecolhida
      titulo="Ver mais informações"
      resumo="Mais vendidos dos últimos 30 dias e movimentações recentes, com quem registrou."
      icone={<IconeSubiu className="h-5 w-5" />}
    >
      <div className="grid md:grid-cols-2 md:divide-x md:divide-areia-200">
        <section aria-labelledby="titulo-mais-vendidos" className="min-w-0">
          <h3
            id="titulo-mais-vendidos"
            className="px-4 pb-1 pt-4 font-display text-xl font-bold text-areia-900 sm:px-5"
          >
            Mais vendidos <span className="text-base font-semibold text-areia-600">· últimos 30 dias</span>
          </h3>
          <ol className="divide-y divide-areia-100">
            {maisVendidos.map((item, i) => (
              <li key={item.produtoId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="w-6 shrink-0 text-right font-display text-xl font-bold text-areia-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-areia-900">{item.nome}</p>
                  <p className="text-sm text-areia-600">{item.unidades} unidades</p>
                </div>
                <span className="shrink-0 text-base font-bold tabular-nums text-areia-900">
                  {formatarMoeda(item.total)}
                </span>
              </li>
            ))}
            {maisVendidos.length === 0 && (
              <li className="px-4 py-6 text-center text-base text-areia-600 sm:px-5">
                Nenhuma venda nos últimos 30 dias.
              </li>
            )}
          </ol>
        </section>

        <section
          aria-labelledby="titulo-movimentacoes"
          className="min-w-0 border-t border-areia-200 md:border-t-0"
        >
          <h3
            id="titulo-movimentacoes"
            className="px-4 pb-1 pt-4 font-display text-xl font-bold text-areia-900 sm:px-5"
          >
            Movimentações recentes
          </h3>
          <ul className="divide-y divide-areia-100">
            {movimentacoes.map((item) => (
              <li key={item.movimento.id} className="px-4 py-3 sm:px-5">
                <LinhaDeMovimento item={item} />
              </li>
            ))}
            {movimentacoes.length === 0 && (
              <li className="px-4 py-6 text-center text-base text-areia-600 sm:px-5">
                Nenhuma movimentação registrada.
              </li>
            )}
          </ul>
        </section>
      </div>
    </SecaoRecolhida>
  );
}

/** Uma linha de movimento: produto, quantidade com sinal, tipo, data e responsável. */
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
        <span className="min-w-0 truncate text-base text-areia-900">
          {mostrarProduto ? (
            <span className="font-semibold">{produtoNome}</span>
          ) : (
            <span className="font-semibold" style={{ color: estilo.cor }}>
              {estilo.label}
            </span>
          )}
        </span>
        <span className="shrink-0 text-lg font-bold tabular-nums" style={{ color: estilo.cor }}>
          {comSinal(efeito)}
        </span>
      </div>
      <p className="mt-0.5 flex items-center justify-between gap-2 text-sm text-areia-600">
        <span className="min-w-0 truncate">
          {mostrarProduto && `${estilo.label} · `}
          {diaEHora(movimento.data)} · {movimento.responsavel}
        </span>
        {saldoApos !== undefined && (
          <span className="shrink-0 tabular-nums">saldo {saldoApos}</span>
        )}
      </p>
      {nota && <p className="mt-0.5 truncate text-sm text-areia-600">{nota}</p>}
    </div>
  );
}
