"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeAlerta, IconeRelogio } from "@/components/ui/Icons";
import type { ReservaSemPagamento } from "@/lib/consultas/financeiro";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";

function Prazo({ reserva }: { reserva: ReservaSemPagamento }) {
  const prazo = reserva.ocupacao.prazoPagamento;
  if (!prazo) return null;
  const quando = `${formatarDiaMes(prazo)} às ${prazo.slice(11, 16)}`;
  if (reserva.prazoVencido) {
    return (
      <Badge cor="#8A2118" fundo="#FBE3E0" borda="#EC9A90" className="whitespace-nowrap">
        <IconeAlerta className="h-3.5 w-3.5" />
        Prazo venceu em {quando}
      </Badge>
    );
  }
  if (reserva.prazoHoje) {
    return (
      <Badge cor="#A16207" fundo="#FEFBEB" borda="#F5D97A" className="whitespace-nowrap">
        <IconeRelogio className="h-3.5 w-3.5" />
        Prazo termina hoje às {prazo.slice(11, 16)}
      </Badge>
    );
  }
  return (
    <Badge borda="#E8E3DB" className="whitespace-nowrap">
      <IconeRelogio className="h-3.5 w-3.5" />
      Prazo até {quando}
    </Badge>
  );
}

/**
 * Reservas avulsas que só ficam confirmadas na agenda depois do pagamento
 * (convenção com a agenda e hipótese H5). Prazo vencido fica em destaque;
 * a recepção decide se cede o horário. Mostra todas, sem cortar a lista.
 */
export function ReservasSemPagamento({
  reservas,
  aoPagar,
  aoAbrir,
}: {
  reservas: ReservaSemPagamento[];
  aoPagar: (lancamentoId: string) => void;
  aoAbrir: (lancamentoId: string) => void;
}) {
  if (reservas.length === 0) return null;
  const vencidas = reservas.filter((r) => r.prazoVencido).length;

  return (
    <Card className={vencidas > 0 ? "border-tijolo-200" : ""}>
      <CardHeader
        titulo="Reservas aguardando pagamento"
        descricao="Só ficam confirmadas na agenda depois do pagamento. Com o prazo vencido, a recepção decide se cede o horário (hipótese H5)."
        icone={<IconeAlerta className="h-5 w-5" />}
        className={vencidas > 0 ? "bg-tijolo-50/50" : ""}
        acao={
          <p className="text-sm font-medium text-areia-700">
            {reservas.length} {reservas.length === 1 ? "reserva" : "reservas"}
            {vencidas > 0 && (
              <span className="text-tijolo-700">
                {" "}
                · {vencidas} com prazo vencido
              </span>
            )}
          </p>
        }
      />
      <ul className="divide-y divide-areia-100">
        {reservas.map((reserva) => {
          const { ocupacao, titular, lancamento } = reserva;
          return (
            <li
              key={ocupacao.id}
              className={`grid gap-x-4 gap-y-2 px-4 py-3 sm:px-5 md:grid-cols-[150px_minmax(0,1fr)_auto] md:items-center ${
                reserva.prazoVencido ? "bg-tijolo-50/40" : ""
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-areia-900">
                  {DIAS_SEMANA_CURTO[diaDaSemana(ocupacao.data)]} {formatarDiaMes(ocupacao.data)} ·{" "}
                  {ocupacao.horaInicio}
                </p>
                <p className="text-xs text-areia-500">
                  {reserva.quadra} · até {ocupacao.horaFim}
                </p>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {titular ? (
                    <Link
                      href={`/alunos/${titular.id}`}
                      className="flex min-w-0 items-center gap-2 text-sm font-medium text-areia-800 hover:text-tijolo-700 hover:underline"
                    >
                      <Avatar id={titular.id} nome={titular.nome} src={titular.fotoUrl} tamanho="xs" />
                      <span className="truncate">{titular.nome}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-areia-600">Sem participante</span>
                  )}
                  {reserva.acompanhantes > 0 && (
                    <span className="text-xs text-areia-500">+{reserva.acompanhantes}</span>
                  )}
                  <Prazo reserva={reserva} />
                </div>
                {lancamento ? (
                  <button
                    type="button"
                    onClick={() => aoAbrir(lancamento.lancamento.id)}
                    className="mt-1 text-left text-xs text-areia-600 hover:text-tijolo-700 hover:underline"
                  >
                    {lancamento.lancamento.item} · {formatarMoeda(lancamento.lancamento.valor)}
                  </button>
                ) : (
                  <p className="mt-1 text-xs text-tijolo-700">Sem cobrança lançada para esta reserva.</p>
                )}
              </div>

              {lancamento && (
                <button
                  type="button"
                  onClick={() => aoPagar(lancamento.lancamento.id)}
                  className={`${reserva.prazoVencido ? "btn-primario" : "btn-secundario"} w-full whitespace-nowrap py-2 md:w-auto`}
                  aria-label={`Registrar pagamento da reserva de ${titular?.nome ?? reserva.quadra}`}
                >
                  Registrar pagamento
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
