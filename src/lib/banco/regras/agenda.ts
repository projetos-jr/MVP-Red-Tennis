/**
 * Regras da agenda.
 *
 * A principal: duas ocupacoes que nao estejam canceladas nao podem dividir a
 * mesma quadra no mesmo horario. Bloqueios seguem a mesma regra. No banco
 * real isso vira uma "exclusion constraint" (btree_gist) na tabela
 * `ocupacoes`; aqui, `garantirQuadraLivre` faz o mesmo papel.
 */

import { diaDaSemana, formatarDiaMes, horaParaMinutos, somarDias } from "../../date";
import type { Banco, HorarioFixo, Ocupacao, QuadraId } from "../tipos";
import { ErroDeRegra, sobrepoe } from "./comum";

/** O que basta saber de uma ocupacao para checar conflito. */
export interface IntervaloNaQuadra {
  /** Id da propria ocupacao, para ignora-la ao editar. */
  id?: string;
  quadraId: QuadraId;
  data: string;
  horaInicio: string;
  horaFim: string;
}

export function ocupacaoAtiva(ocupacao: Ocupacao): boolean {
  return ocupacao.situacao !== "cancelada";
}

export function rotuloDaQuadra(quadraId: QuadraId): string {
  return quadraId === "paredao" ? "Paredão" : `Quadra ${quadraId}`;
}

export function duracaoEmMinutos(
  item: Pick<Ocupacao, "horaInicio" | "horaFim">,
): number {
  return horaParaMinutos(item.horaFim) - horaParaMinutos(item.horaInicio);
}

/** Ocupacoes ativas que batem com o intervalo na mesma quadra. */
export function conflitosNaQuadra(
  ocupacoes: Ocupacao[],
  alvo: IntervaloNaQuadra,
): Ocupacao[] {
  return ocupacoes.filter(
    (o) =>
      o.id !== alvo.id &&
      ocupacaoAtiva(o) &&
      o.quadraId === alvo.quadraId &&
      o.data === alvo.data &&
      sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim),
  );
}

/** Ocupacoes ativas do mesmo professor que batem com o intervalo (em qualquer quadra). */
export function conflitosDoProfessor(
  ocupacoes: Ocupacao[],
  alvo: Omit<IntervaloNaQuadra, "quadraId"> & { professorId?: string },
): Ocupacao[] {
  if (!alvo.professorId) return [];
  return ocupacoes.filter(
    (o) =>
      o.id !== alvo.id &&
      ocupacaoAtiva(o) &&
      o.professorId === alvo.professorId &&
      o.data === alvo.data &&
      sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim),
  );
}

/** "Individual · Guilherme Lima", "Bloqueio · Manutenção do saibro"... */
export function descreverOcupacao(banco: Banco, ocupacao: Ocupacao): string {
  if (ocupacao.tipo === "Bloqueio") {
    return `Bloqueio${ocupacao.descricao ? ` · ${ocupacao.descricao}` : ""}`;
  }
  const nomes = banco.ocupacaoAlunos
    .filter((p) => p.ocupacaoId === ocupacao.id)
    .map((p) => banco.alunos.find((a) => a.id === p.alunoId)?.nome)
    .filter(Boolean);
  const pessoas =
    nomes.length === 0
      ? ""
      : nomes.length <= 2
        ? ` · ${nomes.join(" e ")}`
        : ` · ${nomes[0]} e mais ${nomes.length - 1}`;
  return `${ocupacao.tipo}${pessoas}`;
}

/**
 * Recusa a operacao se a quadra ja estiver ocupada no intervalo.
 * A mensagem diz quem ocupa, para a recepcao resolver na hora.
 */
export function garantirQuadraLivre(banco: Banco, alvo: IntervaloNaQuadra): void {
  const conflito = conflitosNaQuadra(banco.ocupacoes, alvo)[0];
  if (!conflito) return;
  throw new ErroDeRegra(
    `${rotuloDaQuadra(alvo.quadraId)} já está ocupada em ${formatarDiaMes(alvo.data)} ` +
      `das ${conflito.horaInicio} às ${conflito.horaFim} ` +
      `(${descreverOcupacao(banco, conflito)}).`,
  );
}

/** Horario de inicio antes do fim, dentro do funcionamento da arena. */
export function garantirHorarioValido(horaInicio: string, horaFim: string): void {
  if (!(horaInicio < horaFim)) {
    throw new ErroDeRegra("O horário de término precisa ser depois do início.");
  }
  if (horaInicio < "07:00" || horaFim > "22:00") {
    throw new ErroDeRegra("A arena funciona das 07:00 às 22:00.");
  }
}

/** Datas (entre `de` e `ate`, inclusive) em que um horario fixo acontece. */
export function datasDoHorarioFixo(
  horario: Pick<HorarioFixo, "diaSemana" | "inicio" | "fim">,
  de: string,
  ate: string,
): string[] {
  const inicio = horario.inicio > de ? horario.inicio : de;
  const fim = horario.fim && horario.fim < ate ? horario.fim : ate;
  const datas: string[] = [];
  let data = inicio;
  // Avanca ate o primeiro dia da semana certo e depois de 7 em 7 dias.
  while (data <= fim && diaDaSemana(data) !== horario.diaSemana) {
    data = somarDias(data, 1);
  }
  while (data <= fim) {
    datas.push(data);
    data = somarDias(data, 7);
  }
  return datas;
}

/**
 * Indice "quadra|data" -> ocupacoes ativas, para checar muitos conflitos de
 * uma vez sem varrer a lista inteira a cada consulta (usado na geracao de
 * dados e em operacoes em lote, como a recorrencia).
 */
export function indexarPorQuadraEData(ocupacoes: Ocupacao[]): Map<string, Ocupacao[]> {
  const indice = new Map<string, Ocupacao[]>();
  ocupacoes.forEach((o) => {
    if (!ocupacaoAtiva(o)) return;
    const chave = `${o.quadraId}|${o.data}`;
    const lista = indice.get(chave);
    if (lista) lista.push(o);
    else indice.set(chave, [o]);
  });
  return indice;
}

export function livreNoIndice(
  indice: Map<string, Ocupacao[]>,
  alvo: IntervaloNaQuadra,
): boolean {
  const lista = indice.get(`${alvo.quadraId}|${alvo.data}`) ?? [];
  return !lista.some(
    (o) =>
      o.id !== alvo.id &&
      sobrepoe(o.horaInicio, o.horaFim, alvo.horaInicio, alvo.horaFim),
  );
}
