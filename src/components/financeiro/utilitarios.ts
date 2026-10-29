/**
 * Ajudantes da tela do financeiro (sem regra de negócio: as regras ficam em
 * `src/lib/banco/regras/financeiro.ts`).
 */

/**
 * Valor digitado -> número. Aceita como se escreve no Brasil ("1.234,56",
 * "63,5") e com ponto ("63.5"). Vazio vira `undefined`; texto inválido vira
 * NaN, e a operação recusa com a mensagem certa.
 */
export function lerValor(texto: string): number | undefined {
  const limpo = texto.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!limpo) return undefined;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return Number(normalizado);
}

/** Baixa um texto como arquivo (a planilha CSV), sem passar por servidor. */
export function baixarArquivo(nome: string, conteudo: string, tipo: string): void {
  const arquivo = new Blob([conteudo], { type: tipo });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Alguns navegadores ainda leem o endereço logo depois do clique.
  window.setTimeout(() => URL.revokeObjectURL(endereco), 1000);
}
