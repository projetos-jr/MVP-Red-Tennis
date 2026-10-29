import { comSinal } from "./formatos";

/**
 * Quadro "saldo atual → saldo depois" dos formularios de movimento, para a
 * pessoa conferir o efeito antes de gravar.
 */
export function ResumoDoSaldo({
  saldoAtual,
  saldoDepois,
  estoqueMinimo,
  extra,
}: {
  saldoAtual: number;
  /** Vazio enquanto a quantidade digitada nao for valida. */
  saldoDepois?: number;
  estoqueMinimo: number;
  extra?: { rotulo: string; valor: string };
}) {
  const abaixo = saldoDepois !== undefined && saldoDepois < estoqueMinimo;
  return (
    <dl className="space-y-1 rounded-xl bg-areia-50 px-3.5 py-3 text-sm">
      <div className="flex items-center justify-between text-areia-600">
        <dt>Saldo atual</dt>
        <dd className="font-semibold tabular-nums text-areia-800">{saldoAtual}</dd>
      </div>
      <div className="flex items-center justify-between text-areia-600">
        <dt>Saldo depois</dt>
        <dd
          className={`font-semibold tabular-nums ${
            saldoDepois === undefined
              ? "text-areia-400"
              : abaixo
                ? "text-tijolo-700"
                : "text-emerald-700"
          }`}
        >
          {saldoDepois === undefined ? (
            "—"
          ) : (
            <>
              {saldoDepois}
              <span className="ml-1.5 text-xs font-medium">
                ({comSinal(saldoDepois - saldoAtual)}
                {abaixo ? " · abaixo do mínimo" : ""})
              </span>
            </>
          )}
        </dd>
      </div>
      {extra && (
        <div className="flex items-center justify-between text-areia-500">
          <dt>{extra.rotulo}</dt>
          <dd className="font-medium tabular-nums">{extra.valor}</dd>
        </div>
      )}
    </dl>
  );
}
