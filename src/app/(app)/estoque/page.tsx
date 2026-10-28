"use client";

import { useMemo, useState } from "react";
import { CardProduto } from "@/components/estoque/CardProduto";
import { ModalMovimento } from "@/components/estoque/ModalMovimento";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import {
  IconeAlerta,
  IconeBusca,
  IconeEstoque,
  IconeFinanceiro,
  IconeSubiu,
} from "@/components/ui/Icons";
import { CATEGORIAS_PRODUTO } from "@/lib/arena";
import {
  filtrarProdutos,
  maisVendidos,
  nivelDoEstoque,
  resumoEstoque,
} from "@/lib/selectors";
import {
  ESTILO_MOVIMENTO,
  ESTILO_NIVEL_ESTOQUE,
  formatarMoeda,
} from "@/lib/theme";
import type { CategoriaProduto, Produto } from "@/lib/types";
import { useApp } from "@/store/AppStore";

export default function PaginaEstoque() {
  const {
    produtos,
    consumos,
    movimentos,
    registrarEntrada,
    registrarPerda,
  } = useApp();

  const [categoria, setCategoria] = useState<CategoriaProduto | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [apenasAlerta, setApenasAlerta] = useState(false);
  const [movimento, setMovimento] = useState<{
    produto: Produto;
    tipo: "entrada" | "perda";
  } | null>(null);

  const resumo = resumoEstoque(produtos, consumos);
  const lista = useMemo(
    () => filtrarProdutos({ categoria, busca, apenasAlerta }, produtos),
    [categoria, busca, apenasAlerta, produtos],
  );

  const precisamRepor = produtos
    .filter((p) => {
      const nivel = nivelDoEstoque(p);
      return nivel === "esgotado" || nivel === "critico";
    })
    .sort((a, b) => a.quantidade - b.quantidade);

  const campeoes = maisVendidos(5, consumos);
  const recentes = movimentos.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Estoque</h1>
          <p className="mt-1 text-sm text-areia-600">
            Bebidas, cervejas, lanches e acessórios vendidos no balcão da arena.
          </p>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Unidades em estoque"
          rotuloCurto="Unidades"
          valor={String(resumo.unidadesEmEstoque)}
          detalhe={`${resumo.itensCadastrados} itens cadastrados`}
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
          detalhe="Consumo lançado nas fichas"
          icone={<IconeSubiu className="h-5 w-5" />}
          tom="positivo"
        />
        <StatCard
          rotulo="Valor do estoque"
          rotuloCurto="Valor"
          valor={formatarMoeda(resumo.valorDeVenda)}
          detalhe={`Custo ${formatarMoeda(resumo.valorDeCusto)} · margem ${formatarMoeda(resumo.margemPotencial)}`}
          icone={<IconeFinanceiro className="h-5 w-5" />}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-4">
        {/* Catálogo */}
        <Card className="xl:col-span-3">
          <CardHeader
            titulo="Itens em estoque"
            descricao="A barra mostra o saldo; o traço indica o estoque mínimo."
            icone={<IconeEstoque className="h-5 w-5" />}
          />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-areia-200 px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="campo py-2 pl-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoria("todas")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  categoria === "todas"
                    ? "bg-saibro-600 text-white"
                    : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                }`}
              >
                Todas
              </button>
              {CATEGORIAS_PRODUTO.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    categoria === c
                      ? "bg-saibro-600 text-white"
                      : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-areia-700">
              <input
                type="checkbox"
                checked={apenasAlerta}
                onChange={(e) => setApenasAlerta(e.target.checked)}
                className="h-4 w-4 rounded border-areia-300 text-saibro-600 focus:ring-saibro-500"
              />
              Só o que precisa repor
            </label>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {lista.map((produto) => (
              <CardProduto
                key={produto.id}
                produto={produto}
                aoRegistrarEntrada={(p) => setMovimento({ produto: p, tipo: "entrada" })}
                aoRegistrarBaixa={(p) => setMovimento({ produto: p, tipo: "perda" })}
              />
            ))}

            {lista.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-areia-500">
                Nenhum produto encontrado com os filtros atuais.
              </p>
            )}
          </div>
        </Card>

        {/* Coluna lateral */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              titulo="Lista de compras"
              descricao="Itens abaixo do mínimo."
              icone={<IconeAlerta className="h-5 w-5" />}
            />
            <ul className="divide-y divide-areia-100">
              {precisamRepor.map((produto) => {
                const estilo = ESTILO_NIVEL_ESTOQUE[nivelDoEstoque(produto)];
                const sugerido = Math.max(
                  produto.estoqueMinimo * 2 - produto.quantidade,
                  produto.estoqueMinimo,
                );
                return (
                  <li
                    key={produto.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-areia-900">
                        {produto.nome}
                      </p>
                      <p className="text-xs text-areia-500">
                        Tem {produto.quantidade} · mín. {produto.estoqueMinimo}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        cor={estilo.cor}
                        fundo={estilo.fundo}
                        borda={estilo.borda}
                        className="text-[10px]"
                      >
                        {estilo.label}
                      </Badge>
                      <p className="mt-1 text-[11px] text-areia-500">
                        comprar ~{sugerido}
                      </p>
                    </div>
                  </li>
                );
              })}

              {precisamRepor.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-areia-500">
                  Todo o estoque está acima do mínimo.
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader
              titulo="Mais vendidos"
              descricao="Últimos 30 dias."
              icone={<IconeSubiu className="h-5 w-5" />}
            />
            <ul className="divide-y divide-areia-100">
              {campeoes.map((item, i) => (
                <li
                  key={item.produtoId}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="w-5 shrink-0 text-right text-sm font-bold text-areia-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-areia-900">{item.nome}</p>
                    <p className="text-xs text-areia-500">
                      {item.unidades} unidades
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-areia-800">
                    {formatarMoeda(item.total)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              titulo="Movimentações recentes"
              descricao="Entradas, vendas e perdas."
              icone={<IconeEstoque className="h-5 w-5" />}
            />
            <ul className="divide-y divide-areia-100">
              {recentes.map((mov) => {
                const estilo = ESTILO_MOVIMENTO[mov.tipo];
                const produto = produtos.find((p) => p.id === mov.produtoId);
                return (
                  <li key={mov.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm text-areia-900">
                        {produto?.nome ?? "Produto removido"}
                      </span>
                      <span
                        className="shrink-0 text-sm font-semibold tabular-nums"
                        style={{ color: estilo.cor }}
                      >
                        {estilo.sinal}
                        {mov.quantidade}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-areia-500">
                      {estilo.label} · {mov.data.replace("T", " às ")} ·{" "}
                      {mov.responsavel}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      {movimento && (
        <ModalMovimento
          produto={movimento.produto}
          tipo={movimento.tipo}
          aoFechar={() => setMovimento(null)}
          aoConfirmar={(quantidade, observacao) => {
            if (movimento.tipo === "entrada") {
              registrarEntrada(movimento.produto.id, quantidade, observacao);
            } else {
              registrarPerda(movimento.produto.id, quantidade, observacao);
            }
          }}
        />
      )}
    </div>
  );
}
