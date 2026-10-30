"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeFinanceiro } from "@/components/ui/Icons";
import type { RegraRepasse } from "@/lib/banco/tipos";
import type { RepasseDoMes } from "@/lib/consultas/professores";
import { formatarMesAno } from "@/lib/date";
import { formatarMinutos, formatarMoeda } from "@/lib/theme";
import { rotuloDaRegraDeRepasse } from "@/components/aluno/estilos";

/** Meses mostrados antes de "Ver meses anteriores": o corrente e os dois ultimos fechados. */
const MESES_VISIVEIS = 3;

const SITUACAO: Record<RepasseDoMes["situacao"], { rotulo: string; cor: string; fundo: string }> = {
  em_andamento: { rotulo: "Mês em andamento", cor: "#0369A1", fundo: "#F0FAFF" },
  fechado: { rotulo: "Fechado", cor: "#4F483E", fundo: "#F4F1EC" },
  aberto: { rotulo: "Sem fechamento", cor: "#A16207", fundo: "#FEFBEB" },
};

function nomeDoMes(competencia: string): string {
  const texto = formatarMesAno(`${competencia}-01`);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Diferenca pago - previsto: negativo = falta pagar; o mes corrente ainda nao fechou. */
function Diferenca({ repasse }: { repasse: RepasseDoMes }) {
  if (repasse.situacao === "em_andamento") return <span className="text-areia-400">—</span>;
  if (Math.abs(repasse.diferenca) < 0.01) {
    return <span className="font-medium text-emerald-700">Em dia</span>;
  }
  return repasse.diferenca < 0 ? (
    <span className="font-semibold text-tijolo-700">Falta {formatarMoeda(-repasse.diferenca)}</span>
  ) : (
    <span className="font-semibold text-amber-700">Pago a mais {formatarMoeda(repasse.diferenca)}</span>
  );
}

/**
 * Repasse do professor mes a mes: aulas dadas, valor previsto pela regra
 * (Hipotese H6), valor pago (lancamentos de repasse no Financeiro) e a
 * diferenca.
 */
export function RepasseDoProfessor({
  repasses,
  regra,
}: {
  repasses: RepasseDoMes[];
  regra: RegraRepasse;
}) {
  const [todos, setTodos] = useState(false);
  const atual = repasses[0];
  const visiveis = todos ? repasses : repasses.slice(0, MESES_VISIVEIS);

  return (
    <Card>
      <CardHeader
        titulo="Repasse"
        descricao={`Previsto pela regra (${rotuloDaRegraDeRepasse(regra)}) e pago, mês a mês.`}
        icone={<IconeFinanceiro className="h-5 w-5" />}
      />

      {atual && (
        <div className="grid gap-px border-b border-areia-200 bg-areia-200 sm:grid-cols-3">
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-areia-500">
              {nomeDoMes(atual.competencia)}
            </p>
            <p className="mt-1 text-lg font-bold text-areia-900">
              {atual.aulasDadas} {atual.aulasDadas === 1 ? "aula dada" : "aulas dadas"}
            </p>
            <p className="text-xs text-areia-500">{formatarMinutos(atual.minutosDados)} até hoje</p>
          </div>
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-areia-500">Previsto até hoje</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-saibro-800">
              {formatarMoeda(atual.previsto)}
            </p>
            <p className="text-xs text-areia-500">Pela regra do professor</p>
          </div>
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-areia-500">Pago no mês</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-areia-900">{formatarMoeda(atual.pago)}</p>
            <p className="text-xs text-areia-500">
              {atual.aPagar > 0 ? `${formatarMoeda(atual.aPagar)} lançado a pagar` : "Fecha no início do mês seguinte"}
            </p>
          </div>
        </div>
      )}

      {/* Celular */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {visiveis.map((repasse) => {
          const situacao = SITUACAO[repasse.situacao];
          return (
            <li key={repasse.competencia} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-areia-900">{nomeDoMes(repasse.competencia)}</span>
                <Badge cor={situacao.cor} fundo={situacao.fundo}>
                  {situacao.rotulo}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-areia-600">
                {repasse.aulasDadas} aulas · previsto {formatarMoeda(repasse.previsto)} · pago{" "}
                {formatarMoeda(repasse.pago)}
              </p>
              <p className="mt-0.5 text-xs">
                <Diferenca repasse={repasse} />
              </p>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rolagem-suave md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
              <th scope="col" className="px-5 py-2.5 font-medium">Mês</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Aulas</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Previsto</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Pago</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Diferença</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-areia-100">
            {visiveis.map((repasse) => {
              const situacao = SITUACAO[repasse.situacao];
              return (
                <tr key={repasse.competencia} className="hover:bg-areia-50">
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium text-areia-800">
                    {nomeDoMes(repasse.competencia)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-areia-600">
                    {repasse.aulasDadas}
                    <span className="block text-[11px] text-areia-500">{formatarMinutos(repasse.minutosDados)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-areia-800">
                    {formatarMoeda(repasse.previsto)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-areia-800">
                    {formatarMoeda(repasse.pago)}
                    {repasse.aPagar > 0 && (
                      <span className="block text-[11px] text-areia-500">
                        + {formatarMoeda(repasse.aPagar)} a pagar
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    <Diferenca repasse={repasse} />
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge cor={situacao.cor} fundo={situacao.fundo}>
                      {situacao.rotulo}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {repasses.length > MESES_VISIVEIS && (
        <button
          type="button"
          onClick={() => setTodos(!todos)}
          className="w-full border-t border-areia-200 px-5 py-2.5 text-sm font-medium text-saibro-700 hover:bg-areia-50"
        >
          {todos ? "Mostrar só os últimos meses" : "Ver meses anteriores"}
        </button>
      )}

      <p className="border-t border-areia-200 px-5 py-3 text-xs leading-relaxed text-areia-500">
        {regra.modo === "por_hora"
          ? "Previsto = horas das aulas realizadas no mês × valor por hora-aula."
          : "Previsto = percentual sobre as mensalidades pagas no mês pelos alunos das aulas dele (a confirmar com a arena)."}{" "}
        Nos meses fechados vale o valor do fechamento. O pagamento é lançado no Financeiro (a pagar,
        categoria Repasse).
      </p>
    </Card>
  );
}
