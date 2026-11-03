/**
 * Conversao entre o formato do banco (Postgres, snake_case) e o das telas
 * (`src/lib/banco/tipos.ts`, camelCase).
 *
 *  - nomes: `hora_inicio` <-> `horaInicio`, `horarios_fixos` <-> `horariosFixos`;
 *  - vazio: `null` no banco <-> campo ausente na tela;
 *  - horas: `08:00:00` -> `08:00`;
 *  - data e hora (timestamptz): o banco devolve em UTC; a tela usa
 *    "YYYY-MM-DDTHH:mm:ss" no fuso da arena, e e assim que volta a ser gravado
 *    (com o fuso da arena explicito);
 *  - professores: `repasse_modo` + `repasse_valor` <-> `repasse: { modo, valor }`.
 */

import { TIMEZONE_ARENA } from "@/lib/date";
import type { Banco, RegistroAuditoria, TabelaDoBanco } from "@/lib/banco/tipos";

type Linha = Record<string, unknown>;

/** horariosFixos -> horarios_fixos */
export function paraSnake(nome: string): string {
  return nome.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

/** horarios_fixos -> horariosFixos */
export function paraCamel(nome: string): string {
  return nome.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());
}

/**
 * Fuso da arena. O Brasil nao tem horario de verao desde 2019, entao Sao Paulo
 * e sempre UTC-3. Se isso mudar, troque aqui (e em `privado.hoje()` nada muda:
 * o banco usa o nome do fuso).
 */
export const DESLOCAMENTO_ARENA = "-03:00";

const DATA_HORA_COM_FUSO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)$/;
const DATA_HORA_DA_ARENA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const HORA_COM_SEGUNDOS = /^\d{2}:\d{2}:\d{2}$/;

const FORMATO_DA_ARENA = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE_ARENA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "2026-11-03T13:00:00+00:00" -> "2026-11-03T10:00:00" (fuso da arena). */
export function dataHoraDaArena(valor: string): string {
  const partes = FORMATO_DA_ARENA.formatToParts(new Date(valor.replace(" ", "T")));
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}`;
}

/** Valor do banco -> valor da tela. */
function valorDoBanco(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  if (HORA_COM_SEGUNDOS.test(valor)) return valor.slice(0, 5);
  if (DATA_HORA_COM_FUSO.test(valor)) return dataHoraDaArena(valor);
  return valor;
}

/** Valor da tela -> valor do banco. */
function valorParaBanco(valor: unknown): unknown {
  if (typeof valor === "string" && DATA_HORA_DA_ARENA.test(valor)) {
    return `${valor.length === 16 ? `${valor}:00` : valor}${DESLOCAMENTO_ARENA}`;
  }
  return valor;
}

/** Colunas que existem no banco mas nao nas telas. */
const SO_NO_BANCO: Partial<Record<TabelaDoBanco, string[]>> = {
  // Ordem de inscricao: so serve para ordenar a lista (desempate final).
  torneioInscritos: ["ordem_inscricao"],
};

/** Uma linha do banco -> um registro da tela. */
export function doBanco<T>(tabela: TabelaDoBanco, linha: Linha): T {
  const registro: Linha = {};
  const ignorar = SO_NO_BANCO[tabela] ?? [];
  for (const [coluna, valor] of Object.entries(linha)) {
    if (valor === null || valor === undefined || ignorar.includes(coluna)) continue;
    registro[paraCamel(coluna)] = valorDoBanco(valor);
  }
  if (tabela === "professores") {
    registro.repasse = { modo: registro.repasseModo, valor: Number(registro.repasseValor) };
    delete registro.repasseModo;
    delete registro.repasseValor;
  }
  if (tabela === "auditoria") {
    return auditoriaDoBanco(registro) as T;
  }
  return registro as T;
}

/**
 * Um registro da tela -> uma linha do banco.
 *  - "inserir": campos vazios ficam de fora (o banco usa o padrao da coluna);
 *  - "atualizar": campos vazios viram `null` (apagar um telefone, por exemplo).
 */
export function paraBanco(
  tabela: TabelaDoBanco,
  registro: object,
  modo: "inserir" | "atualizar",
): Linha {
  const origem: Linha = { ...(registro as Linha) };
  if (tabela === "professores" && origem.repasse) {
    const regra = origem.repasse as { modo: string; valor: number };
    origem.repasseModo = regra.modo;
    origem.repasseValor = regra.valor;
    delete origem.repasse;
  }
  const linha: Linha = {};
  for (const [campo, valor] of Object.entries(origem)) {
    if (valor === undefined) continue;
    linha[paraSnake(campo)] = valorParaBanco(valor);
  }
  if (modo === "atualizar") {
    for (const coluna of COLUNAS_OPCIONAIS[tabela] ?? []) {
      if (!(coluna in linha)) linha[coluna] = null;
    }
  }
  return linha;
}

/**
 * Colunas que podem ficar vazias, por tabela. Ao atualizar um registro, a
 * ausencia do campo na tela significa "apagar o valor".
 */
const COLUNAS_OPCIONAIS: Partial<Record<TabelaDoBanco, string[]>> = {
  alunos: ["foto_url", "data_nascimento", "professor_principal_id", "categoria_ranking"],
  professores: ["telefone", "email"],
  colaboradores: ["professor_id"],
  comentarios: ["editado_em"],
  matriculas: ["fim"],
  congelamentos: ["fim_previsto", "fim_real"],
  horariosFixos: ["professor_id", "fim"],
  ocupacoes: [
    "professor_id", "horario_fixo_id", "motivo_cancelamento", "cancelada_em",
    "prazo_pagamento", "descricao",
  ],
  ocupacaoAlunos: ["sigla"],
  reposicoes: ["sigla", "ocupacao_origem_id", "ocupacao_uso_id", "validade", "observacao"],
  lancamentos: [
    "pessoa_id", "pessoa_tipo", "nome_pagante", "pago_em", "forma_pagamento",
    "valor_convenio", "comprovante", "competencia", "matricula_id", "ocupacao_id",
    "consumo_id", "torneio_id", "repasse_id", "movimento_estoque_id", "cancelado_em",
    "motivo_cancelamento",
  ],
  movimentosEstoque: ["observacao", "consumo_id"],
  torneios: ["categoria"],
  torneioInscritos: ["cabeca_de_chave", "grupo"],
  partidas: [
    "data", "placar", "vencedor", "ocupacao_id", "torneio_id", "inscricao_a_id",
    "inscricao_b_id", "fase", "rodada", "grupo", "ordem", "proxima_partida_id",
    "lado_na_proxima",
  ],
};

/** Nome da tabela no banco ("horarios_fixos") -> na tela ("horariosFixos"). */
const TABELAS_DA_TELA = new Map<string, TabelaDoBanco>();

export function registrarTabelas(tabelas: TabelaDoBanco[]): void {
  for (const t of tabelas) TABELAS_DA_TELA.set(paraSnake(t), t);
}

/**
 * Historico: o banco guarda a linha inteira (snake_case) antes e depois; a
 * tela mostra os campos com os nomes das telas.
 */
function auditoriaDoBanco(registro: Linha): RegistroAuditoria {
  const tabela = TABELAS_DA_TELA.get(String(registro.tabela)) ?? (registro.tabela as TabelaDoBanco);
  const converter = (foto: unknown) =>
    foto && typeof foto === "object" ? doBanco(tabela, foto as Linha) : undefined;
  return {
    id: String(registro.id),
    em: String(registro.em),
    usuarioId: String(registro.usuarioId ?? ""),
    // Sem usuario: rotinas do proprio banco (ex.: liberar reservas vencidas).
    usuarioNome: String(registro.usuarioNome ?? "Sistema"),
    tabela,
    registroId: String(registro.registroId ?? ""),
    acao: registro.acao as RegistroAuditoria["acao"],
    antes: converter(registro.antes),
    depois: converter(registro.depois),
    operacao: String(registro.operacao ?? ""),
  };
}

/** Banco vazio (antes do login, no modo Supabase). */
export function bancoVazio(configuracoes: Banco["configuracoes"]): Banco {
  return {
    colaboradores: [],
    configuracoes,
    auditoria: [],
    comentarios: [],
    quadras: [],
    professores: [],
    alunos: [],
    planos: [],
    matriculas: [],
    congelamentos: [],
    horariosFixos: [],
    horarioAlunos: [],
    ocupacoes: [],
    ocupacaoAlunos: [],
    reposicoes: [],
    lancamentos: [],
    repasses: [],
    produtos: [],
    movimentosEstoque: [],
    consumos: [],
    torneios: [],
    torneioInscritos: [],
    partidas: [],
  };
}
