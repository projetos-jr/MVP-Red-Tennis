"use client";

import { lerInteiro } from "./formatos";

/**
 * Campo de quantidade com botoes − e +, bom de usar no tablet.
 * O valor fica como texto para a pessoa poder apagar e digitar de novo;
 * quem usa le o numero com `lerInteiro`.
 *
 * O rotulo nao envolve o campo (como no `Campo`): os botoes ficariam dentro
 * do <label> e um clique no texto acionaria o "−".
 */
export function CampoQuantidade({
  id,
  rotulo,
  valor,
  aoMudar,
  minimo = 1,
  maximo,
  ajuda,
  erro,
  obrigatorio,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  minimo?: number;
  maximo?: number;
  ajuda?: string;
  erro?: string;
  obrigatorio?: boolean;
}) {
  const numero = lerInteiro(valor);
  const atual = Number.isNaN(numero) ? minimo - 1 : numero;

  function mudarPor(passo: number) {
    let proximo = Math.max(minimo, atual + passo);
    if (maximo !== undefined) proximo = Math.min(maximo, proximo);
    aoMudar(String(proximo));
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-areia-800">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-tijolo-600">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => mudarPor(-1)}
          disabled={atual <= minimo}
          className="btn-secundario h-11 w-11 shrink-0 p-0 text-lg"
          aria-label={`Diminuir ${rotulo.toLowerCase()}`}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={minimo}
          max={maximo}
          step={1}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          aria-invalid={Boolean(erro)}
          className="campo text-center text-lg font-semibold tabular-nums"
        />
        <button
          type="button"
          onClick={() => mudarPor(1)}
          disabled={maximo !== undefined && atual >= maximo}
          className="btn-secundario h-11 w-11 shrink-0 p-0 text-lg"
          aria-label={`Aumentar ${rotulo.toLowerCase()}`}
        >
          +
        </button>
      </div>
      {erro ? (
        <span className="mt-1 block text-xs font-medium text-tijolo-700">{erro}</span>
      ) : (
        ajuda && <span className="mt-1 block text-xs text-areia-500">{ajuda}</span>
      )}
    </div>
  );
}
