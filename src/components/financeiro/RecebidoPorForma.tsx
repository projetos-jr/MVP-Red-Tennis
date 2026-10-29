"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { IconeFinanceiro } from "@/components/ui/Icons";
import { nomeDoMes, type RecebidoPorFormas } from "@/lib/consultas/financeiro";
import { formatarMoeda } from "@/lib/theme";

/**
 * Relatório simples do mês: o recebido dividido por forma de pagamento.
 * Uma cor só (a barra é a fatia do total); cada linha tem o nome, o valor,
 * a porcentagem e a quantidade escritos, então nada depende da cor.
 */
export function RecebidoPorForma({ dados, mes }: { dados: RecebidoPorFormas; mes: string }) {
  return (
    <Card>
      <CardHeader
        titulo={`Recebido por forma de pagamento · ${nomeDoMes(mes)}`}
        descricao="O mesmo total do cartão “Recebido”, dividido pela forma de pagamento."
        icone={<IconeFinanceiro className="h-5 w-5" />}
      />
      <div className="space-y-5 p-5">
        {dados.quantidade === 0 ? (
          <p className="text-sm text-areia-500">Nenhum pagamento recebido neste mês.</p>
        ) : (
          <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
            {dados.formas.map((item) => {
              const porcentagem = Math.round(item.participacao * 100);
              return (
                <li key={item.forma}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-areia-800">{item.forma}</span>
                    <span className="text-sm font-semibold tabular-nums text-areia-900">
                      {formatarMoeda(item.valor)}
                      <span className="ml-2 text-xs font-normal text-areia-500">{porcentagem}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full rounded-r-[4px] bg-saibro-100" aria-hidden="true">
                    <div
                      className="h-full rounded-r-[4px] bg-saibro-600"
                      style={{ width: `${item.participacao * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-areia-500">
                    {item.quantidade} {item.quantidade === 1 ? "pagamento" : "pagamentos"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-1 rounded-xl border border-areia-200 bg-areia-50 px-4 py-3 text-sm text-areia-700">
          <span>
            Total recebido{" "}
            <strong className="font-semibold text-areia-900">{formatarMoeda(dados.total)}</strong>{" "}
            em {dados.quantidade} {dados.quantidade === 1 ? "pagamento" : "pagamentos"}
          </span>
          <span>
            Parte coberta por convênio{" "}
            <strong className="font-semibold text-areia-900">
              {formatarMoeda(dados.convenio.valor)}
            </strong>{" "}
            em {dados.convenio.quantidade}{" "}
            {dados.convenio.quantidade === 1 ? "pagamento" : "pagamentos"} (só registro, sem
            integração)
          </span>
        </div>
      </div>
    </Card>
  );
}
