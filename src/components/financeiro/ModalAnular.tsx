"use client";

import { useMemo, useState } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo } from "@/components/ui/Formulario";
import { HOJE } from "@/lib/banco/constantes";
import { anularLancamento } from "@/lib/banco/operacoes/financeiro";
import { detalheDoLancamento } from "@/lib/consultas/financeiro";
import { formatarData } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

/** Anular nunca apaga: pede o motivo e o lançamento fica na lista como anulado. */
export function ModalAnular({
  id,
  aoFechar,
  aoConcluir,
}: {
  id: string;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const detalhe = useMemo(() => detalheDoLancamento(banco, id, HOJE), [banco, id]);
  const [motivo, setMotivo] = useState("");

  if (!detalhe) return null;
  const { lancamento, pessoa } = detalhe.linha;
  const nome = pessoa?.nome ?? lancamento.nomePagante;

  function confirmar() {
    if (gravar(anularLancamento, { id, motivo }, "Lançamento anulado.")) aoConcluir();
  }

  return (
    <Confirmacao
      aberto
      titulo="Anular lançamento"
      perigoso
      rotuloConfirmar="Anular lançamento"
      aoConfirmar={confirmar}
      aoCancelar={aoFechar}
      mensagem={
        <>
          <p>
            <strong className="text-areia-900">{lancamento.item}</strong>
            {nome ? ` · ${nome}` : ""} · {formatarMoeda(lancamento.valor)}
          </p>
          <p className="mt-2">
            O lançamento sai dos totais, mas <strong>não é apagado</strong>: continua na lista
            como anulado, com o motivo e quem anulou.
          </p>
          {lancamento.pagoEm && (
            <p className="mt-2 rounded-lg bg-tijolo-50 px-3 py-2 text-tijolo-800">
              Ele já foi pago em {formatarData(lancamento.pagoEm)}. Anule só em caso de estorno ou
              de pagamento lançado por engano.
            </p>
          )}
        </>
      }
    >
      <Campo rotulo="Motivo da anulação" obrigatorio>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ex.: lançado em dobro, aula remarcada, bolsa concedida…"
          className="campo resize-none"
        />
      </Campo>
    </Confirmacao>
  );
}
