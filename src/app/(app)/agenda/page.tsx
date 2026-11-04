"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiltrosDaAgenda } from "@/components/agenda/FiltrosDaAgenda";
import { GradeDeColunas, type MeiaHoraEscolhida } from "@/components/agenda/GradeDeColunas";
import { colunasDaDiaria, colunasDaSemana, fimSugerido, pxPorMinuto } from "@/components/agenda/grade";
import { IconeChuva, IconeImpressora, IconeTablet } from "@/components/agenda/Icones";
import { Legenda } from "@/components/agenda/Legenda";
import { ListaDoDia } from "@/components/agenda/ListaDoDia";
import { ModalBloquearQuadra } from "@/components/agenda/ModalBloquearQuadra";
import { ModalChuva } from "@/components/agenda/ModalChuva";
import {
  ModalNovoHorario,
  type PreenchimentoNovoHorario,
} from "@/components/agenda/ModalNovoHorario";
import { ModalReservas } from "@/components/agenda/ModalReservas";
import { PainelDoHorario } from "@/components/agenda/PainelDoHorario";
import { SeletorDaVisao } from "@/components/agenda/SeletorDaVisao";
import { useAgora } from "@/components/agenda/useAgora";
import { useLarguraDaAgenda, useToque } from "@/components/agenda/useMidia";
import { VisaoMensal } from "@/components/agenda/VisaoMensal";
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
  IconeRelogio,
} from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import { liberarReservasVencidas } from "@/lib/banco/operacoes/agenda";
import {
  contarReservasVencidas,
  disponibilidadeDasQuadras,
  montarAgenda,
  professoresAtivos,
  quadrasDaArena,
  reservasAguardandoPagamento,
  resumirAgenda,
  type ItemAgenda,
  type ResumoDaAgenda,
} from "@/lib/consultas/agenda";
import {
  enderecoDaAgenda,
  estadoDaAgendaPelaUrl,
  trocarVisao,
  type ContextoDaAgenda,
  type EstadoDaAgenda,
  type VisaoDaAgenda,
} from "@/lib/consultas/enderecoDaAgenda";
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

type Janela = "bloqueio" | "chuva" | "reservas";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function PaginaAgenda() {
  return (
    <Suspense fallback={<Carregando />}>
      <Agenda />
    </Suspense>
  );
}

/** Mantem so os horarios que passam no teste, dia a dia. */
function filtrarPorData(
  porData: Map<string, ItemAgenda[]>,
  manter: (item: ItemAgenda) => boolean,
): Map<string, ItemAgenda[]> {
  return new Map([...porData].map(([data, itens]) => [data, itens.filter(manter)]));
}

/**
 * A agenda. O ENDERECO e a fonte da verdade (visao, data, quadra, professor,
 * filtros e o painel aberto: ver `consultas/enderecoDaAgenda.ts`); cada clique
 * reescreve o endereco com `history.replaceState` e a tela acompanha. So o que
 * e passageiro (janelas abertas, qual dos dois dias aparece no tablet em pe)
 * fica no estado do componente.
 */
function Agenda() {
  const parametros = useSearchParams();
  const { banco, colaborador, executar } = useApp();
  const { avisar } = useAvisos();
  const agora = useAgora();
  const largura = useLarguraDaAgenda();
  const toque = useToque();

  // Hipotese H9: o professor ve so as proprias aulas e nao altera a agenda.
  const podeEditar = colaborador.perfil !== "professor";
  const professorDoPerfil = podeEditar ? undefined : colaborador.professorId;
  const ctx = useMemo<ContextoDaAgenda>(
    () => ({ hoje: HOJE, professorTravado: professorDoPerfil }),
    [professorDoPerfil],
  );

  const consulta = parametros.toString();
  const estado = useMemo(
    () => estadoDaAgendaPelaUrl(banco, new URLSearchParams(consulta), ctx),
    [banco, consulta, ctx],
  );
  const { visao, data } = estado;

  const quadras = useMemo(() => quadrasDaArena(banco), [banco]);
  const professores = useMemo(() => professoresAtivos(banco), [banco]);

  const [novoHorario, setNovoHorario] = useState<PreenchimentoNovoHorario | null>(null);
  const [janela, setJanela] = useState<Janela | null>(null);
  // Diaria com um dia por vez (tablet em pe e celular): mostra o segundo dia?
  const [segundoDia, setSegundoDia] = useState(false);

  // --- Endereco: cada mudanca vira um novo endereco ---------------------------
  const irPara = useCallback((novo: EstadoDaAgenda) => {
    window.history.replaceState(null, "", enderecoDaAgenda(novo, HOJE));
  }, []);
  const mudar = useCallback(
    (parcial: Partial<EstadoDaAgenda>) => irPara({ ...estado, ...parcial }),
    [estado, irPara],
  );

  // --- Periodo visivel -------------------------------------------------------
  const diasDaDiaria = useMemo(() => [data, somarDias(data, 1)], [data]);
  const diaVisivel = segundoDia ? diasDaDiaria[1] : diasDaDiaria[0];
  const semana = useMemo(() => datasDaSemana(data), [data]);
  const datas = useMemo(
    () => (visao === "mes" ? gradeDoMes(data) : visao === "diaria" ? diasDaDiaria : semana),
    [visao, data, diasDaDiaria, semana],
  );

  // --- Leitura: so o periodo visivel, indexado por data ------------------------
  const quadraDaVisao = visao === "quadra" ? estado.quadraId : undefined;
  const porData = useMemo(
    () =>
      montarAgenda(
        banco,
        datas,
        {
          quadraId: quadraDaVisao ?? "todas",
          professorId: estado.professorId ?? "todos",
          tipo: "todos",
          mostrarCanceladas: true,
        },
        agora,
      ),
    [banco, datas, quadraDaVisao, estado.professorId, agora],
  );
  // O que ocupa a quadra decide onde se pode marcar: sem o filtro de tipo e,
  // fora da visao Professor, sem o filtro de professor.
  const ocupadoPorData = useMemo(
    () =>
      visao === "professor" || !estado.professorId || !podeEditar
        ? porData
        : montarAgenda(
            banco,
            datas,
            { quadraId: quadraDaVisao ?? "todas", professorId: "todos", tipo: "todos", mostrarCanceladas: false },
            agora,
          ),
    [visao, estado.professorId, podeEditar, porData, banco, datas, quadraDaVisao, agora],
  );
  // Os contadores contam as canceladas mesmo quando a grade as esconde.
  const porDataDoTipo = useMemo(
    () =>
      estado.tipo === "todos" ? porData : filtrarPorData(porData, (i) => i.ocupacao.tipo === estado.tipo),
    [porData, estado.tipo],
  );
  const porDataVisivel = useMemo(
    () => (estado.mostrarCanceladas ? porDataDoTipo : filtrarPorData(porDataDoTipo, (i) => !i.cancelada)),
    [porDataDoTipo, estado.mostrarCanceladas],
  );

  const umDiaPorVez = largura !== "larga";
  const datasDoResumo = useMemo(() => {
    if (visao === "mes") return datas.filter((d) => mesmoMes(d, data));
    if (visao === "diaria") return umDiaPorVez ? [diaVisivel] : diasDaDiaria;
    return largura === "estreita" ? [data] : semana;
  }, [visao, datas, data, umDiaPorVez, diaVisivel, diasDaDiaria, largura, semana]);
  const resumo = useMemo(
    () => resumirAgenda(porDataDoTipo, datasDoResumo, visao === "quadra" ? 1 : quadras.length),
    [porDataDoTipo, datasDoResumo, visao, quadras.length],
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
    void executar(liberarReservasVencidas, {}).then((resultado) => {
      if (resultado.ok) {
        avisar(
          "info",
          `${plural(vencidas, "reserva sem pagamento no prazo foi liberada", "reservas sem pagamento no prazo foram liberadas")} automaticamente (opção ligada nas Configurações).`,
        );
      } else if (!resultado.erro) {
        // Erro vazio: outra gravacao estava em andamento. Tenta de novo quando
        // o banco mudar (o efeito roda outra vez).
        jaLiberou.current = false;
      }
    });
  }, [banco, podeEditar, executar, avisar]);

  // --- Grade -------------------------------------------------------------------
  const grupos = useMemo(() => {
    if (visao === "diaria") return colunasDaDiaria(umDiaPorVez ? [diaVisivel] : diasDaDiaria, quadras);
    if (visao === "quadra") {
      const quadra = quadras.find((q) => q.id === estado.quadraId) ?? quadras[0];
      return quadra ? colunasDaSemana(semana, { quadra }) : [];
    }
    if (visao === "professor") {
      const professor = banco.professores.find((p) => p.id === estado.professorId);
      return professor ? colunasDaSemana(semana, { professor }) : [];
    }
    return [];
  }, [visao, umDiaPorVez, diaVisivel, diasDaDiaria, quadras, estado.quadraId, estado.professorId, semana, banco.professores]);
  const realce = visao === "diaria" && estado.quadraId ? `${data}|${estado.quadraId}` : undefined;

  // --- Acoes ---------------------------------------------------------------------
  const abrirHorario = useCallback(
    (item: ItemAgenda) => mudar({ ocupacaoId: item.ocupacao.id }),
    [mudar],
  );
  const fecharPainel = useCallback(() => mudar({ ocupacaoId: undefined }), [mudar]);
  const abrirDia = useCallback(
    (dia: string) => {
      setSegundoDia(false);
      irPara({
        ...trocarVisao(banco, estado, "diaria", ctx),
        data: dia,
        // Da semana de uma quadra, a Diaria abre com a coluna dela realcada.
        quadraId: estado.visao === "quadra" ? estado.quadraId : undefined,
      });
    },
    [banco, estado, ctx, irPara],
  );
  const escolherVisao = useCallback(
    (nova: VisaoDaAgenda) => irPara(trocarVisao(banco, estado, nova, ctx)),
    [banco, estado, ctx, irPara],
  );

  const marcar = useCallback(
    (escolha: Partial<MeiaHoraEscolhida>) => {
      let quadraId = escolha.quadraId;
      // Na visao Professor a coluna nao tem quadra: sugere a primeira livre.
      if (!quadraId && escolha.data && escolha.horaInicio) {
        const livres = disponibilidadeDasQuadras(banco, {
          data: escolha.data,
          horaInicio: escolha.horaInicio,
          horaFim: fimSugerido(escolha.horaInicio),
        });
        quadraId = quadras.find((q) => !livres.get(q.id))?.id;
      }
      setNovoHorario({
        data: escolha.data,
        horaInicio: escolha.horaInicio,
        quadraId,
        professorId: escolha.professorId,
      });
    },
    [banco, quadras],
  );
  const marcarNaGrade = podeEditar ? marcar : undefined;
  const assuntoDaVisao = {
    quadraId: visao === "quadra" ? estado.quadraId : undefined,
    professorId: visao === "professor" ? estado.professorId : undefined,
  };

  function navegar(direcao: -1 | 1) {
    setSegundoDia(false);
    mudar({
      data:
        visao === "diaria"
          ? somarDias(data, direcao)
          : visao === "mes"
            ? somarMeses(data, direcao)
            : somarDias(data, 7 * direcao),
      ocupacaoId: undefined,
    });
  }

  /** Depois de gravar: vai para a data do horario se ela nao esta na tela. */
  function mostrarData(nova: string) {
    const visivel =
      visao === "mes" ? mesmoMes(nova, data) : visao === "diaria" ? diasDaDiaria.includes(nova) : semana.includes(nova);
    if (visao === "diaria" && visivel) setSegundoDia(nova !== data);
    if (!visivel) {
      setSegundoDia(false);
      mudar({ data: nova });
    }
  }

  const curto = (d: string) => `${DIAS_SEMANA_CURTO[diaDaSemana(d)]} ${formatarDiaMes(d)}`;
  const titulo =
    visao === "diaria"
      ? umDiaPorVez
        ? curto(diaVisivel)
        : `${curto(diasDaDiaria[0])} e ${curto(diasDaDiaria[1])}`
      : visao === "mes"
        ? formatarMesAno(data)
        : `${formatarDiaMes(semana[0])} — ${formatarDiaMes(semana[6])}`;
  const periodo =
    visao === "mes"
      ? "neste mês"
      : visao === "diaria"
        ? umDiaPorVez
          ? diaVisivel === HOJE
            ? "hoje"
            : "neste dia"
          : data === HOJE
            ? "hoje e amanhã"
            : "nestes dois dias"
        : largura === "estreita"
          ? "neste dia"
          : "nesta semana";
  const passo = visao === "diaria" ? "dia" : visao === "mes" ? "mês" : "semana";
  const professorTravado = professorDoPerfil
    ? professores.find((p) => p.id === professorDoPerfil)?.nome
    : undefined;

  // As janelas ficam fora do `space-y-4`: a margem que ele poe entre os filhos
  // deslocaria as camadas fixas (painel e modais).
  return (
    <>
      <div className="space-y-4">
        {/* Cabecalho: titulo, contadores numa linha e a navegacao */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold leading-none text-areia-900 sm:text-4xl">
              Agenda
            </h1>
            <ResumoEmLinha
              resumo={resumo}
              periodo={periodo}
              mostrarCanceladas={estado.mostrarCanceladas}
              horasDeAula={visao === "professor"}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SeletorDaVisao valor={visao} aoMudar={escolherVisao} />

            <div className="flex items-center gap-1 rounded-xl border border-areia-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => navegar(-1)}
                className="btn-fantasma px-2 py-1.5"
                aria-label={passo === "dia" ? "Dia anterior" : passo === "mês" ? "Mês anterior" : "Semana anterior"}
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
                aria-label={passo === "dia" ? "Próximo dia" : passo === "mês" ? "Próximo mês" : "Próxima semana"}
              >
                <IconeProximo className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSegundoDia(false);
                mudar({ data: HOJE, ocupacaoId: undefined });
              }}
              className="btn-secundario py-2"
            >
              Hoje
            </button>

            <input
              type="date"
              value={data}
              onChange={(e) => {
                if (!DATA_ISO.test(e.target.value)) return;
                setSegundoDia(false);
                mudar({ data: e.target.value });
              }}
              className="campo hidden w-auto py-1.5 xl:block"
              aria-label="Ir para a data"
            />

            {podeEditar && (
              <button
                type="button"
                onClick={() =>
                  marcar({ data: visao === "diaria" ? diaVisivel : data, ...assuntoDaVisao })
                }
                // No celular a lista do dia ja tem o botao "Marcar" (fica so no Mes).
                className={`btn-primario py-2 ${visao === "mes" ? "" : "hidden md:inline-flex"}`}
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
            href={`/agenda/imprimir?data=${visao === "diaria" ? diaVisivel : data}`}
            className="btn-secundario shrink-0 px-3 py-2 text-xs"
          >
            <IconeImpressora className="h-4 w-4" />
            Imprimir o dia
          </Link>
          <Link
            href={`/agenda/quadra?quadra=${estado.quadraId ?? "1"}${data !== HOJE ? `&data=${data}` : ""}`}
            className="btn-secundario shrink-0 px-3 py-2 text-xs"
          >
            <IconeTablet className="h-4 w-4" />
            Modo quadra
          </Link>

          {/* Hipotese H5: reserva com prazo vencido entra em alerta; quem decide e a recepcao. */}
          {podeEditar && reservasVencidas > 0 && (
            <button
              type="button"
              onClick={() => setJanela("reservas")}
              className="alvo-de-toque flex shrink-0 items-center gap-2 rounded-xl border border-tijolo-200 bg-tijolo-50 px-3 py-2 text-xs font-semibold text-tijolo-800 transition-colors hover:bg-tijolo-100 md:ml-auto"
              title="A reserva só entra em alerta: a recepção decide se libera o horário (Hipótese H5)."
            >
              <IconeAlerta className="h-4 w-4 shrink-0 text-tijolo-600" />
              {plural(
                reservasVencidas,
                "reserva passou do prazo de pagamento",
                "reservas passaram do prazo de pagamento",
              )}
              <span className="underline underline-offset-2">Ver</span>
            </button>
          )}
        </div>

        {!podeEditar && (
          <p className="rounded-2xl border border-saibro-200 bg-saibro-50 px-4 py-2.5 text-sm text-saibro-900">
            Perfil de professor: você vê só as suas aulas e não altera a agenda (Hipótese H9).
          </p>
        )}

        <Card>
          <FiltrosDaAgenda
            estado={estado}
            aoMudar={(parcial) => mudar({ ...parcial, ocupacaoId: undefined })}
            quadras={quadras}
            professores={professores}
            professorTravado={professorTravado}
            extra={
              visao === "diaria" && largura === "media" ? (
                <Segmentado
                  aria="Qual dia"
                  valor={segundoDia ? "segundo" : "primeiro"}
                  aoMudar={(v) => setSegundoDia(v === "segundo")}
                  opcoes={[
                    { valor: "primeiro", rotulo: diasDaDiaria[0] === HOJE ? "Hoje" : curto(diasDaDiaria[0]) },
                    {
                      valor: "segundo",
                      rotulo: diasDaDiaria[1] === somarDias(HOJE, 1) ? "Amanhã" : curto(diasDaDiaria[1]),
                    },
                  ]}
                />
              ) : undefined
            }
          />

          {visao === "mes" ? (
            <VisaoMensal
              referencia={data}
              datas={datas}
              porData={porDataVisivel}
              hoje={HOJE}
              aoSelecionarDia={abrirDia}
            />
          ) : largura === "estreita" ? (
            visao === "diaria" ? (
              <ListaDoDia
                datas={diasDaDiaria}
                dia={diaVisivel}
                aoTrocarDia={(d) => setSegundoDia(d !== data)}
                itens={porDataVisivel.get(diaVisivel) ?? []}
                hoje={HOJE}
                aoAbrir={abrirHorario}
                aoAdicionar={marcarNaGrade && ((inicial) => marcarNaGrade({ ...inicial, ...assuntoDaVisao }))}
              />
            ) : (
              <ListaDoDia
                datas={semana}
                dia={data}
                aoTrocarDia={(d) => mudar({ data: d })}
                itens={porDataVisivel.get(data) ?? []}
                hoje={HOJE}
                aoAbrir={abrirHorario}
                aoAdicionar={marcarNaGrade && ((inicial) => marcarNaGrade({ ...inicial, ...assuntoDaVisao }))}
              />
            )
          ) : grupos.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-areia-600">
              Nenhum professor ativo cadastrado.
            </p>
          ) : (
            <GradeDeColunas
              grupos={grupos}
              porData={porDataVisivel}
              ocupadoPorData={ocupadoPorData}
              hoje={HOJE}
              agora={agora}
              px={pxPorMinuto(toque)}
              larguraMinima={96}
              realce={realce}
              nomesComoLink={!toque}
              aoAbrir={abrirHorario}
              aoMarcar={marcarNaGrade}
              aoAbrirDia={visao === "diaria" ? undefined : abrirDia}
            />
          )}

          <div className="hidden border-t border-areia-200 px-4 py-2.5 md:block">
            <Legenda />
          </div>
        </Card>

        <p className="flex items-start gap-2 text-xs text-areia-600">
          <IconeAgenda className="h-4 w-4 shrink-0" />
          {toque
            ? "Toque num horário para abrir o painel (presença, cancelar, remarcar e a ficha de cada aluno)"
            : "Clique num horário para abrir o painel (presença, cancelar, remarcar), no nome de um aluno para abrir a ficha"}
          {podeEditar ? " ou numa meia hora livre para marcar um novo horário." : "."}
        </p>
      </div>

      {novoHorario && (
        <ModalNovoHorario
          aberto
          inicial={novoHorario}
          aoFechar={() => setNovoHorario(null)}
          aoSalvar={mostrarData}
        />
      )}
      {janela === "bloqueio" && (
        <ModalBloquearQuadra
          aberto
          aoFechar={() => setJanela(null)}
          inicial={{
            data: visao === "diaria" ? diaVisivel : data,
            quadraId: estado.quadraId,
          }}
          agora={agora}
        />
      )}
      {janela === "chuva" && (
        <ModalChuva
          aberto
          aoFechar={() => setJanela(null)}
          dataInicial={visao === "diaria" ? diaVisivel : HOJE}
          agora={agora}
        />
      )}
      {janela === "reservas" && (
        <ModalReservas
          aberto
          aoFechar={() => setJanela(null)}
          agora={agora}
          podeEditar={podeEditar}
          aoAbrirHorario={(id, dia) => {
            setJanela(null);
            setSegundoDia(false);
            mudar({ data: dia, ocupacaoId: id });
          }}
        />
      )}
      <PainelDoHorario
        ocupacaoId={estado.ocupacaoId ?? null}
        aoFechar={fecharPainel}
        podeEditar={podeEditar}
        agora={agora}
      />
    </>
  );
}

/** Os contadores do periodo que esta na tela, numa linha so (libera altura para a grade). */
function ResumoEmLinha({
  resumo,
  periodo,
  mostrarCanceladas,
  horasDeAula,
}: {
  resumo: ResumoDaAgenda;
  periodo: string;
  mostrarCanceladas: boolean;
  /** Visao Professor: horas de aula no lugar da ocupacao das quadras. */
  horasDeAula: boolean;
}) {
  const ocupacao = resumo.minutosDisponiveis
    ? Math.round((resumo.minutosOcupados / resumo.minutosDisponiveis) * 100)
    : 0;
  const numero = "font-display text-base font-semibold text-areia-900";
  const separador = <span className="text-areia-400" aria-hidden="true">·</span>;
  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-areia-600">
      <span>
        <strong className={numero}>{resumo.ativas.toLocaleString("pt-BR")}</strong>{" "}
        {resumo.ativas === 1 ? "horário" : "horários"} {periodo}
      </span>
      {separador}
      <span>
        <strong className={numero}>{resumo.alunos.toLocaleString("pt-BR")}</strong>{" "}
        {resumo.alunos === 1 ? "aluno" : "alunos"}
      </span>
      {separador}
      {horasDeAula ? (
        <span>
          <strong className={numero}>{Math.round(resumo.minutosOcupados / 60)} h</strong> de aula
        </span>
      ) : (
        <span title={`${Math.round(resumo.minutosOcupados / 60)} h de ${Math.round(resumo.minutosDisponiveis / 60)} h de quadra`}>
          <strong className={numero}>{ocupacao}%</strong> de ocupação
          {resumo.bloqueios > 0 && ` (${plural(resumo.bloqueios, "bloqueio", "bloqueios")})`}
        </span>
      )}
      {separador}
      <span>
        <strong className={numero}>{resumo.canceladas.toLocaleString("pt-BR")}</strong>{" "}
        {resumo.canceladas === 1 ? "cancelada" : "canceladas"}
        {!mostrarCanceladas && resumo.canceladas > 0 && " (escondidas)"}
      </span>
      {separador}
      <span className={resumo.vencidas > 0 ? "font-medium text-tijolo-700" : undefined}>
        <strong className={resumo.vencidas > 0 ? `${numero} !text-tijolo-700` : numero}>
          {resumo.aguardandoPagamento.toLocaleString("pt-BR")}
        </strong>{" "}
        a pagar{resumo.vencidas > 0 && ` (${resumo.vencidas} com prazo vencido)`}
      </span>
    </p>
  );
}
