"use client";

import { useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo } from "@/components/ui/Formulario";
import { IconeAgenda, IconeAlerta } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import {
  corrigirResultadoDePartida,
  excluirPartida,
  registrarResultadoDePartida,
} from "@/lib/banco/operacoes/ranking";
import { rotuloDaQuadra } from "@/lib/consultas/base";
import type { PartidaNaLista } from "@/lib/consultas/ranking";
import { formatarData, formatarDiaMes } from "@/lib/date";
import { useGravar } from "@/store/useGravar";
import { CamposDoResultado, type ValoresDoResultado } from "./CamposDoResultado";
import { Confronto } from "./Confronto";
import { RegistroDaPartida } from "./RegistroDaPartida";

/**
 * Partida de ranking: registrar o resultado (se estava marcada), corrigir ou
 * excluir, com comentarios e historico. (Partida de torneio abre na chave do
 * torneio.) Use com `key={partidaId}`.
 */
export function ModalPartida({ item, aoFechar }: { item: PartidaNaLista; aoFechar: () => void }) {
  const gravar = useGravar();
  const { partida, a, b, reserva } = item;
  const [valores, setValores] = useState<ValoresDoResultado>({
    placar: partida.wo ? "" : (partida.placar ?? ""),
    vencedor: partida.vencedor ?? "",
    wo: Boolean(partida.wo),
  });
  const [data, setData] = useState(partida.data ?? HOJE);
  const [excluindo, setExcluindo] = useState(false);

  const temResultado = Boolean(partida.vencedor);
  const dataDaPartida = reserva?.data ?? partida.data ?? HOJE;
  const aindaNaoChegou = !temResultado && dataDaPartida > HOJE;
  const reservaFutura = reserva && reserva.situacao !== "cancelada" && reserva.data >= HOJE;

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    // Com reserva, a data e a da reserva (a operacao ignora a data enviada).
    const dados = { id: partida.id, ...valores, data: reserva ? undefined : data };
    const ok = temResultado
      ? gravar(corrigirResultadoDePartida, dados, "Resultado corrigido. O ranking foi recalculado.")
      : gravar(registrarResultadoDePartida, dados, "Resultado registrado. O ranking foi atualizado.");
    if (ok) aoFechar();
  }

  function excluir() {
    if (gravar(excluirPartida, { id: partida.id }, "Partida excluída.")) {
      setExcluindo(false);
      aoFechar();
    }
  }

  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        titulo="Partida de ranking"
        descricao={partida.data ? formatarData(partida.data) : undefined}
      >
        <form onSubmit={salvar}>
          <div className="space-y-4 px-5 py-4">
            <Confronto a={a} b={b} vencedor={partida.vencedor} placar={partida.placar} />

            {reserva && (
              <p className="flex items-center gap-2 text-sm text-areia-700">
                <IconeAgenda className="h-4 w-4 shrink-0 text-saibro-600" />
                Reserva: {rotuloDaQuadra(reserva.quadraId)} · {formatarDiaMes(reserva.data)} ·{" "}
                {reserva.horaInicio}–{reserva.horaFim}
                {reserva.situacao === "cancelada" && " (cancelada)"}
              </p>
            )}

            {aindaNaoChegou ? (
              <p className="flex items-start gap-2.5 rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-3 text-sm text-areia-700">
                <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0 text-areia-500" />
                Marcada para {formatarData(dataDaPartida)}. O resultado entra a partir desse dia.
              </p>
            ) : (
              <>
                <CamposDoResultado valores={valores} aoMudar={setValores} nomeA={a.nome} nomeB={b.nome} />
                {!reserva && (
                  <Campo rotulo="Data da partida" obrigatorio>
                    <input
                      type="date"
                      value={data}
                      max={HOJE}
                      onChange={(e) => setData(e.target.value)}
                      className="campo"
                    />
                  </Campo>
                )}
              </>
            )}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-areia-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setExcluindo(true)}
              className="btn-fantasma w-full text-tijolo-700 hover:text-tijolo-800 sm:w-auto"
            >
              Excluir partida
            </button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={aoFechar} className="btn-secundario">
                {aindaNaoChegou ? "Fechar" : "Cancelar"}
              </button>
              {!aindaNaoChegou && (
                <button type="submit" className="btn-primario">
                  {temResultado ? "Salvar correção" : "Registrar resultado"}
                </button>
              )}
            </div>
          </footer>
        </form>

        <RegistroDaPartida partidaId={partida.id} />
      </Modal>

      <Confirmacao
        aberto={excluindo}
        titulo="Excluir partida?"
        mensagem={
          <>
            A partida entre <strong>{a.nome}</strong> e <strong>{b.nome}</strong> sai do histórico e
            o ranking é recalculado.
            {reservaFutura && (
              <> A reserva da {rotuloDaQuadra(reserva.quadraId)} também será cancelada.</>
            )}{" "}
            O registro da exclusão fica no histórico de alterações.
          </>
        }
        rotuloConfirmar="Excluir partida"
        perigoso
        aoConfirmar={excluir}
        aoCancelar={() => setExcluindo(false)}
      />
    </>
  );
}
