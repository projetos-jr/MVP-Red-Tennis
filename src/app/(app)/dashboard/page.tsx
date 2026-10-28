"use client";

import Link from "next/link";
import { CardQuadra } from "@/components/dashboard/CardQuadra";
import { corDaQuadra } from "@/components/dashboard/Quadra3D";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  IconeAgenda,
  IconeAlerta,
  IconeFinanceiro,
  IconeQuadras,
  IconeRelogio,
  IconeSeta,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { StatCard } from "@/components/ui/StatCard";
import {
  DIAS_SEMANA_LONGO,
  diaDaSemana,
  formatarDataExtenso,
  horaAtualArena,
  saudacao,
} from "@/lib/date";
import { HOJE } from "@/lib/arena";
import { caminhoAvatar } from "@/lib/dados";
import {
  horariosDoDia,
  nomeCompacto,
  nomeDoAluno,
  ocupacaoDasQuadras,
  reservasSemPagamento,
  resumoDoDia,
  resumoFinanceiro,
} from "@/lib/selectors";
import { ESTILO_TIPO, formatarMoeda, rotuloQuadra } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

export default function PaginaDashboard() {
  const { usuario, horarios } = useApp();

  const ocupacoes = ocupacaoDasQuadras(HOJE, horarios);
  const resumo = resumoDoDia(HOJE, horarios);
  const financeiro = resumoFinanceiro();
  const pendencias = reservasSemPagamento().slice(0, 4);

  const diaAtual = diaDaSemana(HOJE);
  const hora = horaAtualArena();
  const agendaHoje = horariosDoDia(diaAtual, {}, horarios);
  const proximas = agendaHoje
    .filter((h) => Number(h.horaInicio.slice(0, 2)) >= hora)
    .slice(0, 6);
  const listaAgenda = proximas.length > 0 ? proximas : agendaHoje.slice(-6);

  return (
    <div className="space-y-6">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-areia-600">
            {saudacao()}, {usuario.nome.split(" ")[0]} 👋
          </p>
          <h1 className="mt-1 text-2xl font-bold text-areia-900 sm:text-3xl">
            Visão das quadras
          </h1>
          <p className="mt-1 text-sm text-areia-600 first-letter:uppercase">
            {DIAS_SEMANA_LONGO[diaAtual]}, {formatarDataExtenso(HOJE)}
          </p>
        </div>

        {/* No celular a agenda já está na barra inferior */}
        <Link href="/agenda" className="btn-secundario hidden md:inline-flex">
          <IconeAgenda className="h-4 w-4" />
          Abrir agenda completa
        </Link>
      </div>

      {/* Indicadores do dia */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Aulas e locações hoje"
          rotuloCurto="Hoje"
          valor={String(resumo.aulasHoje)}
          detalhe="Distribuídas entre as 4 quadras e o paredão"
          icone={<IconeAgenda className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Alunos em quadra"
          rotuloCurto="Alunos"
          valor={String(resumo.alunosEmQuadra)}
          detalhe="Pessoas com horário marcado hoje"
          icone={<IconeUsuarios className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Ocupação média"
          rotuloCurto="Ocupação"
          valor={`${Math.round(resumo.taxaOcupacaoMedia * 100)}%`}
          detalhe={`Maior procura: ${rotuloQuadra(resumo.quadraMaisCheia)}`}
          icone={<IconeQuadras className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Pendências financeiras"
          rotuloCurto="Pendências"
          valor={formatarMoeda(financeiro.emAtraso)}
          detalhe={`${financeiro.quantidadeEmAtraso} reserva(s) sem pagamento confirmado`}
          icone={<IconeFinanceiro className="h-5 w-5" />}
          tom={financeiro.quantidadeEmAtraso > 0 ? "alerta" : "positivo"}
        />
      </div>

      {/* Quadras em perspectiva */}
      <Card>
        <CardHeader
          titulo="Ocupação de hoje"
          descricao="Quanto mais escuro o piso, mais cheia está a quadra. Clique para abrir a agenda daquela quadra."
          icone={<IconeQuadras className="h-5 w-5" />}
          acao={<EscalaOcupacao />}
        />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
          {ocupacoes.map((ocupacao) => (
            <CardQuadra key={String(ocupacao.quadra)} ocupacao={ocupacao} />
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Agenda do dia */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            titulo={proximas.length > 0 ? "Próximos horários de hoje" : "Últimos horários de hoje"}
            descricao="Sequência do dia nas quadras, com professor e alunos."
            icone={<IconeRelogio className="h-5 w-5" />}
            acao={
              <Link
                href="/agenda"
                className="text-sm font-medium text-tijolo-700 hover:underline"
              >
                Ver semana
              </Link>
            }
          />
          <ul className="divide-y divide-areia-200">
            {listaAgenda.map((horario) => {
              const estilo = ESTILO_TIPO[horario.tipo];
              return (
                <li
                  key={horario.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-areia-50"
                >
                  <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-areia-900">
                    {horario.horaInicio}
                  </span>
                  <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: estilo.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        cor={estilo.texto}
                        fundo={estilo.fundo}
                        borda={estilo.borda}
                        className="text-[11px]"
                      >
                        {horario.tipo}
                      </Badge>
                      <span className="chip bg-areia-100 text-[11px] text-areia-600">
                        {rotuloQuadra(horario.quadra)}
                      </span>
                      {horario.temConflito && (
                        <Badge
                          cor="#8A2118"
                          fundo="#FBE3E0"
                          borda="#EC9A90"
                          className="text-[11px]"
                        >
                          <IconeAlerta className="h-3.5 w-3.5" />
                          Conflito
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-areia-700">
                      {horario.alunosIds
                        .map((id) => nomeCompacto(nomeDoAluno(id)))
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {horario.alunosIds.slice(0, 3).map((id) => (
                      <Avatar
                        key={id}
                        id={id}
                        nome={nomeDoAluno(id)}
                        src={caminhoAvatar(id)}
                        tamanho="sm"
                        comAnel
                        className="-ml-3 first:ml-0"
                      />
                    ))}
                    <span className="hidden text-xs text-areia-500 sm:block">
                      {horario.professor}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Pontos de atencao */}
        <Card>
          <CardHeader
            titulo="Precisa de atenção"
            descricao="O que não pode passar batido hoje."
            icone={<IconeAlerta className="h-5 w-5" />}
          />
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-tijolo-200 bg-tijolo-50/60 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-tijolo-800">
                <IconeAlerta className="h-4 w-4" />
                {resumo.conflitos} conflito(s) de horário
              </p>
              <p className="mt-1 text-xs leading-relaxed text-tijolo-700/80">
                Dois agendamentos ocupando a mesma quadra no mesmo horário.
              </p>
              <Link
                href="/agenda"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-tijolo-700 hover:underline"
              >
                Resolver na agenda <IconeSeta className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div>
              <p className="card-titulo">Pagamentos em atraso</p>
              <ul className="mt-2 space-y-2">
                {pendencias.map((pagamento) => (
                  <li
                    key={pagamento.id}
                    className="flex items-center gap-3 rounded-xl border border-areia-200 p-2.5"
                  >
                    <Avatar
                      id={pagamento.alunoId}
                      nome={nomeDoAluno(pagamento.alunoId)}
                      src={caminhoAvatar(pagamento.alunoId)}
                      tamanho="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/alunos/${pagamento.alunoId}`}
                        className="block truncate text-sm font-medium text-areia-900 hover:text-tijolo-700 hover:underline"
                      >
                        {nomeDoAluno(pagamento.alunoId)}
                      </Link>
                      <p className="truncate text-xs text-areia-500">
                        {pagamento.item}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-tijolo-700">
                        {formatarMoeda(pagamento.valor)}
                      </p>
                      <p className="text-[11px] text-areia-500">
                        {pagamento.diasEmAtraso}d de atraso
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href="/financeiro"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-tijolo-700 hover:underline"
              >
                Abrir financeiro <IconeSeta className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Escala de referencia do gradiente de ocupacao, para os dois tipos de piso. */
function EscalaOcupacao() {
  const passos = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex">
      {(["saibro", "cimento"] as const).map((piso) => (
        <div key={piso} className="flex items-center gap-2">
          <span className="text-[11px] capitalize text-areia-500">{piso}</span>
          <div className="flex overflow-hidden rounded-full border border-areia-200">
            {passos.map((taxa) => (
              <span
                key={taxa}
                className="h-3.5 w-5"
                style={{ backgroundColor: corDaQuadra(taxa, piso).media }}
              />
            ))}
          </div>
        </div>
      ))}
      <span className="text-[11px] text-areia-400">livre → lotada</span>
    </div>
  );
}
