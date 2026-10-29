/**
 * ============================================================================
 *  CONSULTAS — camada de leitura do modelo novo
 * ============================================================================
 *  As telas leem o banco por funcoes daqui, nunca filtrando tabelas direto no
 *  componente. Cada modulo tem o seu arquivo (`agenda.ts`, `alunos.ts`...);
 *  este reune o que todos usam. Toda funcao recebe o `banco` (de
 *  `useApp().banco`) como primeiro parametro.
 *
 *  Quando o Supabase entrar, estas funcoes passam a buscar do banco real e as
 *  telas nao mudam.
 * ============================================================================
 */

import type {
  Aluno,
  Banco,
  Colaborador,
  Comentario,
  EntidadeComentavel,
  ModuloSistema,
  Professor,
  RegistroAuditoria,
  TabelaDoBanco,
} from "../banco/tipos";

export { rotuloDaQuadra } from "../banco/regras/agenda";

export function buscarAluno(banco: Banco, id: string): Aluno | undefined {
  return banco.alunos.find((a) => a.id === id);
}

export function buscarProfessor(banco: Banco, id: string): Professor | undefined {
  return banco.professores.find((p) => p.id === id);
}

/** Nome de um aluno, professor ou colaborador pelo id. */
export function nomeDaPessoa(banco: Banco, id: string | undefined): string {
  if (!id) return "—";
  return (
    banco.alunos.find((a) => a.id === id)?.nome ??
    banco.professores.find((p) => p.id === id)?.nome ??
    banco.colaboradores.find((c) => c.id === id)?.nome ??
    "Registro removido"
  );
}

/** "Ana Beatriz Moraes" -> "Ana Moraes" (usado onde o espaco e curto). */
export function nomeCompacto(nomeCompleto: string): string {
  const partes = nomeCompleto.split(" ");
  if (partes.length <= 2) return nomeCompleto;
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/** Comentarios de um registro, do mais recente para o mais antigo. */
export function comentariosDe(
  banco: Banco,
  entidade: EntidadeComentavel,
  entidadeId: string,
): Comentario[] {
  return banco.comentarios
    .filter((c) => c.entidade === entidade && c.entidadeId === entidadeId)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Historico de alteracoes de um registro, do mais recente para o mais antigo. */
export function historicoDoRegistro(
  banco: Banco,
  tabela: TabelaDoBanco,
  registroId: string,
): RegistroAuditoria[] {
  return banco.auditoria
    .filter((r) => r.tabela === tabela && r.registroId === registroId)
    .sort((a, b) => b.em.localeCompare(a.em));
}

/** O perfil do colaborador enxerga o modulo? (Hipotese H9, editavel nas Configuracoes.) */
export function podeAcessar(
  banco: Banco,
  colaborador: Colaborador,
  modulo: ModuloSistema,
): boolean {
  return banco.configuracoes.permissoes[colaborador.perfil]?.includes(modulo) ?? false;
}
