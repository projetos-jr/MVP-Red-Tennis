/**
 * Logica pura da grade da agenda (sem React): colunas, posicoes, meias horas,
 * linha do "agora" e o que pode ser marcado. A tela (`GradeDeColunas`) so
 * desenha o que estas funcoes calculam; os testes ficam em `grade.test.ts`.
 *
 * A grade tem linhas de 30 em 30 minutos (como o sistema antigo da arena) e
 * colunas que podem ser:
 *  - Diaria: 2 dias x 5 quadras (cada dia e um grupo de colunas);
 *  - Professores: 2 dias x os professores ativos (Hipotese H20, "igual a
 *    agenda das quadras");
 *  - Quadra: 7 dias de uma quadra (um grupo so, a quadra);
 *  - semana de um professor: 7 dias de um professor (um grupo so).
 */

import { FAIXAS_HORARIAS, HORA_ABERTURA, HORA_FECHAMENTO } from "@/lib/banco/constantes";
import type { Professor, Quadra } from "@/lib/banco/tipos";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import { horaParaMinutos, minutosParaHora } from "@/lib/date";

/** Tamanho de cada linha da grade, em minutos. */
export const PASSO = 30;

export const ABERTURA_EM_MINUTOS = HORA_ABERTURA * 60;
export const FECHAMENTO_EM_MINUTOS = HORA_FECHAMENTO * 60;

/**
 * Pixels por minuto (redesign 3: "a agenda maior, para bater o olho e ler").
 *  - Mouse (computador da recepcao), 1,7: meia hora de 51px; um horario de
 *    1 h (o mais comum) fica com 101px, o bastante para a linha da hora e do
 *    tipo, DUAS linhas de nomes em 16px e o professor em 14px
 *    (`linhasDoBloco`). Numa tela de 1440 x 900 cabem perto de 12 meias horas
 *    (6 h) sem rolar a pagina.
 *  - Toque (tablet na quadra), 1,8: meia hora de 54px (alvo de toque bem
 *    acima de 44px) e TRES linhas de nomes num horario de 1 h, porque as
 *    colunas do tablet sao mais estreitas (~110px) e os nomes quebram mais.
 */
export const PX_POR_MINUTO = { mouse: 1.7, toque: 1.8 } as const;

export function pxPorMinuto(toque: boolean): number {
  return toque ? PX_POR_MINUTO.toque : PX_POR_MINUTO.mouse;
}

/** Altura total da grade (07h as 22h). */
export function alturaDaGrade(px: number): number {
  return (FECHAMENTO_EM_MINUTOS - ABERTURA_EM_MINUTOS) * px;
}

/** Inicio de cada meia hora: "07:00", "07:30" ... "21:30" (30 linhas). */
export const MEIAS_HORAS: string[] = Array.from(
  { length: (FECHAMENTO_EM_MINUTOS - ABERTURA_EM_MINUTOS) / PASSO },
  (_, i) => minutosParaHora(ABERTURA_EM_MINUTOS + i * PASSO),
);

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

/** Uma coluna da grade: um dia numa quadra (ou de um professor). */
export interface ColunaDaGrade {
  /** Unica na grade: "2026-11-04|1", "2026-11-04|prof-2". */
  chave: string;
  data: string;
  /** Quadra da coluna (Diaria e semana da quadra). */
  quadra?: Quadra;
  /** Professor da coluna (visao Professores e semana do professor). */
  professorId?: string;
  /** Professor da coluna na visao Professores (o cabecalho mostra o nome e a cor). */
  professor?: Professor;
}

/**
 * Grupo de colunas (primeira linha do cabecalho):
 *  - "dia": um dia da Diaria (uma coluna por quadra) ou da visao Professores
 *    (uma coluna por professor);
 *  - "quadra" / "professor": a semana inteira, uma coluna por dia.
 */
export type GrupoDeColunas =
  | { tipo: "dia"; chave: string; data: string; colunas: ColunaDaGrade[] }
  | { tipo: "quadra"; chave: string; quadra: Quadra; colunas: ColunaDaGrade[] }
  | { tipo: "professor"; chave: string; professor: Professor; colunas: ColunaDaGrade[] };

/** Diaria: cada data e um grupo, com uma coluna por quadra (Quadra 1 a 4 e Paredao). */
export function colunasDaDiaria(datas: string[], quadras: Quadra[]): GrupoDeColunas[] {
  return datas.map((data) => ({
    tipo: "dia",
    chave: data,
    data,
    colunas: quadras.map((quadra) => ({ chave: `${data}|${quadra.id}`, data, quadra })),
  }));
}

/**
 * Visao Professores (Hipotese H20): cada data e um grupo, com uma coluna por
 * professor ativo, como a Diaria faz com as quadras.
 */
export function colunasDosProfessores(datas: string[], professores: Professor[]): GrupoDeColunas[] {
  return datas.map((data) => ({
    tipo: "dia",
    chave: data,
    data,
    colunas: professores.map((professor) => ({
      chave: `${data}|${professor.id}`,
      data,
      professorId: professor.id,
      professor,
    })),
  }));
}

/** Semana de uma quadra ou de um professor: um grupo so, uma coluna por dia. */
export function colunasDaSemana(
  datas: string[],
  alvo: { quadra: Quadra } | { professor: Professor },
): GrupoDeColunas[] {
  if ("quadra" in alvo) {
    const { quadra } = alvo;
    return [
      {
        tipo: "quadra",
        chave: `quadra|${quadra.id}`,
        quadra,
        colunas: datas.map((data) => ({ chave: `${data}|${quadra.id}`, data, quadra })),
      },
    ];
  }
  const { professor } = alvo;
  return [
    {
      tipo: "professor",
      chave: `professor|${professor.id}`,
      professor,
      colunas: datas.map((data) => ({
        chave: `${data}|${professor.id}`,
        data,
        professorId: professor.id,
      })),
    },
  ];
}

/** Os horarios do dia que caem nesta coluna (pela quadra ou pelo professor). */
export function itensDaColuna(coluna: ColunaDaGrade, itensDoDia: ItemAgenda[]): ItemAgenda[] {
  return itensDoDia.filter(
    (i) =>
      (!coluna.quadra || i.ocupacao.quadraId === coluna.quadra.id) &&
      (!coluna.professorId || i.ocupacao.professorId === coluna.professorId),
  );
}

/** Quantas ocupacoes ativas (sem bloqueios e canceladas) a coluna tem. */
export function horariosAtivos(itens: ItemAgenda[]): number {
  return itens.filter((i) => !i.cancelada && i.ocupacao.tipo !== "Bloqueio").length;
}

// ---------------------------------------------------------------------------
// Posicoes
// ---------------------------------------------------------------------------

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

/** Bloco mais baixo que isto vira uma linha so (ex.: aula de 15 minutos). */
export const ALTURA_MINIMA_DO_BLOCO = 24;

/**
 * Medidas do texto dentro do bloco, em px (a grade e medida em px: a altura
 * do bloco e a duracao). Folga = 4px em cima e 4px embaixo.
 */
export const LINHAS_DO_BLOCO = { folga: 8, cabecalho: 20, nome: 20, professor: 18 } as const;

/**
 * Posicao vertical de um horario, com precisao de minuto. Deixa 1px de folga
 * em cima (separa dois horarios seguidos); uma meia hora no toque fica com
 * 44px, o alvo minimo.
 */
export function posicaoVertical(
  horario: { horaInicio: string; horaFim: string },
  px: number,
): { top: number; height: number } {
  const inicio = limitar(horaParaMinutos(horario.horaInicio), ABERTURA_EM_MINUTOS, FECHAMENTO_EM_MINUTOS);
  const fim = limitar(horaParaMinutos(horario.horaFim), inicio, FECHAMENTO_EM_MINUTOS);
  return {
    top: (inicio - ABERTURA_EM_MINUTOS) * px + 1,
    height: Math.max((fim - inicio) * px - 1, ALTURA_MINIMA_DO_BLOCO),
  };
}

/** Posicao lateral dentro da coluna, quando horarios dividem o mesmo intervalo. */
export function posicaoHorizontal(subcoluna: { coluna: number; total: number }): {
  left: string;
  width: string;
} {
  const { coluna, total } = subcoluna;
  return {
    left: `calc(${(coluna / total) * 100}% + 2px)`,
    width: `calc(${100 / total}% - 4px)`,
  };
}

/**
 * Quanto cabe no bloco, pela altura:
 *  - minima (< 48px): uma linha (hora e o primeiro nome);
 *  - compacta (< 66px): hora e marcas; nomes numa linha (meia hora);
 *  - normal (< 96px): hora, tipo, nomes e professor;
 *  - ampla: tudo, um nome por linha quando cabem (1 h ou mais).
 */
export type DensidadeDoBloco = "minima" | "compacta" | "normal" | "ampla";

export function densidadeDoBloco(altura: number): DensidadeDoBloco {
  const { folga, cabecalho, nome } = LINHAS_DO_BLOCO;
  if (altura < folga + cabecalho + nome) return "minima";
  if (altura < 66) return "compacta";
  if (altura < 96) return "normal";
  return "ampla";
}

/**
 * Quantas linhas de nomes cabem no bloco e se o professor ainda cabe embaixo
 * (`LINHAS_DO_BLOCO`: cabecalho 20px, nomes 20px, professor 18px, 4px de
 * folga em cima e embaixo). O que nao cabe termina em reticencias (a turma
 * inteira esta no painel).
 */
export function linhasDoBloco(
  altura: number,
  comProfessor: boolean,
): { nomes: number; professor: boolean } {
  const { folga, cabecalho, nome, professor: linhaDoProfessor } = LINHAS_DO_BLOCO;
  const util = altura - folga - cabecalho;
  const professor = comProfessor && util >= nome + linhaDoProfessor;
  return {
    nomes: Math.max(0, Math.floor((util - (professor ? linhaDoProfessor : 0)) / nome)),
    professor,
  };
}

// ---------------------------------------------------------------------------
// Agora, passado e o que pode ser marcado
// ---------------------------------------------------------------------------

/**
 * Minuto do dia do "agora" ("YYYY-MM-DDTHH:mm:ss") se ele cai nesta data e
 * dentro do funcionamento; senao, undefined (sem linha do agora).
 */
export function minutoDoAgora(agora: string, data: string): number | undefined {
  if (agora.slice(0, 10) !== data) return undefined;
  const minuto = horaParaMinutos(agora.slice(11, 16));
  return minuto >= ABERTURA_EM_MINUTOS && minuto <= FECHAMENTO_EM_MINUTOS ? minuto : undefined;
}

/**
 * Quantos minutos da coluna ja passaram (a pelicula do passado): o dia
 * inteiro antes de hoje, ate o agora hoje, nada depois de hoje.
 */
export function minutosPassados(data: string, agora: string): number {
  const dia = agora.slice(0, 10);
  const total = FECHAMENTO_EM_MINUTOS - ABERTURA_EM_MINUTOS;
  if (data < dia) return total;
  if (data > dia) return 0;
  return limitar(horaParaMinutos(agora.slice(11, 16)) - ABERTURA_EM_MINUTOS, 0, total);
}

/**
 * A meia hora que comeca em `inicio` ("07:30") esta livre para marcar nesta
 * coluna? Segue a regra de gravacao: so a partir de hoje (o passado fica como
 * historico) e sem ocupacao ativa no intervalo (cancelada nao ocupa). Os
 * `itens` sao os da coluna SEM o filtro de tipo: um horario escondido pelo
 * filtro continua ocupando a quadra.
 */
export function podeMarcarEm(
  coluna: Pick<ColunaDaGrade, "data">,
  inicio: string,
  itens: ItemAgenda[],
  hoje: string,
): boolean {
  if (coluna.data < hoje) return false;
  const comeco = horaParaMinutos(inicio);
  const fim = comeco + PASSO;
  if (comeco < ABERTURA_EM_MINUTOS || fim > FECHAMENTO_EM_MINUTOS) return false;
  return !itens.some(
    (i) =>
      !i.cancelada &&
      horaParaMinutos(i.ocupacao.horaInicio) < fim &&
      horaParaMinutos(i.ocupacao.horaFim) > comeco,
  );
}

/** Fim sugerido para um horario novo que comeca em `inicio`: 1 hora depois, ate as 22h. */
export function fimSugerido(inicio: string): string {
  return minutosParaHora(Math.min(horaParaMinutos(inicio) + 60, FECHAMENTO_EM_MINUTOS));
}

/**
 * Fim sugerido ao clicar numa meia hora livre da grade: 1 hora depois, mas
 * parando no inicio do proximo horario ativo da coluna (cancelada nao conta),
 * para o formulario nao abrir ja em conflito. Nunca menos de 30 min (a meia
 * hora clicada esta livre) e nunca depois das 22h.
 */
export function fimLivre(inicio: string, itens: ItemAgenda[]): string {
  const comeco = horaParaMinutos(inicio);
  let fim = Math.min(comeco + 60, FECHAMENTO_EM_MINUTOS);
  itens.forEach((i) => {
    if (i.cancelada) return;
    const outro = horaParaMinutos(i.ocupacao.horaInicio);
    if (outro > comeco && outro < fim) fim = outro;
  });
  return minutosParaHora(Math.max(fim, Math.min(comeco + PASSO, FECHAMENTO_EM_MINUTOS)));
}

// ---------------------------------------------------------------------------
// Horarios que se sobrepoem e faixas de 1 hora (lista do celular)
// ---------------------------------------------------------------------------

/**
 * Dentro de uma quadra so pode haver uma ocupacao ativa por vez, mas uma
 * aula cancelada continua aparecendo ao lado da que ocupou o lugar dela.
 * Esta funcao divide a coluna em "subcolunas" para que horarios que se
 * sobrepoem fiquem lado a lado, em vez de um por cima do outro.
 */
export function subcolunas(
  itens: ItemAgenda[],
  opcoes: { vagaAoLadoDasCanceladas?: boolean } = {},
): Map<string, { coluna: number; total: number }> {
  const ordenados = [...itens].sort(
    (a, b) =>
      a.ocupacao.horaInicio.localeCompare(b.ocupacao.horaInicio) ||
      Number(a.cancelada) - Number(b.cancelada),
  );
  const posicoes = new Map<string, { coluna: number; total: number }>();
  let grupo: Array<{ id: string; coluna: number; cancelada: boolean }> = [];
  let finsDasColunas: string[] = [];
  let fimDoGrupo = "";

  const fecharGrupo = () => {
    // Grupo so de canceladas: o horario esta livre. Com `vagaAoLadoDasCanceladas`
    // sobra uma subcoluna vazia a direita, onde as meias horas continuam
    // clicaveis para marcar no lugar.
    const soCanceladas = grupo.length > 0 && grupo.every((g) => g.cancelada);
    const total = finsDasColunas.length + (soCanceladas && opcoes.vagaAoLadoDasCanceladas ? 1 : 0);
    grupo.forEach(({ id, coluna }) => posicoes.set(id, { coluna, total }));
    grupo = [];
    finsDasColunas = [];
  };

  ordenados.forEach(({ ocupacao, cancelada }) => {
    if (grupo.length > 0 && ocupacao.horaInicio >= fimDoGrupo) fecharGrupo();
    let coluna = finsDasColunas.findIndex((fim) => fim <= ocupacao.horaInicio);
    if (coluna === -1) {
      coluna = finsDasColunas.length;
      finsDasColunas.push(ocupacao.horaFim);
    } else {
      finsDasColunas[coluna] = ocupacao.horaFim;
    }
    fimDoGrupo =
      grupo.length === 0 || ocupacao.horaFim > fimDoGrupo ? ocupacao.horaFim : fimDoGrupo;
    grupo.push({ id: ocupacao.id, coluna, cancelada });
  });
  fecharGrupo();
  return posicoes;
}

export interface CelulaDaLista {
  /** Horarios que comecam nesta faixa de 1 h. */
  comecam: ItemAgenda[];
  /** Horarios que comecaram antes e ainda ocupam esta faixa. */
  continuam: ItemAgenda[];
}

/** Distribui os horarios do dia nas faixas de 1 h (lista do celular). */
export function celulasDoDia(itens: ItemAgenda[]): Map<string, CelulaDaLista> {
  const celulas = new Map<string, CelulaDaLista>(
    FAIXAS_HORARIAS.map((faixa) => [faixa, { comecam: [], continuam: [] }]),
  );
  itens.forEach((item) => {
    const inicio = horaParaMinutos(item.ocupacao.horaInicio);
    const fim = horaParaMinutos(item.ocupacao.horaFim);
    FAIXAS_HORARIAS.forEach((faixa) => {
      const comeco = horaParaMinutos(faixa);
      const celula = celulas.get(faixa);
      if (!celula) return;
      if (inicio >= comeco && inicio < comeco + 60) celula.comecam.push(item);
      else if (inicio < comeco && fim > comeco) celula.continuam.push(item);
    });
  });
  return celulas;
}

/** Quantas ocupacoes do dia foram canceladas por chuva (CH). */
export function canceladasPorChuva(itens: ItemAgenda[]): number {
  return itens.filter((i) => i.cancelada && i.ocupacao.motivoCancelamento === "CH").length;
}

