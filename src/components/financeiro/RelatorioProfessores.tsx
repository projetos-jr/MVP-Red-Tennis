"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeAlerta, IconeUsuarios } from "@/components/ui/Icons";
import { BotaoMaisOpcoes } from "@/components/ui/MaisOpcoes";
import type { Professor } from "@/lib/banco/tipos";
import { nomeDoMes, type LinhaRepasse, type RelatorioDeRepasses } from "@/lib/consultas/financeiro";
import { formatarData } from "@/lib/date";
import { formatarMinutos, formatarMoeda } from "@/lib/theme";
import { BadgeRepasse } from "./Etiquetas";

const ID_DA_TABELA = "tabela-de-repasses";

/** "R$ 78,00 por hora" ou "30% das mensalidades" (hipótese H6). */
function regraDoProfessor(professor: Professor): string {
  return professor.repasse.modo === "por_hora"
    ? `${formatarMoeda(professor.repasse.valor)} por hora`
    : `${professor.repasse.valor}% das mensalidades`;
}

function NomeDoProfessor({ professor }: { professor: Professor }) {
  return (
    <Link
      href={`/professores/${professor.id}`}
      className="alvo-de-toque inline-flex items-center gap-2.5 text-lg font-semibold text-areia-900 hover:text-saibro-700 hover:underline"
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: professor.cor }}
        aria-hidden="true"
      />
      {professor.nome}
    </Link>
  );
}

function Pago({ linha }: { linha: LinhaRepasse }) {
  return (
    <>
      {formatarMoeda(linha.pago)}
      {linha.emAberto > 0 && (
        <span className="block text-sm font-normal text-areia-600">
          + {formatarMoeda(linha.emAberto)} a pagar
        </span>
      )}
    </>
  );
}

/** Situação geral do mês, em uma frase. */
function avisoDoMes(relatorio: RelatorioDeRepasses): string {
  const fechamentos = relatorio.linhas
    .map((l) => l.fechamento?.fechadoEm)
    .filter((data): data is string => Boolean(data))
    .sort();
  if (relatorio.futuro) {
    return "Este mês ainda não começou: não há aulas dadas.";
  }
  if (!relatorio.terminado) {
    return "Mês em andamento: o previsto conta as aulas dadas até hoje e ainda vai mudar.";
  }
  if (relatorio.aFechar.length > 0) {
    const n = relatorio.aFechar.length;
    return `O mês terminou e o repasse ainda não foi fechado para ${n} ${n === 1 ? "professor" : "professores"}.`;
  }
  if (fechamentos.length > 0) {
    return `Repasse fechado em ${formatarData(fechamentos[fechamentos.length - 1])}. Os valores ficam como estavam no fechamento.`;
  }
  return "Nenhuma aula dada neste mês.";
}

/**
 * Relatório de professores: por mês, aulas dadas, previsto (pela regra do
 * professor, H6), pago e diferença. Mês terminado e sem fechamento pode ser
 * fechado (cria o repasse e a conta a pagar).
 *
 * Fechado, mostra o essencial em letra grande (professor, previsto, pago e
 * situação); "Mais detalhes" acrescenta aulas, horas, diferença, a regra de
 * cada professor e a explicação das contas.
 */
export function RelatorioProfessores({
  relatorio,
  mesAnteriorAFechar,
  aoFecharMes,
  aoVerMesAnterior,
}: {
  relatorio: RelatorioDeRepasses;
  /** Quantos professores o mês anterior ainda tem a fechar (aviso no mês em curso). */
  mesAnteriorAFechar: number;
  aoFecharMes: () => void;
  aoVerMesAnterior: () => void;
}) {
  const [detalhes, setDetalhes] = useState(false);
  const nome = nomeDoMes(relatorio.competencia);
  const { totais } = relatorio;

  return (
    <Card>
      <CardHeader
        titulo={`Repasse dos professores · ${nome}`}
        descricao="Quanto cada professor deve receber pela regra dele e quanto já foi pago."
        icone={<IconeUsuarios className="h-5 w-5" />}
        acao={
          relatorio.aFechar.length > 0 ? (
            <button type="button" onClick={aoFecharMes} className="btn-primario px-5 py-3 text-base">
              Fechar repasse de {nome.split(" ")[0]}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3 border-b border-areia-200 px-4 py-4 text-base text-areia-700 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>{avisoDoMes(relatorio)}</p>
          <BotaoMaisOpcoes
            aberto={detalhes}
            aoAlternar={() => setDetalhes((atual) => !atual)}
            controla={ID_DA_TABELA}
            rotulo="Mais detalhes"
            rotuloAberto="Menos detalhes"
            className="text-base"
          />
        </div>
        {mesAnteriorAFechar > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-amber-50 px-4 py-2.5 text-amber-900">
            <IconeAlerta className="h-5 w-5 shrink-0" />
            O mês anterior terminou e ainda tem repasse a fechar.
            <button
              type="button"
              onClick={aoVerMesAnterior}
              className="alvo-de-toque font-semibold underline underline-offset-2 hover:no-underline"
            >
              Ver o mês anterior
            </button>
          </p>
        )}
      </div>

      <div id={ID_DA_TABELA}>
        {/* Celular: um cartão por professor */}
        <ul className="divide-y divide-areia-100 md:hidden">
          {relatorio.linhas.map((linha) => (
            <li key={linha.professor.id} className="space-y-2 px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <NomeDoProfessor professor={linha.professor} />
                  {detalhes && (
                    <span className="block text-sm text-areia-600">
                      {regraDoProfessor(linha.professor)}
                    </span>
                  )}
                </span>
                <BadgeRepasse situacao={linha.situacao} className="text-sm" />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-base">
                {detalhes && (
                  <>
                    <dt className="text-areia-600">Aulas dadas</dt>
                    <dd className="text-right tabular-nums text-areia-800">
                      {linha.aulasDadas} · {formatarMinutos(linha.minutosDados)}
                    </dd>
                  </>
                )}
                <dt className="text-areia-600">Previsto</dt>
                <dd className="text-right text-lg font-bold tabular-nums text-areia-900">
                  {formatarMoeda(linha.previsto)}
                </dd>
                <dt className="text-areia-600">Pago</dt>
                <dd className="text-right font-semibold tabular-nums text-areia-800">
                  <Pago linha={linha} />
                </dd>
                {detalhes && (
                  <>
                    <dt className="font-medium text-areia-700">Diferença</dt>
                    <dd className="text-right font-semibold tabular-nums text-areia-900">
                      {formatarMoeda(linha.diferenca)}
                    </dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto rolagem-suave md:block">
          <table className={`w-full text-base ${detalhes ? "min-w-[820px]" : "min-w-[600px]"}`}>
            <thead>
              <tr className="border-b border-areia-200 text-left text-sm text-areia-600">
                <th className="px-5 py-3 font-semibold">Professor</th>
                {detalhes && <th className="px-3 py-3 text-right font-semibold">Aulas dadas</th>}
                {detalhes && <th className="px-3 py-3 text-right font-semibold">Horas</th>}
                <th className="px-3 py-3 text-right font-semibold">Previsto</th>
                <th className="px-3 py-3 text-right font-semibold">Pago</th>
                {detalhes && <th className="px-3 py-3 text-right font-semibold">Diferença</th>}
                <th className="px-5 py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-areia-100">
              {relatorio.linhas.map((linha) => (
                <tr key={linha.professor.id} className="hover:bg-areia-50">
                  <td className="px-5 py-3.5">
                    <NomeDoProfessor professor={linha.professor} />
                    {detalhes && (
                      <span className="mt-0.5 block text-sm text-areia-600">
                        {regraDoProfessor(linha.professor)}
                      </span>
                    )}
                  </td>
                  {detalhes && (
                    <td className="px-3 py-3.5 text-right tabular-nums text-areia-700">{linha.aulasDadas}</td>
                  )}
                  {detalhes && (
                    <td className="px-3 py-3.5 text-right tabular-nums text-areia-700">
                      {formatarMinutos(linha.minutosDados)}
                    </td>
                  )}
                  <td className="px-3 py-3.5 text-right text-lg font-bold tabular-nums text-areia-900">
                    {formatarMoeda(linha.previsto)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-areia-800">
                    <Pago linha={linha} />
                  </td>
                  {detalhes && (
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-areia-900">
                      {formatarMoeda(linha.diferenca)}
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <BadgeRepasse situacao={linha.situacao} className="text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-areia-200 bg-areia-50 font-semibold text-areia-900">
                <td className="px-5 py-3 text-sm text-areia-700">Total</td>
                {detalhes && <td className="px-3 py-3 text-right tabular-nums">{totais.aulasDadas}</td>}
                {detalhes && (
                  <td className="px-3 py-3 text-right tabular-nums">{formatarMinutos(totais.minutosDados)}</td>
                )}
                <td className="px-3 py-3 text-right tabular-nums">{formatarMoeda(totais.previsto)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatarMoeda(totais.pago)}</td>
                {detalhes && (
                  <td className="px-3 py-3 text-right tabular-nums">{formatarMoeda(totais.diferenca)}</td>
                )}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {detalhes && (
          <footer className="border-t border-areia-200 px-5 py-3 text-sm leading-relaxed text-areia-600">
            Previsto: aulas realizadas no mês × a regra de cada professor (hipótese H6, ajustável nas
            Configurações). Depois do fechamento, vale o valor gravado nele. Pago: lançamentos de repasse
            do mês já pagos. Diferença: previsto menos pago.
          </footer>
        )}
      </div>
    </Card>
  );
}
