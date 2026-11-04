"use client";

import { useMemo } from "react";
import { IconeMais } from "@/components/ui/Icons";
import { FAIXAS_HORARIAS } from "@/lib/banco/constantes";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import { DIAS_SEMANA_CURTO, diaDaSemana, paraData, somarDias } from "@/lib/date";
import { CartaoOcupacao, ContinuacaoOcupacao } from "./CartaoOcupacao";
import { canceladasPorChuva, celulasDoDia } from "./grade";
import { IconeChuva } from "./Icones";

/**
 * Agenda do celular: um dia por vez, em lista.
 *
 * As colunas da grade nao cabem numa tela estreita sem rolagem lateral. Aqui
 * o dia e escolhido numa regua no topo (os 2 dias da Diaria, ou os 7 dias da
 * semana nas visoes Quadra e Professor) e os horarios aparecem empilhados, da
 * abertura ao fechamento, com as faixas livres sinalizadas.
 */
export function ListaDoDia({
  datas,
  dia,
  aoTrocarDia,
  itens,
  hoje,
  aoAbrir,
  aoAdicionar,
}: {
  /** Datas da regua (2 na Diaria, 7 na semana). */
  datas: string[];
  dia: string;
  aoTrocarDia: (data: string) => void;
  itens: ItemAgenda[];
  hoje: string;
  aoAbrir: (item: ItemAgenda) => void;
  aoAdicionar?: (inicial: { data: string; horaInicio?: string }) => void;
}) {
  const celulas = useMemo(() => celulasDoDia(itens), [itens]);
  const ativos = itens.filter((i) => !i.cancelada).length;
  const chuva = canceladasPorChuva(itens);
  const passado = dia < hoje;
  const doisDias = datas.length <= 2;

  return (
    <div>
      <div
        className="flex gap-1.5 overflow-x-auto rolagem-suave border-b border-areia-200 px-3 py-3"
        role="group"
        aria-label="Escolher o dia"
      >
        {datas.map((data) => {
          const ativo = data === dia;
          const ehHoje = data === hoje;
          const nome =
            doisDias && ehHoje
              ? "Hoje"
              : doisDias && data === somarDias(hoje, 1)
                ? "Amanhã"
                : DIAS_SEMANA_CURTO[diaDaSemana(data)];
          return (
            <button
              key={data}
              type="button"
              onClick={() => aoTrocarDia(data)}
              aria-pressed={ativo}
              className={`flex min-w-[42px] flex-1 flex-col items-center rounded-xl px-1 py-1.5 transition-colors ${
                ativo
                  ? "bg-saibro-600 text-white"
                  : ehHoje
                    ? "bg-saibro-50 text-saibro-800"
                    : "bg-areia-100 text-areia-700"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase">{nome}</span>
              <span className="font-display text-lg font-semibold leading-tight">
                {paraData(data).getUTCDate()}
                {doisDias && `/${String(paraData(data).getUTCMonth() + 1).padStart(2, "0")}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-areia-200 px-4 py-2">
        <p className="text-sm text-areia-600">
          <strong className="font-semibold text-areia-900">{ativos}</strong>{" "}
          {ativos === 1 ? "horário" : "horários"} neste dia
          {chuva > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
              <IconeChuva className="h-3 w-3" />
              Chuva
            </span>
          )}
        </p>
        {aoAdicionar && !passado && (
          <button
            type="button"
            onClick={() => aoAdicionar({ data: dia })}
            className="btn-primario px-3 py-2 text-xs"
          >
            <IconeMais className="h-4 w-4" />
            Marcar
          </button>
        )}
      </div>

      <ul className="divide-y divide-areia-100">
        {FAIXAS_HORARIAS.map((faixa) => {
          const celula = celulas.get(faixa);
          const vazio = !celula || (celula.comecam.length === 0 && celula.continuam.length === 0);
          return (
            <li key={faixa} className="flex gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 pt-1 font-display text-base font-semibold tabular-nums text-areia-800">
                {faixa}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                {celula?.continuam.map((item) => (
                  <ContinuacaoOcupacao key={item.ocupacao.id} item={item} aoAbrir={aoAbrir} />
                ))}
                {celula?.comecam.map((item) => (
                  <CartaoOcupacao key={item.ocupacao.id} item={item} aoAbrir={aoAbrir} />
                ))}
                {vazio &&
                  (aoAdicionar && !passado ? (
                    <button
                      type="button"
                      onClick={() => aoAdicionar({ data: dia, horaInicio: faixa })}
                      className="alvo-de-toque flex w-full items-center gap-2 rounded-lg border border-dashed border-areia-300 px-3 py-2 text-left text-xs text-areia-600 transition-colors hover:border-saibro-300 hover:text-saibro-700"
                    >
                      <IconeMais className="h-3.5 w-3.5" />
                      Livre
                    </button>
                  ) : (
                    <p className="px-3 py-2 text-xs text-areia-500">Livre</p>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
