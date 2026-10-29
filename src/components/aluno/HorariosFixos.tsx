import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeAgenda } from "@/components/ui/Icons";
import type { AulaDoAluno, HorarioFixoDoAluno } from "@/lib/consultas/alunos";
import { nomeCompacto, rotuloDaQuadra } from "@/lib/consultas/base";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarData, formatarDiaMes } from "@/lib/date";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { ESTILO_SITUACAO_NA_AULA } from "./estilos";

/** Horarios fixos do aluno (o molde semanal) e as proximas aulas de verdade. */
export function HorariosFixos({
  horarios,
  proximas,
}: {
  horarios: HorarioFixoDoAluno[];
  proximas: AulaDoAluno[];
}) {
  return (
    <Card>
      <CardHeader
        titulo="Horários fixos"
        descricao="Aulas que se repetem toda semana e as próximas datas."
        icone={<IconeAgenda className="h-5 w-5" />}
      />
      <ul className="divide-y divide-areia-100">
        {horarios.map(({ horario, professor, alunos }) => {
          const estilo = ESTILO_OCUPACAO[horario.tipo];
          return (
            <li key={horario.id} className="flex items-center gap-3 px-5 py-3">
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: estilo.cor }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums text-areia-900">
                  {DIAS_SEMANA_CURTO[horario.diaSemana]} · {horario.horaInicio}–{horario.horaFim}
                </p>
                <p className="truncate text-xs text-areia-500">
                  {rotuloDaQuadra(horario.quadraId)} ·{" "}
                  {professor ? nomeCompacto(professor.nome) : "sem professor"}
                  {alunos > 1 && ` · turma de ${alunos}`}
                  {horario.fim && ` · até ${formatarData(horario.fim)}`}
                </p>
              </div>
              <Badge
                cor={estilo.texto}
                fundo={estilo.fundo}
                borda={estilo.borda}
                className="shrink-0 text-[11px]"
              >
                {horario.tipo}
              </Badge>
            </li>
          );
        })}
        {horarios.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-areia-500">Nenhum horário fixo na agenda.</li>
        )}
      </ul>

      {proximas.length > 0 && (
        <div className="border-t border-areia-200">
          <h3 className="px-5 pb-1 pt-4 text-sm font-semibold text-areia-800">Próximas aulas</h3>
          <ul className="divide-y divide-areia-100">
            {proximas.map((aula) => {
              const { ocupacao } = aula;
              const estilo = ESTILO_SITUACAO_NA_AULA[aula.situacao];
              const fora = aula.situacao === "cancelada" || aula.situacao === "suspensa";
              return (
                <li
                  key={`${ocupacao.id}-${aula.participacaoId ?? "s"}`}
                  className="flex items-center justify-between gap-2 px-5 py-2.5"
                >
                  <span className={`min-w-0 text-sm ${fora ? "text-areia-500" : "text-areia-800"}`}>
                    <span className="font-medium tabular-nums">
                      {DIAS_SEMANA_CURTO[diaDaSemana(ocupacao.data)]} {formatarDiaMes(ocupacao.data)} ·{" "}
                      {ocupacao.horaInicio}
                    </span>
                    <span className="block truncate text-xs text-areia-500">
                      {rotuloDaQuadra(ocupacao.quadraId)} · {ocupacao.tipo}
                      {ocupacao.descricao && ` · ${ocupacao.descricao}`}
                    </span>
                  </span>
                  {fora && (
                    <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda} className="shrink-0">
                      {estilo.rotulo}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
