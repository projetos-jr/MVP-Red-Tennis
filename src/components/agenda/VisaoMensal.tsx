"use client";

import { DIAS_SEMANA_CURTO, ORDEM_SEMANA, gradeDoMes, mesmoMes, paraData } from "@/lib/date";
import { HOJE } from "@/lib/arena";
import { choveuEm, horariosDaData, type FiltroAgenda } from "@/lib/selectors";
import type { Horario } from "@/lib/types";
import { ESTILO_TIPO, ORDEM_TIPOS } from "@/lib/theme";

interface VisaoMensalProps {
  /** Qualquer data dentro do mes que sera exibido. */
  referencia: string;
  filtro: FiltroAgenda;
  /** Grade em vigor, incluindo horários criados na sessão. */
  horarios: Horario[];
  /** Abrir a semana correspondente ao clicar num dia. */
  aoSelecionarDia: (data: string) => void;
}

/**
 * Panorama mensal simplificado: quantos horarios cada dia tem e como eles se
 * distribuem entre os tipos de alocacao. Serve para leitura rapida de volume,
 * nao para agendar.
 */
export function VisaoMensal({
  referencia,
  filtro,
  horarios,
  aoSelecionarDia,
}: VisaoMensalProps) {
  const dias = gradeDoMes(referencia);

  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1.5">
        {ORDEM_SEMANA.map((dia) => (
          <div
            key={dia}
            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-areia-500"
          >
            {DIAS_SEMANA_CURTO[dia]}
          </div>
        ))}

        {dias.map((data) => {
          const doMes = mesmoMes(data, referencia);
          const ehHoje = data === HOJE;
          const chuva = choveuEm(data);
          const eventos = horariosDaData(data, filtro, horarios);
          const conflitos = eventos.filter((e) => e.temConflito).length;

          const porTipo = ORDEM_TIPOS.map((tipo) => ({
            tipo,
            quantidade: eventos.filter((e) => e.tipo === tipo).length,
          })).filter((t) => t.quantidade > 0);

          return (
            <button
              key={data}
              type="button"
              onClick={() => aoSelecionarDia(data)}
              className={`flex min-h-[92px] flex-col rounded-xl border p-2 text-left transition-all hover:border-saibro-400 hover:shadow-sm ${
                ehHoje
                  ? "border-saibro-500 bg-saibro-50 ring-2 ring-saibro-500/20"
                  : doMes
                    ? "border-areia-200 bg-white"
                    : "border-areia-100 bg-areia-50/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-semibold ${
                    ehHoje
                      ? "text-saibro-800"
                      : doMes
                        ? "text-areia-800"
                        : "text-areia-400"
                  }`}
                >
                  {paraData(data).getUTCDate()}
                </span>
                {eventos.length > 0 && (
                  <span
                    className={`text-[10px] font-medium ${
                      doMes ? "text-areia-500" : "text-areia-300"
                    }`}
                  >
                    {eventos.length}
                  </span>
                )}
              </div>

              {/* Distribuicao por tipo, proporcional ao volume do dia */}
              <div
                className={`mt-auto flex h-1.5 w-full overflow-hidden rounded-full ${
                  doMes ? "bg-areia-100" : "bg-transparent"
                }`}
              >
                {porTipo.map(({ tipo, quantidade }) => (
                  <span
                    key={tipo}
                    style={{
                      backgroundColor: ESTILO_TIPO[tipo].cor,
                      width: `${(quantidade / eventos.length) * 100}%`,
                      opacity: doMes ? 1 : 0.35,
                    }}
                    title={`${tipo}: ${quantidade}`}
                  />
                ))}
              </div>

              {chuva && doMes && (
                <span className="mt-1.5 inline-flex w-fit rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                  Chuva · sem operação
                </span>
              )}

              {conflitos > 0 && doMes && (
                <span className="mt-1.5 inline-flex w-fit rounded bg-tijolo-100 px-1.5 py-0.5 text-[10px] font-semibold text-tijolo-700">
                  {conflitos} conflito{conflitos > 1 ? "s" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
