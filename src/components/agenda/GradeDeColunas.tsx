"use client";

import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { IconeProximo } from "@/components/ui/Icons";
import type { Professor, QuadraId } from "@/lib/banco/tipos";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import {
  DIAS_SEMANA_CURTO,
  DIAS_SEMANA_LONGO,
  diaDaSemana,
  formatarDiaMes,
  horaParaMinutos,
  minutosParaHora,
} from "@/lib/date";
import { textoLegivelSobre } from "@/lib/cores";
import { BRANCO, PALETA } from "@/lib/paleta";
import { BlocoNaGrade } from "./CartaoOcupacao";
import { CLASSE_DO_PISO } from "./estilos";
import {
  ABERTURA_EM_MINUTOS,
  MEIAS_HORAS,
  PASSO,
  alturaDaGrade,
  canceladasPorChuva,
  horariosAtivos,
  itensDaColuna,
  minutoDoAgora,
  minutosPassados,
  fimLivre,
  podeMarcarEm,
  posicaoHorizontal,
  posicaoVertical,
  subcolunas,
  type ColunaDaGrade,
  type GrupoDeColunas,
} from "./grade";
import { IconeChuva } from "./Icones";

/** Largura da coluna das horas (":00" em letra de placar grande). */
const COLUNA_DAS_HORAS = 64;

/** O que um clique numa meia hora livre manda para o "Novo horario". */
/** Ate o pe da tela, descontando onde a grade comeca (medido em `--topo-da-grade`). */
const ALTURA_DA_GRADE: CSSProperties = {
  maxHeight: "calc(100dvh - var(--topo-da-grade, 13.5rem) - 0.75rem)",
};

export interface MeiaHoraEscolhida {
  data: string;
  horaInicio: string;
  /** Ate o proximo horario da coluna (no maximo 1 h): o formulario nao abre em conflito. */
  horaFim: string;
  quadraId?: QuadraId;
  professorId?: string;
}

/**
 * A grade da agenda: linhas de 30 em 30 minutos e colunas por quadra
 * (Diaria), por professor (Professores) ou por dia (semana de uma quadra ou
 * de um professor).
 *
 *  - Cabecalho fixo em 2 niveis: grupo (o dia, ou a quadra/professor da
 *    semana) e as colunas (as quadras, na cor do piso; os professores, na cor
 *    de cada um; ou os dias). Letras grandes: o dia em letra de placar.
 *  - Coluna das horas fixa: as horas cheias em destaque, as meias horas leves.
 *  - Cada meia hora livre e um botao invisivel que abre o "Novo horario" ja
 *    com a data, a hora e a quadra (ou o professor).
 *  - Linha do "agora" e pelicula do passado em cada coluna.
 *  - Ao abrir, a grade rola ate o agora (ou ate o primeiro horario).
 */
export const GradeDeColunas = memo(function GradeDeColunas({
  grupos,
  porData,
  ocupadoPorData,
  hoje,
  agora,
  px,
  larguraMinima,
  realce,
  nomesComoLink,
  aoAbrir,
  aoMarcar,
  aoAbrirDia,
  aoEscolherProfessor,
  mostrarGrupo = true,
}: {
  grupos: GrupoDeColunas[];
  /** Horarios que aparecem (com os filtros). */
  porData: Map<string, ItemAgenda[]>;
  /** Horarios que ocupam a quadra (sem o filtro de tipo): decidem o que pode ser marcado. */
  ocupadoPorData: Map<string, ItemAgenda[]>;
  hoje: string;
  agora: string;
  px: number;
  larguraMinima: number;
  /** Chave da coluna realcada (link do Inicio para uma quadra). */
  realce?: string;
  nomesComoLink: boolean;
  aoAbrir: (item: ItemAgenda) => void;
  /** Ausente para quem so consulta (perfil de professor). */
  aoMarcar?: (escolha: MeiaHoraEscolhida) => void;
  /** Cabecalho do dia (semana): abre a Diaria daquele dia. */
  aoAbrirDia?: (data: string) => void;
  /** Cabecalho de um professor (visao Professores): abre a semana dele. */
  aoEscolherProfessor?: (professorId: string) => void;
  /** Primeira linha do cabecalho. Nas semanas, a faixa de cima ja diz a quadra ou o professor. */
  mostrarGrupo?: boolean;
}) {
  const colunas = useMemo(() => grupos.flatMap((g) => g.colunas), [grupos]);
  const porColuna = useMemo(
    () =>
      new Map(
        colunas.map((coluna) => [
          coluna.chave,
          {
            itens: itensDaColuna(coluna, porData.get(coluna.data) ?? []),
            ocupado: itensDaColuna(coluna, ocupadoPorData.get(coluna.data) ?? []),
          },
        ]),
      ),
    [colunas, porData, ocupadoPorData],
  );

  const semana = grupos[0]?.tipo !== "dia";
  const modelo = `${COLUNA_DAS_HORAS}px repeat(${colunas.length}, minmax(${larguraMinima}px, 1fr))`;
  const altura = alturaDaGrade(px);
  const minutoAgora = minutoDoAgora(agora, agora.slice(0, 10));
  const colunasDeHoje = colunas.filter((c) => c.data === agora.slice(0, 10));
  const agoraVisivel = minutoAgora !== undefined && colunasDeHoje.length > 0;

  // Rolagem ate o agora (ou o primeiro horario). So rola de novo quando a
  // grade muda de periodo ou de tamanho, para nao atrapalhar quem esta lendo.
  const rolagem = useRef<HTMLDivElement>(null);
  const ultimaRolagem = useRef("");
  const primeiroInicio = useMemo(() => {
    let menor: number | undefined;
    porColuna.forEach(({ itens }) =>
      itens.forEach((i) => {
        const minuto = horaParaMinutos(i.ocupacao.horaInicio);
        if (menor === undefined || minuto < menor) menor = minuto;
      }),
    );
    return menor;
  }, [porColuna]);
  const chaveDaRolagem = `${colunas.map((c) => c.chave).join(",")}|${px}|${agoraVisivel ? "agora" : "inicio"}`;
  useEffect(() => {
    const elemento = rolagem.current;
    if (!elemento || ultimaRolagem.current === chaveDaRolagem) return;
    ultimaRolagem.current = chaveDaRolagem;
    const alvo = agoraVisivel ? minutoAgora : primeiroInicio;
    // Meia hora antes do agora fica visivel em cima.
    elemento.scrollTop =
      alvo === undefined ? 0 : Math.max((alvo - ABERTURA_EM_MINUTOS - PASSO) * px, 0);
  }, [chaveDaRolagem, agoraVisivel, minutoAgora, primeiroInicio, px]);

  // Altura: a grade vai ate o pe da tela, seja qual for a altura do que esta
  // em cima (barra em uma ou duas linhas, "Letras maiores", faixa da semana,
  // "Mais opcoes" aberto). Mede onde a grade comeca na pagina e grava numa
  // variavel CSS (direto no DOM, sem redesenhar o React); com pouco espaco
  // vale o minimo de 26rem e a pagina rola.
  useEffect(() => {
    const elemento = rolagem.current;
    if (!elemento) return;
    function medir() {
      if (!elemento) return;
      const topo = Math.round(elemento.getBoundingClientRect().top + window.scrollY);
      elemento.style.setProperty("--topo-da-grade", `${topo}px`);
    }
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(document.body);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  // Linhas da grade: hora cheia mais marcada, meia hora leve. (Memorizado:
  // um objeto novo a cada desenho faria todas as colunas redesenharem.)
  const linhas = useMemo<CSSProperties>(
    () => ({
      height: altura,
      backgroundImage: `linear-gradient(to bottom, ${PALETA.areia[200]} 1px, transparent 1px), linear-gradient(to bottom, ${PALETA.areia[100]} 1px, transparent 1px)`,
      backgroundSize: `100% ${PASSO * px * 2}px, 100% ${PASSO * px}px`,
    }),
    [altura, px],
  );

  return (
    // `isolate`: os z-index de dentro (cabecalho e coluna das horas fixos)
    // ficam so dentro da grade e nunca passam por cima do topo e dos menus.
    <div
      ref={rolagem}
      data-grade-da-agenda=""
      className="relative isolate min-h-[26rem] overflow-auto overscroll-contain rolagem-suave"
      style={ALTURA_DA_GRADE}
    >
      <div style={{ minWidth: COLUNA_DAS_HORAS + colunas.length * larguraMinima }}>
        {/* Cabecalho fixo: grupos e colunas */}
        <div
          className="sticky top-0 z-40 grid border-b border-areia-300 bg-white shadow-sm"
          style={{ gridTemplateColumns: modelo }}
        >
          <div
            className={`sticky left-0 z-10 border-r border-areia-200 bg-white ${mostrarGrupo ? "row-span-2" : ""}`}
            aria-hidden="true"
          />
          {mostrarGrupo &&
            grupos.map((grupo, g) => (
              <CabecalhoDoGrupo
                key={grupo.chave}
                grupo={grupo}
                hoje={hoje}
                primeiro={g === 0}
                itensDoDia={grupo.tipo === "dia" ? (porData.get(grupo.data) ?? []) : []}
              />
            ))}
          {grupos.map((grupo, g) =>
            grupo.colunas.map((coluna, c) => (
              <CabecalhoDaColuna
                key={coluna.chave}
                coluna={coluna}
                semana={semana}
                hoje={hoje}
                inicioDeGrupo={g > 0 && c === 0}
                realcada={coluna.chave === realce}
                ativos={horariosAtivos(porColuna.get(coluna.chave)?.itens ?? [])}
                chuva={semana ? canceladasPorChuva(porData.get(coluna.data) ?? []) : 0}
                aoAbrirDia={aoAbrirDia}
                aoEscolherProfessor={aoEscolherProfessor}
              />
            )),
          )}
        </div>

        {/* Corpo: horas + colunas */}
        <div className="relative grid" style={{ gridTemplateColumns: modelo }}>
          <ColunaDasHoras px={px} altura={altura} agora={agoraVisivel ? minutoAgora : undefined} />
          {grupos.map((grupo, g) =>
            grupo.colunas.map((coluna, c) => {
              const dados = porColuna.get(coluna.chave);
              return (
                <ColunaDeHorarios
                  key={coluna.chave}
                  coluna={coluna}
                  itens={dados?.itens ?? []}
                  ocupado={dados?.ocupado ?? []}
                  hoje={hoje}
                  px={px}
                  linhas={linhas}
                  passados={minutosPassados(coluna.data, agora)}
                  agora={coluna.data === agora.slice(0, 10) ? minutoAgora : undefined}
                  inicioDeGrupo={g > 0 && c === 0}
                  realcada={coluna.chave === realce}
                  mostrarQuadra={Boolean(coluna.professorId)}
                  mostrarProfessor={!coluna.professorId}
                  nomesComoLink={nomesComoLink}
                  aoAbrir={aoAbrir}
                  aoMarcar={aoMarcar}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
});

function CabecalhoDoGrupo({
  grupo,
  hoje,
  primeiro,
  itensDoDia,
}: {
  grupo: GrupoDeColunas;
  hoje: string;
  primeiro: boolean;
  itensDoDia: ItemAgenda[];
}) {
  const estilo = { gridColumn: `span ${grupo.colunas.length}` };
  const separador = primeiro ? "" : "border-l-4 border-l-areia-300";

  if (grupo.tipo === "quadra") {
    return (
      <div
        style={estilo}
        className={`linha-de-quadra flex items-center justify-center gap-2 px-3 py-2 ${CLASSE_DO_PISO[grupo.quadra.piso]}`}
      >
        <span className="font-display text-2xl font-bold leading-none">{grupo.quadra.nome}</span>
        <span className="text-base font-medium">
          · {grupo.quadra.piso === "cimento" ? "piso de cimento" : "saibro"}
        </span>
      </div>
    );
  }
  if (grupo.tipo === "professor") {
    return (
      <div style={estilo} className="flex items-center justify-center gap-2 bg-areia-800 px-3 py-2 text-white">
        <span
          className="h-3.5 w-3.5 rounded-full ring-2 ring-white"
          style={{ backgroundColor: grupo.professor.cor }}
          aria-hidden="true"
        />
        <span className="font-display text-2xl font-bold leading-none">{grupo.professor.nome}</span>
        <span className="text-base font-medium">· aulas da semana</span>
      </div>
    );
  }

  const ehHoje = grupo.data === hoje;
  const chuva = canceladasPorChuva(itensDoDia);
  return (
    <div
      style={estilo}
      data-cabecalho-do-dia=""
      className={`flex min-w-0 items-center gap-3 px-3 py-2 ${separador} ${ehHoje ? "bg-saibro-50" : "bg-white"}`}
    >
      <span
        className={`truncate font-display text-[1.75rem] font-bold leading-none first-letter:uppercase xl:text-3xl xl:leading-none ${
          ehHoje ? "text-saibro-800" : "text-areia-900"
        }`}
      >
        {DIAS_SEMANA_LONGO[diaDaSemana(grupo.data)]}, {formatarDiaMes(grupo.data)}
      </span>
      {ehHoje && (
        <span className="shrink-0 rounded-full bg-bola-300 px-3 py-1 font-display text-lg font-bold uppercase leading-none tracking-wide text-areia-900">
          Hoje
        </span>
      )}
      {chuva > 0 && <SeloDeChuva quantidade={chuva} />}
    </div>
  );
}

function SeloDeChuva({ quantidade }: { quantidade: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-100 px-2 py-1 text-sm font-semibold text-sky-800">
      <IconeChuva className="h-4 w-4" />
      Chuva · {quantidade} {quantidade === 1 ? "cancelada" : "canceladas"}
    </span>
  );
}

function CabecalhoDaColuna({
  coluna,
  semana,
  hoje,
  inicioDeGrupo,
  realcada,
  ativos,
  chuva,
  aoAbrirDia,
  aoEscolherProfessor,
}: {
  coluna: ColunaDaGrade;
  semana: boolean;
  hoje: string;
  inicioDeGrupo: boolean;
  realcada: boolean;
  ativos: number;
  chuva: number;
  aoAbrirDia?: (data: string) => void;
  aoEscolherProfessor?: (professorId: string) => void;
}) {
  const separador = inicioDeGrupo ? "border-l-4 border-l-areia-300" : "border-l border-l-white";
  const contagem = `${ativos} ${ativos === 1 ? "horário" : "horários"}`;

  if (!semana && coluna.quadra) {
    return (
      <div
        className={`linha-de-quadra flex min-w-0 items-center justify-between gap-1 px-2 py-2.5 [container-type:inline-size] ${separador} ${
          CLASSE_DO_PISO[coluna.quadra.piso]
        } ${realcada ? "ring-4 ring-inset ring-bola-300" : ""}`}
        title={`${coluna.quadra.nome} (${coluna.quadra.piso}) · ${contagem}`}
      >
        {/* Coluna estreita (letras maiores, tablet): letra um pouco menor em vez de "Quadr…". Em rem: acompanha o tamanho da letra escolhido. */}
        <span className="truncate font-display text-lg font-bold leading-none xl:text-xl xl:leading-none [@container(max-width:6.8rem)]:text-base [@container(max-width:6.8rem)]:leading-none">
          {coluna.quadra.nome}
        </span>
        {/* Muito estreita: o nome vale mais que a contagem (que fica no title). */}
        <span className="contents [@container(max-width:5.6rem)]:hidden">
          <ContagemDaColuna ativos={ativos} contagem={contagem} fundo="escuro" />
        </span>
      </div>
    );
  }

  if (!semana && coluna.professor) {
    return (
      <CabecalhoDoProfessor
        professor={coluna.professor}
        separador={separador}
        ativos={ativos}
        contagem={contagem}
        aoEscolher={aoEscolherProfessor}
      />
    );
  }

  const ehHoje = coluna.data === hoje;
  const conteudo = (
    <>
      <span
        className={`block text-sm font-bold uppercase tracking-wide ${
          ehHoje ? "text-saibro-800" : "text-areia-700"
        }`}
      >
        {DIAS_SEMANA_CURTO[diaDaSemana(coluna.data)]}
        {ehHoje && " · hoje"}
      </span>
      <span
        className={`block font-display text-2xl font-bold leading-tight ${
          ehHoje ? "text-saibro-800" : "text-areia-900"
        }`}
      >
        {formatarDiaMes(coluna.data)}
      </span>
      <span className="block text-sm text-areia-700">{contagem}</span>
      {chuva > 0 && (
        <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 text-xs font-semibold text-sky-800">
          <IconeChuva className="h-3.5 w-3.5" />
          Chuva
        </span>
      )}
    </>
  );
  const classe = `border-l border-areia-200 px-1 py-2 text-center first:border-l-0 ${
    ehHoje ? "bg-saibro-50" : "bg-white"
  }`;
  return aoAbrirDia ? (
    <button
      type="button"
      onClick={() => aoAbrirDia(coluna.data)}
      className={`${classe} transition-colors hover:bg-saibro-100`}
      aria-label={`Abrir a Diária de ${formatarDiaMes(coluna.data)} (${contagem})`}
    >
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Quantos horarios a coluna tem: o numero a vista, a frase para o leitor de tela. */
function ContagemDaColuna({
  ativos,
  contagem,
  fundo,
}: {
  ativos: number;
  contagem: string;
  fundo: "escuro" | "claro";
}) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 text-sm font-bold tabular-nums leading-5 ${
        fundo === "escuro" ? "bg-black/20" : "bg-white/50"
      }`}
    >
      <span aria-hidden="true">{ativos}</span>
      <span className="sr-only">{contagem}</span>
    </span>
  );
}

/**
 * Cabecalho de uma coluna da visao Professores: o nome na cor do professor
 * (texto branco ou escuro, o que for mais legivel sobre ela). Clicar abre a
 * semana daquele professor.
 */
function CabecalhoDoProfessor({
  professor,
  separador,
  ativos,
  contagem,
  aoEscolher,
}: {
  professor: Professor;
  separador: string;
  ativos: number;
  contagem: string;
  aoEscolher?: (professorId: string) => void;
}) {
  const texto = textoLegivelSobre(professor.cor);
  const conteudo = (
    <>
      <span className="min-w-0 flex-1 truncate font-display text-lg font-bold leading-none xl:text-xl xl:leading-none">
        {professor.nome}
      </span>
      <ContagemDaColuna ativos={ativos} contagem={contagem} fundo={texto === BRANCO ? "escuro" : "claro"} />
      {/* A seta (abre a semana) so onde sobra largura: no tablet o nome vem primeiro. */}
      {aoEscolher && <IconeProximo className="hidden h-4 w-4 shrink-0 xl:block" />}
    </>
  );
  const classe = `flex min-w-0 items-center gap-1.5 px-2 py-2.5 text-left ${separador}`;
  const estilo = { backgroundColor: professor.cor, color: texto };
  return aoEscolher ? (
    <button
      type="button"
      onClick={() => aoEscolher(professor.id)}
      className={`alvo-de-toque ${classe} transition-[filter] hover:brightness-110`}
      style={estilo}
      title={`Ver a semana de ${professor.nome}`}
      aria-label={`Ver a semana de ${professor.nome} (${contagem})`}
    >
      {conteudo}
    </button>
  ) : (
    <div className={classe} style={estilo} title={`${professor.nome} · ${contagem}`}>
      {conteudo}
    </div>
  );
}

function ColunaDasHoras({
  px,
  altura,
  agora,
}: {
  px: number;
  altura: number;
  agora?: number;
}) {
  return (
    <div
      className="sticky left-0 z-30 border-r border-areia-200 bg-white"
      style={{ height: altura }}
    >
      {MEIAS_HORAS.map((hora, i) => {
        const cheia = hora.endsWith(":00");
        // A etiqueta do agora cobre a hora que estiver embaixo dela.
        const topo = i * PASSO * px + 5;
        if (agora !== undefined && Math.abs(topo - ((agora - ABERTURA_EM_MINUTOS) * px - 11)) < 22) {
          return null;
        }
        return (
          <span
            key={hora}
            className={`absolute right-2 tabular-nums ${
              cheia
                ? "font-display text-[21px] font-bold leading-none text-areia-900"
                : "text-[13px] font-medium leading-none text-areia-600"
            }`}
            style={{ top: topo }}
          >
            {hora}
          </span>
        );
      })}
      {agora !== undefined && (
        <>
          <span
            className="absolute right-3 z-10 rounded bg-tijolo-600 px-1.5 py-0.5 text-[14px] font-bold tabular-nums leading-tight text-white shadow-sm"
            style={{ top: (agora - ABERTURA_EM_MINUTOS) * px - 11 }}
          >
            {minutosParaHora(agora)}
          </span>
          {/* A bolinha (bola de tenis) no comeco da linha do agora, por cima dos blocos. */}
          <span
            className="absolute -right-2 z-10 h-4 w-4 rounded-full bg-bola-300 ring-2 ring-tijolo-600"
            style={{ top: (agora - ABERTURA_EM_MINUTOS) * px - 8 }}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}

/**
 * Uma coluna (um dia numa quadra, ou um dia do professor). Memorizada: abrir
 * um painel ou um formulario nao redesenha as 10 colunas da Diaria.
 */
const ColunaDeHorarios = memo(function ColunaDeHorarios({
  coluna,
  itens,
  ocupado,
  hoje,
  px,
  linhas,
  passados,
  agora,
  inicioDeGrupo,
  realcada,
  mostrarQuadra,
  mostrarProfessor,
  nomesComoLink,
  aoAbrir,
  aoMarcar,
}: {
  coluna: ColunaDaGrade;
  itens: ItemAgenda[];
  ocupado: ItemAgenda[];
  hoje: string;
  px: number;
  linhas: CSSProperties;
  passados: number;
  agora?: number;
  inicioDeGrupo: boolean;
  realcada: boolean;
  mostrarQuadra: boolean;
  mostrarProfessor: boolean;
  nomesComoLink: boolean;
  aoAbrir: (item: ItemAgenda) => void;
  aoMarcar?: (escolha: MeiaHoraEscolhida) => void;
}) {
  // Podendo marcar, a cancelada sozinha deixa meia coluna livre ao lado.
  const posicoes = useMemo(
    () => subcolunas(itens, { vagaAoLadoDasCanceladas: Boolean(aoMarcar) }),
    [itens, aoMarcar],
  );
  const livres = useMemo(
    () => (aoMarcar ? MEIAS_HORAS.filter((hora) => podeMarcarEm(coluna, hora, ocupado, hoje)) : []),
    [aoMarcar, coluna, ocupado, hoje],
  );
  const onde = coluna.quadra
    ? `${coluna.quadra.id === "paredao" ? "no" : "na"} ${coluna.quadra.nome}, `
    : coluna.professor
      ? `com ${coluna.professor.nome}, `
      : "";

  return (
    <div
      className={`relative ${inicioDeGrupo ? "border-l-4 border-l-areia-300" : "border-l border-l-areia-200"} ${
        realcada ? "bg-bola-50" : "bg-white"
      }`}
      style={linhas}
    >
      {passados > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-areia-200/45"
          style={{ height: passados * px }}
          aria-hidden="true"
        />
      )}

      {aoMarcar &&
        livres.map((hora) => {
          const i = MEIAS_HORAS.indexOf(hora);
          return (
            <button
              key={hora}
              type="button"
              tabIndex={-1}
              onClick={() =>
                aoMarcar({
                  data: coluna.data,
                  horaInicio: hora,
                  horaFim: fimLivre(hora, ocupado),
                  quadraId: coluna.quadra?.id,
                  professorId: coluna.professorId,
                })
              }
              className="group/meia absolute inset-x-0.5 flex items-center justify-center rounded transition-colors [@media(hover:hover)]:hover:bg-saibro-50 [@media(hover:hover)]:hover:ring-1 [@media(hover:hover)]:hover:ring-inset [@media(hover:hover)]:hover:ring-saibro-300"
              style={{ top: i * PASSO * px + 1, height: PASSO * px - 1 }}
              aria-label={`Novo horário ${onde}${formatarDiaMes(coluna.data)} às ${hora}`}
              title={`Novo horário às ${hora}`}
            >
              <span className="invisible text-[14px] font-bold text-saibro-800 [@media(hover:hover)]:group-hover/meia:visible">
                + {hora}
              </span>
            </button>
          );
        })}

      {itens.map((item) => (
        <BlocoNaGrade
          key={item.ocupacao.id}
          item={item}
          posicao={{
            ...posicaoVertical(item.ocupacao, px),
            ...posicaoHorizontal(posicoes.get(item.ocupacao.id) ?? { coluna: 0, total: 1 }),
          }}
          mostrarQuadra={mostrarQuadra}
          mostrarProfessor={mostrarProfessor}
          nomesComoLink={nomesComoLink}
          aoAbrir={aoAbrir}
        />
      ))}

      {/* Linha do agora: por tras dos blocos (nao risca o texto deles). */}
      {agora !== undefined && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[5] h-[3px] bg-tijolo-600"
          style={{ top: (agora - ABERTURA_EM_MINUTOS) * px - 1.5 }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});
