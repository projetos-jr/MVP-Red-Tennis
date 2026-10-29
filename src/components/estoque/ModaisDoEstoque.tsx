"use client";

import { Confirmacao } from "@/components/ui/Confirmacao";
import { inativarProduto } from "@/lib/banco/operacoes/estoque";
import type { CategoriaProduto } from "@/lib/banco/tipos";
import { produtoComSaldo } from "@/lib/consultas/estoque";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { ModalEntrada } from "./ModalEntrada";
import { ModalInventario } from "./ModalInventario";
import { ModalPerda } from "./ModalPerda";
import { ModalProduto } from "./ModalProduto";

/** O que a pessoa pediu para fazer no estoque (cada uma abre um formulario). */
export type AcaoDoEstoque =
  | { tipo: "novo"; categoria?: CategoriaProduto }
  | { tipo: "editar"; produtoId: string }
  | { tipo: "entrada"; produtoId: string; quantidadeSugerida?: number }
  | { tipo: "perda"; produtoId: string }
  | { tipo: "inventario"; produtoId: string }
  | { tipo: "inativar"; produtoId: string };

/**
 * Abre o formulario da acao escolhida. O produto e relido do banco a cada
 * renderizacao, entao o saldo mostrado e sempre o de agora.
 */
export function ModaisDoEstoque({
  acao,
  aoFechar,
}: {
  acao: AcaoDoEstoque | null;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();

  if (!acao) return null;
  if (acao.tipo === "novo") {
    return <ModalProduto categoriaInicial={acao.categoria} aoFechar={aoFechar} />;
  }

  const item = produtoComSaldo(banco, acao.produtoId);
  if (!item) return null;
  const chave = `${acao.tipo}-${acao.produtoId}`;

  switch (acao.tipo) {
    case "editar":
      return <ModalProduto key={chave} produto={item.produto} aoFechar={aoFechar} />;
    case "entrada":
      return (
        <ModalEntrada
          key={chave}
          item={item}
          quantidadeSugerida={acao.quantidadeSugerida}
          aoFechar={aoFechar}
        />
      );
    case "perda":
      return <ModalPerda key={chave} item={item} aoFechar={aoFechar} />;
    case "inventario":
      return <ModalInventario key={chave} item={item} aoFechar={aoFechar} />;
    case "inativar":
      return (
        <Confirmacao
          key={chave}
          aberto
          titulo="Inativar produto"
          rotuloConfirmar="Inativar"
          perigoso
          mensagem={
            <>
              <p>
                <strong className="text-areia-900">{item.produto.nome}</strong> sai do catálogo
                e das listas de venda, mas continua no histórico: consumos, movimentos e
                financeiro não mudam. Dá para reativar depois.
              </p>
              {item.saldo > 0 && (
                <p className="mt-2">
                  Ainda há <strong>{item.saldo}</strong> unidade(s) em estoque. Elas continuam
                  contadas e podem receber perda ou ajuste no detalhe do produto.
                </p>
              )}
            </>
          }
          aoConfirmar={() => {
            if (
              gravar(
                inativarProduto,
                { id: item.produto.id },
                `${item.produto.nome} foi inativado e saiu das listas de venda.`,
              )
            ) {
              aoFechar();
            }
          }}
          aoCancelar={aoFechar}
        />
      );
  }
}
