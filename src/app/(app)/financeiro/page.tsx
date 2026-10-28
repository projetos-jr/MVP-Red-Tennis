"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GraficoFluxoCaixa } from "@/components/financeiro/GraficoFluxoCaixa";
import { GraficoFormasPagamento } from "@/components/financeiro/GraficoFormasPagamento";
import { TabelaPagamentos } from "@/components/financeiro/TabelaPagamentos";
import { Card, CardHeader } from "@/components/ui/Card";
import { Segmentado } from "@/components/ui/Segmentado";
import { StatCard } from "@/components/ui/StatCard";
import {
  IconeAlerta,
  IconeBusca,
  IconeCheck,
  IconeExportar,
  IconeFinanceiro,
  IconeRelogio,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { formatarMesAno } from "@/lib/date";
import { HOJE } from "@/lib/arena";
import {
  filtrarPagamentos,
  fluxoDeCaixa,
  receitaRecorrente,
  reservasSemPagamento,
  resumoFinanceiro,
  resumoProfessores,
  totaisPorForma,
} from "@/lib/selectors";
import { formatarMoeda } from "@/lib/theme";
import type { FormaPagamento } from "@/lib/types";

const FORMAS: Array<FormaPagamento | "todas"> = [
  "todas",
  "Stone",
  "Bradesco",
  "Total Pass",
  "Dinheiro",
];

export default function PaginaFinanceiro() {
  const [aba, setAba] = useState<"operacional" | "planejamento">("operacional");
  const [status, setStatus] = useState<"todos" | "confirmado" | "pendente">(
    "todos",
  );
  const [forma, setForma] = useState<FormaPagamento | "todas">("todas");
  const [busca, setBusca] = useState("");

  const resumo = resumoFinanceiro();
  const pendencias = reservasSemPagamento();

  const pagamentos = useMemo(
    () => filtrarPagamentos({ status, forma, busca }).slice(0, 60),
    [status, forma, busca],
  );

  const fluxo = useMemo(() => fluxoDeCaixa(21), []);
  const formas = useMemo(() => totaisPorForma(), []);
  const professores = useMemo(() => resumoProfessores(), []);
  const recorrente = receitaRecorrente();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-areia-600 first-letter:uppercase">
            {formatarMesAno(HOJE)} · operação e planejamento
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmentado
            aria="Área do financeiro"
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: "operacional", rotulo: "Operacional" },
              { valor: "planejamento", rotulo: "Planejamento" },
            ]}
          />
          <button
            type="button"
            className="btn-secundario py-2"
            title="Exportação simulada — o MVP não gera arquivo"
          >
            <IconeExportar className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Indicadores do mes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Recebido no mês"
          rotuloCurto="Recebido"
          valor={formatarMoeda(resumo.recebidoNoMes)}
          detalhe={`Ticket médio ${formatarMoeda(resumo.ticketMedio)}`}
          icone={<IconeCheck className="h-5 w-5" />}
          tom="positivo"
        />
        <StatCard
          rotulo="A receber"
          rotuloCurto="A receber"
          valor={formatarMoeda(resumo.aReceber)}
          detalhe="Boletos, crédito e convênio a compensar"
          icone={<IconeRelogio className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Em atraso"
          rotuloCurto="Em atraso"
          valor={formatarMoeda(resumo.emAtraso)}
          detalhe={`${resumo.quantidadeEmAtraso} reserva(s) sem pagamento confirmado`}
          icone={<IconeAlerta className="h-5 w-5" />}
          tom={resumo.quantidadeEmAtraso > 0 ? "alerta" : "neutro"}
        />
        <StatCard
          rotulo="Receita recorrente"
          rotuloCurto="Recorrente"
          valor={formatarMoeda(recorrente)}
          detalhe="Soma das mensalidades de planos ativos"
          icone={<IconeFinanceiro className="h-5 w-5" />}
        />
      </div>

      {aba === "operacional" ? (
        <>
          {/* Pendencias em destaque */}
          {pendencias.length > 0 && (
            <Card className="border-tijolo-200">
              <CardHeader
                titulo="Reservas sem pagamento confirmado no prazo"
                descricao="Pagamento não identificado depois do prazo acordado."
                icone={<IconeAlerta className="h-5 w-5" />}
                className="bg-tijolo-50/50"
              />
              <TabelaPagamentos pagamentos={pendencias.slice(0, 6)} />
            </Card>
          )}

          <Card>
            <CardHeader
              titulo="Lançamentos"
              descricao="Pagamentos vinculados a alunos, horários e serviços avulsos."
              icone={<IconeFinanceiro className="h-5 w-5" />}
            />

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-areia-200 px-4 py-3">
              <div className="relative min-w-[220px] flex-1">
                <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por aluno, pagante ou item…"
                  className="campo py-2 pl-9 text-sm"
                />
              </div>

              <Segmentado
                aria="Situação do pagamento"
                valor={status}
                aoMudar={setStatus}
                opcoes={[
                  { valor: "todos", rotulo: "Todos" },
                  { valor: "confirmado", rotulo: "Confirmados" },
                  { valor: "pendente", rotulo: "Pendentes" },
                ]}
              />

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-areia-500">Forma:</span>
                {FORMAS.map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => setForma(opcao)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      forma === opcao
                        ? "bg-saibro-600 text-white"
                        : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                    }`}
                  >
                    {opcao === "todas" ? "Todas" : opcao}
                  </button>
                ))}
              </div>
            </div>

            <TabelaPagamentos pagamentos={pagamentos} />

            <footer className="border-t border-areia-200 px-5 py-3 text-xs text-areia-500">
              Exibindo {pagamentos.length} lançamentos mais recentes.
            </footer>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader
              titulo="Fluxo de caixa"
              descricao="Entradas por dia nas últimas três semanas, separando o que já entrou do que está previsto."
              icone={<IconeFinanceiro className="h-5 w-5" />}
            />
            <div className="p-5">
              <GraficoFluxoCaixa dados={fluxo} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                titulo="Divisão por forma de pagamento"
                descricao={`Participação de cada meio no mês.`}
                icone={<IconeFinanceiro className="h-5 w-5" />}
              />
              <div className="p-5">
                <GraficoFormasPagamento dados={formas} />

                <div className="mt-5 rounded-xl border border-areia-200 bg-areia-50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-areia-500">
                    Total Pass no mês
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="text-sm text-areia-700">
                      Coberto pelo convênio{" "}
                      <strong className="font-semibold text-areia-900">
                        {formatarMoeda(resumo.cobertoTotalPass)}
                      </strong>
                    </span>
                    <span className="text-sm text-areia-700">
                      Complemento pago à parte{" "}
                      <strong className="font-semibold text-areia-900">
                        {formatarMoeda(resumo.complementoTotalPass)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                titulo="Resumo de professores"
                descricao="Comissão por aula na grade semanal — visão agregada, não folha de pagamento."
                icone={<IconeUsuarios className="h-5 w-5" />}
              />
              {/* Celular: um cartão por professor */}
              <ul className="divide-y divide-areia-100 md:hidden">
                {professores.map((item) => (
                  <li key={`m-${item.professor.id}`} className="px-4 py-3">
                    <Link
                      href={`/professores/${item.professor.id}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.professor.cor }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-areia-900">
                            {item.professor.nome}
                          </span>
                          <span className="block truncate text-xs text-areia-500">
                            {item.aulasSemana} aulas · {item.horasSemana.toFixed(0)}h
                            por semana
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-base font-bold tabular-nums text-areia-900">
                          {formatarMoeda(item.comissaoMes)}
                        </span>
                        <span className="block text-[11px] text-areia-500">
                          por mês
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                <li className="flex items-center justify-between bg-areia-50 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-areia-600">
                    Total estimado
                  </span>
                  <span className="text-base font-bold tabular-nums text-areia-900">
                    {formatarMoeda(
                      professores.reduce((s, p) => s + p.comissaoMes, 0),
                    )}
                  </span>
                </li>
              </ul>

              <div className="hidden overflow-x-auto rolagem-suave md:block">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
                      <th className="px-5 py-2.5 font-medium">Professor</th>
                      <th className="px-3 py-2.5 text-right font-medium">Aulas/sem</th>
                      <th className="px-3 py-2.5 text-right font-medium">Horas/sem</th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        Comissão / mês
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-areia-100">
                    {professores.map((item) => (
                      <tr key={item.professor.id} className="hover:bg-areia-50">
                        <td className="px-5 py-3">
                          <Link
                            href={`/professores/${item.professor.id}`}
                            className="flex items-center gap-2 font-medium text-areia-800 hover:text-tijolo-700 hover:underline"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.professor.cor }}
                            />
                            {item.professor.nome}
                          </Link>
                          <span className="mt-0.5 block text-xs text-areia-500">
                            {item.professor.especialidade} ·{" "}
                            {formatarMoeda(item.professor.valorHoraAula)}/h ·{" "}
                            {item.alunosAtendidos} alunos
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-areia-700">
                          {item.aulasSemana}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-areia-700">
                          {item.horasSemana.toFixed(0)}h
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-areia-900">
                          {formatarMoeda(item.comissaoMes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-areia-200 bg-areia-50">
                      <td className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-areia-600">
                        Total estimado
                      </td>
                      <td colSpan={2} />
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-areia-900">
                        {formatarMoeda(
                          professores.reduce((s, p) => s + p.comissaoMes, 0),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
