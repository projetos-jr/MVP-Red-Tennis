/**
 * Leitura do banco real: traz as tabelas para o mesmo objeto `Banco` que as
 * telas ja usam (`src/lib/consultas/` nao muda).
 *
 * Cada perfil so recebe o que a RLS deixa: o professor, por exemplo, recebe a
 * lista de lancamentos vazia. A tela ja esconde o que o perfil nao enxerga.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Banco, Configuracoes, TabelaDoBanco } from "@/lib/banco/tipos";
import { doBanco, paraSnake, registrarTabelas } from "./conversao";
import { mensagemDoErro } from "./erros";

/** Todas as tabelas de registros, na ordem em que sao carregadas. */
export const TABELAS: Exclude<TabelaDoBanco, "configuracoes">[] = [
  "colaboradores",
  "quadras",
  "professores",
  "alunos",
  "planos",
  "matriculas",
  "congelamentos",
  "horariosFixos",
  "horarioAlunos",
  "ocupacoes",
  "ocupacaoAlunos",
  "reposicoes",
  "produtos",
  "consumos",
  "movimentosEstoque",
  "torneios",
  "torneioInscritos",
  "partidas",
  "repasses",
  "lancamentos",
  "comentarios",
  "auditoria",
];
registrarTabelas([...TABELAS, "configuracoes"]);

/**
 * Ordem de cada tabela (a mesma dos dados de exemplo, para as listas sairem
 * iguais nos dois modos). Sem ordem definida, vale o id.
 */
const ORDEM: Partial<Record<TabelaDoBanco, { coluna: string; crescente?: boolean }[]>> = {
  quadras: [{ coluna: "ordem" }],
  alunos: [{ coluna: "criado_em" }, { coluna: "id" }],
  ocupacoes: [{ coluna: "data" }, { coluna: "hora_inicio" }, { coluna: "quadra_id" }, { coluna: "id" }],
  reposicoes: [{ coluna: "criado_em" }, { coluna: "id" }],
  consumos: [{ coluna: "data" }, { coluna: "id" }],
  movimentosEstoque: [{ coluna: "data" }, { coluna: "id" }],
  torneios: [{ coluna: "criado_em" }, { coluna: "id" }],
  torneioInscritos: [{ coluna: "ordem_inscricao" }],
  partidas: [{ coluna: "criado_em" }, { coluna: "id" }],
  repasses: [{ coluna: "fechado_em" }, { coluna: "id" }],
  lancamentos: [{ coluna: "criado_em" }, { coluna: "id" }],
  comentarios: [{ coluna: "criado_em" }, { coluna: "id" }],
  // Historico: os mais recentes primeiro na busca (limite abaixo), devolvidos
  // em ordem do tempo.
  auditoria: [{ coluna: "id", crescente: false }],
};

/** O banco entrega no maximo 1.000 linhas por vez. */
const TAMANHO_DA_PAGINA = 1000;

/** Historico: so os registros mais recentes vao para a tela. */
const LIMITE_DO_HISTORICO = 5000;

async function lerTabela(cliente: SupabaseClient, tabela: TabelaDoBanco): Promise<unknown[]> {
  const nome = paraSnake(tabela);
  const ordem = ORDEM[tabela] ?? [{ coluna: "id" }];

  // Primeiro a primeira pagina com a contagem total; depois as demais
  // paginas em paralelo.
  const pagina = (inicio: number, fim: number, contar: boolean) => {
    let consulta = cliente.from(nome).select("*", contar ? { count: "exact" } : undefined);
    for (const { coluna, crescente = true } of ordem) {
      consulta = consulta.order(coluna, { ascending: crescente });
    }
    return consulta.range(inicio, fim);
  };

  const primeira = await pagina(0, TAMANHO_DA_PAGINA - 1, true);
  if (primeira.error) throw new Error(`${nome}: ${mensagemDoErro(primeira.error)}`);
  const total = Math.min(
    primeira.count ?? primeira.data.length,
    tabela === "auditoria" ? LIMITE_DO_HISTORICO : Infinity,
  );
  const demais = [];
  for (let inicio = TAMANHO_DA_PAGINA; inicio < total; inicio += TAMANHO_DA_PAGINA) {
    demais.push(pagina(inicio, Math.min(inicio + TAMANHO_DA_PAGINA, total) - 1, false));
  }
  const linhas = [primeira.data as Record<string, unknown>[]];
  for (const { data, error } of await Promise.all(demais)) {
    if (error) throw new Error(`${nome}: ${mensagemDoErro(error)}`);
    linhas.push(data as Record<string, unknown>[]);
  }

  const registros = linhas.flat().map((linha) => doBanco(tabela, linha));
  return tabela === "auditoria" ? registros.reverse() : registros;
}

async function lerConfiguracoes(cliente: SupabaseClient): Promise<Configuracoes> {
  const { data, error } = await cliente.from("configuracoes").select("*").eq("id", 1).single();
  if (error) throw new Error(`configuracoes: ${mensagemDoErro(error)}`);
  const { id, ...resto } = doBanco<Configuracoes & { id: number }>("configuracoes", data);
  void id;
  // Valores numericos chegam como numero; os do tipo numeric podem vir como texto.
  return {
    ...resto,
    precoLocacaoHora: Number(resto.precoLocacaoHora),
    precoParedaoHora: Number(resto.precoParedaoHora),
  };
}

/**
 * Le as tabelas pedidas (ou todas) em paralelo. Devolve so as tabelas lidas,
 * para juntar com o banco que a tela ja tem.
 */
export async function carregarTabelas(
  cliente: SupabaseClient,
  tabelas: TabelaDoBanco[] = [...TABELAS, "configuracoes"],
): Promise<Partial<Banco>> {
  const unicas = [...new Set(tabelas)];
  const lidas = await Promise.all(
    unicas.map(async (tabela) =>
      [tabela, tabela === "configuracoes" ? await lerConfiguracoes(cliente) : await lerTabela(cliente, tabela)] as const,
    ),
  );
  return Object.fromEntries(lidas) as Partial<Banco>;
}
