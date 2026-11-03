/**
 * Mensagens de erro do banco em linguagem da tela.
 *
 * As funcoes do banco recusam com a mesma mensagem que a tela ja mostra
 * (codigo P0001): essa passa direto. Os outros codigos sao das regras das
 * tabelas (constraints) e da seguranca (RLS).
 */

interface ErroDoPostgres {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

const POR_CODIGO: Record<string, string> = {
  // Exclusion constraint: duas ocupacoes na mesma quadra e horario, ou duas
  // matriculas vigentes do mesmo aluno.
  "23P01": "Conflito: já existe outro registro ocupando esse mesmo período.",
  "23505": "Já existe um registro igual a este.",
  "23503": "Este registro está ligado a outro que não existe mais (ou que ainda é usado).",
  "23514": "Um dos valores não é aceito pelas regras do banco.",
  "23502": "Falta preencher um campo obrigatório.",
  "22P02": "Um dos valores está num formato inválido.",
  "22008": "Uma das datas é inválida.",
  "42501": "Seu perfil não tem permissão para esta operação.",
  PGRST301: "Sua sessão expirou. Entre de novo.",
  PGRST303: "Sua sessão expirou. Entre de novo.",
};

export function mensagemDoErro(erro: ErroDoPostgres | Error | unknown): string {
  if (!erro || typeof erro !== "object") return "Não foi possível falar com o banco. Tente de novo.";
  const { code, message } = erro as ErroDoPostgres;
  if (code === "P0001" && message) return message;
  if (code === "23P01" && message?.includes("ocupacoes_sem_conflito")) {
    return "Conflito de horário: a quadra já está ocupada nesse período. Atualize a agenda e tente outro horário.";
  }
  if (code && POR_CODIGO[code]) return POR_CODIGO[code];
  if (message && /fetch|network|Failed to fetch|NetworkError/i.test(message)) {
    return "Sem conexão com o banco. Confira a internet e tente de novo.";
  }
  return message ? `O banco recusou a gravação: ${message}` : "Não foi possível falar com o banco. Tente de novo.";
}

/** Erro com mensagem pronta para a tela. */
export class ErroDoBanco extends Error {}
