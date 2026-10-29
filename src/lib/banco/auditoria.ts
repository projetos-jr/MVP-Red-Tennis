/**
 * Auditoria automatica.
 *
 * Depois de cada operacao, compara o banco de antes com o de depois e grava
 * um registro para cada criacao, alteracao e exclusao — quem fez, quando,
 * como era e como ficou. E o mesmo papel do gatilho unico de auditoria do
 * banco real: nenhuma tela precisa lembrar de registrar nada.
 *
 * As operacoes nunca alteram objetos no lugar (sempre criam copias), entao
 * basta comparar referencias para achar o que mudou.
 */

import { novoId } from "./regras/comum";
import type {
  Banco,
  Colaborador,
  RegistroAuditoria,
  TabelaDeRegistros,
} from "./tipos";

/** Tabelas auditadas: todas, menos a propria auditoria. */
const TABELAS_AUDITADAS: Exclude<TabelaDeRegistros, "auditoria">[] = [
  "colaboradores",
  "comentarios",
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
  "lancamentos",
  "repasses",
  "produtos",
  "movimentosEstoque",
  "consumos",
  "torneios",
  "torneioInscritos",
  "partidas",
];

interface ComId {
  id: string;
}

export function registrosDeAuditoria(
  antes: Banco,
  depois: Banco,
  usuario: Pick<Colaborador, "id" | "nome">,
  operacao: string,
  em: string,
): RegistroAuditoria[] {
  const registros: RegistroAuditoria[] = [];

  const registrar = (
    tabela: RegistroAuditoria["tabela"],
    registroId: string,
    acao: RegistroAuditoria["acao"],
    valorAntes?: unknown,
    valorDepois?: unknown,
  ) => {
    registros.push({
      id: novoId("au"),
      em,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      tabela,
      registroId,
      acao,
      antes: valorAntes,
      depois: valorDepois,
      operacao,
    });
  };

  TABELAS_AUDITADAS.forEach((tabela) => {
    const listaAntes = antes[tabela] as ComId[];
    const listaDepois = depois[tabela] as ComId[];
    if (listaAntes === listaDepois) return;

    const porIdAntes = new Map(listaAntes.map((r) => [r.id, r]));
    const idsDepois = new Set<string>();

    listaDepois.forEach((registro) => {
      idsDepois.add(registro.id);
      const anterior = porIdAntes.get(registro.id);
      if (!anterior) registrar(tabela, registro.id, "criar", undefined, registro);
      else if (anterior !== registro) registrar(tabela, registro.id, "alterar", anterior, registro);
    });

    listaAntes.forEach((registro) => {
      if (!idsDepois.has(registro.id)) registrar(tabela, registro.id, "apagar", registro);
    });
  });

  if (antes.configuracoes !== depois.configuracoes) {
    registrar("configuracoes", "geral", "alterar", antes.configuracoes, depois.configuracoes);
  }

  return registros;
}
