"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeCongelado } from "@/components/ui/Icons";
import type { Congelamento } from "@/lib/banco/tipos";
import type { CongelamentoDoAluno, ResumoDoAluno } from "@/lib/consultas/alunos";
import { formatarData } from "@/lib/date";
import { ESTILO_SITUACAO_CONGELAMENTO, plural } from "./estilos";

function periodo(congelamento: Congelamento): string {
  if (congelamento.fimReal && congelamento.fimReal < congelamento.inicio) {
    return `Marcado para ${formatarData(congelamento.inicio)}`;
  }
  if (congelamento.fimReal) {
    return `${formatarData(congelamento.inicio)} → ${formatarData(congelamento.fimReal)}`;
  }
  return congelamento.fimPrevisto
    ? `${formatarData(congelamento.inicio)} → ${formatarData(congelamento.fimPrevisto)} (previsto)`
    : `Desde ${formatarData(congelamento.inicio)}`;
}

/**
 * Congelamento do plano (Hipotese H4): o que vale agora, a acao de congelar
 * ou reativar e o historico de congelamentos.
 */
export function CartaoCongelamento({
  resumo,
  congelamentos,
  hoje,
  podeEditar,
  aoCongelar,
  aoReativar,
}: {
  resumo: ResumoDoAluno;
  congelamentos: CongelamentoDoAluno[];
  hoje: string;
  podeEditar: boolean;
  aoCongelar: () => void;
  aoReativar: () => void;
}) {
  const { aluno, matricula, congelamento, congelamentoAgendado } = resumo;
  const atual = congelamento ?? congelamentoAgendado;
  const infoAtual = congelamentos.find((c) => c.congelamento.id === atual?.id);
  const editavel = podeEditar && aluno.ativo;
  const voltaAtrasada = congelamento && !congelamento.fimReal && (congelamento.fimPrevisto ?? hoje) < hoje;

  return (
    <Card>
      <CardHeader
        titulo="Congelamento"
        descricao="Pausa no plano: as aulas fixas do período ficam suspensas, sem gerar reposição."
        icone={<IconeCongelado className="h-5 w-5" />}
      />

      <div className="p-5">
        {atual ? (
          <div
            className={`rounded-xl border p-4 ${
              congelamento
                ? "border-sky-200 bg-sky-50/70 text-sky-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">
              {congelamento ? "Congelado agora" : "Congelamento marcado"}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{periodo(atual)}</p>
            <p className="mt-1 text-sm">Motivo: {atual.motivo}</p>
            {infoAtual && atual.aulasSuspensas && (
              <p className="mt-1 text-xs">
                {plural(infoAtual.aulasSuspensas, "aula suspensa", "aulas suspensas")}, sem crédito de
                reposição.
              </p>
            )}
            {voltaAtrasada && (
              <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium text-tijolo-800">
                A volta prevista já passou. Reative o plano quando o aluno voltar.
              </p>
            )}
            {editavel && !atual.fimReal && (
              <button type="button" onClick={aoReativar} className="btn-primario mt-3 w-full">
                {congelamento ? "Reativar plano" : "Desmarcar congelamento"}
              </button>
            )}
          </div>
        ) : !aluno.ativo ? (
          <p className="text-sm text-areia-500">Aluno inativo: não há plano para congelar.</p>
        ) : matricula ? (
          <>
            <p className="text-sm leading-relaxed text-areia-600">
              Para quando o aluno vai parar por um tempo (viagem, férias). Sem prazo mínimo ou
              máximo; a mensalidade não muda sozinha.
            </p>
            {editavel && (
              <button type="button" onClick={aoCongelar} className="btn-secundario mt-3 w-full">
                <IconeCongelado className="h-4 w-4" />
                Congelar plano
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-areia-500">Sem matrícula valendo: não há plano para congelar.</p>
        )}
      </div>

      {congelamentos.length > 0 && (
        <div className="border-t border-areia-200">
          <h3 className="px-5 pb-1 pt-4 text-sm font-semibold text-areia-800">
            Histórico de congelamentos
          </h3>
          <ul className="divide-y divide-areia-100">
            {congelamentos.map((item) => {
              const estilo = ESTILO_SITUACAO_CONGELAMENTO[item.situacao];
              return (
                <li key={item.congelamento.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium tabular-nums text-areia-900">
                      {periodo(item.congelamento)}
                    </span>
                    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda} className="shrink-0">
                      {estilo.rotulo}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-areia-600">
                    {item.congelamento.motivo}
                    {item.congelamento.aulasSuspensas &&
                      item.situacao !== "cancelado" &&
                      ` · ${plural(item.aulasSuspensas, "aula suspensa", "aulas suspensas")}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
