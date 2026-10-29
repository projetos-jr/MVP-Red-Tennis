/**
 * Regras de cadastro (alunos e professores), matricula e congelamento.
 *
 * No banco real:
 *  - cadastro: checks de formato (telefone, e-mail, cor) nas tabelas `alunos`
 *    e `professores`, e o check da regra de repasse (valor >= 0, percentual
 *    ate 100);
 *  - matricula: exclusion constraint (btree_gist) que impede dois periodos
 *    sobrepostos do mesmo aluno: (aluno_id, daterange(inicio, fim, '[]'));
 *  - congelamento: a mesma constraint por matricula, e as funcoes
 *    `congelar_plano` e `reativar_plano`, que suspendem e devolvem as aulas
 *    fixas (Hipotese H4);
 *  - permissoes: politicas de acesso (RLS) por perfil (Hipotese H9).
 */

import { formatarData, somarDias, somarMeses } from "../../date";
import type {
  Aluno,
  AulaSuspensa,
  Banco,
  CategoriaRanking,
  Colaborador,
  Congelamento,
  Matricula,
  Ocupacao,
  Plano,
  Professor,
  RegraRepasse,
} from "../tipos";
import { conflitosDoProfessor, conflitosNaQuadra, descreverOcupacao, rotuloDaQuadra } from "./agenda";
import { ErroDeRegra, exigir, novoId } from "./comum";

/** Data usada como "sem fim" ao comparar periodos. */
const SEM_FIM = "9999-12-31";

// ---------------------------------------------------------------------------
// Matricula vigente e situacao do aluno
// ---------------------------------------------------------------------------

/** Matricula valida na data (inicio <= data e sem fim, ou fim >= data). */
export function matriculaVigente(
  matriculas: Matricula[],
  alunoId: string,
  data: string,
): Matricula | undefined {
  return matriculas.find(
    (m) => m.alunoId === alunoId && m.inicio <= data && (!m.fim || m.fim >= data),
  );
}

/** Congelamento em curso na data (comecou e ainda nao terminou). */
export function congelamentoVigente(
  congelamentos: Congelamento[],
  matriculaId: string,
  data: string,
): Congelamento | undefined {
  return congelamentos.find(
    (c) =>
      c.matriculaId === matriculaId &&
      c.inicio <= data &&
      (!c.fimReal || c.fimReal >= data),
  );
}

/**
 * Situacao do aluno:
 *  - ativo: tem matricula vigente;
 *  - congelado: tem matricula vigente com congelamento em curso;
 *  - avulso: frequenta sem plano mensal (locacoes avulsas, ranking);
 *  - inativo: saiu da arena.
 */
export type SituacaoAluno = "ativo" | "congelado" | "avulso" | "inativo";

export function situacaoDoAluno(banco: Banco, aluno: Aluno, hoje: string): SituacaoAluno {
  if (!aluno.ativo) return "inativo";
  const matricula = matriculaVigente(banco.matriculas, aluno.id, hoje);
  if (!matricula) return "avulso";
  return congelamentoVigente(banco.congelamentos, matricula.id, hoje) ? "congelado" : "ativo";
}

/** Plano da matricula vigente, se houver. */
export function planoVigente(banco: Banco, alunoId: string, hoje: string): Plano | undefined {
  const matricula = matriculaVigente(banco.matriculas, alunoId, hoje);
  return matricula ? banco.planos.find((p) => p.id === matricula.planoId) : undefined;
}

/**
 * O aluno esta congelado na data? Serve para quem gera aulas a partir dos
 * horarios fixos (agenda): aluno congelado nao entra nas aulas do periodo.
 */
export function alunoCongeladoEm(banco: Banco, alunoId: string, data: string): boolean {
  const matricula = matriculaVigente(banco.matriculas, alunoId, data);
  return Boolean(matricula && congelamentoVigente(banco.congelamentos, matricula.id, data));
}

// ---------------------------------------------------------------------------
// Permissoes (Hipotese H9)
// ---------------------------------------------------------------------------

/** Dono e recepcao alteram cadastros; professor so consulta. */
export function podeAlterarCadastros(usuario: Pick<Colaborador, "perfil">): boolean {
  return usuario.perfil === "dono" || usuario.perfil === "recepcao";
}

export function garantirPodeAlterarCadastros(usuario: Pick<Colaborador, "perfil">): void {
  exigir(
    podeAlterarCadastros(usuario),
    "O perfil de professor só consulta os cadastros: peça a alteração à recepção.",
  );
}

/** A regra de repasse define quanto a arena paga: so o dono altera (financeiro a pagar). */
export function podeAlterarRepasse(usuario: Pick<Colaborador, "perfil">): boolean {
  return usuario.perfil === "dono";
}

export function garantirPodeAlterarRepasse(usuario: Pick<Colaborador, "perfil">): void {
  exigir(
    podeAlterarRepasse(usuario),
    "Só o dono cadastra professores e altera a regra de repasse.",
  );
}

// ---------------------------------------------------------------------------
// Datas, nomes e contatos
// ---------------------------------------------------------------------------

/** "2026-11-05" e uma data que existe no calendario? */
export function dataValida(texto: string | undefined): texto is string {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  // 2026-02-30 vira 2026-03-02 ao passar pelo calendario: nao e a mesma data.
  return somarDias(texto, 0) === texto;
}

/** Datas digitadas precisam estar a ate um ano de hoje (evita erro de digitacao no ano). */
export function garantirDataProxima(data: string, hoje: string, rotulo: string): void {
  exigir(
    data >= somarMeses(hoje, -12) && data <= somarMeses(hoje, 12),
    `${rotulo} precisa estar a até um ano de hoje. Confira o ano.`,
  );
}

/** "  ana   beatriz " -> "ana beatriz" */
export function limparNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

/** Nome comparavel: sem acento, minusculo e sem espacos sobrando. */
export function chaveDeNome(nome: string): string {
  return limparNome(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Telefone brasileiro com DDD, ja formatado: "(11) 98812-4471" (celular) ou
 * "(11) 3456-7890" (fixo). Aceita com ou sem +55, zero, espacos e tracos.
 * Devolve undefined se nao for um numero valido.
 */
export function normalizarTelefone(texto: string): string | undefined {
  let digitos = texto.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  if ((digitos.length === 11 || digitos.length === 12) && digitos.startsWith("0")) {
    digitos = digitos.slice(1);
  }
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  if (!/^[1-9][1-9]$/.test(ddd)) return undefined;
  if (numero.length === 9 && numero.startsWith("9")) {
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }
  if (numero.length === 8 && /^[2-5]/.test(numero)) {
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  }
  return undefined;
}

/** E-mail em minusculas, ou undefined se o formato nao for nome@dominio.ext. */
export function normalizarEmail(texto: string): string | undefined {
  const email = texto.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(email) ? email : undefined;
}

/** Telefone e e-mail opcionais: vazio fica vazio; preenchido precisa ser valido. */
function validarContatos(dados: { telefone?: string; email?: string }): {
  telefone: string;
  email: string;
} {
  const telefoneDigitado = (dados.telefone ?? "").trim();
  const telefone = telefoneDigitado ? normalizarTelefone(telefoneDigitado) : "";
  exigir(
    telefone !== undefined,
    "Telefone inválido. Use o DDD e o número, por exemplo (11) 98812-4471.",
  );

  const emailDigitado = (dados.email ?? "").trim();
  const email = emailDigitado ? normalizarEmail(emailDigitado) : "";
  exigir(email !== undefined, "E-mail inválido. Use o formato nome@exemplo.com.");

  return { telefone, email };
}

// ---------------------------------------------------------------------------
// Cadastro do aluno
// ---------------------------------------------------------------------------

export const CATEGORIAS_RANKING: CategoriaRanking[] = ["A", "B", "C", "D"];

export interface DadosCadastroAluno {
  nome: string;
  telefone?: string;
  email?: string;
  dataNascimento?: string;
  professorPrincipalId?: string;
  inscritoRanking: boolean;
  categoriaRanking?: CategoriaRanking;
}

export type CadastroDeAluno = Pick<
  Aluno,
  | "nome"
  | "telefone"
  | "email"
  | "dataNascimento"
  | "professorPrincipalId"
  | "inscritoRanking"
  | "categoriaRanking"
>;

/**
 * Confere e arruma os dados do cadastro. Recusa com mensagem clara: nome
 * obrigatorio; telefone e e-mail, quando preenchidos, em formato valido;
 * nascimento no passado; professor existente e ativo; categoria para quem
 * entra no ranking. `professorAtualId` deixa manter um professor que ja saiu.
 */
export function validarCadastroAluno(
  banco: Banco,
  dados: DadosCadastroAluno,
  hoje: string,
  professorAtualId?: string,
): CadastroDeAluno {
  const nome = limparNome(dados.nome ?? "");
  exigir(nome.length >= 2, "Informe o nome do aluno.");
  exigir(nome.length <= 80, "O nome pode ter no máximo 80 caracteres.");

  const { telefone, email } = validarContatos(dados);

  let dataNascimento: string | undefined;
  if (dados.dataNascimento) {
    exigir(dataValida(dados.dataNascimento), "Data de nascimento inválida.");
    exigir(dados.dataNascimento <= hoje, "A data de nascimento não pode ser no futuro.");
    exigir(dados.dataNascimento >= "1900-01-01", "Confira o ano da data de nascimento.");
    dataNascimento = dados.dataNascimento;
  }

  const professorPrincipalId = dados.professorPrincipalId || undefined;
  if (professorPrincipalId) {
    const professor = banco.professores.find((p) => p.id === professorPrincipalId);
    exigir(professor, "Professor não encontrado.");
    exigir(
      professor.ativo || professorPrincipalId === professorAtualId,
      `${professor.nome} não está mais ativo como professor.`,
    );
  }

  let categoriaRanking: CategoriaRanking | undefined;
  if (dados.inscritoRanking) {
    exigir(
      dados.categoriaRanking && CATEGORIAS_RANKING.includes(dados.categoriaRanking),
      "Escolha a categoria do ranking.",
    );
    categoriaRanking = dados.categoriaRanking;
  }

  return {
    nome,
    telefone,
    email,
    dataNascimento,
    professorPrincipalId,
    inscritoRanking: Boolean(dados.inscritoRanking),
    categoriaRanking,
  };
}

// ---------------------------------------------------------------------------
// Matricula
// ---------------------------------------------------------------------------

/** Os dois periodos tem algum dia em comum? Fim vazio = sem data para acabar. */
export function periodosSeSobrepoem(
  inicioA: string,
  fimA: string | undefined,
  inicioB: string,
  fimB: string | undefined,
): boolean {
  return inicioA <= (fimB ?? SEM_FIM) && inicioB <= (fimA ?? SEM_FIM);
}

/**
 * Um aluno nunca tem duas matriculas valendo no mesmo dia: a troca de plano
 * encerra uma e abre a outra no dia seguinte.
 */
export function garantirSemMatriculaSobreposta(
  matriculas: Matricula[],
  alunoId: string,
  inicio: string,
  fim: string | undefined,
  ignorarId?: string,
): void {
  const conflito = matriculas.find(
    (m) =>
      m.alunoId === alunoId &&
      m.id !== ignorarId &&
      periodosSeSobrepoem(m.inicio, m.fim, inicio, fim),
  );
  if (!conflito) return;
  throw new ErroDeRegra(
    conflito.fim
      ? `O aluno já tem uma matrícula de ${formatarData(conflito.inicio)} a ${formatarData(conflito.fim)}: duas matrículas não podem valer ao mesmo tempo.`
      : `O aluno já tem uma matrícula a partir de ${formatarData(conflito.inicio)}, sem data de fim. Use "Trocar de plano" ou encerre a matrícula atual.`,
  );
}

/**
 * Ao cancelar uma matricula que ainda nao comecou: se ela era uma troca de
 * plano (a anterior termina na vespera), a anterior volta a valer.
 */
export function matriculaQueVoltaAValer(
  matriculas: Matricula[],
  agendada: Matricula,
): Matricula | undefined {
  const vespera = somarDias(agendada.inicio, -1);
  const anterior = matriculas.find((m) => m.alunoId === agendada.alunoId && m.fim === vespera);
  const temPosterior = matriculas.some(
    (m) => m.alunoId === agendada.alunoId && m.inicio > agendada.inicio,
  );
  return anterior && !temPosterior ? anterior : undefined;
}

/** Valor combinado maior que zero e vencimento de 1 a 28 (existe em todo mes). */
export function validarValorEVencimento(valorMensal: number, diaVencimento: number): {
  valorMensal: number;
  diaVencimento: number;
} {
  exigir(
    Number.isFinite(valorMensal) && valorMensal > 0,
    "Informe o valor combinado da mensalidade (maior que zero).",
  );
  exigir(
    Number.isInteger(diaVencimento) && diaVencimento >= 1 && diaVencimento <= 28,
    "O dia de vencimento precisa ser de 1 a 28.",
  );
  return { valorMensal: Math.round(valorMensal * 100) / 100, diaVencimento };
}

export interface DadosDaMatricula {
  planoId: string;
  valorMensal: number;
  diaVencimento: number;
  /** Primeiro dia da matricula (ou do novo plano, na troca). */
  inicio: string;
}

/** Plano ativo, valor e vencimento validos, inicio a ate um ano de hoje. */
export function validarDadosDaMatricula(
  banco: Banco,
  dados: DadosDaMatricula,
  hoje: string,
): DadosDaMatricula {
  const plano = banco.planos.find((p) => p.id === dados.planoId);
  exigir(plano, "Escolha o plano.");
  exigir(plano.ativo, `O plano "${plano.nome}" não está mais disponível.`);
  const { valorMensal, diaVencimento } = validarValorEVencimento(
    dados.valorMensal,
    dados.diaVencimento,
  );
  exigir(dataValida(dados.inicio), "Informe a data de início.");
  garantirDataProxima(dados.inicio, hoje, "A data de início");
  return { planoId: plano.id, valorMensal, diaVencimento, inicio: dados.inicio };
}

// ---------------------------------------------------------------------------
// Congelamento (Hipotese H4)
// ---------------------------------------------------------------------------

/**
 * Motivo gravado nas aulas canceladas por congelamento. Nao e uma sigla de
 * reposicao, entao nao gera credito.
 */
export const MOTIVO_CONGELAMENTO = "Congelamento";

/** Motivo gravado nas aulas canceladas porque o aluno saiu da arena. */
export const MOTIVO_INATIVACAO = "Aluno inativado";

/** Congelamento cancelado antes de comecar (fim real antes do inicio): nunca valeu. */
export function congelamentoAnulado(congelamento: Congelamento): boolean {
  return Boolean(congelamento.fimReal && congelamento.fimReal < congelamento.inicio);
}

/**
 * Dois congelamentos da mesma matricula nao se sobrepoem. Um congelamento sem
 * volta registrada conta como "ate a volta", sem data.
 */
export function garantirSemCongelamentoSobreposto(
  congelamentos: Congelamento[],
  matriculaId: string,
  inicio: string,
  fim: string,
): void {
  const conflito = congelamentos.find(
    (c) =>
      c.matriculaId === matriculaId &&
      !congelamentoAnulado(c) &&
      periodosSeSobrepoem(c.inicio, c.fimReal, inicio, fim),
  );
  if (!conflito) return;
  throw new ErroDeRegra(
    conflito.fimReal
      ? `Já houve um congelamento de ${formatarData(conflito.inicio)} a ${formatarData(conflito.fimReal)}: os períodos não podem se sobrepor.`
      : `Já existe um congelamento a partir de ${formatarData(conflito.inicio)}, sem volta registrada. Reative o plano antes de congelar de novo.`,
  );
}

/** Aula fixa que sera suspensa, e como. */
export interface AulaASuspender {
  ocupacao: Ocupacao;
  acao: AulaSuspensa["acao"];
}

function porDataEHora(a: Ocupacao, b: Ocupacao): number {
  return a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio);
}

/**
 * Aulas fixas do aluno entre `inicio` e `fim` (inclusive) que ficam suspensas
 * (Hipotese H4): so as que vem de horario fixo e ainda estao agendadas.
 * Se o aluno e o unico participante, a aula inteira e cancelada (a quadra
 * fica livre); numa turma, ele sai da lista e a aula continua para os outros.
 * Nenhuma gera credito de reposicao.
 */
export function aulasParaSuspender(
  banco: Banco,
  alunoId: string,
  inicio: string,
  fim: string,
): AulaASuspender[] {
  const ocupacaoPorId = new Map(banco.ocupacoes.map((o) => [o.id, o]));
  const candidatas: Ocupacao[] = [];
  banco.ocupacaoAlunos.forEach((p) => {
    if (p.alunoId !== alunoId) return;
    const ocupacao = ocupacaoPorId.get(p.ocupacaoId);
    if (
      ocupacao &&
      ocupacao.horarioFixoId &&
      ocupacao.situacao === "agendada" &&
      ocupacao.data >= inicio &&
      ocupacao.data <= fim
    ) {
      candidatas.push(ocupacao);
    }
  });
  if (candidatas.length === 0) return [];

  const ids = new Set(candidatas.map((o) => o.id));
  const participantes = new Map<string, number>();
  banco.ocupacaoAlunos.forEach((p) => {
    if (ids.has(p.ocupacaoId)) {
      participantes.set(p.ocupacaoId, (participantes.get(p.ocupacaoId) ?? 0) + 1);
    }
  });

  return candidatas.sort(porDataEHora).map((ocupacao) => ({
    ocupacao,
    acao: (participantes.get(ocupacao.id) ?? 0) <= 1 ? "cancelada" : "retirado",
  }));
}

/**
 * Aplica a suspensao: cancela as aulas que eram so do aluno (com `motivo`) e
 * tira o aluno das turmas. Nao cria credito de reposicao.
 */
export function suspenderAulas(
  banco: Banco,
  alunoId: string,
  aulas: AulaASuspender[],
  motivo: string,
  agora: string,
): Banco {
  const canceladas = new Set(aulas.filter((a) => a.acao === "cancelada").map((a) => a.ocupacao.id));
  const retirado = new Set(aulas.filter((a) => a.acao === "retirado").map((a) => a.ocupacao.id));
  return {
    ...banco,
    ocupacoes:
      canceladas.size === 0
        ? banco.ocupacoes
        : banco.ocupacoes.map(
            (o): Ocupacao =>
              canceladas.has(o.id)
                ? { ...o, situacao: "cancelada", motivoCancelamento: motivo, canceladaEm: agora }
                : o,
          ),
    ocupacaoAlunos:
      retirado.size === 0
        ? banco.ocupacaoAlunos
        : banco.ocupacaoAlunos.filter(
            (p) => !(p.alunoId === alunoId && retirado.has(p.ocupacaoId)),
          ),
  };
}

/**
 * Aulas do congelamento que continuam suspensas agora. O congelamento guarda
 * o que suspendeu; o que voltou (na reativacao, ou remarcado pela agenda) sai
 * da conta olhando o estado de cada aula.
 */
export function aulasAindaSuspensas(
  banco: Banco,
  congelamento: Congelamento,
  alunoId: string,
): AulaSuspensa[] {
  const lista = congelamento.aulasSuspensas ?? [];
  if (lista.length === 0) return [];
  const participa = new Set(
    banco.ocupacaoAlunos.filter((p) => p.alunoId === alunoId).map((p) => p.ocupacaoId),
  );
  return lista.filter((suspensa) => {
    const ocupacao = banco.ocupacoes.find((o) => o.id === suspensa.ocupacaoId);
    if (!ocupacao) return false;
    return suspensa.acao === "cancelada"
      ? ocupacao.situacao === "cancelada" && ocupacao.motivoCancelamento === MOTIVO_CONGELAMENTO
      : !participa.has(ocupacao.id);
  });
}

export interface AulaQueVolta extends AulaSuspensa {
  ocupacao: Ocupacao;
}

export interface AulaQueNaoVolta {
  ocupacao: Ocupacao;
  motivo: string;
}

export interface PreviaDaVolta {
  voltam: AulaQueVolta[];
  naoVoltam: AulaQueNaoVolta[];
}

/**
 * O que acontece com as aulas suspensas quando o aluno volta: as de
 * `aPartirDe` em diante voltam para a agenda, menos as que nao podem (a
 * quadra foi ocupada por outra pessoa, a aula da turma foi cancelada...).
 * As de antes continuam suspensas.
 */
export function previaDaVolta(
  banco: Banco,
  congelamento: Congelamento,
  alunoId: string,
  aPartirDe: string,
): PreviaDaVolta {
  const voltam: AulaQueVolta[] = [];
  const naoVoltam: AulaQueNaoVolta[] = [];

  (congelamento.aulasSuspensas ?? []).forEach((suspensa) => {
    const ocupacao = banco.ocupacoes.find((o) => o.id === suspensa.ocupacaoId);
    if (!ocupacao || ocupacao.data < aPartirDe) return;

    if (suspensa.acao === "cancelada") {
      // Se alguem ja mexeu nesta aula pela agenda, ela nao e mais do congelamento.
      if (ocupacao.situacao !== "cancelada" || ocupacao.motivoCancelamento !== MOTIVO_CONGELAMENTO) {
        return;
      }
      const conflito = conflitosNaQuadra(banco.ocupacoes, ocupacao)[0];
      if (conflito) {
        naoVoltam.push({
          ocupacao,
          motivo: `${rotuloDaQuadra(ocupacao.quadraId)} já ocupada das ${conflito.horaInicio} às ${conflito.horaFim} (${descreverOcupacao(banco, conflito)})`,
        });
        return;
      }
      if (
        banco.configuracoes.bloquearProfessorEmDuasAulas &&
        conflitosDoProfessor(banco.ocupacoes, ocupacao).length > 0
      ) {
        naoVoltam.push({ ocupacao, motivo: "o professor já tem outra aula nesse horário" });
        return;
      }
      voltam.push({ ...suspensa, ocupacao });
      return;
    }

    // "retirado": a aula da turma continuou; o aluno volta para a lista.
    if (ocupacao.situacao === "cancelada") {
      naoVoltam.push({
        ocupacao,
        motivo: `a aula da turma foi cancelada${ocupacao.motivoCancelamento ? ` (${ocupacao.motivoCancelamento})` : ""}`,
      });
      return;
    }
    if (ocupacao.situacao === "realizada") return;
    const jaParticipa = banco.ocupacaoAlunos.some(
      (p) => p.ocupacaoId === ocupacao.id && p.alunoId === alunoId,
    );
    if (!jaParticipa) voltam.push({ ...suspensa, ocupacao });
  });

  return {
    voltam: voltam.sort((a, b) => porDataEHora(a.ocupacao, b.ocupacao)),
    naoVoltam: naoVoltam.sort((a, b) => porDataEHora(a.ocupacao, b.ocupacao)),
  };
}

/**
 * Ultimo dia congelado para quem volta em `dataVolta`. Voltar no dia do
 * inicio (ou antes) anula o congelamento: o fim fica antes do inicio.
 */
export function fimRealParaVolta(congelamento: Congelamento, dataVolta: string): string {
  const volta = dataVolta > congelamento.inicio ? dataVolta : congelamento.inicio;
  return somarDias(volta, -1);
}

/** As aulas suspensas que voltam: reagenda as canceladas e recoloca o aluno nas turmas. */
export function devolverAulas(banco: Banco, alunoId: string, voltam: AulaQueVolta[]): Banco {
  const reagendar = new Set(voltam.filter((a) => a.acao === "cancelada").map((a) => a.ocupacaoId));
  const recolocar = voltam.filter((a) => a.acao === "retirado");
  return {
    ...banco,
    ocupacoes:
      reagendar.size === 0
        ? banco.ocupacoes
        : banco.ocupacoes.map(
            (o): Ocupacao =>
              reagendar.has(o.id)
                ? { ...o, situacao: "agendada", motivoCancelamento: undefined, canceladaEm: undefined }
                : o,
          ),
    ocupacaoAlunos:
      recolocar.length === 0
        ? banco.ocupacaoAlunos
        : [
            ...banco.ocupacaoAlunos,
            ...recolocar.map((a) => ({
              id: novoId("pa"),
              ocupacaoId: a.ocupacaoId,
              alunoId,
              presenca: "a_marcar" as const,
            })),
          ],
  };
}

// ---------------------------------------------------------------------------
// Inativacao
// ---------------------------------------------------------------------------

/** Aulas fixas do aluno depois do ultimo dia na arena (as mesmas regras da suspensao). */
export function aulasDepoisDaSaida(banco: Banco, alunoId: string, ultimoDia: string): AulaASuspender[] {
  return aulasParaSuspender(banco, alunoId, somarDias(ultimoDia, 1), SEM_FIM);
}

/**
 * Reservas que nao vem de horario fixo (avulsas, reposicoes, ranking) entre
 * as datas. Nem o congelamento nem a inativacao mexem nelas: quem decide e a
 * recepcao, pela agenda (algumas tem cobranca ou partida ligada).
 */
export function reservasAvulsasDoAluno(
  banco: Banco,
  alunoId: string,
  inicio: string,
  fim: string,
): Ocupacao[] {
  const ids = new Set(
    banco.ocupacaoAlunos.filter((p) => p.alunoId === alunoId).map((p) => p.ocupacaoId),
  );
  return banco.ocupacoes
    .filter(
      (o) =>
        ids.has(o.id) &&
        !o.horarioFixoId &&
        o.situacao !== "cancelada" &&
        o.situacao !== "realizada" &&
        o.data >= inicio &&
        o.data <= fim,
    )
    .sort(porDataEHora);
}

// ---------------------------------------------------------------------------
// Professores: cadastro e regra de repasse (Hipotese H6)
// ---------------------------------------------------------------------------

/** Valor por hora nao negativo; percentual de 0 a 100. */
export function validarRegraRepasse(regra: RegraRepasse | undefined): RegraRepasse {
  exigir(
    regra && (regra.modo === "por_hora" || regra.modo === "percentual"),
    "Escolha como o repasse é calculado: por hora-aula ou percentual.",
  );
  exigir(
    Number.isFinite(regra.valor),
    regra.modo === "por_hora" ? "Informe o valor por hora-aula." : "Informe o percentual do repasse.",
  );
  exigir(regra.valor >= 0, "O valor do repasse não pode ser negativo.");
  if (regra.modo === "percentual") {
    exigir(regra.valor <= 100, "O percentual do repasse vai de 0 a 100.");
  }
  return { modo: regra.modo, valor: Math.round(regra.valor * 100) / 100 };
}

export interface DadosCadastroProfessor {
  nome: string;
  /** Cor na agenda, "#RRGGBB". */
  cor: string;
  especialidade?: string;
  telefone?: string;
  email?: string;
  repasse: RegraRepasse;
}

export type CadastroDeProfessor = Omit<Professor, "id" | "ativo">;

/** Nome obrigatorio e sem repetir, cor valida, contatos validos, repasse valido. */
export function validarCadastroProfessor(
  banco: Banco,
  dados: DadosCadastroProfessor,
  ignorarId?: string,
): CadastroDeProfessor {
  const nome = limparNome(dados.nome ?? "");
  exigir(nome.length >= 2, "Informe o nome do professor.");
  exigir(nome.length <= 80, "O nome pode ter no máximo 80 caracteres.");
  const repetido = banco.professores.find(
    (p) => p.id !== ignorarId && chaveDeNome(p.nome) === chaveDeNome(nome),
  );
  exigir(!repetido, `Já existe um professor chamado ${repetido?.nome ?? nome}.`);

  const cor = (dados.cor ?? "").trim().toUpperCase();
  exigir(/^#[0-9A-F]{6}$/.test(cor), "Escolha a cor do professor na agenda.");

  const especialidade = limparNome(dados.especialidade ?? "");
  exigir(especialidade.length <= 80, "A especialidade pode ter no máximo 80 caracteres.");

  const { telefone, email } = validarContatos(dados);

  return {
    nome,
    cor,
    especialidade,
    telefone: telefone || undefined,
    email: email || undefined,
    repasse: validarRegraRepasse(dados.repasse),
  };
}
