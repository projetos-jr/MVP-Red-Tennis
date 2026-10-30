/**
 * Gera `supabase/seed.sql` com os mesmos dados de exemplo do front
 * (`src/lib/banco/semente/`), para carregar no Supabase.
 *
 *   npm run banco:seed
 *
 * As datas sao ancoradas no dia em que o arquivo e gerado: gere de novo
 * antes de carregar. Colaboradores nao entram (sao usuarios do Supabase
 * Auth, criados no painel) e a auditoria comeca vazia.
 *
 * O arquivo gerado fica fora do Git (e grande e muda todo dia).
 */

import { writeFileSync } from "node:fs";
import { gerarBancoInicial } from "../src/lib/banco/semente";
import type { Banco } from "../src/lib/banco/tipos";

const banco = gerarBancoInicial();

/** horariosFixos -> horarios_fixos */
function snake(nome: string): string {
  return nome.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

function texto(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

function valorSql(valor: unknown, coluna: string): string {
  // Campo ausente usa o padrao da coluna (ex.: wo = false).
  if (valor === undefined) return "default";
  if (valor === null) return "null";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") return texto(valor);
  // Listas de ids viram text[]; o resto (objetos, listas de objetos) vira jsonb.
  if (Array.isArray(valor) && COLUNAS_TEXT_ARRAY.has(coluna)) {
    return valor.length === 0 ? "'{}'::text[]" : `array[${valor.map((v) => texto(String(v))).join(", ")}]`;
  }
  return `${texto(JSON.stringify(valor))}::jsonb`;
}

const COLUNAS_TEXT_ARRAY = new Set(["alunos_ids", "lado_a", "lado_b"]);

/** Ajustes de formato entre o front e o banco, por tabela. */
const ADAPTAR: Partial<Record<keyof Banco, (registro: Record<string, unknown>) => Record<string, unknown>>> = {
  professores: ({ repasse, ...resto }) => {
    const regra = repasse as { modo: string; valor: number };
    return { ...resto, repasseModo: regra.modo, repasseValor: regra.valor };
  },
  // Os autores dos comentarios de exemplo nao sao usuarios do Supabase.
  comentarios: ({ autorId, ...resto }) => {
    void autorId;
    return resto;
  },
  // O vinculo com a proxima partida entra depois (a proxima pode vir depois na lista).
  partidas: ({ proximaPartidaId, ladoNaProxima, ...resto }) => {
    void proximaPartidaId;
    void ladoNaProxima;
    return resto;
  },
};

function inserir(tabela: keyof Banco, registros: object[]): string {
  if (registros.length === 0) return "";
  const adaptar = ADAPTAR[tabela] ?? ((r) => r);
  const linhas = registros.map((r) => adaptar({ ...(r as Record<string, unknown>) }));
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const partes: string[] = [];
  for (let i = 0; i < linhas.length; i += 500) {
    const valores = linhas
      .slice(i, i + 500)
      .map((l) => `(${colunas.map((c) => valorSql(l[c], snake(c))).join(", ")})`)
      .join(",\n  ");
    partes.push(
      `insert into public.${snake(tabela)} (${colunas.map(snake).join(", ")}) values\n  ${valores};`,
    );
  }
  return partes.join("\n");
}

const TABELAS_AUDITADAS = [
  "comentarios", "professores", "alunos", "planos", "matriculas", "congelamentos",
  "horarios_fixos", "horario_alunos", "ocupacoes", "ocupacao_alunos", "reposicoes",
  "produtos", "consumos", "movimentos_estoque", "torneios", "torneio_inscritos",
  "partidas", "repasses", "lancamentos", "configuracoes",
];

const c = banco.configuracoes;
const sql = [
  "-- Dados de exemplo gerados por scripts/gerar-seed.ts. Nao edite a mao.",
  `-- Gerado em ${new Date().toISOString()}. Datas ancoradas nesse dia.`,
  "set timezone = 'America/Sao_Paulo';",
  "begin;",
  "",
  "-- A carga de exemplo nao entra no historico de alteracoes.",
  ...TABELAS_AUDITADAS.map((t) => `alter table public.${t} disable trigger auditar;`),
  "",
  `update public.configuracoes set
  siglas = ${valorSql(c.siglas, "siglas")},
  validade_reposicao_meses = ${c.validadeReposicaoMeses},
  prazo_pagamento_reserva_horas = ${c.prazoPagamentoReservaHoras},
  liberar_reserva_automaticamente = ${c.liberarReservaAutomaticamente},
  semanas_geradas_a_frente = ${c.semanasGeradasAFrente},
  bloquear_professor_em_duas_aulas = ${c.bloquearProfessorEmDuasAulas},
  pontos_vitoria = ${c.pontosVitoria},
  pontos_derrota = ${c.pontosDerrota},
  torneio_conta_para_ranking = ${c.torneioContaParaRanking},
  classificados_por_grupo = ${c.classificadosPorGrupo},
  criterios_desempate = ${valorSql(c.criteriosDesempate, "")},
  formas_pagamento = ${valorSql(c.formasPagamento, "")},
  prazo_pagamento_consumo_dias = ${c.prazoPagamentoConsumoDias},
  preco_locacao_hora = ${c.precoLocacaoHora},
  preco_paredao_hora = ${c.precoParedaoHora},
  permissoes = ${valorSql(c.permissoes, "")}
where id = 1;`,
  "",
  inserir("professores", banco.professores),
  inserir("alunos", banco.alunos),
  inserir("planos", banco.planos),
  inserir("matriculas", banco.matriculas),
  inserir("congelamentos", banco.congelamentos),
  inserir("horariosFixos", banco.horariosFixos),
  inserir("horarioAlunos", banco.horarioAlunos),
  inserir("ocupacoes", banco.ocupacoes),
  inserir("ocupacaoAlunos", banco.ocupacaoAlunos),
  inserir("reposicoes", banco.reposicoes),
  inserir("produtos", banco.produtos),
  inserir("consumos", banco.consumos),
  // Na ordem do tempo: o banco confere que o estoque nunca fica negativo.
  inserir(
    "movimentosEstoque",
    [...banco.movimentosEstoque].sort((a, b) => a.data.localeCompare(b.data)),
  ),
  inserir("torneios", banco.torneios),
  inserir("torneioInscritos", banco.torneioInscritos),
  inserir("partidas", banco.partidas),
  ...banco.partidas
    .filter((p) => p.proximaPartidaId)
    .map(
      (p) =>
        `update public.partidas set proxima_partida_id = ${texto(p.proximaPartidaId!)}, lado_na_proxima = ${valorSql(p.ladoNaProxima, "")} where id = ${texto(p.id)};`,
    ),
  inserir("repasses", banco.repasses),
  inserir("lancamentos", banco.lancamentos),
  inserir("comentarios", banco.comentarios),
  "",
  ...TABELAS_AUDITADAS.map((t) => `alter table public.${t} enable trigger auditar;`),
  "commit;",
  "",
].join("\n");

writeFileSync("supabase/seed.sql", sql);
console.log(
  `supabase/seed.sql gerado: ${banco.alunos.length} alunos, ${banco.ocupacoes.length} ocupações, ` +
    `${banco.lancamentos.length} lançamentos, ${(sql.length / 1024 / 1024).toFixed(1)} MB.`,
);
