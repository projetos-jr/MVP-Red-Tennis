"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarraDaAgenda } from "@/components/agenda/BarraDaAgenda";
import { FaixaDeProfessores, FaixaDeQuadras } from "@/components/agenda/FaixaDeAssunto";
import {
  LinhaDeFiltrosAtivos,
  descricaoDosFiltros,
  filtrosAtivosDaAgenda,
} from "@/components/agenda/FiltrosDaAgenda";
import { GradeDeColunas, type MeiaHoraEscolhida } from "@/components/agenda/GradeDeColunas";
import {
  colunasDaDiaria,
  colunasDaSemana,
  colunasDosProfessores,
  fimSugerido,
  pxPorMinuto,
} from "@/components/agenda/grade";
import { ListaDoDia } from "@/components/agenda/ListaDoDia";
import { ModalBloquearQuadra } from "@/components/agenda/ModalBloquearQuadra";
import { ModalChuva } from "@/components/agenda/ModalChuva";
import {
  ModalNovoHorario,
  type PreenchimentoNovoHorario,
} from "@/components/agenda/ModalNovoHorario";
import { ModalReservas } from "@/components/agenda/ModalReservas";
import { OpcoesDaAgenda } from "@/components/agenda/OpcoesDaAgenda";
import { PainelDoHorario } from "@/components/agenda/PainelDoHorario";
import { useAgora } from "@/components/agenda/useAgora";
import { useLarguraDaAgenda, useMidia, useToque } from "@/components/agenda/useMidia";
import { VisaoMensal } from "@/components/agenda/VisaoMensal";
import { plural } from "@/components/agenda/estilos";
import { useAvisos } from "@/components/ui/Avisos";
import { Card } from "@/components/ui/Card";
import { Carregando } from "@/components/ui/Carregando";
import { IconeAgenda } from "@/components/ui/Icons";
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
 * e passageiro (janelas abertas, "Mais opcoes", qual dos dois dias aparece no
 * tablet em pe) fica no estado do componente.
 *
 * Redesign 3 (pedido do dono: "a agenda maior, menos botaozinho"): uma barra
 * enxuta em cima, o resto em "Mais opcoes", e a grade com quase toda a tela.
 */
function Agenda() {
  const parametros = useSearchParams();
  const { banco, colaborador, executar } = useApp();
  const { avisar } = useAvisos();
  const agora = useAgora();
  const largura = useLarguraDaAgenda();
  const toque = useToque();
  const computadorLargo = useMidia("(min-width: 1280px)", true);

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
  // Visao Professores sem professor escolhido: hoje e amanha com todos (H20).
  // Com um professor: a semana dele.
  const semanaDoProfessor = visao === "professor" && Boolean(estado.professorId);
  const doisDias = visao === "diaria" || (visao === "professor" && !estado.professorId);

  const quadras = useMemo(() => quadrasDaArena(banco), [banco]);
  const professores = useMemo(() => professoresAtivos(banco), [banco]);

  const [novoHorario, setNovoHorario] = useState<PreenchimentoNovoHorario | null>(null);
  const [janela, setJanela] = useState<Janela | null>(null);
  // Diaria com um dia por vez (tablet em pe e celular): mostra o segundo dia?
  const [segundoDia, setSegundoDia] = useState(false);
  // "Mais opcoes" sempre comeca fechado (a grade e o que importa). Chegando
  // por um link ja filtrado (o LAP do Inicio), uma linha curta diz o filtro.
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);

  // --- Endereco: cada mudanca vira um novo endereco ---------------------------
  const irPara = useCallback((novo: EstadoDaAgenda) => {
    window.history.replaceState(null, "", enderecoDaAgenda(novo, HOJE));
  }, []);
  const mudar = useCallback(
    (parcial: Partial<EstadoDaAgenda>) => irPara({ ...estado, ...parcial }),
    [estado, irPara],
  );
  // O estado mais recente para os tratadores passados a grade: assim eles nao
  // mudam a cada endereco e a grade (memo) nao redesenha ao abrir um horario.
  const estadoAtual = useRef(estado);
  useEffect(() => {
    estadoAtual.current = estado;
  }, [estado]);

  /**
   * Abrir o painel de um horario EMPILHA um endereco: o "Voltar" do navegador
   * (ou do tablet) fecha o painel em vez de sair da agenda. Data, visao e
   * filtros continuam trocando o endereco no lugar.
   */
  const abrirPainel = useCallback((novo: EstadoDaAgenda) => {
    const endereco = enderecoDaAgenda(novo, HOJE);
    if (estadoAtual.current.ocupacaoId) {
      window.history.replaceState(null, "", endereco);
      return;
    }
    const base = enderecoDaAgenda({ ...novo, ocupacaoId: undefined }, HOJE);
    // So a nossa marca: o Next acrescenta o estado interno dele e atualiza o
    // endereco lido pela tela (copiar o estado atual inteiro o faria ignorar).
    window.history.pushState({ painelDaAgenda: base }, "", endereco);
  }, []);

  // --- Periodo visivel -------------------------------------------------------
  const diasDaDiaria = useMemo(() => [data, somarDias(data, 1)], [data]);
  const diaVisivel = segundoDia ? diasDaDiaria[1] : diasDaDiaria[0];
  const semana = useMemo(() => datasDaSemana(data), [data]);
  const datas = useMemo(
    () => (visao === "mes" ? gradeDoMes(data) : doisDias ? diasDaDiaria : semana),
    [visao, data, doisDias, diasDaDiaria, semana],
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
  // fora da visao Professores, sem o filtro de professor.
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
  // Os contadores contam as canceladas mesmo quando a grade as esconde. Na
  // visao Professores com todos, so contam as aulas com professor ativo.
  const idsDosProfessores = useMemo(() => new Set(professores.map((p) => p.id)), [professores]);
  const soDosProfessores = visao === "professor" && !estado.professorId;
  const porDataDoTipo = useMemo(
    () =>
      estado.tipo === "todos" && !soDosProfessores
        ? porData
        : filtrarPorData(
            porData,
            (i) =>
              (estado.tipo === "todos" || i.ocupacao.tipo === estado.tipo) &&
              (!soDosProfessores || idsDosProfessores.has(i.ocupacao.professorId ?? "")),
          ),
    [porData, estado.tipo, soDosProfessores, idsDosProfessores],
  );
  const porDataVisivel = useMemo(
    () => (estado.mostrarCanceladas ? porDataDoTipo : filtrarPorData(porDataDoTipo, (i) => !i.cancelada)),
    [porDataDoTipo, estado.mostrarCanceladas],
  );

  const umDiaPorVez = largura !== "larga";
  const datasDoResumo = useMemo(() => {
    if (visao === "mes") return datas.filter((d) => mesmoMes(d, data));
    if (doisDias) return umDiaPorVez ? [diaVisivel] : diasDaDiaria;
    return largura === "estreita" ? [data] : semana;
  }, [visao, datas, data, doisDias, umDiaPorVez, diaVisivel, diasDaDiaria, largura, semana]);
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
    const dias = umDiaPorVez ? [diaVisivel] : diasDaDiaria;
    if (visao === "diaria") return colunasDaDiaria(dias, quadras);
    if (visao === "quadra") {
      const quadra = quadras.find((q) => q.id === estado.quadraId) ?? quadras[0];
      return quadra ? colunasDaSemana(semana, { quadra }) : [];
    }
    if (visao === "professor") {
      if (!estado.professorId) return colunasDosProfessores(dias, professores);
      const professor = banco.professores.find((p) => p.id === estado.professorId);
      return professor ? colunasDaSemana(semana, { professor }) : [];
    }
    return [];
  }, [visao, umDiaPorVez, diaVisivel, diasDaDiaria, quadras, professores, estado.quadraId, estado.professorId, semana, banco.professores]);
  const semColunas = grupos.every((g) => g.colunas.length === 0);
  const realce = visao === "diaria" && estado.quadraId ? `${data}|${estado.quadraId}` : undefined;

  // --- Acoes ---------------------------------------------------------------------
  const abrirHorario = useCallback(
    (item: ItemAgenda) => abrirPainel({ ...estadoAtual.current, ocupacaoId: item.ocupacao.id }),
    [abrirPainel],
  );
  const fecharPainel = useCallback(() => {
    const atual = { ...estadoAtual.current, ocupacaoId: undefined };
    // Aberto por clique (endereco empilhado e nada mudou depois): volta uma
    // entrada, para o "Voltar" seguinte sair da agenda de uma vez.
    if (window.history.state?.painelDaAgenda === enderecoDaAgenda(atual, HOJE)) {
      window.history.back();
    } else {
      irPara(atual);
    }
  }, [irPara]);
  const abrirDia = useCallback(
    (dia: string) => {
      const atual = estadoAtual.current;
      setSegundoDia(false);
      irPara({
        ...trocarVisao(banco, atual, "diaria", ctx),
        data: dia,
        // Da semana de uma quadra, a Diaria abre com a coluna dela realcada.
        quadraId: atual.visao === "quadra" ? atual.quadraId : undefined,
      });
    },
    [banco, ctx, irPara],
  );
  const escolherVisao = useCallback(
    (nova: VisaoDaAgenda) => {
      setSegundoDia(false);
      irPara(trocarVisao(banco, estadoAtual.current, nova, ctx));
    },
    [banco, ctx, irPara],
  );
  /** Visao Professores: um professor abre a semana dele; sem professor, os dois dias com todos. */
  /**
   * Dos 2 dias com todos os professores, abrir a semana de um deles EMPILHA
   * um endereco (o "Voltar" do tablet retorna a todos); "Todos os
   * professores" desempilha quando foi assim. Trocar de um professor para
   * outro troca o endereco no lugar.
   */
  const escolherProfessor = useCallback(
    (professorId: string | undefined) => {
      setSegundoDia(false);
      const atual = estadoAtual.current;
      const novo = { ...atual, professorId, ocupacaoId: undefined };
      const endereco = enderecoDaAgenda(novo, HOJE);
      if (atual.visao === "professor" && !atual.professorId && professorId) {
        const base = enderecoDaAgenda({ ...atual, ocupacaoId: undefined }, HOJE);
        window.history.pushState({ semanaDoProfessor: base }, "", endereco);
        return;
      }
      if (!professorId && window.history.state?.semanaDoProfessor === endereco) {
        window.history.back();
        return;
      }
      irPara(novo);
    },
    [irPara],
  );

  const marcar = useCallback(
    (escolha: Partial<MeiaHoraEscolhida>) => {
      let quadraId = escolha.quadraId;
      const horaFim = escolha.horaFim ?? (escolha.horaInicio && fimSugerido(escolha.horaInicio));
      // Na visao Professores a coluna nao tem quadra: sugere a primeira livre.
      if (!quadraId && escolha.data && escolha.horaInicio && horaFim) {
        const livres = disponibilidadeDasQuadras(banco, {
          data: escolha.data,
          horaInicio: escolha.horaInicio,
          horaFim,
        });
        quadraId = quadras.find((q) => !livres.get(q.id))?.id;
      }
      setNovoHorario({
        data: escolha.data,
        horaInicio: escolha.horaInicio,
        horaFim: horaFim || undefined,
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
      data: doisDias
        ? // Um dia por vez: anda a partir do dia que esta na tela.
          somarDias(umDiaPorVez ? diaVisivel : data, direcao)
        : visao === "mes"
          ? somarMeses(data, direcao)
          : somarDias(data, 7 * direcao),
      ocupacaoId: undefined,
    });
  }

  function irParaData(nova: string) {
    setSegundoDia(false);
    mudar({ data: nova, ocupacaoId: undefined });
  }

  /** Depois de gravar: vai para a data do horario se ela nao esta na tela. */
  function mostrarData(nova: string) {
    const visivel =
      visao === "mes"
        ? mesmoMes(nova, data)
        : doisDias
          ? diasDaDiaria.includes(nova)
          : // No celular, Quadra e a semana do professor mostram um dia so.
            largura === "estreita"
            ? nova === data
            : semana.includes(nova);
    if (doisDias && visivel) setSegundoDia(nova !== data);
    if (!visivel) {
      setSegundoDia(false);
      mudar({ data: nova });
    }
  }

  const curto = (d: string) => `${DIAS_SEMANA_CURTO[diaDaSemana(d)]} ${formatarDiaMes(d)}`;
  const titulo = doisDias
    ? umDiaPorVez
      ? curto(diaVisivel)
      : `${curto(diasDaDiaria[0])} e ${curto(diasDaDiaria[1])}`
    : visao === "mes"
      ? formatarMesAno(data)
      : `${formatarDiaMes(semana[0])} — ${formatarDiaMes(semana[6])}`;
  // Tablet deitado: sem o dia da semana (o cabecalho grande da grade ja diz).
  const tituloCurto =
    doisDias && !umDiaPorVez
      ? `${formatarDiaMes(diasDaDiaria[0])} e ${formatarDiaMes(diasDaDiaria[1])}`
      : undefined;
  const periodo =
    visao === "mes"
      ? "neste mês"
      : doisDias
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
  const passo = doisDias ? "dia" : visao === "mes" ? "mês" : "semana";
  const professorTravado = professorDoPerfil
    ? banco.professores.find((p) => p.id === professorDoPerfil)
    : undefined;
  const professorDaSemana = semanaDoProfessor
    ? banco.professores.find((p) => p.id === estado.professorId)
    : undefined;
  const professorFora =
    professorDaSemana && !professores.some((p) => p.id === professorDaSemana.id)
      ? professorDaSemana
      : undefined;
  const textoDasVencidas = computadorLargo
    ? plural(reservasVencidas, "reserva vencida", "reservas vencidas")
    : plural(reservasVencidas, "vencida", "vencidas");

  // Faixa de cima da grade: de quem e a semana (ou, no celular, os professores).
  const faixa =
    visao === "quadra" ? (
      <FaixaDeQuadras
        quadras={quadras}
        valor={estado.quadraId}
        aoMudar={(quadraId) => mudar({ quadraId, ocupacaoId: undefined })}
      />
    ) : visao === "professor" && (semanaDoProfessor || largura === "estreita") ? (
      <FaixaDeProfessores
        professores={professores}
        valor={estado.professorId}
        aoMudar={escolherProfessor}
        travado={professorTravado}
        professorFora={professorFora}
      />
    ) : null;

  // As janelas ficam fora do `space-y-*`: a margem que ele poe entre os filhos
  // deslocaria as camadas fixas (painel e modais).
  return (
    <>
      {/* Margens menores em volta (a grade ganha largura e altura). */}
      <div className="-mt-3 space-y-2.5 sm:-mt-5 md:-mx-2 lg:-mx-3 2xl:-mx-6">
        <BarraDaAgenda
          visao={visao}
          aoMudarVisao={escolherVisao}
          titulo={titulo}
          tituloCurto={tituloCurto}
          passo={passo}
          aoNavegar={navegar}
          aoHoje={() => irParaData(HOJE)}
          vencidas={podeEditar ? reservasVencidas : 0}
          textoDasVencidas={textoDasVencidas}
          aoAbrirReservas={() => setJanela("reservas")}
          aoNovoHorario={
            podeEditar
              ? () => marcar({ data: doisDias ? diaVisivel : data, ...assuntoDaVisao })
              : undefined
          }
          novoHorarioNoCelular={visao === "mes"}
          professorTravado={professorTravado?.nome}
          opcoesAbertas={opcoesAbertas}
          aoAlternarOpcoes={() => setOpcoesAbertas((aberto) => !aberto)}
          filtrosAtivos={filtrosAtivosDaAgenda(estado, Boolean(professorDoPerfil))}
        />

        {!opcoesAbertas && (
          <LinhaDeFiltrosAtivos
            filtros={descricaoDosFiltros(
              estado,
              Boolean(professorDoPerfil),
              banco.professores.find((p) => p.id === estado.professorId)?.nome,
            )}
            aoVer={() => setOpcoesAbertas(true)}
            aoLimpar={() => {
              setSegundoDia(false);
              mudar({
                tipo: "todos",
                mostrarCanceladas: true,
                // Na visao Professores o professor escolhido e o assunto, nao filtro.
                ...(visao !== "professor" && !professorDoPerfil ? { professorId: undefined } : {}),
                ocupacaoId: undefined,
              });
            }}
          />
        )}

        <OpcoesDaAgenda
          aberto={opcoesAbertas}
          podeEditar={podeEditar}
          aoAbrirJanela={(qual) => {
            // Abriu uma janela pelo painel: o painel fecha (como no estoque e no financeiro).
            setJanela(qual);
            setOpcoesAbertas(false);
          }}
          reservas={reservas.length}
          reservasVencidas={reservasVencidas}
          linkImprimir={`/agenda/imprimir?data=${doisDias ? diaVisivel : data}`}
          linkModoQuadra={`/agenda/quadra?quadra=${estado.quadraId ?? "1"}${data !== HOJE ? `&data=${data}` : ""}`}
          data={data}
          aoIrParaData={irParaData}
          estado={estado}
          aoMudar={(parcial) => {
            setSegundoDia(false);
            mudar({ ...parcial, ocupacaoId: undefined });
          }}
          professores={professores}
          professorTravado={professorTravado?.nome}
          professorFora={banco.professores.find((p) => p.id === estado.professorId)?.nome}
          resumo={resumo}
          periodo={periodo}
          horasDeAula={visao === "professor"}
        />

        <Card className="overflow-hidden">
          {faixa}

          {visao === "mes" ? (
            <VisaoMensal
              referencia={data}
              datas={datas}
              porData={porDataVisivel}
              hoje={HOJE}
              aoSelecionarDia={abrirDia}
            />
          ) : largura === "estreita" ? (
            doisDias ? (
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
          ) : semColunas ? (
            <p className="px-6 py-12 text-center text-base text-areia-600">
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
              aoAbrirDia={doisDias ? undefined : abrirDia}
              aoEscolherProfessor={visao === "professor" && !professorDoPerfil ? escolherProfessor : undefined}
              mostrarGrupo={!faixa}
            />
          )}
        </Card>

        <p className="flex items-start gap-2 text-sm text-areia-600">
          <IconeAgenda className="h-4 w-4 shrink-0" />
          {toque
            ? "Toque num horário para abrir o painel (presença, cancelar, remarcar e a ficha de cada aluno)"
            : "Clique num horário para abrir o painel (presença, cancelar, remarcar), no nome de um aluno para abrir a ficha"}
          {podeEditar ? " ou numa meia hora livre para marcar um novo horário." : "."}
          {visao === "professor" && !estado.professorId && !professorDoPerfil && largura !== "estreita"
            ? " Clique no nome de um professor para ver a semana dele."
            : ""}
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
            data: doisDias ? diaVisivel : data,
            quadraId: estado.quadraId,
          }}
          agora={agora}
        />
      )}
      {janela === "chuva" && (
        <ModalChuva
          aberto
          aoFechar={() => setJanela(null)}
          dataInicial={doisDias ? diaVisivel : HOJE}
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
            abrirPainel({ ...estado, data: dia, ocupacaoId: id });
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
