/**
 * Pecas comuns a todas as regras e operacoes.
 */

/**
 * Erro de regra de negocio: a operacao foi recusada e nada foi gravado.
 * A mensagem vai direto para a tela, entao deve ser clara para quem esta na
 * recepcao ("A quadra 2 já está ocupada...").
 *
 * No banco real, o equivalente e o erro devolvido por uma constraint ou por
 * uma funcao do Postgres.
 */
export class ErroDeRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeRegra";
  }
}

/** Recusa a operacao com `mensagem` se a condicao for falsa. */
export function exigir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new ErroDeRegra(mensagem);
}

let contadorDeIds = 0;

/** Id novo e unico na sessao, com um prefixo que diz de que tabela ele e. */
export function novoId(prefixo: string): string {
  contadorDeIds += 1;
  return `${prefixo}-${Date.now().toString(36)}${contadorDeIds.toString(36)}`;
}

/**
 * Dois intervalos de horario se sobrepoem? ("HH:mm", fim exclusivo.)
 * Uma aula que termina as 11:00 NAO conflita com outra que comeca as 11:00.
 */
export function sobrepoe(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  return inicioA < fimB && inicioB < fimA;
}
