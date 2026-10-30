"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeAgenda, IconeAnterior, IconeProximo } from "@/components/ui/Icons";
import { rotuloDaQuadra } from "@/lib/consultas/base";
import type { SemanaDoProfessor } from "@/lib/consultas/professores";
import { DIAS_SEMANA_LONGO, diaDaSemana, formatarDiaMes, inicioDaSemana, somarDias } from "@/lib/date";
import { ESTILO_OCUPACAO } from "@/lib/theme";

/**
 * Agenda da semana do professor, lida das ocupacoes reais (com cancelamentos
 * e reposicoes), dia a dia, com navegacao entre semanas.
 */
export function AgendaDaSemana({
  semana,
  referencia,
  hoje,
  aoMudarReferencia,
}: {
  semana: SemanaDoProfessor;
  /** Uma data da semana mostrada. */
  referencia: string;
  hoje: string;
  aoMudarReferencia: (data: string) => void;
}) {
  const segunda = inicioDaSemana(referencia);
  const estaSemana = segunda === inicioDaSemana(hoje);

  return (
    <Card>
      <CardHeader
        titulo="Agenda da semana"
        descricao="As aulas deste professor nas datas da semana, como estão na agenda."
        icone={<IconeAgenda className="h-5 w-5" />}
        acao={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => aoMudarReferencia(somarDias(segunda, -7))}
              className="btn-fantasma px-2 py-1.5"
              aria-label="Semana anterior"
            >
              <IconeAnterior className="h-4 w-4" />
            </button>
            <span className="min-w-[7.5rem] text-center text-sm font-semibold tabular-nums text-areia-800">
              {formatarDiaMes(segunda)} a {formatarDiaMes(somarDias(segunda, 6))}
            </span>
            <button
              type="button"
              onClick={() => aoMudarReferencia(somarDias(segunda, 7))}
              className="btn-fantasma px-2 py-1.5"
              aria-label="Próxima semana"
            >
              <IconeProximo className="h-4 w-4" />
            </button>
            {!estaSemana && (
              <button
                type="button"
                onClick={() => aoMudarReferencia(hoje)}
                className="btn-secundario ml-1 px-3 py-1.5 text-xs"
              >
                Esta semana
              </button>
            )}
          </div>
        }
      />

      <div className="max-h-[560px] overflow-y-auto rolagem-suave">
        {semana.dias.map((dia) => (
          <section key={dia.data} aria-label={`${DIAS_SEMANA_LONGO[diaDaSemana(dia.data)]}, ${formatarDiaMes(dia.data)}`}>
            <h3 className="sticky top-0 z-[1] flex items-baseline justify-between gap-2 border-b border-areia-100 bg-areia-50/95 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-areia-600 backdrop-blur">
              <span>
                {DIAS_SEMANA_LONGO[diaDaSemana(dia.data)]}, {formatarDiaMes(dia.data)}
                {dia.data === hoje && <span className="ml-1.5 text-tijolo-700">· hoje</span>}
              </span>
              <span className="font-normal normal-case text-areia-500">
                {dia.aulas.length === 0
                  ? "sem aulas"
                  : dia.aulas.length === 1
                    ? "1 aula"
                    : `${dia.aulas.length} aulas`}
              </span>
            </h3>
            <ul className="divide-y divide-areia-100">
              {dia.aulas.map(({ ocupacao, alunos }) => {
                const estilo = ESTILO_OCUPACAO[ocupacao.tipo];
                const cancelada = ocupacao.situacao === "cancelada";
                return (
                  <li key={ocupacao.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: cancelada ? "#D6CEC2" : estilo.cor }}
                    />
                    <div className="w-[5.5rem] shrink-0">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          cancelada ? "text-areia-400 line-through" : "text-areia-900"
                        }`}
                      >
                        {ocupacao.horaInicio}–{ocupacao.horaFim}
                      </p>
                      <p className="text-xs text-areia-500">{rotuloDaQuadra(ocupacao.quadraId)}</p>
                    </div>
                    <div className="min-w-0 flex-1 text-sm text-areia-700">
                      {alunos.length === 0 ? (
                        <span className="text-areia-500">Sem alunos</span>
                      ) : (
                        alunos.map((aluno, i) => (
                          <span key={aluno.id}>
                            {i > 0 && <span className="text-areia-300"> · </span>}
                            <Link href={`/alunos/${aluno.id}`} className="hover:text-tijolo-700 hover:underline">
                              {aluno.nome}
                            </Link>
                          </span>
                        ))
                      )}
                      {ocupacao.descricao && (
                        <span className="block text-xs text-areia-500">{ocupacao.descricao}</span>
                      )}
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        cor={estilo.texto}
                        fundo={estilo.fundo}
                        borda={estilo.borda}
                        className="text-[11px]"
                      >
                        {ocupacao.tipo}
                      </Badge>
                      {cancelada && (
                        <Badge className="px-2 py-0.5 text-[10px]">
                          Cancelada{ocupacao.motivoCancelamento && ` · ${ocupacao.motivoCancelamento}`}
                        </Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="border-t border-areia-200 px-5 py-2.5 text-xs text-areia-500">
        {semana.aulas === 1 ? "1 aula" : `${semana.aulas} aulas`} na semana
        {semana.canceladas > 0 && ` · ${semana.canceladas} canceladas`} ·{" "}
        {semana.alunosAtendidos} alunos diferentes
      </p>
    </Card>
  );
}
