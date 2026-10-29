"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeFinanceiro, IconeMais } from "@/components/ui/Icons";
import type { MatriculaDoAluno, ResumoDoAluno } from "@/lib/consultas/alunos";
import { formatarData } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { IconeEditar, IconeTroca } from "./Icones";
import {
  ConfirmarCancelamentoDaAgendada,
  ConfirmarEncerramento,
  ModalCorrigirMatricula,
  ModalMatricula,
} from "./ModaisMatricula";
import { ESTILO_SITUACAO_MATRICULA, ESTILO_TABELA } from "./estilos";

type Acao = "nova" | "trocar" | "corrigir" | "encerrar" | "cancelar";

/**
 * Matricula do aluno: o plano que vale hoje, o valor combinado, o vencimento
 * e o historico de planos (cada troca encerra uma matricula e abre outra).
 */
export function CartaoMatricula({
  resumo,
  matriculas,
  podeEditar,
}: {
  resumo: ResumoDoAluno;
  matriculas: MatriculaDoAluno[];
  podeEditar: boolean;
}) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const fechar = () => setAcao(null);
  const { aluno, congelamento } = resumo;

  const vigente = matriculas.find((m) => m.matricula.id === resumo.matricula?.id);
  const agendada = matriculas.find((m) => m.matricula.id === resumo.matriculaAgendada?.id);
  const editavel = podeEditar && aluno.ativo;

  return (
    <Card>
      <CardHeader
        titulo="Matrícula"
        descricao="Plano, valor combinado e vencimento. Cada troca de plano fica no histórico."
        icone={<IconeFinanceiro className="h-5 w-5" />}
      />

      <div className="p-5">
        {vigente ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Dado rotulo="Plano atual">
                <span className="block">{vigente.plano?.nome ?? "Plano removido"}</span>
                {vigente.plano && (
                  <Badge
                    cor={ESTILO_TABELA[vigente.plano.tabela].cor}
                    fundo={ESTILO_TABELA[vigente.plano.tabela].fundo}
                    className="mt-1 px-2 py-0.5 text-[11px]"
                  >
                    {ESTILO_TABELA[vigente.plano.tabela].rotulo}
                  </Badge>
                )}
              </Dado>
              <Dado rotulo="Valor combinado">
                {formatarMoeda(vigente.matricula.valorMensal)}
                <span className="font-normal text-areia-500"> /mês</span>
                {vigente.plano && vigente.plano.valorMensal !== vigente.matricula.valorMensal && (
                  <span className="mt-0.5 block text-xs font-normal text-areia-500">
                    Preço de tabela hoje: {formatarMoeda(vigente.plano.valorMensal)}
                  </span>
                )}
              </Dado>
              <Dado rotulo="Vencimento">Todo dia {vigente.matricula.diaVencimento}</Dado>
              <Dado rotulo="Período">
                Desde {formatarData(vigente.matricula.inicio)}
                {vigente.matricula.fim && (
                  <span className="mt-0.5 block text-xs font-normal text-tijolo-700">
                    Termina em {formatarData(vigente.matricula.fim)}
                  </span>
                )}
              </Dado>
            </dl>

            {editavel && (
              <div className="mt-5 flex flex-wrap gap-2">
                {!agendada && (
                  <button type="button" onClick={() => setAcao("trocar")} className="btn-secundario">
                    <IconeTroca className="h-4 w-4" />
                    Trocar de plano
                  </button>
                )}
                <button type="button" onClick={() => setAcao("corrigir")} className="btn-secundario">
                  <IconeEditar className="h-4 w-4" />
                  Corrigir valor ou vencimento
                </button>
                {!vigente.matricula.fim && (
                  <button
                    type="button"
                    onClick={() => setAcao("encerrar")}
                    className="btn-fantasma text-tijolo-700 hover:bg-tijolo-50 hover:text-tijolo-800"
                  >
                    Encerrar matrícula
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-areia-300 bg-areia-50 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-areia-800">Sem plano mensal valendo hoje.</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-areia-500">
              {aluno.ativo
                ? "O aluno pode usar locações avulsas e o ranking. Para começar um plano, crie uma matrícula."
                : "Aluno inativo: reative o cadastro para criar uma matrícula."}
            </p>
            {editavel && !agendada && (
              <button type="button" onClick={() => setAcao("nova")} className="btn-primario mt-4">
                <IconeMais className="h-4 w-4" />
                Nova matrícula
              </button>
            )}
          </div>
        )}

        {agendada && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="min-w-0 leading-snug">
              <strong className="font-semibold">
                {vigente ? "Troca de plano marcada" : "Matrícula marcada"}:
              </strong>{" "}
              a partir de {formatarData(agendada.matricula.inicio)}, {agendada.plano?.nome ?? "—"} ·{" "}
              {formatarMoeda(agendada.matricula.valorMensal)} · todo dia{" "}
              {agendada.matricula.diaVencimento}.
            </p>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setAcao("cancelar")}
                className="btn-secundario px-3 py-1.5 text-xs"
              >
                Desmarcar
              </button>
            )}
          </div>
        )}
      </div>

      <HistoricoDePlanos matriculas={matriculas} />

      {acao === "nova" && <ModalMatricula aberto aoFechar={fechar} alunoId={aluno.id} />}
      {acao === "trocar" && vigente && (
        <ModalMatricula aberto aoFechar={fechar} alunoId={aluno.id} atual={vigente} />
      )}
      {acao === "corrigir" && vigente && (
        <ModalCorrigirMatricula aberto aoFechar={fechar} atual={vigente} />
      )}
      {acao === "encerrar" && vigente && (
        <ConfirmarEncerramento
          aberto
          aoFechar={fechar}
          atual={vigente}
          congelado={Boolean(congelamento)}
        />
      )}
      {acao === "cancelar" && agendada && (
        <ConfirmarCancelamentoDaAgendada aberto aoFechar={fechar} agendada={agendada} />
      )}
    </Card>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-areia-500">{rotulo}</dt>
      <dd className="mt-1 text-sm font-semibold text-areia-900">{children}</dd>
    </div>
  );
}

function periodo({ matricula }: MatriculaDoAluno): string {
  if (!matricula.fim) return `${formatarData(matricula.inicio)} → sem data de fim`;
  return `${formatarData(matricula.inicio)} → ${formatarData(matricula.fim)}`;
}

function HistoricoDePlanos({ matriculas }: { matriculas: MatriculaDoAluno[] }) {
  if (matriculas.length === 0) {
    return (
      <p className="border-t border-areia-200 px-5 py-4 text-sm text-areia-500">
        Nenhuma matrícula registrada.
      </p>
    );
  }

  return (
    <div className="border-t border-areia-200">
      <h3 className="px-5 pb-2 pt-4 text-sm font-semibold text-areia-800">Histórico de planos</h3>

      {/* Celular: um cartao por matricula */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {matriculas.map((item) => {
          const estilo = ESTILO_SITUACAO_MATRICULA[item.situacao];
          return (
            <li key={item.matricula.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-areia-900">{item.plano?.nome ?? "—"}</span>
                <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
                  {estilo.rotulo}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-areia-600">
                {formatarMoeda(item.matricula.valorMensal)} · todo dia {item.matricula.diaVencimento}
                {item.plano && ` · ${ESTILO_TABELA[item.plano.tabela].rotulo.toLowerCase()}`}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-areia-500">{periodo(item)}</p>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rolagem-suave md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
              <th scope="col" className="px-5 py-2.5 font-medium">Plano</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Tabela</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Vencimento</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Período</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-areia-100">
            {matriculas.map((item) => {
              const estilo = ESTILO_SITUACAO_MATRICULA[item.situacao];
              return (
                <tr key={item.matricula.id} className="hover:bg-areia-50">
                  <td className="px-5 py-2.5 font-medium text-areia-800">{item.plano?.nome ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-areia-600">
                    {item.plano ? ESTILO_TABELA[item.plano.tabela].rotulo : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-areia-800">
                    {formatarMoeda(item.matricula.valorMensal)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-areia-600">
                    Dia {item.matricula.diaVencimento}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-areia-600">
                    {periodo(item)}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
                      {estilo.rotulo}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
