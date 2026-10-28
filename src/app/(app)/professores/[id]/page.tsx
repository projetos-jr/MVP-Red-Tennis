"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FichaConsumo } from "@/components/consumo/FichaConsumo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import {
  IconeAgenda,
  IconeFinanceiro,
  IconeRelogio,
  IconeUsuarios,
  IconeVoltar,
} from "@/components/ui/Icons";
import { DIAS_SEMANA_CURTO } from "@/lib/date";
import { caminhoAvatar } from "@/lib/dados";
import {
  agendaDoProfessor,
  buscarProfessor,
  nomeDoAluno,
} from "@/lib/selectors";
import { ESTILO_TIPO, formatarMoeda, rotuloQuadra } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

export default function PaginaFichaProfessor() {
  const parametros = useParams<{ id: string }>();
  const { horarios, alunos } = useApp();

  const professor = buscarProfessor(parametros.id);

  if (!professor) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-areia-600">Professor não encontrado.</p>
        <Link href="/agenda" className="btn-secundario mt-4">
          Voltar para a agenda
        </Link>
      </Card>
    );
  }

  const agenda = agendaDoProfessor(professor.nome, horarios);
  const comissaoMes = agenda.horasSemana * professor.valorHoraAula * 4.3;
  const alunosDoProfessor = alunos.filter(
    (a) => a.professorPrincipal === professor.nome,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-areia-600 transition-colors hover:text-tijolo-700"
      >
        <IconeVoltar className="h-4 w-4" />
        Voltar
      </Link>

      {/* Cabeçalho */}
      <section className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-saibro-600 via-saibro-500 to-saibro-700" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
          <Avatar
            id={professor.id}
            nome={professor.nome}
            src={caminhoAvatar(professor.id)}
            tamanho="xl"
            comAnel
            className="-mt-12 shadow-card"
          />
          <div className="min-w-0 flex-1 sm:pt-2">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold text-areia-900">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: professor.cor }}
                title="Cor do professor na agenda"
              />
              {professor.nome}
            </h1>
            <p className="mt-1 text-sm text-areia-600">
              {professor.especialidade}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge cor="#9A4720" fundo="#FAE8DA" borda="#F3CEAF">
                Professor
              </Badge>
              <Badge>{formatarMoeda(professor.valorHoraAula)} por hora/aula</Badge>
              <Badge>{alunosDoProfessor.length} alunos no plano</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Aulas por semana"
          rotuloCurto="Aulas/sem"
          valor={String(agenda.aulasSemana)}
          detalhe="Alocações fixas na grade"
          icone={<IconeAgenda className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Horas por semana"
          rotuloCurto="Horas/sem"
          valor={`${agenda.horasSemana.toFixed(0)}h`}
          detalhe="Somando todas as turmas"
          icone={<IconeRelogio className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Alunos atendidos"
          rotuloCurto="Alunos"
          valor={String(agenda.alunosAtendidos.length)}
          detalhe="Pessoas distintas na semana"
          icone={<IconeUsuarios className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Comissão estimada"
          rotuloCurto="Comissão"
          valor={formatarMoeda(comissaoMes)}
          detalhe="Por mês, com base na grade atual"
          icone={<IconeFinanceiro className="h-5 w-5" />}
          tom="positivo"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Agenda do professor */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            titulo="Agenda da semana"
            descricao="Todas as turmas deste professor na grade atual."
            icone={<IconeAgenda className="h-5 w-5" />}
            acao={
              <Link
                href={`/agenda?professor=${encodeURIComponent(professor.nome)}`}
                className="text-sm font-medium text-tijolo-700 hover:underline"
              >
                Ver na agenda
              </Link>
            }
          />
          <ul className="max-h-[520px] divide-y divide-areia-100 overflow-y-auto rolagem-suave">
            {agenda.horarios.map((horario) => {
              const estilo = ESTILO_TIPO[horario.tipo];
              return (
                <li key={horario.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: estilo.cor }}
                  />
                  <div className="w-24 shrink-0">
                    <p className="text-sm font-semibold text-areia-900">
                      {DIAS_SEMANA_CURTO[horario.diaSemana]} · {horario.horaInicio}
                    </p>
                    <p className="text-xs text-areia-500">
                      {rotuloQuadra(horario.quadra)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-areia-700">
                      {horario.alunosIds.map((id) => nomeDoAluno(id)).join(" · ")}
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

            {agenda.horarios.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-areia-500">
                Nenhuma aula na grade atual.
              </li>
            )}
          </ul>
        </Card>

        <div className="min-w-0 space-y-6">
          <FichaConsumo
            pessoaId={professor.id}
            tipoPessoa="professor"
            nomePessoa={professor.nome}
          />

          <Card>
            <CardHeader
              titulo="Alunos no plano"
              descricao="Têm este professor como principal."
              icone={<IconeUsuarios className="h-5 w-5" />}
            />
            <ul className="max-h-72 divide-y divide-areia-100 overflow-y-auto rolagem-suave">
              {alunosDoProfessor.map((aluno) => (
                <li key={aluno.id}>
                  <Link
                    href={`/alunos/${aluno.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-areia-50"
                  >
                    <Avatar
                      id={aluno.id}
                      nome={aluno.nome}
                      src={aluno.avatarUrl}
                      tamanho="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-areia-900">
                        {aluno.nome}
                      </span>
                      <span className="block truncate text-xs text-areia-500">
                        {aluno.plano}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
