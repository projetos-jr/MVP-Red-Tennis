"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeAlerta, IconeCheck } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import { marcarPartida, registrarPartida } from "@/lib/banco/operacoes/ranking";
import type { QuadraId } from "@/lib/banco/tipos";
import {
  conflitoDaReserva,
  jogadoresDoRanking,
  quadrasParaPartida,
} from "@/lib/consultas/ranking";
import { somarDias } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { CamposDoResultado, RESULTADO_VAZIO, type ValoresDoResultado } from "./CamposDoResultado";

export type ModoDaPartida = "resultado" | "marcar";

/** Horas cheias oferecidas na reserva: inicio das 07h as 21h, fim das 08h as 22h. */
const HORAS_DE_INICIO = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);
const HORAS_DE_FIM = Array.from({ length: 15 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);

/**
 * Nova partida de ranking: o resultado de uma partida que ja aconteceu, ou
 * uma partida marcada (com reserva de quadra opcional, que aparece em roxo na
 * agenda). Use com `key` para recomecar o formulario a cada abertura.
 */
export function ModalNovaPartida({
  modoInicial,
  aoFechar,
}: {
  modoInicial: ModoDaPartida;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const jogadores = useMemo(() => jogadoresDoRanking(banco), [banco]);
  const quadras = useMemo(() => quadrasParaPartida(banco), [banco]);

  const [modo, setModo] = useState<ModoDaPartida>(modoInicial);
  const [jogadorA, setJogadorA] = useState("");
  const [jogadorB, setJogadorB] = useState("");
  const [data, setData] = useState(modoInicial === "resultado" ? HOJE : somarDias(HOJE, 1));
  const [resultado, setResultado] = useState<ValoresDoResultado>(RESULTADO_VAZIO);
  const [reservar, setReservar] = useState(true);
  const [quadraId, setQuadraId] = useState<QuadraId>(quadras[0]?.id ?? "1");
  const [horaInicio, setHoraInicio] = useState("19:00");
  const [horaFim, setHoraFim] = useState("20:00");

  const nome = (id: string, padrao: string) => jogadores.find((j) => j.id === id)?.nome ?? padrao;
  const nomeA = nome(jogadorA, "Jogador A");
  const nomeB = nome(jogadorB, "Jogador B");

  const conflito = useMemo(
    () =>
      modo === "marcar" && reservar
        ? conflitoDaReserva(banco, { quadraId, data, horaInicio, horaFim })
        : undefined,
    [banco, modo, reservar, quadraId, data, horaInicio, horaFim],
  );

  function trocarModo(novo: ModoDaPartida) {
    setModo(novo);
    // A data acompanha o modo: resultado e de hoje para tras; partida marcada, de hoje em diante.
    if (novo === "resultado" && data > HOJE) setData(HOJE);
    if (novo === "marcar" && data < HOJE) setData(somarDias(HOJE, 1));
  }

  /** Mudar o inicio leva o fim junto, mantendo a duracao (sem passar das 22h). */
  function trocarInicio(hora: string) {
    const duracao = Math.max(1, Number(horaFim.slice(0, 2)) - Number(horaInicio.slice(0, 2)));
    const fim = Math.min(22, Number(hora.slice(0, 2)) + duracao);
    setHoraInicio(hora);
    setHoraFim(`${String(fim).padStart(2, "0")}:00`);
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const ok =
      modo === "resultado"
        ? gravar(
            registrarPartida,
            { jogadorA, jogadorB, data, ...resultado },
            "Partida registrada. O ranking foi atualizado.",
          )
        : gravar(
            marcarPartida,
            {
              jogadorA,
              jogadorB,
              data,
              reserva: reservar ? { quadraId, horaInicio, horaFim } : undefined,
            },
            reservar ? "Partida marcada e quadra reservada na agenda." : "Partida marcada.",
          );
    if (ok) aoFechar();
  }

  const opcoesDeJogador = jogadores.map((j) => (
    <option key={j.id} value={j.id}>
      {j.nome}
      {j.categoriaRanking ? ` · Cat. ${j.categoriaRanking}` : ""}
    </option>
  ));

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={modo === "resultado" ? "Registrar partida" : "Marcar partida"}
      descricao="Partida de ranking entre dois jogadores inscritos."
    >
      <form onSubmit={salvar}>
        <div className="space-y-4 px-5 py-4">
          <Segmentado
            aria="O que registrar"
            valor={modo}
            aoMudar={trocarModo}
            className="w-full [&>button]:flex-1"
            opcoes={[
              { valor: "resultado", rotulo: "Já foi jogada" },
              {
                valor: "marcar",
                rotulo: (
                  <>
                    <span className="sm:hidden">Marcar partida</span>
                    <span className="hidden sm:inline">Marcar para depois</span>
                  </>
                ),
              },
            ]}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Jogador A" obrigatorio>
              <select value={jogadorA} onChange={(e) => setJogadorA(e.target.value)} className="campo">
                <option value="">Escolha…</option>
                {opcoesDeJogador}
              </select>
            </Campo>
            <Campo rotulo="Jogador B" obrigatorio>
              <select value={jogadorB} onChange={(e) => setJogadorB(e.target.value)} className="campo">
                <option value="">Escolha…</option>
                {opcoesDeJogador}
              </select>
            </Campo>
          </div>

          <Campo
            rotulo={modo === "resultado" ? "Data em que foi jogada" : "Data da partida"}
            obrigatorio
          >
            <input
              type="date"
              value={data}
              min={modo === "marcar" ? HOJE : undefined}
              max={modo === "resultado" ? HOJE : undefined}
              onChange={(e) => setData(e.target.value)}
              className="campo"
            />
          </Campo>

          {modo === "resultado" ? (
            <CamposDoResultado valores={resultado} aoMudar={setResultado} nomeA={nomeA} nomeB={nomeB} />
          ) : (
            <div className="space-y-3 rounded-xl border border-areia-200 p-3.5">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={reservar}
                  onChange={(e) => setReservar(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-tijolo-600"
                />
                <span>
                  <span className="font-medium text-areia-800">Reservar quadra</span>
                  <span className="block text-xs text-areia-500">
                    A reserva entra na agenda como partida de ranking (roxo).
                  </span>
                </span>
              </label>

              {reservar && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Campo rotulo="Quadra">
                      <select
                        value={quadraId}
                        onChange={(e) => setQuadraId(e.target.value as QuadraId)}
                        className="campo px-2.5"
                      >
                        {quadras.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.nome}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo rotulo="Início">
                      <select
                        value={horaInicio}
                        onChange={(e) => trocarInicio(e.target.value)}
                        className="campo px-2.5"
                      >
                        {HORAS_DE_INICIO.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo rotulo="Fim">
                      <select
                        value={horaFim}
                        onChange={(e) => setHoraFim(e.target.value)}
                        className="campo px-2.5"
                      >
                        {HORAS_DE_FIM.filter((h) => h > horaInicio).map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <p
                    role="status"
                    className={`flex items-start gap-2 text-xs ${conflito ? "text-tijolo-700" : "text-emerald-700"}`}
                  >
                    {conflito ? (
                      <IconeAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <IconeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    {conflito ?? "Quadra livre nesse horário."}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar={modo === "resultado" ? "Registrar partida" : "Marcar partida"}
        />
      </form>
    </Modal>
  );
}
