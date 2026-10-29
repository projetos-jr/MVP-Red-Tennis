"use client";

import { useMemo, useState } from "react";
import { ModalConsumo } from "@/components/consumo/ModalConsumo";
import { CardProduto, type AcaoRapida } from "@/components/estoque/CardProduto";
import {
  CartaoListaDeCompras,
  CartaoMaisVendidos,
  CartaoMovimentacoes,
} from "@/components/estoque/CartoesLaterais";
import { ModaisDoEstoque, type AcaoDoEstoque } from "@/components/estoque/ModaisDoEstoque";
import { SemAcessoAoEstoque } from "@/components/estoque/SemAcessoAoEstoque";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import {
  IconeAlerta,
  IconeBusca,
  IconeCopo,
  IconeEstoque,
  IconeFinanceiro,
  IconeMais,
  IconeSubiu,
} from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { reativarProduto } from "@/lib/banco/operacoes/estoque";
import { podeAcessar } from "@/lib/consultas/base";
import {
  CATEGORIAS_PRODUTO,
  filtrarProdutos,
  listaDeCompras,
  maisVendidos,
  movimentacoesRecentes,
  produtosComSaldo,
  resumoDoEstoque,
  type FiltroEstoque,
  type ProdutoComSaldo,
} from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

const FILTRO_INICIAL: FiltroEstoque = {
  categoria: "todas",
  busca: "",
  apenasRepor: false,
  incluirInativos: false,
};

export default function PaginaEstoque() {
  const { banco, colaborador } = useApp();
  const gravar = useGravar();
  const [filtro, setFiltro] = useState<FiltroEstoque>(FILTRO_INICIAL);
  const [acao, setAcao] = useState<AcaoDoEstoque | null>(null);
  const [lancandoConsumo, setLancandoConsumo] = useState(false);

  // O saldo de cada produto e a soma dos movimentos: calculado uma vez por gravacao.
  const produtos = useMemo(() => produtosComSaldo(banco), [banco]);
  const resumo = useMemo(() => resumoDoEstoque(banco, produtos, HOJE), [banco, produtos]);
  const lista = useMemo(() => filtrarProdutos(produtos, filtro), [produtos, filtro]);
  const compras = useMemo(() => listaDeCompras(produtos), [produtos]);
  const campeoes = useMemo(() => maisVendidos(banco, HOJE), [banco]);
  const recentes = useMemo(() => movimentacoesRecentes(banco), [banco]);

  if (!podeAcessar(banco, colaborador, "estoque")) return <SemAcessoAoEstoque />;

  function mudarFiltro(parcial: Partial<FiltroEstoque>) {
    setFiltro((atual) => ({ ...atual, ...parcial }));
  }

  function agir(tipo: AcaoRapida, item: ProdutoComSaldo) {
    if (tipo === "reativar") {
      gravar(
        reativarProduto,
        { id: item.produto.id },
        `${item.produto.nome} voltou para o catálogo e para as listas de venda.`,
      );
      return;
    }
    setAcao({ tipo, produtoId: item.produto.id });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Estoque</h1>
          <p className="mt-1 text-sm text-areia-600">
            Bebidas, cervejas, lanches e acessórios vendidos no balcão da arena.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() =>
              setAcao({
                tipo: "novo",
                categoria: filtro.categoria === "todas" ? undefined : filtro.categoria,
              })
            }
            className="btn-secundario flex-1 sm:flex-none"
          >
            <IconeMais className="h-4 w-4" />
            Novo produto
          </button>
          <button
            type="button"
            onClick={() => setLancandoConsumo(true)}
            className="btn-primario flex-1 sm:flex-none"
          >
            <IconeCopo className="h-4 w-4" />
            Lançar consumo
          </button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Unidades em estoque"
          rotuloCurto="Unidades"
          valor={String(resumo.unidades)}
          detalhe={`${resumo.produtosAtivos} itens ativos${
            resumo.produtosInativos > 0 ? ` · ${resumo.produtosInativos} inativo(s)` : ""
          }`}
          icone={<IconeEstoque className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Precisam de reposição"
          rotuloCurto="Repor"
          valor={String(resumo.precisamRepor)}
          detalhe={
            resumo.esgotados > 0
              ? `${resumo.esgotados} item(ns) já esgotado(s)`
              : "Nenhum item esgotado"
          }
          icone={<IconeAlerta className="h-5 w-5" />}
          tom={resumo.precisamRepor > 0 ? "alerta" : "positivo"}
        />
        <StatCard
          rotulo="Vendas no mês"
          rotuloCurto="Vendas"
          valor={formatarMoeda(resumo.vendasNoMes)}
          detalhe={`${formatarMoeda(resumo.consumoEmAberto)} em aberto nas contas`}
          icone={<IconeSubiu className="h-5 w-5" />}
          tom="positivo"
        />
        <StatCard
          rotulo="Valor do estoque"
          rotuloCurto="Valor"
          valor={formatarMoeda(resumo.valorDeVenda)}
          detalhe={`Custo ${formatarMoeda(resumo.valorDeCusto)} · margem ${formatarMoeda(
            resumo.valorDeVenda - resumo.valorDeCusto,
          )}`}
          icone={<IconeFinanceiro className="h-5 w-5" />}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-4">
        {/* Catálogo */}
        <Card className="xl:col-span-3">
          <CardHeader
            titulo="Itens em estoque"
            descricao="A barra mostra o saldo; o traço indica o estoque mínimo. Clique no nome para ver o detalhe."
            icone={<IconeEstoque className="h-5 w-5" />}
          />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-areia-200 px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
              <input
                value={filtro.busca}
                onChange={(e) => mudarFiltro({ busca: e.target.value })}
                placeholder="Buscar produto…"
                aria-label="Buscar produto"
                className="campo py-2 pl-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Categoria">
              {(["todas", ...CATEGORIAS_PRODUTO] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => mudarFiltro({ categoria: c })}
                  aria-pressed={filtro.categoria === c}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    filtro.categoria === c
                      ? "bg-saibro-600 text-white"
                      : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                  }`}
                >
                  {c === "todas" ? "Todas" : c}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-areia-700">
                <input
                  type="checkbox"
                  checked={filtro.apenasRepor}
                  onChange={(e) => mudarFiltro({ apenasRepor: e.target.checked })}
                  className="h-4 w-4 rounded border-areia-300 text-saibro-600 focus:ring-saibro-500"
                />
                Só o que precisa repor
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-areia-700">
                <input
                  type="checkbox"
                  checked={filtro.incluirInativos}
                  onChange={(e) => mudarFiltro({ incluirInativos: e.target.checked })}
                  className="h-4 w-4 rounded border-areia-300 text-saibro-600 focus:ring-saibro-500"
                />
                Mostrar inativos
                {resumo.produtosInativos > 0 && ` (${resumo.produtosInativos})`}
              </label>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {lista.map((item) => (
              <CardProduto key={item.produto.id} item={item} aoAgir={agir} />
            ))}

            {lista.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-areia-500">
                Nenhum produto encontrado com os filtros atuais.
              </p>
            )}
          </div>
        </Card>

        {/* Coluna lateral (no tablet, vira uma faixa abaixo do catálogo) */}
        <div className="grid min-w-0 items-start gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
          <CartaoListaDeCompras
            itens={compras}
            aoDarEntrada={(item) =>
              setAcao({
                tipo: "entrada",
                produtoId: item.produto.id,
                quantidadeSugerida: item.sugerido,
              })
            }
          />
          <CartaoMaisVendidos itens={campeoes} />
          <CartaoMovimentacoes itens={recentes} />
        </div>
      </div>

      <ModaisDoEstoque acao={acao} aoFechar={() => setAcao(null)} />
      {lancandoConsumo && <ModalConsumo aoFechar={() => setLancandoConsumo(false)} />}
    </div>
  );
}
