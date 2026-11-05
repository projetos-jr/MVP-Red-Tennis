"use client";

import Link from "next/link";
import { BotaoGrande } from "@/components/ui/BotaoGrande";
import { IconeEntrada, IconeLixeira } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import type { ProdutoComSaldo } from "@/lib/consultas/estoque";
import { IconeContagem } from "./Icones";

export type Movimento = "entrada" | "perda" | "inventario";

/**
 * Janela "Movimentar", aberta ao tocar no cartão de um produto: três botões
 * grandes (Entrada, Perda, Contagem), cada um com uma linha dizendo o que faz.
 * Escolher um botão abre o mesmo formulário de antes (ModalEntrada,
 * ModalPerda, ModalInventario); nada muda na gravação.
 */
export function ModalMovimentar({
  item,
  aoEscolher,
  aoFechar,
}: {
  item: ProdutoComSaldo;
  aoEscolher: (movimento: Movimento) => void;
  aoFechar: () => void;
}) {
  const { produto, saldo } = item;
  const semSaldo = saldo <= 0;

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={produto.nome}
      descricao={`Tem ${saldo} · mínimo ${produto.estoqueMinimo} · ${produto.unidade}`}
    >
      <div className="space-y-3 px-5 py-4">
        <p className="text-base text-areia-700">O que aconteceu com este produto?</p>
        <BotaoGrande
          primario
          icone={<IconeEntrada className="h-6 w-6" />}
          titulo="Entrada"
          descricao="Chegou mercadoria: soma no estoque."
          aoClicar={() => aoEscolher("entrada")}
        />
        <BotaoGrande
          icone={<IconeLixeira className="h-6 w-6" />}
          titulo="Perda"
          descricao={
            semSaldo
              ? "Não há unidades em estoque para registrar perda."
              : "Quebrou, venceu ou foi cortesia: tira do estoque."
          }
          disabled={semSaldo}
          aoClicar={() => aoEscolher("perda")}
        />
        <BotaoGrande
          icone={<IconeContagem className="h-6 w-6" />}
          titulo="Contagem"
          descricao="Conferiu a prateleira: o saldo fica igual ao que você contou."
          aoClicar={() => aoEscolher("inventario")}
        />
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-areia-200 px-5 py-3">
        <Link href={`/estoque/produto?id=${produto.id}`} className="link-acao alvo-de-toque inline-flex items-center text-base">
          Ver detalhes do produto
        </Link>
        <button type="button" onClick={aoFechar} className="btn-secundario px-5 text-base">
          Fechar
        </button>
      </footer>
    </Modal>
  );
}
