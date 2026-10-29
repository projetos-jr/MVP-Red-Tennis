"use client";

import { useState } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo } from "@/components/ui/Formulario";
import { HOJE } from "@/lib/banco/constantes";
import { fecharRepasseDoMes } from "@/lib/banco/operacoes/financeiro";
import {
  nomeDoMes,
  vencimentoSugeridoDoRepasse,
  type RelatorioDeRepasses,
} from "@/lib/consultas/financeiro";
import { formatarMinutos, formatarMoeda } from "@/lib/theme";
import { useGravar } from "@/store/useGravar";

/**
 * Confirma o fechamento do repasse do mês: mostra quanto cada professor vai
 * receber e pede a data de pagamento. Fechado, o mês não muda mais.
 */
export function ModalFecharRepasse({
  relatorio,
  aoFechar,
  aoConcluir,
}: {
  relatorio: RelatorioDeRepasses;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const gravar = useGravar();
  const [vencimento, setVencimento] = useState(() =>
    vencimentoSugeridoDoRepasse(relatorio.competencia, HOJE),
  );
  const nome = nomeDoMes(relatorio.competencia);
  const linhas = relatorio.aFechar;
  const total = linhas.reduce((soma, l) => soma + l.faltaLancar, 0);
  const contas = linhas.filter((l) => l.faltaLancar > 0).length;

  function confirmar() {
    const mensagem =
      contas === 0
        ? `Repasse de ${nome} fechado. Não havia nada a lançar.`
        : `Repasse de ${nome} fechado: ${contas} ${contas === 1 ? "conta a pagar lançada" : "contas a pagar lançadas"}.`;
    if (gravar(fecharRepasseDoMes, { competencia: relatorio.competencia, vencimento }, mensagem)) {
      aoConcluir();
    }
  }

  return (
    <Confirmacao
      aberto
      titulo={`Fechar repasse de ${nome}`}
      rotuloConfirmar="Fechar repasse"
      aoConfirmar={confirmar}
      aoCancelar={aoFechar}
      mensagem={
        <p>
          Para cada professor abaixo, o sistema grava as aulas dadas e o valor previsto pela regra
          dele e lança a conta a pagar. <strong>Depois de fechado, o mês não muda mais.</strong>
        </p>
      }
    >
      <ul className="divide-y divide-areia-100 rounded-xl border border-areia-200">
        {linhas.map((linha) => {
          const jaLancado = linha.pago + linha.emAberto;
          return (
            <li key={linha.professor.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium text-areia-900">{linha.professor.nome}</span>
                <span className="block text-xs text-areia-500">
                  {linha.aulasDadas} aulas · {formatarMinutos(linha.minutosDados)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums text-areia-900">
                  {formatarMoeda(linha.faltaLancar)}
                </span>
                {jaLancado > 0 && (
                  <span className="block text-[11px] text-areia-500">
                    desconta {formatarMoeda(jaLancado)} já lançado
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="flex justify-between font-semibold text-areia-900">
        <span>Total a pagar</span>
        <span className="tabular-nums">{formatarMoeda(total)}</span>
      </p>
      <Campo
        rotulo="Data para pagar"
        obrigatorio
        ajuda="Sugestão: dia 5 do mês seguinte (ou hoje, se esse dia já passou)."
      >
        <input
          type="date"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
          className="campo"
        />
      </Campo>
    </Confirmacao>
  );
}
