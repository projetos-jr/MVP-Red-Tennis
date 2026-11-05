"use client";

import { IconeFinanceiro } from "@/components/ui/Icons";
import { nomeDoMes, type RecebidoPorFormas } from "@/lib/consultas/financeiro";
import { formatarMoeda } from "@/lib/theme";
import { SecaoRecolhida } from "./SecaoRecolhida";

/**
 * Relatório simples do mês: o recebido dividido por forma de pagamento.
 * Começa fechado ("Ver por forma de pagamento"): é apoio, não é do dia a dia.
 * Uma cor só (a barra é a fatia do total); cada linha tem o nome, o valor,
 * a porcentagem e a quantidade escritos, então nada depende da cor.
 */
export function RecebidoPorForma({ dados, mes }: { dados: RecebidoPorFormas; mes: string }) {
  return (
    <SecaoRecolhida
      titulo="Ver por forma de pagamento"
      resumo={
        dados.quantidade === 0
          ? `Nada recebido em ${nomeDoMes(mes)}.`
          : `${formatarMoeda(dados.total)} recebidos em ${nomeDoMes(mes)} (o total do cartão “Recebido”).`
      }
      icone={<IconeFinanceiro className="h-5 w-5" />}
    >
      <div className="space-y-5 p-4 sm:p-5">
        {dados.quantidade === 0 ? (
          <p className="text-base text-areia-600">Nenhum pagamento recebido neste mês.</p>
        ) : (
          <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2">
            {dados.formas.map((item) => {
              const porcentagem = Math.round(item.participacao * 100);
              return (
                <li key={item.forma}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-semibold text-areia-800">{item.forma}</span>
                    <span className="text-base font-bold tabular-nums text-areia-900">
                      {formatarMoeda(item.valor)}
                      <span className="ml-2 text-sm font-normal text-areia-600">{porcentagem}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 w-full rounded-r-[4px] bg-saibro-100" aria-hidden="true">
                    <div
                      className="h-full rounded-r-[4px] bg-saibro-600"
                      style={{ width: `${item.participacao * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-areia-600">
                    {item.quantidade} {item.quantidade === 1 ? "pagamento" : "pagamentos"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-1 rounded-xl border border-areia-200 bg-areia-50 px-4 py-3 text-base text-areia-700">
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
    </SecaoRecolhida>
  );
}
