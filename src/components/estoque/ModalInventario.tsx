"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { ajustarInventario } from "@/lib/banco/operacoes/estoque";
import type { ProdutoComSaldo } from "@/lib/consultas/estoque";
import { useGravar } from "@/store/useGravar";
import { CampoQuantidade } from "./CampoQuantidade";
import { comSinal, lerInteiro } from "./formatos";

/**
 * Ajuste de inventario: a pessoa conta o que ha e informa o total. O sistema
 * grava um movimento "ajuste" com a diferenca; ninguem digita o saldo.
 */
export function ModalInventario({
  item,
  aoFechar,
}: {
  item: ProdutoComSaldo;
  aoFechar: () => void;
}) {
  const gravar = useGravar();
  const { produto, saldo } = item;
  const [contado, setContado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string>();

  const numero = lerInteiro(contado);
  const contadoValido = Number.isInteger(numero) && numero >= 0;
  const diferenca = contadoValido ? numero - saldo : 0;

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!contadoValido) {
      setErro("Informe quantas unidades você contou (pode ser zero).");
      return;
    }
    setErro(undefined);
    // Contado igual ao sistema vai para a regra, que explica que nao ha o que ajustar.
    const gravou = gravar(
      ajustarInventario,
      { produtoId: produto.id, saldoContado: numero, observacao },
      `Inventário ajustado: ${produto.nome} agora tem ${numero} em estoque.`,
    );
    if (gravou) aoFechar();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Ajuste de inventário"
      descricao={`${produto.nome} · ${produto.unidade}`}
      largura="sm"
    >
      <form onSubmit={salvar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-areia-600">
            Conte as unidades na prateleira e no depósito e informe o total. O sistema
            grava a diferença como um ajuste.
          </p>

          <CampoQuantidade
            id="inventario-contado"
            rotulo="Quantidade contada"
            obrigatorio
            minimo={0}
            valor={contado}
            aoMudar={setContado}
            erro={erro}
            ajuda={`O sistema mostra ${saldo}.`}
          />

          <Campo rotulo="Observação" ajuda="Opcional: por que a contagem mudou.">
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: contagem do fim do mês"
              className="campo"
              maxLength={120}
            />
          </Campo>

          <dl className="space-y-1 rounded-xl bg-areia-50 px-3.5 py-3 text-sm">
            <div className="flex items-center justify-between text-areia-600">
              <dt>No sistema</dt>
              <dd className="font-semibold tabular-nums text-areia-800">{saldo}</dd>
            </div>
            <div className="flex items-center justify-between text-areia-600">
              <dt>Diferença</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  !contadoValido || diferenca === 0
                    ? "text-areia-500"
                    : diferenca > 0
                      ? "text-emerald-700"
                      : "text-tijolo-700"
                }`}
              >
                {!contadoValido
                  ? "—"
                  : diferenca === 0
                    ? "nenhuma"
                    : `${comSinal(diferenca)} ${diferenca > 0 ? "(sobrou)" : "(faltou)"}`}
              </dd>
            </div>
          </dl>
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Registrar ajuste" />
      </form>
    </Modal>
  );
}
