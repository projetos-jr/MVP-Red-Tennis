"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiltrosDaAgenda } from "@/components/agenda/FiltrosDaAgenda";
import {
  IconeCancelar,
  IconeChuva,
  IconeImpressora,
  IconeTablet,
} from "@/components/agenda/Icones";
import { Legenda } from "@/components/agenda/Legenda";
import { ModalBloquearQuadra } from "@/components/agenda/ModalBloquearQuadra";
import { ModalChuva } from "@/components/agenda/ModalChuva";
import {
  ModalNovoHorario,
  type PreenchimentoNovoHorario,
} from "@/components/agenda/ModalNovoHorario";
import { ModalReservas } from "@/components/agenda/ModalReservas";
import { PainelDoHorario } from "@/components/agenda/PainelDoHorario";
import { useAgora } from "@/components/agenda/useAgora";
import { VisaoDiaQuadras } from "@/components/agenda/VisaoDiaQuadras";
import { VisaoDiaria } from "@/components/agenda/VisaoDiaria";
import { VisaoMensal } from "@/components/agenda/VisaoMensal";
import { VisaoSemanal } from "@/components/agenda/VisaoSemanal";
import { plural } from "@/components/agenda/estilos";
import { useAvisos } from "@/components/ui/Avisos";
import { Card } from "@/components/ui/Card";
import { Carregando } from "@/components/ui/Carregando";
import {
  IconeAgenda,
  IconeAlerta,
  IconeAnterior,
  IconeCadeado,
  IconeMais,
  IconeProximo,
  IconeQuadras,
  IconeRelogio,
} from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { StatCard } from "@/components/ui/StatCard";
import { HOJE } from "@/lib/banco/constantes";
import { liberarReservasVencidas } from "@/lib/banco/operacoes/agenda";
import {
  FILTRO_INICIAL,
  contarReservasVencidas,
  montarAgenda,
  professorPelaUrl,
  professoresAtivos,
  quadraPelaUrl,
  quadrasDaArena,
  reservasAguardandoPagamento,
  resumirAgenda,
  type FiltroAgenda,
  type ItemAgenda,
  type ResumoDaAgenda,
} from "@/lib/consultas/agenda";
import {
  DIAS_SEMANA_CURTO,
  agoraArena,
  datasDaSemana,
  diaDaSemana,
  formatarDiaMes,
  formatarMesAno,
  gradeDoMes,
  mesmoMes,
  somarDias,
  somarMeses,
} from "@/lib/date";
import { useApp } from "@/store/AppStore";

type Visao = "dia" | "semana" | "mes";
type Janela = "bloqueio" | "chuva" | "reservas";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function PaginaAgenda() {
  return (
    <Suspense fallback={<Carregando />}>
      <AgendaPelaUrl />
    </Suspense>
  );
}

/**
 * Aceita `?quadra=<id>`, `?professor=<id ou nome>`, `?data=YYYY-MM-DD`,
 * `?visao=dia|semana|mes` e `?ocupacao=<id>` (abre o painel do horario).
 * A agenda recomeca quando a URL muda (ex.: vindo da ficha do professor).
 */
function AgendaPelaUrl() {
  const parametros = useSearchParams();
  return (
    <Agenda
      key={parametros.toString()}
      url={{
        quadra: parametros.get("quadra"),
        professor: parametros.get("professor"),
        data: parametros.get("data"),
        visao: parametros.get("visao"),
        ocupacao: parametros.get("ocupacao"),
      }}
    />
  );
}

function Agenda({
  url,
}: {
  url: Record<"quadra" | "professor" | "data" | "visao" | "ocupacao", string | null>;
}) {
  const { banco, colaborador, executar } = useApp();
  const { avisar } = useAvisos();
  const agora = useAgora();

  // Hipotese H9: o professor ve so as proprias aulas e nao altera a agenda.
  const podeEditar = colaborador.perfil !== "professor";
  const professorDoPerfil = podeEditar ? undefined : colaborador.professorId;

  const quadras = useMemo(() => quadrasDaArena(banco), [banco]);
  const professores = useMemo(() => professoresAtivos(banco), [banco]);

  const [visao, setVisao] = useState<Visao>(() =>
    url.visao === "dia" || url.visao === "semana" || url.visao === "mes"
      ? url.visao
      : url.data
        ? "dia"
        : "semana",
  );
  const [dataFoco, setDataFoco] = useState(() =>
    url.data && DATA_ISO.test(url.data) ? url.data : HOJE,
  );
  const [filtro, setFiltro] = useState<FiltroAgenda>(() => ({
    ...FILTRO_INICIAL,
    quadraId: quadraPelaUrl(banco, url.quadra) ?? "todas",
    professorId: professorPelaUrl(banco, url.professor) ?? "todos",
  }));
  const [ocupacaoAberta, setOcupacaoAberta] = useState<string | null>(url.ocupacao);
  const [novoHorario, setNovoHorario] = useState<PreenchimentoNovoHorario | null>(null);
  const [janela, setJanela] = useState<Janela | null>(null);

  const filtroEfetivo = useMemo(
    () => (professorDoPerfil ? { ...filtro, professorId: professorDoPerfil } : filtro),
    [filtro, professorDoPerfil],
  );

  // --- Leitura: so o periodo visivel, indexado por data ------------------------
  const semana = useMemo(() => datasDaSemana(dataFoco), [dataFoco]);
  const datasDaGrade = useMemo(
    () => (visao === "mes" ? gradeDoMes(dataFoco) : semana),
    [visao, dataFoco, semana],
  );
  // Os contadores contam as canceladas mesmo quando a grade as esconde.
  const porData = useMemo(
    () => montarAgenda(banco, datasDaGrade, { ...filtroEfetivo, mostrarCanceladas: true }, agora),
    [banco, datasDaGrade, filtroEfetivo, agora],
  );
  const porDataVisivel = useMemo(() => {
    if (filtroEfetivo.mostrarCanceladas) return porData;
    return new Map([...porData].map(([data, itens]) => [data, itens.filter((i) => !i.cancelada)]));
  }, [porData, filtroEfetivo.mostrarCanceladas]);

  const datasDoResumo = useMemo(
    () =>
      visao === "dia"
        ? [dataFoco]
        : visao === "semana"
          ? semana
          : datasDaGrade.filter((d) => mesmoMes(d, dataFoco)),
    [visao, dataFoco, semana, datasDaGrade],
  );
  const quadrasNoResumo = filtroEfetivo.quadraId === "todas" ? quadras.length : 1;
  const resumo = useMemo(
    () => resumirAgenda(porData, datasDoResumo, quadrasNoResumo),
    [porData, datasDoResumo, quadrasNoResumo],
  );
  // No celular a grade mostra um dia por vez: os contadores acompanham o dia.
  const resumoDoDia = useMemo(
    () => resumirAgenda(porData, [dataFoco], quadrasNoResumo),
    [porData, dataFoco, quadrasNoResumo],
  );
  const reservas = useMemo(() => reservasAguardandoPagamento(banco, agora), [banco, agora]);
  const reservasVencidas = reservas.filter((r) => r.vencida).length;

  // --- Hipotese H5: liberacao automatica, so se a opcao estiver ligada ---------
  const jaLiberou = useRef(false);
  useEffect(() => {
    if (jaLiberou.current || !podeEditar || !banco.configuracoes.liberarReservaAutomaticamente)
      return;
    jaLiberou.current = true;
    const vencidas = contarReservasVencidas(banco, agoraArena());
    if (vencidas === 0) return;
    if (executar(liberarReservasVencidas, {}).ok) {
      avisar(
        "info",
        `${plural(vencidas, "reserva sem pagamento no prazo foi liberada", "reservas sem pagamento no prazo foram liberadas")} automaticamente (opção ligada nas Configurações).`,
      );
    }
  }, [banco, podeEditar, executar, avisar]);

  // --- Acoes ---------------------------------------------------------------------
  const abrirHorario = useCallback(
    (item: ItemAgenda) => setOcupacaoAberta(item.ocupacao.id),
    [setOcupacaoAberta],
  );
  const fecharPainel = useCallback(() => setOcupacaoAberta(null), [setOcupacaoAberta]);
  const abrirDia = useCallback(
    (data: string) => {
      setDataFoco(data);
      setVisao("dia");
    },
    [setDataFoco, setVisao],
  );

  const marcar = podeEditar
    ? (inicial: PreenchimentoNovoHorario) =>
        setNovoHorario({
          ...inicial,
          quadraId: inicial.quadraId ?? (filtro.quadraId !== "todas" ? filtro.quadraId : undefined),
        })
    : undefined;

  function navegar(direcao: -1 | 1) {
    setDataFoco((atual) =>
      visao === "dia"
        ? somarDias(atual, direcao)
        : visao === "semana"
          ? somarDias(atual, 7 * direcao)
          : somarMeses(atual, direcao),
    );
  }

  const titulo =
    visao === "dia"
      ? `${DIAS_SEMANA_CURTO[diaDaSemana(dataFoco)]}, ${formatarDiaMes(dataFoco)}`
      : visao === "semana"
        ? `${formatarDiaMes(semana[0])} — ${formatarDiaMes(semana[6])}`
        : formatarMesAno(dataFoco);
  const periodo = visao === "dia" ? "neste dia" : visao === "semana" ? "nesta semana" : "neste mês";
  const resumoNoCelular = visao === "mes" ? resumo : resumoDoDia;
  const periodoNoCelular = visao === "mes" ? "neste mês" : "neste dia";
  const quadrasDoDia =
    filtro.quadraId === "todas" ? quadras : quadras.filter((q) => q.id === filtro.quadraId);
  const quadraDoModo = filtro.quadraId !== "todas" ? filtro.quadraId : "1";

  // As janelas ficam fora do `space-y-5`: a margem que ele poe entre os filhos
  // deslocaria as camadas fixas (painel e modais).
  return (
    <>
      <div className="space-y-5">
        {/* Cabecalho */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Agenda</h1>
            <p className="mt-1 text-sm text-areia-600 md:hidden">
              {plural(resumoNoCelular.ativas, "horário", "horários")} {periodoNoCelular}
            </p>
            <p className="mt-1 hidden text-sm text-areia-600 md:block">
              {plural(resumo.ativas, "horário", "horários")} {periodo} · funcionamento das 07h às
              22h
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-areia-200 bg-white p-1">
              <button
                type="button"
                onClick={() => navegar(-1)}
                className="btn-fantasma px-2 py-1.5"
                aria-label={
                  visao === "dia"
                    ? "Dia anterior"
                    : visao === "semana"
                      ? "Semana anterior"
                      : "Mês anterior"
                }
              >
                <IconeAnterior className="h-4 w-4" />
              </button>
              <span
                className="min-w-[124px] text-center text-sm font-semibold text-areia-800 first-letter:uppercase"
                aria-live="polite"
              >
                {titulo}
              </span>
              <button
                type="button"
                onClick={() => navegar(1)}
                className="btn-fantasma px-2 py-1.5"
                aria-label={
                  visao === "dia"
                    ? "Próximo dia"
                    : visao === "semana"
                      ? "Próxima semana"
                      : "Próximo mês"
                }
              >
                <IconeProximo className="h-4 w-4" />
              </button>
            </div>

            <button type="button" onClick={() => setDataFoco(HOJE)} className="btn-secundario py-2">
              Hoje
            </button>

            <input
              type="date"
              value={dataFoco}
              onChange={(e) => DATA_ISO.test(e.target.value) && setDataFoco(e.target.value)}
              className="campo hidden w-auto py-1.5 lg:block"
              aria-label="Ir para a data"
            />

            <Segmentado
              aria="Modo de visualização"
              valor={visao === "mes" ? "mes" : "dia"}
              aoMudar={(valor) => setVisao(valor)}
              opcoes={[
                { valor: "dia", rotulo: "Dia" },
                { valor: "mes", rotulo: "Mês" },
              ]}
              className="md:hidden"
            />
            <Segmentado
              aria="Modo de visualização"
              valor={visao}
              aoMudar={setVisao}
              opcoes={[
                { valor: "dia", rotulo: "Dia" },
                { valor: "semana", rotulo: "Semana" },
                { valor: "mes", rotulo: "Mês" },
              ]}
              className="hidden md:inline-flex"
            />

            {podeEditar && (
              <button
                type="button"
                onClick={() => marcar?.({ data: dataFoco })}
                className="btn-primario py-2"
              >
                <IconeMais className="h-4 w-4" />
                Novo horário
              </button>
            )}
          </div>
        </div>

        {/* Acoes da agenda: no celular, uma linha que rola para o lado */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 rolagem-suave sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          {podeEditar && (
            <>
              <button
                type="button"
                onClick={() => setJanela("bloqueio")}
                className="btn-secundario shrink-0 px-3 py-2 text-xs"
              >
                <IconeCadeado className="h-4 w-4" />
                Bloquear quadra
              </button>
              <button
                type="button"
                onClick={() => setJanela("chuva")}
                className="btn-secundario shrink-0 px-3 py-2 text-xs"
              >
                <IconeChuva className="h-4 w-4" />
                Cancelar por chuva
              </button>
              <button
                type="button"
                onClick={() => setJanela("reservas")}
                className="btn-secundario shrink-0 px-3 py-2 text-xs"
              >
                <IconeRelogio className="h-4 w-4" />
                Reservas sem pagamento
                {reservas.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-bold ${
                      reservasVencidas > 0
                        ? "bg-tijolo-600 text-white"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {reservas.length}
                  </span>
                )}
              </button>
            </>
          )}
          <Link
            href={`/agenda/imprimir?data=${dataFoco}`}
            className="btn-secundario shrink-0 px-3 py-2 text-xs"
          >
            <IconeImpressora className="h-4 w-4" />
            Imprimir o dia
          </Link>
          <Link
            href={`/agenda/quadra?quadra=${quadraDoModo}${dataFoco !== HOJE ? `&data=${dataFoco}` : ""}`}
            className="btn-secundario shrink-0 px-3 py-2 text-xs"
          >
            <IconeTablet className="h-4 w-4" />
            Modo quadra
          </Link>
        </div>

        {!podeEditar && (
          <p className="rounded-2xl border border-saibro-200 bg-saibro-50/70 px-4 py-3 text-sm text-saibro-900">
            Perfil de professor: você vê só as suas aulas e não altera a agenda (Hipótese H9).
          </p>
        )}

        {/* Hipotese H5: reserva com prazo vencido entra em alerta; quem decide e a recepcao. */}
        {podeEditar && reservasVencidas > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tijolo-200 bg-tijolo-50/70 px-4 py-3">
            <div className="flex items-start gap-3">
              <IconeAlerta className="mt-0.5 h-5 w-5 shrink-0 text-tijolo-600" />
              <div>
                <p className="text-sm font-semibold text-tijolo-800">
                  {plural(
                    reservasVencidas,
                    "reserva passou do prazo de pagamento",
                    "reservas passaram do prazo de pagamento",
                  )}
                </p>
                <p className="hidden text-xs text-areia-700 md:block">
                  A reserva só entra em alerta: a recepção decide se libera o horário (Hipótese H5).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJanela("reservas")}
              className="btn-secundario py-1.5 text-xs"
            >
              Ver reservas
            </button>
          </div>
        )}

        {/* Contadores do periodo visivel (no celular, o dia em foco) */}
        <Contadores
          resumo={resumoNoCelular}
          periodo={periodoNoCelular}
          mostrarCanceladas={filtro.mostrarCanceladas}
          className="grid grid-cols-2 gap-3 md:hidden"
        />
        <Contadores
          resumo={resumo}
          periodo={periodo}
          mostrarCanceladas={filtro.mostrarCanceladas}
          className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4"
        />

        <Card>
          <FiltrosDaAgenda
            filtro={filtro}
            aoMudar={(parcial) => setFiltro((atual) => ({ ...atual, ...parcial }))}
            quadras={quadras}
            professores={professores}
            professorTravado={
              professorDoPerfil
                ? professores.find((p) => p.id === professorDoPerfil)?.nome
                : undefined
            }
          />
          <div className="hidden border-b border-areia-200 px-4 py-2.5 md:block">
            <Legenda />
          </div>

          {visao === "mes" ? (
            <VisaoMensal
              referencia={dataFoco}
              datas={datasDaGrade}
              porData={porDataVisivel}
              hoje={HOJE}
              aoSelecionarDia={abrirDia}
            />
          ) : (
            <>
              {/* Celular: um dia por vez. Computador: semana ou dia por quadra. */}
              <div className="md:hidden">
                <VisaoDiaria
                  datas={semana}
                  dia={dataFoco}
                  aoTrocarDia={setDataFoco}
                  itens={porDataVisivel.get(dataFoco) ?? []}
                  hoje={HOJE}
                  aoAbrir={abrirHorario}
                  aoAdicionar={marcar}
                />
              </div>
              <div className="hidden md:block">
                {visao === "dia" ? (
                  <VisaoDiaQuadras
                    data={dataFoco}
                    itens={porDataVisivel.get(dataFoco) ?? []}
                    quadras={quadrasDoDia}
                    hoje={HOJE}
                    agora={agora}
                    aoAbrir={abrirHorario}
                    aoAdicionar={marcar}
                  />
                ) : (
                  <VisaoSemanal
                    datas={semana}
                    porData={porDataVisivel}
                    hoje={HOJE}
                    umaQuadra={filtro.quadraId !== "todas"}
                    aoAbrir={abrirHorario}
                    aoAbrirDia={abrirDia}
                    aoAdicionar={marcar}
                  />
                )}
              </div>
            </>
          )}
        </Card>

        <p className="flex items-start gap-2 text-xs text-areia-500">
          <IconeAgenda className="h-4 w-4 shrink-0" />
          Clique num horário para abrir o painel (presença, cancelar, remarcar), no nome de um aluno
          para abrir a ficha{podeEditar ? " ou num espaço livre para marcar um novo horário" : ""}.
        </p>
      </div>

      {novoHorario && (
        <ModalNovoHorario
          aberto
          inicial={novoHorario}
          aoFechar={() => setNovoHorario(null)}
          aoSalvar={(data) => setDataFoco(data)}
        />
      )}
      {janela === "bloqueio" && (
        <ModalBloquearQuadra
          aberto
          aoFechar={() => setJanela(null)}
          inicial={{
            data: dataFoco,
            quadraId: filtro.quadraId !== "todas" ? filtro.quadraId : undefined,
          }}
          agora={agora}
        />
      )}
      {janela === "chuva" && (
        <ModalChuva
          aberto
          aoFechar={() => setJanela(null)}
          dataInicial={visao === "dia" ? dataFoco : HOJE}
          agora={agora}
        />
      )}
      {janela === "reservas" && (
        <ModalReservas
          aberto
          aoFechar={() => setJanela(null)}
          agora={agora}
          podeEditar={podeEditar}
          aoAbrirHorario={(id, data) => {
            setJanela(null);
            setDataFoco(data);
            setOcupacaoAberta(id);
          }}
        />
      )}
      <PainelDoHorario
        ocupacaoId={ocupacaoAberta}
        aoFechar={fecharPainel}
        podeEditar={podeEditar}
        agora={agora}
      />
    </>
  );
}

/** Os quatro contadores do topo, sempre do periodo que esta na tela. */
function Contadores({
  resumo,
  periodo,
  mostrarCanceladas,
  className,
}: {
  resumo: ResumoDaAgenda;
  periodo: string;
  mostrarCanceladas: boolean;
  className: string;
}) {
  const ocupacao = resumo.minutosDisponiveis
    ? Math.round((resumo.minutosOcupados / resumo.minutosDisponiveis) * 100)
    : 0;
  return (
    <div className={className}>
      <StatCard
        rotulo="Aulas e reservas"
        rotuloCurto="Horários"
        valor={resumo.ativas.toLocaleString("pt-BR")}
        detalhe={`${plural(resumo.alunos, "aluno", "alunos")} ${periodo}`}
        icone={<IconeAgenda className="h-5 w-5" />}
        tom="saibro"
      />
      <StatCard
        rotulo="Ocupação das quadras"
        rotuloCurto="Ocupação"
        valor={`${ocupacao}%`}
        detalhe={`${Math.round(resumo.minutosOcupados / 60)} h de ${Math.round(resumo.minutosDisponiveis / 60)} h de quadra${
          resumo.bloqueios > 0 ? ` · ${plural(resumo.bloqueios, "bloqueio", "bloqueios")}` : ""
        }`}
        icone={<IconeQuadras className="h-5 w-5" />}
      />
      <StatCard
        rotulo="Canceladas"
        valor={resumo.canceladas.toLocaleString("pt-BR")}
        detalhe={
          mostrarCanceladas ? "aparecem riscadas na grade" : "escondidas na grade (veja os filtros)"
        }
        icone={<IconeCancelar className="h-5 w-5" />}
      />
      <StatCard
        rotulo="Aguardando pagamento"
        rotuloCurto="A pagar"
        valor={resumo.aguardandoPagamento.toLocaleString("pt-BR")}
        detalhe={
          resumo.vencidas > 0
            ? `${plural(resumo.vencidas, "com prazo vencido", "com prazo vencido")} ${periodo}`
            : `reservas avulsas ${periodo}`
        }
        icone={<IconeRelogio className="h-5 w-5" />}
        tom={resumo.vencidas > 0 ? "alerta" : "neutro"}
      />
    </div>
  );
}
