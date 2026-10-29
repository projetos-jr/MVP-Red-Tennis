"use client";

import { useState } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { IconeAlerta, IconeRelogio } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { liberarReservasVencidas } from "@/lib/banco/operacoes/agenda";
import {
  MOTIVO_SEM_PAGAMENTO,
  descreverCarimboDaAgenda,
  reservasAguardandoPagamento,
  rotuloDaQuadra,
  type ItemAgenda,
} from "@/lib/consultas/agenda";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { ConfirmarLiberacao } from "./AcoesDoHorario";
import { CorpoRolavel } from "./CamposDeHorario";
import { plural } from "./estilos";

/**
 * Reservas aguardando pagamento (Hipotese H5), com as de prazo vencido em
 * destaque. A recepcao decide: "liberar horario" cancela a reserva com o
 * motivo "Sem pagamento no prazo" (sem reposicao) e anula a cobranca.
 */
export function ModalReservas({
  aberto,
  aoFechar,
  agora,
  podeEditar,
  aoAbrirHorario,
}: {
  aberto: boolean;
  aoFechar: () => void;
  agora: string;
  podeEditar: boolean;
  aoAbrirHorario: (ocupacaoId: string, data: string) => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const reservas = reservasAguardandoPagamento(banco, agora);
  const vencidas = reservas.filter((r) => r.vencida).length;
  const [liberando, setLiberando] = useState<ItemAgenda | null>(null);
  const [liberandoTodas, setLiberandoTodas] = useState(false);
  const automatico = banco.configuracoes.liberarReservaAutomaticamente;

  return (
    <>
      <Modal
        aberto={aberto && !liberando && !liberandoTodas}
        aoFechar={aoFechar}
        titulo="Reservas sem pagamento"
        descricao={`${plural(reservas.length, "reserva aguardando", "reservas aguardando")} pagamento · ${plural(vencidas, "com prazo vencido", "com prazo vencido")}`}
        largura="lg"
      >
        <CorpoRolavel className="space-y-3 px-5 py-4">
          <p className="rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-2.5 text-xs leading-relaxed text-areia-700">
            Locação avulsa fica “aguardando pagamento” por{" "}
            {banco.configuracoes.prazoPagamentoReservaHoras} h (Hipótese H5). Vencido o prazo, a
            reserva só entra em alerta: quem decide liberar o horário é a recepção.{" "}
            {automatico
              ? "A liberação automática está ligada nas Configurações: as vencidas são liberadas ao abrir a agenda."
              : "A liberação automática está desligada nas Configurações."}
          </p>

          {reservas.length === 0 ? (
            <p className="py-6 text-center text-sm text-areia-500">
              Nenhuma reserva aguardando pagamento.
            </p>
          ) : (
            <ul className="divide-y divide-areia-100 rounded-2xl border border-areia-200">
              {reservas.map(({ item, titular, vencida }) => (
                <li
                  key={item.ocupacao.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 ${vencida ? "bg-tijolo-50/60" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      vencida ? "bg-tijolo-600 text-white" : "bg-amber-100 text-amber-800"
                    }`}
                    aria-hidden="true"
                  >
                    {vencida ? (
                      <IconeAlerta className="h-5 w-5" />
                    ) : (
                      <IconeRelogio className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-areia-900">
                      {DIAS_SEMANA_CURTO[diaDaSemana(item.ocupacao.data)]}{" "}
                      {formatarDiaMes(item.ocupacao.data)} · {item.ocupacao.horaInicio}–
                      {item.ocupacao.horaFim} · {rotuloDaQuadra(item.ocupacao.quadraId)}
                    </p>
                    <p className="truncate text-xs text-areia-600">
                      {titular ?? "Sem titular"}
                      {item.cobranca && ` · ${formatarMoeda(item.cobranca.valor)}`}
                    </p>
                    <p
                      className={`text-xs font-semibold ${vencida ? "text-tijolo-700" : "text-amber-800"}`}
                    >
                      {vencida ? "Prazo vencido em " : "Prazo até "}
                      {descreverCarimboDaAgenda(item.ocupacao.prazoPagamento ?? "")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => aoAbrirHorario(item.ocupacao.id, item.ocupacao.data)}
                      className="btn-secundario px-3 py-1.5 text-xs"
                    >
                      Abrir
                    </button>
                    {vencida && podeEditar && (
                      <button
                        type="button"
                        onClick={() => setLiberando(item)}
                        className="btn bg-tijolo-700 px-3 py-1.5 text-xs text-white hover:bg-tijolo-800"
                      >
                        Liberar horário
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CorpoRolavel>
        <footer className="flex flex-col-reverse gap-2 border-t border-areia-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={aoFechar} className="btn-secundario">
            Fechar
          </button>
          {podeEditar && vencidas > 1 && (
            <button
              type="button"
              onClick={() => setLiberandoTodas(true)}
              className="btn bg-tijolo-700 text-white hover:bg-tijolo-800"
            >
              Liberar as {vencidas} vencidas
            </button>
          )}
        </footer>
      </Modal>

      {aberto && liberando && (
        <ConfirmarLiberacao item={liberando} aoFechar={() => setLiberando(null)} />
      )}
      <Confirmacao
        aberto={aberto && liberandoTodas}
        titulo="Liberar todas as vencidas"
        mensagem={`${plural(vencidas, "reserva vencida será cancelada", "reservas vencidas serão canceladas")} com o motivo “${MOTIVO_SEM_PAGAMENTO}”, sem reposição, e as cobranças serão anuladas.`}
        rotuloConfirmar="Liberar todas"
        perigoso
        aoCancelar={() => setLiberandoTodas(false)}
        aoConfirmar={() => {
          gravar(
            liberarReservasVencidas,
            {},
            `${plural(vencidas, "reserva liberada", "reservas liberadas")}.`,
          );
          setLiberandoTodas(false);
        }}
      />
    </>
  );
}
