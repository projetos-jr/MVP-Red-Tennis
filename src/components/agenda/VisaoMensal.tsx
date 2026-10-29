"use client";

import type { ItemAgenda } from "@/lib/consultas/agenda";
import { DIAS_SEMANA_CURTO, ORDEM_SEMANA, formatarDiaMes, mesmoMes, paraData } from "@/lib/date";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { FUNDO_BLOQUEIO, ORDEM_TIPOS_AGENDA } from "./estilos";
import { IconeChuva } from "./Icones";

/**
 * Panorama do mes: quantos horarios cada data tem, como se dividem entre os
 * tipos e o que pede atencao (canceladas, chuva, bloqueios, reservas sem
 * pagamento). Serve para leitura rapida; clicar no dia abre a visao do dia.
 */
export function VisaoMensal({
  referencia,
  datas,
  porData,
  hoje,
  aoSelecionarDia,
}: {
  /** Qualquer data do mes exibido. */
  referencia: string;
  /** As 42 datas da grade do mes. */
  datas: string[];
  porData: Map<string, ItemAgenda[]>;
  hoje: string;
  aoSelecionarDia: (data: string) => void;
}) {
  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {ORDEM_SEMANA.map((dia) => (
          <div
            key={dia}
            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-areia-500"
          >
            {DIAS_SEMANA_CURTO[dia]}
          </div>
        ))}

        {datas.map((data) => {
          const doMes = mesmoMes(data, referencia);
          const ehHoje = data === hoje;
          const itens = porData.get(data) ?? [];
          const ativos = itens.filter((i) => !i.cancelada);
          const canceladas = itens.length - ativos.length;
          const chuva = itens.some((i) => i.cancelada && i.ocupacao.motivoCancelamento === "CH");
          const bloqueios = ativos.filter((i) => i.ocupacao.tipo === "Bloqueio").length;
          const aguardando = ativos.filter(
            (i) => i.estadoReserva === "aguardando" || i.estadoReserva === "vencida",
          );
          const vencidas = aguardando.filter((i) => i.estadoReserva === "vencida").length;
          const horarios = ativos.length - bloqueios;
          const porTipo = ORDEM_TIPOS_AGENDA.map((tipo) => ({
            tipo,
            quantidade: ativos.filter((i) => i.ocupacao.tipo === tipo).length,
          })).filter((t) => t.quantidade > 0);

          const resumo = [
            `${horarios} ${horarios === 1 ? "horário" : "horários"}`,
            canceladas > 0 ? `${canceladas} cancelados` : "",
            bloqueios > 0 ? "com bloqueio" : "",
            aguardando.length > 0 ? `${aguardando.length} aguardando pagamento` : "",
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <button
              key={data}
              type="button"
              onClick={() => aoSelecionarDia(data)}
              aria-label={`${formatarDiaMes(data)}: ${resumo}. Abrir o dia.`}
              className={`flex min-h-[78px] flex-col rounded-xl border p-1.5 text-left transition-all hover:border-saibro-400 hover:shadow-sm sm:min-h-[96px] sm:p-2 ${
                ehHoje
                  ? "border-saibro-500 bg-saibro-50 ring-2 ring-saibro-500/20"
                  : doMes
                    ? "border-areia-200 bg-white"
                    : "border-areia-100 bg-areia-50/60"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-sm font-semibold ${
                    ehHoje ? "text-saibro-800" : doMes ? "text-areia-800" : "text-areia-400"
                  }`}
                >
                  {paraData(data).getUTCDate()}
                </span>
                {horarios > 0 && (
                  <span
                    className={`text-[10px] font-medium ${doMes ? "text-areia-500" : "text-areia-300"}`}
                  >
                    {horarios}
                  </span>
                )}
              </div>

              {doMes && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {chuva && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-semibold text-sky-700">
                      <IconeChuva className="h-3 w-3" />
                      <span className="hidden sm:inline">Chuva</span>
                    </span>
                  )}
                  {bloqueios > 0 && (
                    <span
                      className="rounded px-1 py-0.5 text-[10px] font-semibold text-areia-700"
                      style={{ backgroundColor: "#F4F1EC", backgroundImage: FUNDO_BLOQUEIO }}
                    >
                      <span className="sm:hidden">BL</span>
                      <span className="hidden sm:inline">Bloqueio</span>
                    </span>
                  )}
                  {aguardando.length > 0 && (
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                        vencidas > 0 ? "bg-tijolo-600 text-white" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {aguardando.length}
                      <span className="hidden sm:inline"> a pagar</span>
                    </span>
                  )}
                  {canceladas > 0 && !chuva && (
                    <span className="hidden rounded bg-areia-200 px-1 py-0.5 text-[10px] font-semibold text-areia-700 sm:inline">
                      {canceladas} canc.
                    </span>
                  )}
                </div>
              )}

              <div
                className={`mt-auto flex h-1.5 w-full overflow-hidden rounded-full ${
                  doMes ? "bg-areia-100" : "bg-transparent"
                }`}
              >
                {porTipo.map(({ tipo, quantidade }) => (
                  <span
                    key={tipo}
                    style={{
                      backgroundColor: ESTILO_OCUPACAO[tipo].cor,
                      width: `${(quantidade / ativos.length) * 100}%`,
                      opacity: doMes ? 1 : 0.35,
                    }}
                    title={`${tipo}: ${quantidade}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
