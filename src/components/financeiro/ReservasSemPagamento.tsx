"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EtiquetaDeSituacao } from "@/components/ui/EtiquetaDeSituacao";
import { IconeRelogio } from "@/components/ui/Icons";
import { BotaoDeAtencao } from "@/components/ui/PlacaDeAtencao";
import type { ReservaSemPagamento } from "@/lib/consultas/financeiro";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";

const ID_DA_LISTA = "lista-reservas-aguardando";

function Prazo({ reserva }: { reserva: ReservaSemPagamento }) {
  const prazo = reserva.ocupacao.prazoPagamento;
  if (!prazo) return null;
  const quando = `${formatarDiaMes(prazo)} às ${prazo.slice(11, 16)}`;
  if (reserva.prazoVencido) {
    return (
      <EtiquetaDeSituacao situacao="em_atraso" className="whitespace-nowrap text-sm">
        Prazo venceu em {quando}
      </EtiquetaDeSituacao>
    );
  }
  if (reserva.prazoHoje) {
    return (
      <EtiquetaDeSituacao situacao="pendente" className="whitespace-nowrap text-sm">
        Prazo termina hoje às {prazo.slice(11, 16)}
      </EtiquetaDeSituacao>
    );
  }
  return (
    <EtiquetaDeSituacao situacao="em_andamento" className="whitespace-nowrap text-sm">
      Prazo até {quando}
    </EtiquetaDeSituacao>
  );
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * Reservas avulsas que só ficam confirmadas na agenda depois do pagamento
 * (convenção com a agenda e hipótese H5). Fechado, é só um resumo grande
 * ("9 reservas aguardando pagamento · 3 com prazo vencido") com a placa de
 * atenção quando há prazo vencido; aberto, mostra todas, das de prazo mais
 * curto (as vencidas) para as de prazo mais longo. Sem reservas, nada aparece.
 */
export function ReservasSemPagamento({
  reservas,
  aoPagar,
  aoAbrir,
  abertaNoInicio = false,
}: {
  reservas: ReservaSemPagamento[];
  aoPagar: (lancamentoId: string) => void;
  aoAbrir: (lancamentoId: string) => void;
  /** Abre já com a lista à vista (link `?reservas=abrir`). */
  abertaNoInicio?: boolean;
}) {
  const [aberta, setAberta] = useState(abertaNoInicio);
  // Chegando pelo link (Início › Registrar pagamento), a lista aberta precisa
  // estar à vista: rola até ela uma vez.
  const secao = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!abertaNoInicio) return;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    secao.current?.scrollIntoView({ block: "start", behavior: calmo ? "auto" : "smooth" });
  }, [abertaNoInicio]);
  if (reservas.length === 0) return null;
  const vencidas = reservas.filter((r) => r.prazoVencido).length;

  return (
    <section ref={secao} className={`card scroll-mt-32 ${vencidas > 0 ? "border-tijolo-200" : ""}`}>
      <div
        className={`flex flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${
          vencidas > 0 ? "bg-tijolo-50/60" : ""
        } ${aberta ? "rounded-b-none border-b border-areia-200" : ""}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saibro-600 text-white">
            <IconeRelogio className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-tight text-areia-900 sm:text-2xl">
              {plural(reservas.length, "reserva aguardando", "reservas aguardando")} pagamento
              {vencidas > 0 && (
                <span className="text-tijolo-700"> · {plural(vencidas, "com prazo vencido", "com prazo vencido")}</span>
              )}
            </h2>
            <p className="mt-0.5 text-base text-areia-600">
              Só ficam confirmadas na agenda depois do pagamento.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {!aberta && (
            <BotaoDeAtencao
              variante="compacto"
              quantidade={vencidas}
              descricao={`Ver ${plural(vencidas, "vencida", "vencidas")}`}
              abreJanela={false}
              aoAbrir={() => setAberta(true)}
              className="text-base"
            />
          )}
          <button
            type="button"
            onClick={() => setAberta((atual) => !atual)}
            aria-expanded={aberta}
            aria-controls={ID_DA_LISTA}
            className="btn-secundario px-4 py-2.5 text-base"
          >
            {aberta ? "Esconder reservas" : "Ver reservas"}
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`h-5 w-5 motion-safe:transition-transform ${aberta ? "rotate-180" : ""}`}
            >
              <path
                d="M5 8l5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div id={ID_DA_LISTA} hidden={!aberta} className={aberta ? "motion-safe:animate-fade-up" : ""}>
        {aberta && (
          <>
            <p className="border-b border-areia-200 px-4 py-2.5 text-sm text-areia-600 sm:px-5">
              Com o prazo vencido, a recepção decide se cede o horário (hipótese H5).
            </p>
            <ul className="divide-y divide-areia-100">
              {reservas.map((reserva) => (
                <LinhaDaReserva key={reserva.ocupacao.id} reserva={reserva} aoPagar={aoPagar} aoAbrir={aoAbrir} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function LinhaDaReserva({
  reserva,
  aoPagar,
  aoAbrir,
}: {
  reserva: ReservaSemPagamento;
  aoPagar: (lancamentoId: string) => void;
  aoAbrir: (lancamentoId: string) => void;
}) {
  const { ocupacao, titular, lancamento } = reserva;
  return (
    <li
      className={`grid gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 md:grid-cols-[170px_minmax(0,1fr)_auto] md:items-center ${
        reserva.prazoVencido ? "bg-tijolo-50/40" : ""
      }`}
    >
      <div>
        <p className="text-base font-semibold text-areia-900">
          {DIAS_SEMANA_CURTO[diaDaSemana(ocupacao.data)]} {formatarDiaMes(ocupacao.data)} ·{" "}
          {ocupacao.horaInicio}
        </p>
        <p className="text-sm text-areia-600">
          {reserva.quadra} · até {ocupacao.horaFim}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {titular ? (
            <Link
              href={`/alunos/${titular.id}`}
              className="alvo-de-toque flex min-w-0 items-center gap-2 text-base font-semibold text-areia-800 hover:text-saibro-700 hover:underline"
            >
              <Avatar id={titular.id} nome={titular.nome} src={titular.fotoUrl} tamanho="sm" />
              <span className="truncate">{titular.nome}</span>
            </Link>
          ) : (
            <span className="text-base text-areia-600">Sem participante</span>
          )}
          {reserva.acompanhantes > 0 && (
            <span className="text-sm text-areia-600">+{reserva.acompanhantes}</span>
          )}
          <Prazo reserva={reserva} />
        </div>
        {lancamento ? (
          <button
            type="button"
            onClick={() => aoAbrir(lancamento.lancamento.id)}
            className="alvo-de-toque mt-0.5 text-left text-sm text-areia-700 underline decoration-areia-300 underline-offset-2 hover:text-saibro-700"
          >
            {lancamento.lancamento.item} · {formatarMoeda(lancamento.lancamento.valor)}
          </button>
        ) : (
          <p className="mt-1 text-sm text-tijolo-700">Sem cobrança lançada para esta reserva.</p>
        )}
      </div>

      {lancamento && (
        <button
          type="button"
          onClick={() => aoPagar(lancamento.lancamento.id)}
          className={`${reserva.prazoVencido ? "btn-primario" : "btn-secundario"} w-full whitespace-nowrap px-5 py-3 text-base md:w-auto`}
          aria-label={`Registrar pagamento da reserva de ${titular?.nome ?? reserva.quadra}`}
        >
          Registrar pagamento
        </button>
      )}
    </li>
  );
}
