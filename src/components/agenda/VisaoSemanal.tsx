"use client";

import { useMemo } from "react";
import { IconeMais } from "@/components/ui/Icons";
import { FAIXAS_HORARIAS } from "@/lib/banco/constantes";
import type { ItemAgenda } from "@/lib/consultas/agenda";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarDiaMes, horaParaMinutos } from "@/lib/date";
import { ChipOcupacao, ContinuacaoOcupacao } from "./CartaoOcupacao";
import { IconeChuva } from "./Icones";

interface Celula {
  /** Horarios que comecam nesta faixa de 1 h. */
  comecam: ItemAgenda[];
  /** Horarios que comecaram antes e ainda ocupam esta faixa. */
  continuam: ItemAgenda[];
}

/** Distribui os horarios do dia nas faixas de 1 h da grade. */
export function celulasDoDia(itens: ItemAgenda[]): Map<string, Celula> {
  const celulas = new Map<string, Celula>(
    FAIXAS_HORARIAS.map((faixa) => [faixa, { comecam: [], continuam: [] }]),
  );
  itens.forEach((item) => {
    const inicio = horaParaMinutos(item.ocupacao.horaInicio);
    const fim = horaParaMinutos(item.ocupacao.horaFim);
    FAIXAS_HORARIAS.forEach((faixa) => {
      const comeco = horaParaMinutos(faixa);
      const celula = celulas.get(faixa);
      if (!celula) return;
      if (inicio >= comeco && inicio < comeco + 60) celula.comecam.push(item);
      else if (inicio < comeco && fim > comeco) celula.continuam.push(item);
    });
  });
  return celulas;
}

/** Quantas ocupacoes do dia foram canceladas por chuva (CH). */
export function canceladasPorChuva(itens: ItemAgenda[]): number {
  return itens.filter((i) => i.cancelada && i.ocupacao.motivoCancelamento === "CH").length;
}

const COLUNAS = "58px repeat(7, minmax(0, 1fr))";

/**
 * Grade semanal no estilo do MVP: dias x faixas de 1 h (07h as 22h), agora
 * com as ocupacoes de cada DATA. Horarios mais longos que 1 h aparecem na
 * faixa em que comecam e deixam uma marca nas faixas seguintes.
 */
export function VisaoSemanal({
  datas,
  porData,
  hoje,
  umaQuadra,
  aoAbrir,
  aoAbrirDia,
  aoAdicionar,
}: {
  datas: string[];
  porData: Map<string, ItemAgenda[]>;
  hoje: string;
  /** Com uma quadra so no filtro, os chips mostram a turma inteira. */
  umaQuadra: boolean;
  aoAbrir: (item: ItemAgenda) => void;
  aoAbrirDia: (data: string) => void;
  /** Clique num espaco livre (ausente para quem so consulta). */
  aoAdicionar?: (inicial: { data: string; horaInicio: string }) => void;
}) {
  const celulas = useMemo(
    () => new Map(datas.map((data) => [data, celulasDoDia(porData.get(data) ?? [])])),
    [datas, porData],
  );

  return (
    /* A grade rola dentro do cartao: filtros e legenda continuam visiveis, e
       o cabecalho dos dias e a coluna de horas ficam fixos. */
    <div className="max-h-[calc(100vh-22rem)] min-h-[26rem] overflow-auto rolagem-suave">
      <div className="min-w-[920px]">
        <div
          className="sticky top-0 z-20 grid border-b border-areia-200 bg-white shadow-sm"
          style={{ gridTemplateColumns: COLUNAS }}
        >
          <div className="sticky left-0 z-10 border-r border-areia-200 bg-white" />
          {datas.map((data) => {
            const ehHoje = data === hoje;
            const chuva = canceladasPorChuva(porData.get(data) ?? []);
            return (
              <button
                key={data}
                type="button"
                onClick={() => aoAbrirDia(data)}
                className={`border-r border-areia-200 px-2 py-2 text-center transition-colors last:border-r-0 hover:bg-saibro-50 ${
                  ehHoje ? "bg-saibro-50" : ""
                }`}
                aria-label={`Abrir o dia ${formatarDiaMes(data)}`}
              >
                <span
                  className={`block text-[11px] font-semibold uppercase tracking-wide ${
                    ehHoje ? "text-saibro-700" : "text-areia-500"
                  }`}
                >
                  {DIAS_SEMANA_CURTO[diaDaSemana(data)]}
                  {ehHoje && " · hoje"}
                </span>
                <span
                  className={`mt-0.5 block text-sm font-semibold ${ehHoje ? "text-saibro-800" : "text-areia-800"}`}
                >
                  {formatarDiaMes(data)}
                </span>
                {chuva > 0 && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                    <IconeChuva className="h-3 w-3" />
                    Chuva · {chuva} {chuva === 1 ? "cancelada" : "canceladas"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {FAIXAS_HORARIAS.map((faixa) => (
          <div
            key={faixa}
            className="grid border-b border-areia-200 last:border-b-0"
            style={{ gridTemplateColumns: COLUNAS }}
          >
            <div className="sticky left-0 z-10 border-r border-areia-200 bg-white px-2 pt-1.5 text-right">
              <span className="text-[11px] font-medium tabular-nums text-areia-500">{faixa}</span>
            </div>

            {datas.map((data) => {
              const ehHoje = data === hoje;
              const passado = data < hoje;
              const celula = celulas.get(data)?.get(faixa);
              return (
                <div
                  key={data}
                  className={`min-h-[56px] border-r border-areia-200 p-1 last:border-r-0 ${
                    ehHoje ? "bg-saibro-50/40" : passado ? "bg-areia-50/60" : ""
                  }`}
                >
                  <div className="group/celula flex h-full flex-col gap-1">
                    {celula?.continuam.map((item) => (
                      <ContinuacaoOcupacao key={item.ocupacao.id} item={item} aoAbrir={aoAbrir} />
                    ))}
                    {celula?.comecam.map((item) => (
                      <ChipOcupacao
                        key={item.ocupacao.id}
                        item={item}
                        compacto={!umaQuadra}
                        passado={passado}
                        aoAbrir={aoAbrir}
                      />
                    ))}
                    {aoAdicionar && !passado && (
                      <button
                        type="button"
                        onClick={() => aoAdicionar({ data, horaInicio: faixa })}
                        className="flex min-h-[22px] flex-1 items-center justify-center rounded-lg border border-dashed border-transparent text-areia-400 opacity-0 transition-all hover:border-saibro-300 hover:bg-saibro-50/60 hover:text-saibro-600 focus-visible:opacity-100 group-hover/celula:opacity-100"
                        aria-label={`Novo horário em ${formatarDiaMes(data)} às ${faixa}`}
                        title="Novo horário"
                      >
                        <IconeMais className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
