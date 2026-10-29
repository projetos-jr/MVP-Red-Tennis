"use client";

import { useState } from "react";
import { diaEHora } from "@/components/estoque/formatos";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo } from "@/components/ui/Formulario";
import { HOJE } from "@/lib/banco/constantes";
import { fecharContaDeConsumo } from "@/lib/banco/operacoes/estoque";
import type { ConsumoNaConta } from "@/lib/consultas/estoque";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

/**
 * Fechar a conta: registra de uma vez o pagamento de todos os consumos em
 * aberto da pessoa (data e forma), e os lancamentos ficam pagos no financeiro.
 */
export function ModalFecharConta({
  pessoaId,
  nomePessoa,
  abertos,
  aoFechar,
}: {
  pessoaId: string;
  nomePessoa: string;
  /** Consumos em aberto e em atraso, para a pessoa conferir antes. */
  abertos: ConsumoNaConta[];
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [pagoEm, setPagoEm] = useState(HOJE);
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState<string>();

  const total = abertos.reduce((soma, c) => soma + c.valor, 0);

  function confirmar() {
    if (!forma) {
      setErro("Escolha a forma de pagamento.");
      return;
    }
    setErro(undefined);
    const gravou = gravar(
      fecharContaDeConsumo,
      { pessoaId, pagoEm, formaPagamento: forma },
      `Conta de ${nomePessoa} fechada: ${formatarMoeda(total)} recebidos.`,
    );
    if (gravou) aoFechar();
  }

  return (
    <Confirmacao
      aberto
      titulo="Fechar conta"
      rotuloConfirmar={`Receber ${formatarMoeda(total)}`}
      aoConfirmar={confirmar}
      aoCancelar={aoFechar}
      mensagem={
        <p>
          Registra o pagamento dos <strong>{abertos.length}</strong> consumo(s) em aberto de{" "}
          <strong className="text-areia-900">{nomePessoa}</strong>.
        </p>
      }
    >
      <ul className="max-h-40 divide-y divide-areia-100 overflow-y-auto rounded-xl border border-areia-200 rolagem-suave">
        {abertos.map(({ consumo, valor, situacao }) => (
          <li key={consumo.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-areia-800">
                {consumo.quantidade}× {consumo.produtoNome}
              </span>
              <span className="block text-areia-500">
                {diaEHora(consumo.data)}
                {situacao === "em_atraso" && (
                  <span className="font-medium text-tijolo-700"> · em atraso</span>
                )}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-areia-800">
              {formatarMoeda(valor)}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center justify-between rounded-xl bg-areia-50 px-3 py-2 text-sm">
        <span className="text-areia-600">Total a receber</span>
        <span className="text-base font-bold tabular-nums text-areia-900">
          {formatarMoeda(total)}
        </span>
      </p>

      <div className="space-y-3">
        <Campo rotulo="Data do pagamento" obrigatorio>
          <input
            type="date"
            value={pagoEm}
            max={HOJE}
            onChange={(e) => setPagoEm(e.target.value)}
            className="campo"
          />
        </Campo>
        <Campo rotulo="Forma de pagamento" obrigatorio erro={erro}>
          <select
            value={forma}
            onChange={(e) => {
              setForma(e.target.value);
              setErro(undefined);
            }}
            className="campo"
          >
            <option value="">Escolha…</option>
            {banco.configuracoes.formasPagamento.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Campo>
      </div>
    </Confirmacao>
  );
}
