/**
 * Gera `supabase/seed.sql` com os dados de demonstracao do MVP.
 *
 * Os dados vem de `src/lib/mock-data.ts`, ancorados na data em que o script
 * roda. Uso: `npx tsx scripts/gerar-seed.ts`.
 */
import { writeFileSync } from "node:fs";
import {
  ALUNOS,
  CONSUMOS,
  DIAS_COM_CHUVA,
  HORARIOS,
  IDS_INSCRITOS_RANKING,
  MENSALIDADE_POR_ALUNO,
  MOVIMENTOS_ESTOQUE,
  PAGAMENTOS,
  PRODUTOS,
  PROFESSORES,
  TORNEIOS,
} from "../src/lib/mock-data";

type Valor = string | number | boolean | null | undefined;

function sql(valor: Valor): string {
  if (valor === null || valor === undefined) return "null";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "true" : "false";
  return `'${valor.replace(/'/g, "''")}'`;
}

/** "YYYY-MM-DDTHH:mm" no fuso da arena -> timestamptz. */
function carimbo(local: string): string {
  return sql(`${local}:00-03:00`);
}

function inserir(tabela: string, colunas: string[], linhas: string[][]): string {
  if (linhas.length === 0) return "";
  const partes: string[] = [];
  // Lotes de 200 linhas para manter cada comando em tamanho razoavel.
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200).map((l) => `  (${l.join(", ")})`);
    partes.push(
      `insert into public.${tabela} (${colunas.join(", ")}) values\n${lote.join(",\n")};`,
    );
  }
  return partes.join("\n\n");
}

const idProfessor = new Map(PROFESSORES.map((p) => [p.nome, p.id]));
const professorId = (nome: string) => idProfessor.get(nome) ?? null;
const inscritos = new Set(IDS_INSCRITOS_RANKING);

const blocos: string[] = [
  "-- Dados de demonstracao gerados por scripts/gerar-seed.ts.\n-- Apague antes de usar o sistema com dados reais.",
  inserir(
    "professores",
    ["id", "nome", "cor", "especialidade", "valor_hora_aula"],
    PROFESSORES.map((p) => [sql(p.id), sql(p.nome), sql(p.cor), sql(p.especialidade), sql(p.valorHoraAula)]),
  ),
  inserir(
    "alunos",
    [
      "id", "nome", "avatar_url", "telefone", "email", "plano", "mensalidade", "data_inicio",
      "professor_principal_id", "saldo_minutos_reposicao", "validade_reposicao", "plano_congelado",
      "motivo_congelamento", "inscrito_ranking", "ranking_pontuacao", "categoria_ranking", "variacao_ranking",
    ],
    ALUNOS.map((a) => [
      sql(a.id), sql(a.nome), sql(a.avatarUrl), sql(a.telefone), sql(a.email), sql(a.plano),
      sql(MENSALIDADE_POR_ALUNO[a.id] ?? 0), sql(a.dataInicio), sql(professorId(a.professorPrincipal)),
      sql(a.saldoMinutosReposicao), sql(a.validadeReposicao), sql(a.planoCongelado),
      sql(a.motivoCongelamento), sql(inscritos.has(a.id)), sql(a.rankingPontuacao),
      sql(a.categoriaRanking), sql(a.variacaoRanking),
    ]),
  ),
  inserir(
    "aulas",
    ["aluno_id", "data", "quadra_id", "professor_id", "horario", "status", "motivo_falta", "minutos_repostos"],
    ALUNOS.flatMap((a) =>
      a.historicoAulas.map((h) => [
        sql(a.id), sql(h.data), sql(String(h.quadra)), sql(professorId(h.professor)), sql(h.horario),
        sql(h.status), sql(h.motivoFalta), sql(h.minutosRepostos),
      ]),
    ),
  ),
  inserir(
    "comentarios",
    ["id", "aluno_id", "criado_em", "autor", "autor_id", "texto"],
    ALUNOS.flatMap((a) =>
      a.comentarios.map((c) => [sql(c.id), sql(a.id), carimbo(c.data), sql(c.autor), "null", sql(c.texto)]),
    ),
  ),
  inserir(
    "horarios",
    ["id", "quadra_id", "dia_semana", "hora_inicio", "hora_fim", "tipo", "professor_id"],
    HORARIOS.map((h) => [
      sql(h.id), sql(String(h.quadra)), sql(h.diaSemana), sql(h.horaInicio), sql(h.horaFim),
      sql(h.tipo), sql(professorId(h.professor)),
    ]),
  ),
  inserir(
    "horario_alunos",
    ["horario_id", "aluno_id", "ordem"],
    HORARIOS.flatMap((h) => h.alunosIds.map((id, ordem) => [sql(h.id), sql(id), sql(ordem)])),
  ),
  inserir(
    "dias_sem_aula",
    ["data", "motivo"],
    DIAS_COM_CHUVA.map((d) => [sql(d), sql("CH")]),
  ),
  inserir(
    "pagamentos",
    [
      "id", "aluno_id", "data", "data_limite", "data_compensacao", "nome_pagante", "item", "valor",
      "forma_pagamento", "status", "valor_total_pass", "participantes_confirmados",
    ],
    PAGAMENTOS.map((p) => {
      // No mock, um pagamento pendente compensa 7 dias depois do prazo.
      const limite = p.status === "pendente"
        ? `(${sql(p.dataCompensacao)}::date - 7)`
        : sql(p.dataCompensacao);
      return [
        sql(p.id), sql(p.alunoId), sql(p.data), limite, sql(p.dataCompensacao), sql(p.nomePagante),
        sql(p.item), sql(p.valor), sql(p.formaPagamento), sql(p.status), sql(p.valorTotalPass),
        sql(p.participantesConfirmados),
      ];
    }),
  ),
  inserir(
    "torneios",
    ["id", "nome", "data", "formato", "inscritos", "status"],
    TORNEIOS.map((t) => [sql(t.id), sql(t.nome), sql(t.data), sql(t.formato), sql(t.inscritos), sql(t.status)]),
  ),
  inserir(
    "produtos",
    ["id", "nome", "categoria", "unidade", "preco_custo", "preco_venda", "quantidade", "estoque_minimo", "ultima_entrada"],
    PRODUTOS.map((p) => [
      sql(p.id), sql(p.nome), sql(p.categoria), sql(p.unidade), sql(p.precoCusto), sql(p.precoVenda),
      sql(p.quantidade), sql(p.estoqueMinimo), sql(p.ultimaEntrada),
    ]),
  ),
  // O saldo dos produtos ja reflete os movimentos historicos: o gatilho que
  // atualiza o estoque fica desligado durante a carga.
  "alter table public.movimentos_estoque disable trigger movimentos_estoque_aplicar;",
  inserir(
    "movimentos_estoque",
    ["id", "produto_id", "criado_em", "tipo", "quantidade", "responsavel", "observacao"],
    MOVIMENTOS_ESTOQUE.map((m) => [
      sql(m.id), sql(m.produtoId), carimbo(m.data), sql(m.tipo), sql(m.quantidade), sql(m.responsavel),
      sql(m.observacao),
    ]),
  ),
  "alter table public.movimentos_estoque enable trigger movimentos_estoque_aplicar;",
  inserir(
    "consumos",
    ["id", "aluno_id", "professor_id", "criado_em", "produto_id", "produto_nome", "quantidade", "valor_unitario", "status"],
    CONSUMOS.map((c) => [
      sql(c.id), sql(c.tipoPessoa === "aluno" ? c.pessoaId : null),
      sql(c.tipoPessoa === "professor" ? c.pessoaId : null), carimbo(c.data), sql(c.produtoId),
      sql(c.produtoNome), sql(c.quantidade), sql(c.valorUnitario), sql(c.status),
    ]),
  ),
];

writeFileSync("supabase/seed.sql", blocos.filter(Boolean).join("\n\n") + "\n");
console.log("supabase/seed.sql gerado.");
