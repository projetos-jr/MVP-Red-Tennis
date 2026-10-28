"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { IconeBusca, IconeCopo } from "@/components/ui/Icons";
import { CATEGORIAS_PRODUTO } from "@/lib/arena";
import { nivelDoEstoque } from "@/lib/selectors";
import {
  ESTILO_CATEGORIA_PRODUTO,
  ESTILO_NIVEL_ESTOQUE,
  formatarMoeda,
} from "@/lib/theme";
import type { CategoriaProduto, Produto } from "@/lib/types";
import { useApp } from "@/store/AppStore";

interface ModalConsumoProps {
  aberto: boolean;
  aoFechar: () => void;
  nomePessoa: string;
  aoConfirmar: (produtoId: string, quantidade: number) => void;
}

/**
 * Lancamento de consumo no balcao.
 * Ao confirmar, o item sai do estoque e entra na conta da pessoa.
 */
export function ModalConsumo({
  aberto,
  aoFechar,
  nomePessoa,
  aoConfirmar,
}: ModalConsumoProps) {
  const { produtos } = useApp();
  const [categoria, setCategoria] = useState<CategoriaProduto | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState(1);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (categoria !== "todas" && p.categoria !== categoria) return false;
      if (termo && !p.nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [produtos, categoria, busca]);

  // O produto selecionado pode ter mudado de saldo enquanto o modal está aberto.
  const atual = selecionado
    ? produtos.find((p) => p.id === selecionado.id) ?? selecionado
    : null;
  const maximo = atual ? Math.max(1, atual.quantidade) : 1;

  function confirmar() {
    if (!atual || atual.quantidade === 0) return;
    aoConfirmar(atual.id, Math.min(quantidade, atual.quantidade));
    setSelecionado(null);
    setQuantidade(1);
    setBusca("");
    aoFechar();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Lançar consumo"
      descricao={`O item sai do estoque e entra na conta de ${nomePessoa}.`}
      largura="md"
    >
      <div className="space-y-4 p-5">
        <div className="relative">
          <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto…"
            className="campo pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
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

        <ul className="max-h-60 divide-y divide-areia-100 overflow-y-auto rolagem-suave rounded-xl border border-areia-200">
          {lista.map((produto) => {
            const esgotado = produto.quantidade === 0;
            const marcado = atual?.id === produto.id;
            const cat = ESTILO_CATEGORIA_PRODUTO[produto.categoria];
            const nivel = ESTILO_NIVEL_ESTOQUE[nivelDoEstoque(produto)];

            return (
              <li key={produto.id}>
                <button
                  type="button"
                  disabled={esgotado}
                  onClick={() => {
                    setSelecionado(produto);
                    setQuantidade(1);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    marcado ? "bg-saibro-50" : "hover:bg-areia-50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-areia-900">
                      {produto.nome}
                    </span>
                    <span className="block truncate text-xs text-areia-500">
                      {produto.unidade} · {produto.quantidade} em estoque
                    </span>
                  </span>
                  <Badge
                    cor={cat.cor}
                    fundo={cat.fundo}
                    borda={cat.borda}
                    className="hidden shrink-0 text-[10px] sm:inline-flex"
                  >
                    {produto.categoria}
                  </Badge>
                  {esgotado ? (
                    <Badge
                      cor={nivel.cor}
                      fundo={nivel.fundo}
                      className="shrink-0 text-[10px]"
                    >
                      Esgotado
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-areia-800">
                      {formatarMoeda(produto.precoVenda)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {lista.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-areia-500">
              Nenhum produto encontrado.
            </li>
          )}
        </ul>

        {atual && (
          <div className="rounded-xl border border-saibro-200 bg-saibro-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-areia-900">
                  <IconeCopo className="h-4 w-4 text-saibro-700" />
                  {atual.nome}
                </p>
                <p className="text-xs text-areia-500">
                  {formatarMoeda(atual.precoVenda)} · {atual.unidade}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  className="btn-secundario h-8 w-8 p-0"
                >
                  −
                </button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums text-areia-900">
                  {quantidade}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.min(maximo, q + 1))}
                  className="btn-secundario h-8 w-8 p-0"
                >
                  +
                </button>
              </div>
            </div>

            <p className="mt-3 flex items-center justify-between border-t border-saibro-200 pt-2.5 text-sm">
              <span className="text-areia-600">Total do lançamento</span>
              <span className="text-lg font-bold text-saibro-800">
                {formatarMoeda(atual.precoVenda * quantidade)}
              </span>
            </p>
          </div>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-areia-200 px-5 py-4">
        <button type="button" onClick={aoFechar} className="btn-secundario py-2">
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={!atual || atual.quantidade === 0}
          className="btn-primario py-2"
        >
          Lançar na conta
        </button>
      </footer>
    </Modal>
  );
}
