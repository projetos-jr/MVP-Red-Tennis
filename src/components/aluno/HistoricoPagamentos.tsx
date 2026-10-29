"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeCheck, IconeFinanceiro } from "@/components/ui/Icons";
import type { PagamentoDoAluno, PagamentosDoAluno } from "@/lib/consultas/alunos";
import { formatarData } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { ESTILO_SITUACAO_LANCAMENTO, estiloDaForma } from "./estilos";

const POR_PAGINA = 10;

/**
 * Cobrancas do aluno (a receber, menos o consumo do balcao), com a situacao
 * calculada pelo vencimento, quem pagou e a forma de pagamento.
 */
export function HistoricoPagamentos({ pagamentos }: { pagamentos: PagamentosDoAluno }) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const { lista, totalPago, emAberto, emAtraso } = pagamentos;
  const visiveis = lista.slice(0, limite);

  return (
    <Card>
      <CardHeader
        titulo="Pagamentos"
        descricao="Mensalidades, locações e inscrições do aluno. O consumo do balcão tem bloco próprio."
        icone={<IconeFinanceiro className="h-5 w-5" />}
      />

      <dl className="grid grid-cols-3 gap-px border-b border-areia-200 bg-areia-200">
        <Total rotulo="Pago" valor={totalPago} />
        <Total rotulo="Em aberto" valor={emAberto} classeValor={emAberto > 0 ? "text-amber-700" : undefined} />
        <Total rotulo="Em atraso" valor={emAtraso} classeValor={emAtraso > 0 ? "text-tijolo-700" : undefined} />
      </dl>

      {/* Celular */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {visiveis.map((pagamento) => (
          <li
            key={pagamento.lancamento.id}
            className={`px-4 py-3 ${pagamento.situacao === "cancelado" ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-areia-900">{pagamento.lancamento.item}</p>
                <p className="mt-0.5 text-xs text-areia-500">
                  Vence {formatarData(pagamento.lancamento.vencimento)}
                  {pagamento.lancamento.nomePagante && ` · ${pagamento.lancamento.nomePagante}`}
                </p>
              </div>
              <Valor pagamento={pagamento} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Situacao pagamento={pagamento} />
              <Forma pagamento={pagamento} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rolagem-suave md:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
              <th scope="col" className="px-5 py-2.5 font-medium">Vencimento</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Item</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Quem pagou</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Forma</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-areia-100">
            {visiveis.map((pagamento) => (
              <tr
                key={pagamento.lancamento.id}
                className={`align-top hover:bg-areia-50 ${pagamento.situacao === "cancelado" ? "opacity-60" : ""}`}
              >
                <td className="whitespace-nowrap px-5 py-2.5 font-medium tabular-nums text-areia-800">
                  {formatarData(pagamento.lancamento.vencimento)}
                </td>
                <td className="px-3 py-2.5 text-areia-700">
                  {pagamento.lancamento.item}
                  {/* A categoria so aparece quando o item nao comeca por ela. */}
                  {!pagamento.lancamento.item.startsWith(pagamento.lancamento.categoria) && (
                    <span className="block text-xs text-areia-500">{pagamento.lancamento.categoria}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-areia-600">{pagamento.lancamento.nomePagante ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <Forma pagamento={pagamento} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <Valor pagamento={pagamento} />
                </td>
                <td className="px-5 py-2.5">
                  <Situacao pagamento={pagamento} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lista.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-areia-500">Nenhuma cobrança registrada.</p>
      )}

      {lista.length > limite && (
        <button
          type="button"
          onClick={() => setLimite(limite + POR_PAGINA)}
          className="w-full border-t border-areia-200 px-5 py-3 text-sm font-medium text-saibro-700 hover:bg-areia-50"
        >
          Ver mais ({lista.length - limite} restantes)
        </button>
      )}
    </Card>
  );
}

function Total({ rotulo, valor, classeValor }: { rotulo: string; valor: number; classeValor?: string }) {
  return (
    <div className="bg-white px-4 py-3 sm:px-5">
      <dt className="text-xs font-medium uppercase tracking-wide text-areia-500">{rotulo}</dt>
      <dd className={`mt-1 text-base font-bold tabular-nums sm:text-lg ${classeValor ?? "text-areia-900"}`}>
        {formatarMoeda(valor)}
      </dd>
    </div>
  );
}

function Valor({ pagamento }: { pagamento: PagamentoDoAluno }) {
  return (
    <span
      className={`shrink-0 text-sm font-semibold tabular-nums text-areia-900 ${
        pagamento.situacao === "cancelado" ? "line-through" : ""
      }`}
    >
      {formatarMoeda(pagamento.lancamento.valor)}
    </span>
  );
}

function Situacao({ pagamento }: { pagamento: PagamentoDoAluno }) {
  const estilo = ESTILO_SITUACAO_LANCAMENTO[pagamento.situacao];
  const { lancamento } = pagamento;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
        {pagamento.situacao === "pago" && <IconeCheck className="h-3.5 w-3.5" />}
        {estilo.rotulo}
        {pagamento.diasEmAtraso > 0 && ` · ${pagamento.diasEmAtraso}d`}
      </Badge>
      {lancamento.pagoEm && pagamento.situacao === "pago" && (
        <span className="whitespace-nowrap text-[11px] text-areia-500">
          em {formatarData(lancamento.pagoEm)}
        </span>
      )}
      {lancamento.canceladoEm && lancamento.motivoCancelamento && (
        <span className="text-[11px] text-areia-500">{lancamento.motivoCancelamento}</span>
      )}
    </span>
  );
}

function Forma({ pagamento }: { pagamento: PagamentoDoAluno }) {
  const { formaPagamento, valorConvenio, valor } = pagamento.lancamento;
  if (!formaPagamento) return <span className="text-areia-300">—</span>;
  const estilo = estiloDaForma(formaPagamento);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge cor={estilo.cor} fundo={estilo.fundo} title={estilo.detalhe}>
        {formaPagamento}
      </Badge>
      {valorConvenio !== undefined && (
        <span className="text-[11px] text-areia-500">
          Convênio {formatarMoeda(valorConvenio)} + complemento {formatarMoeda(valor - valorConvenio)}
        </span>
      )}
    </span>
  );
}
