"use client";

import { useState } from "react";
import { IconeCheck, IconeEntrada } from "@/components/ui/Icons";
import { PlacaDeAtencao } from "@/components/ui/PlacaDeAtencao";
import type { ItemDaListaDeCompras } from "@/lib/consultas/estoque";
import { SeloDoNivel } from "./NivelDoEstoque";

/** Quantos itens aparecem antes de "Ver todos": 3 linhas de 3 no computador e no tablet... */
const ITENS_VISIVEIS = 9;
/** ...e 4 no celular, onde cada item ocupa a largura toda. */
const ITENS_VISIVEIS_NO_CELULAR = 4;

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * Lista de compras em destaque, logo abaixo dos números: é o que importa no
 * dia a dia do balcão. Com produto esgotado ou abaixo do mínimo, vem com a
 * placa de atenção; sem nada a repor, fica só uma linha verde.
 */
export function ListaDeCompras({
  itens,
  aoDarEntrada,
}: {
  itens: ItemDaListaDeCompras[];
  /** Sem esta função (perfil só de leitura), a lista não tem botão. */
  aoDarEntrada?: (item: ItemDaListaDeCompras) => void;
}) {
  const [todos, setTodos] = useState(false);

  if (itens.length === 0) {
    return (
      <section className="card flex items-center gap-3 border-quadra-200 bg-quadra-50 px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-quadra-700 text-white">
          <IconeCheck className="h-6 w-6" />
        </span>
        <p className="text-base text-areia-800">
          <strong className="font-semibold text-areia-900">Lista de compras vazia:</strong> todo o
          estoque está acima do mínimo.
        </p>
      </section>
    );
  }

  const esgotados = itens.filter((item) => item.nivel === "esgotado").length;
  const visiveis = todos ? itens : itens.slice(0, ITENS_VISIVEIS);

  return (
    <section className="card border-tijolo-200" aria-labelledby="titulo-lista-de-compras">
      <header className="flex items-center gap-4 rounded-t-2xl border-b border-tijolo-200 bg-tijolo-50 px-4 py-4 sm:px-5">
        <PlacaDeAtencao className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
        <div className="min-w-0">
          <h2
            id="titulo-lista-de-compras"
            className="font-display text-2xl font-bold leading-tight text-areia-900 sm:text-3xl"
          >
            Lista de compras
          </h2>
          <p className="mt-0.5 text-base text-areia-800">
            {plural(itens.length, "produto para repor", "produtos para repor")}
            {esgotados > 0 && (
              <>
                {" · "}
                <strong className="font-semibold text-tijolo-700">
                  {plural(esgotados, "esgotado", "esgotados")}
                </strong>
              </>
            )}
            <span className="hidden md:inline"> — do mais urgente ao menos.</span>
          </p>
        </div>
      </header>

      <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
        {visiveis.map((item, i) => (
          <li
            key={item.produto.id}
            className={`flex-col gap-2 rounded-xl border border-areia-200 bg-white p-3.5 ${
              !todos && i >= ITENS_VISIVEIS_NO_CELULAR ? "hidden sm:flex" : "flex"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-lg font-semibold leading-tight text-areia-900">
                {item.produto.nome}
              </p>
              <SeloDoNivel nivel={item.nivel} className="shrink-0 text-sm" />
            </div>
            <p className="text-base text-areia-700">
              Tem <strong className="font-semibold text-areia-900">{item.saldo}</strong> · mínimo{" "}
              {item.produto.estoqueMinimo} · comprar{" "}
              <strong className="font-bold text-areia-900">~{item.sugerido}</strong>
            </p>
            {aoDarEntrada && (
              <button
                type="button"
                onClick={() => aoDarEntrada(item)}
                className="btn-secundario mt-auto w-full py-2.5 text-base"
                aria-label={`Dar entrada de ${item.produto.nome} (chegou a mercadoria)`}
              >
                <IconeEntrada className="h-5 w-5" />
                Dar entrada
              </button>
            )}
          </li>
        ))}
      </ul>

      {itens.length > ITENS_VISIVEIS_NO_CELULAR && (
        // Entre 5 e 9 itens, só o celular esconde algum: o botão aparece só nele.
        <footer
          className={`border-t border-areia-200 px-4 py-3 sm:px-5 ${
            itens.length > ITENS_VISIVEIS ? "" : "sm:hidden"
          }`}
        >
          <button
            type="button"
            onClick={() => setTodos((atual) => !atual)}
            className="btn-secundario px-4 text-base"
          >
            {todos ? "Mostrar menos" : `Ver todos os ${itens.length}`}
          </button>
        </footer>
      )}
    </section>
  );
}
