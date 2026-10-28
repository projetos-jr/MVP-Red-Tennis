"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { IconeAlerta, IconeMais } from "@/components/ui/Icons";
import { DIAS_SEMANA_CURTO, diaDaSemana, paraData } from "@/lib/date";
import { FAIXAS_HORARIAS, HOJE } from "@/lib/arena";
import { caminhoAvatar } from "@/lib/dados";
import {
  choveuEm,
  horariosNaFaixaData,
  nomeDoAluno,
  type FiltroAgenda,
} from "@/lib/selectors";
import { ESTILO_TIPO, rotuloQuadra } from "@/lib/theme";
import type { Horario } from "@/lib/types";

interface VisaoDiariaProps {
  /** Datas (segunda a domingo) da semana exibida. */
  datas: string[];
  /** Data em foco. */
  dia: string;
  aoTrocarDia: (data: string) => void;
  filtro: FiltroAgenda;
  horarios: Horario[];
  aoAdicionar?: (diaSemana: number, faixa: string) => void;
}

/**
 * Agenda do celular: um dia por vez.
 *
 * A grade semanal de 7 colunas não cabe numa tela estreita sem rolagem
 * horizontal, que é justamente o que torna a agenda difícil de usar no
 * telefone. Aqui o dia é escolhido numa régua no topo e os horários aparecem
 * empilhados, do primeiro ao último, com as faixas livres sinalizadas.
 */
export function VisaoDiaria({
  datas,
  dia,
  aoTrocarDia,
  filtro,
  horarios,
  aoAdicionar,
}: VisaoDiariaProps) {
  const chuva = choveuEm(dia);
  const diaSemana = diaDaSemana(dia);

  const faixas = FAIXAS_HORARIAS.map((faixa) => ({
    faixa,
    eventos: horariosNaFaixaData(dia, faixa, filtro, horarios),
  }));
  const total = faixas.reduce((s, f) => s + f.eventos.length, 0);

  return (
    <div>
      {/* Régua de dias */}
      <div className="flex gap-1.5 overflow-x-auto rolagem-suave border-b border-areia-200 px-3 py-3">
        {datas.map((data) => {
          const ativo = data === dia;
          const ehHoje = data === HOJE;
          return (
            <button
              key={data}
              type="button"
              onClick={() => aoTrocarDia(data)}
              aria-pressed={ativo}
              className={`flex min-w-[52px] flex-1 flex-col items-center rounded-xl px-1 py-2 transition-colors ${
                ativo
                  ? "bg-saibro-600 text-white"
                  : ehHoje
                    ? "bg-saibro-50 text-saibro-800"
                    : "bg-areia-100 text-areia-700"
              }`}
            >
              <span className="text-[11px] font-medium uppercase">
                {DIAS_SEMANA_CURTO[diaDaSemana(data)]}
              </span>
              <span className="text-lg font-bold leading-tight">
                {paraData(data).getUTCDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Resumo do dia */}
      <div className="flex items-center justify-between gap-3 border-b border-areia-200 px-4 py-2.5">
        <p className="text-sm text-areia-600">
          {chuva ? (
            <span className="font-semibold text-sky-700">
              Chuva — arena fechada neste dia
            </span>
          ) : (
            <>
              <strong className="font-semibold text-areia-900">{total}</strong>{" "}
              horário{total === 1 ? "" : "s"} neste dia
            </>
          )}
        </p>
        {aoAdicionar && !chuva && (
          <button
            type="button"
            onClick={() => aoAdicionar(diaSemana, "19:00")}
            className="btn-primario px-3 py-2 text-xs"
          >
            <IconeMais className="h-4 w-4" />
            Marcar
          </button>
        )}
      </div>

      {chuva ? (
        <p className="px-4 py-10 text-center text-sm text-areia-500">
          Todos os horários deste dia foram cancelados por chuva.
        </p>
      ) : (
        <ul className="divide-y divide-areia-100">
          {faixas.map(({ faixa, eventos }) => (
            <li key={faixa} className="flex gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 pt-1 text-sm font-semibold tabular-nums text-areia-500">
                {faixa}
              </span>

              <div className="min-w-0 flex-1">
                {eventos.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => aoAdicionar?.(diaSemana, faixa)}
                    disabled={!aoAdicionar}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-areia-200 px-3 py-2 text-left text-xs text-areia-400 transition-colors enabled:hover:border-saibro-300 enabled:hover:text-saibro-600"
                  >
                    <IconeMais className="h-3.5 w-3.5" />
                    Livre
                  </button>
                ) : (
                  <div className="space-y-2">
                    {eventos.map((horario) => (
                      <CartaoHorario key={horario.id} horario={horario} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Evento da agenda no formato de cartão, com área de toque confortável. */
function CartaoHorario({ horario }: { horario: Horario }) {
  const estilo = ESTILO_TIPO[horario.tipo];
  const semProfessor = horario.professor === "Sem professor";

  return (
    <article
      className={`rounded-xl border-l-4 p-3 ${
        horario.temConflito ? "ring-2 ring-tijolo-500" : ""
      }`}
      style={{
        backgroundColor: estilo.fundo,
        borderLeftColor: estilo.cor,
        boxShadow: horario.temConflito ? undefined : `inset 0 0 0 1px ${estilo.borda}`,
      }}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: estilo.cor }}
        >
          {rotuloQuadra(horario.quadra)}
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: estilo.texto }}
        >
          {horario.tipo}
        </span>
        <span className="text-[11px] text-areia-500">
          {horario.horaInicio}–{horario.horaFim}
        </span>
        {horario.temConflito && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-tijolo-700">
            <IconeAlerta className="h-3.5 w-3.5" />
            Conflito
          </span>
        )}
      </header>

      <ul className="mt-2 space-y-1.5">
        {horario.alunosIds.map((id) => (
          <li key={id}>
            <Link
              href={`/alunos/${id}`}
              className="flex items-center gap-2 text-sm font-medium text-areia-800"
            >
              <Avatar
                id={id}
                nome={nomeDoAluno(id)}
                src={caminhoAvatar(id)}
                tamanho="xs"
              />
              {nomeDoAluno(id)}
            </Link>
          </li>
        ))}
      </ul>

      <p
        className={`mt-2 text-xs ${
          semProfessor ? "italic text-areia-500" : "text-areia-600"
        }`}
      >
        {horario.professor}
      </p>
    </article>
  );
}
