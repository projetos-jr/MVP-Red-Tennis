"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Quadra3D } from "./Quadra3D";
import { IconeCadeado, IconeCheck, IconeRelogio } from "@/components/ui/Icons";
import { HORA_ABERTURA, HORA_FECHAMENTO } from "@/lib/banco/constantes";
import type { Ocupacao } from "@/lib/banco/tipos";
import type { QuadraNoPainel } from "@/lib/consultas/painel";
import { ESTILO_OCUPACAO, formatarMinutos } from "@/lib/theme";

const HORAS_DE_FUNCIONAMENTO = HORA_FECHAMENTO - HORA_ABERTURA;

/** "Individual" ou, no bloqueio, o motivo ("Manutenção do saibro"). */
function nomeDaOcupacao(ocupacao: Ocupacao): string {
  return ocupacao.tipo === "Bloqueio" ? `Bloqueio: ${ocupacao.descricao ?? "quadra fechada"}` : ocupacao.tipo;
}

/** Situacao da quadra agora, em texto: usada no cartao e no rotulo para leitor de tela. */
function situacaoAgora(q: QuadraNoPainel): string {
  if (q.encerrado) return "Arena fechada por hoje";
  if (q.emAndamento) return `Agora: ${nomeDaOcupacao(q.emAndamento)} até ${q.emAndamento.horaFim}`;
  if (q.proxima) return `Próxima: ${q.proxima.horaInicio} · ${nomeDaOcupacao(q.proxima)}`;
  return "Sem mais horários hoje";
}

/**
 * Cartao de uma quadra no Painel: piso em 3D (mais escuro = mais cheio), o
 * que esta acontecendo agora, a proxima ocupacao e a proxima faixa livre.
 * Com `href`, o cartao leva para a Agenda daquela quadra.
 */
export function CardQuadra({ quadra, href }: { quadra: QuadraNoPainel; href?: string }) {
  const { quadra: dados, rotulo, taxa, minutosOcupados, emAndamento } = quadra;
  const percentual = Math.round(taxa * 100);
  const paredao = dados.id === "paredao";
  const cimento = dados.piso === "cimento";
  const destaque = emAndamento ?? quadra.proxima;

  const disponibilidade = quadra.encerrado ? (
    <span className="chip bg-areia-100 text-[11px] text-areia-600">
      <IconeCadeado className="h-3.5 w-3.5" />
      Fechada
    </span>
  ) : quadra.livreAgora ? (
    <span className="chip border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800">
      <IconeCheck className="h-3.5 w-3.5" />
      Livre agora
    </span>
  ) : quadra.proximaFaixaLivre ? (
    <span className="chip bg-areia-100 text-[11px] text-areia-600">
      <IconeRelogio className="h-3.5 w-3.5" />
      Livre às {quadra.proximaFaixaLivre}
    </span>
  ) : (
    <span className="chip border border-saibro-200 bg-saibro-50 text-[11px] text-saibro-800">
      Lotada até o fechamento
    </span>
  );

  const conteudo: ReactNode = (
    <>
      <div className="px-1 pb-3 pt-1 transition-transform duration-300 group-hover:scale-[1.03]">
        <Quadra3D rotulo={paredao ? "P" : dados.id} taxa={taxa} piso={dados.piso} paredao={paredao} />
      </div>

      <div className="mt-auto">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-areia-900">{rotulo}</h3>
          <span className={`text-sm font-bold ${cimento ? "text-slate-600" : "text-saibro-700"}`}>
            {percentual}%
          </span>
        </div>

        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-areia-400">
          {cimento ? "Piso de cimento" : "Piso de saibro"}
        </p>

        {/* Barra de ocupacao do dia */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-areia-200">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              cimento
                ? "bg-gradient-to-r from-slate-300 to-slate-600"
                : "bg-gradient-to-r from-saibro-400 to-saibro-700"
            }`}
            style={{ width: `${Math.max(percentual, 3)}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-areia-600">
          {minutosOcupados === 0
            ? "Nenhum horário marcado hoje"
            : `${formatarMinutos(minutosOcupados)} de ${HORAS_DE_FUNCIONAMENTO}h ocupadas`}
        </p>

        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-areia-700">
          {destaque && (
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: ESTILO_OCUPACAO[destaque.tipo].cor }}
              aria-hidden="true"
            />
          )}
          <span className={emAndamento ? "font-medium" : ""}>{situacaoAgora(quadra)}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">{disponibilidade}</div>
      </div>
    </>
  );

  const classes =
    "group flex flex-col rounded-2xl border border-areia-200 bg-white p-4 shadow-card transition-all duration-200";

  if (!href) return <div className={classes}>{conteudo}</div>;

  return (
    <Link
      href={href}
      className={`${classes} hover:-translate-y-1 hover:border-saibro-300 hover:shadow-card-hover focus-visible:-translate-y-1`}
      aria-label={`${rotulo}, piso de ${dados.piso}: ${percentual}% de ocupação hoje. ${situacaoAgora(quadra)}. ${
        quadra.encerrado
          ? ""
          : quadra.livreAgora
            ? "Livre agora."
            : quadra.proximaFaixaLivre
              ? `Livre às ${quadra.proximaFaixaLivre}.`
              : "Lotada até o fechamento."
      } Abrir na agenda.`}
    >
      {conteudo}
    </Link>
  );
}
