/**
 * ============================================================================
 *  DADOS DE EXEMPLO — banco inicial da demonstracao
 * ============================================================================
 *  Monta o banco inteiro, modulo por modulo, na ordem em que um depende do
 *  outro. Tudo e deterministico (mesmos dados em todo carregamento) e ancorado
 *  em HOJE, para a demonstracao sempre parecer "em uso".
 *
 *  Cada modulo tem o seu arquivo de semente; quem trabalha num modulo mexe so
 *  no arquivo dele.
 * ============================================================================
 */

import type { Banco } from "../tipos";
import { gerarAgenda } from "./agenda";
import {
  COLABORADORES,
  CONFIGURACOES_INICIAIS,
  PLANOS,
  PROFESSORES,
  QUADRAS,
  gerarCadastros,
} from "./cadastros";
import { gerarComentarios } from "./comentarios";
import { gerarEstoque } from "./estoque";
import { gerarFinanceiro } from "./financeiro";
import { gerarRanking } from "./ranking";

export function gerarBancoInicial(): Banco {
  const cadastros = gerarCadastros();
  const agenda = gerarAgenda(cadastros.matriculas, cadastros.congelamentos);
  const ranking = gerarRanking(agenda.ocupacoes, agenda.ocupacaoAlunos);
  const estoque = gerarEstoque();
  const financeiro = gerarFinanceiro({
    alunos: cadastros.alunos,
    planos: PLANOS,
    matriculas: cadastros.matriculas,
    ocupacoes: agenda.ocupacoes,
    ocupacaoAlunos: agenda.ocupacaoAlunos,
    professores: PROFESSORES,
    torneios: ranking.torneios,
    torneioInscritos: ranking.torneioInscritos,
  });
  const lancamentos = [...financeiro.lancamentos, ...estoque.lancamentos].sort((a, b) =>
    b.vencimento.localeCompare(a.vencimento),
  );

  return {
    colaboradores: COLABORADORES,
    configuracoes: CONFIGURACOES_INICIAIS,
    auditoria: [],
    comentarios: gerarComentarios(
      cadastros.alunos,
      COLABORADORES,
      agenda.ocupacoes,
      lancamentos,
    ),
    quadras: QUADRAS,
    professores: PROFESSORES,
    alunos: cadastros.alunos,
    planos: PLANOS,
    matriculas: cadastros.matriculas,
    congelamentos: cadastros.congelamentos,
    horariosFixos: agenda.horariosFixos,
    horarioAlunos: agenda.horarioAlunos,
    ocupacoes: agenda.ocupacoes,
    ocupacaoAlunos: agenda.ocupacaoAlunos,
    reposicoes: agenda.reposicoes,
    lancamentos,
    repasses: financeiro.repasses,
    produtos: estoque.produtos,
    movimentosEstoque: estoque.movimentosEstoque,
    consumos: estoque.consumos,
    torneios: ranking.torneios,
    torneioInscritos: ranking.torneioInscritos,
    partidas: ranking.partidas,
  };
}

/** Banco com que toda sessao comeca. */
export const BANCO_INICIAL: Banco = gerarBancoInicial();
