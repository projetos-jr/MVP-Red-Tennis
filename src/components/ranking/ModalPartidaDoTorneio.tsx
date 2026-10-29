"use client";

import { useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo } from "@/components/ui/Formulario";
import { IconeAlerta } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import {
  apagarResultadoDeTorneio,
  corrigirResultadoDeTorneio,
  registrarResultadoDeTorneio,
} from "@/lib/banco/operacoes/ranking";
import type { Torneio } from "@/lib/banco/tipos";
import { bloqueioDaPartida, type CaixaDePartida } from "@/lib/consultas/ranking";
import { formatarData } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { CamposDoResultado, type ValoresDoResultado } from "./CamposDoResultado";
import { Confronto } from "./Confronto";
import { RegistroDaPartida } from "./RegistroDaPartida";

function Aviso({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-3 text-sm text-areia-700">
      <IconeAlerta className="mt-0.5 h-4 w-4 shrink-0 text-areia-500" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Resultado de uma partida de torneio: registrar, corrigir (so enquanto a
 * partida seguinte nao foi jogada) ou apagar, com comentarios e historico.
 * Use com `key={partidaId}` para o formulario recomecar a cada partida.
 */
export function ModalPartidaDoTorneio({
  torneio,
  caixa,
  aoFechar,
}: {
  torneio: Torneio;
  caixa: CaixaDePartida;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const { partida } = caixa;
  const [valores, setValores] = useState<ValoresDoResultado>({
    placar: partida.wo ? "" : (partida.placar ?? ""),
    vencedor: partida.vencedor ?? "",
    wo: Boolean(partida.wo),
  });
  const [data, setData] = useState(partida.data && partida.data <= HOJE ? partida.data : HOJE);
  const [apagando, setApagando] = useState(false);

  const nomeA = caixa.a.inscricao?.nome ?? caixa.a.aguardando ?? "A definir";
  const nomeB = caixa.b.inscricao?.nome ?? caixa.b.aguardando ?? "A definir";
  const pronta = Boolean(caixa.a.inscricao && caixa.b.inscricao);
  const bloqueio = bloqueioDaPartida(banco, partida.id);
  const temResultado = Boolean(partida.vencedor);
  const final = !partida.grupo && !partida.proximaPartidaId && torneio.formato !== "todos_contra_todos";

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const dados = { partidaId: partida.id, ...valores, data };
    const ok = temResultado
      ? gravar(corrigirResultadoDeTorneio, dados, "Resultado corrigido.")
      : gravar(
          registrarResultadoDeTorneio,
          dados,
          final
            ? "Resultado registrado: o torneio tem um campeão!"
            : partida.proximaPartidaId
              ? "Resultado registrado: o vencedor avançou na chave."
              : "Resultado registrado.",
        );
    if (ok) aoFechar();
  }

  function apagar() {
    if (gravar(apagarResultadoDeTorneio, { partidaId: partida.id }, "Resultado apagado.")) {
      setApagando(false);
      aoFechar();
    }
  }

  return (
    <>
      <Modal
        aberto
        aoFechar={aoFechar}
        titulo={`${partida.fase ?? "Partida"} · Jogo ${caixa.numero}`}
        descricao={torneio.nome}
      >
        <form onSubmit={salvar}>
          <div className="space-y-4 px-5 py-4">
            <Confronto
              a={{ nome: nomeA, alunos: caixa.a.inscricao?.alunos ?? [] }}
              b={{ nome: nomeB, alunos: caixa.b.inscricao?.alunos ?? [] }}
              vencedor={partida.vencedor}
              placar={partida.placar}
            />

            {!pronta ? (
              <Aviso>
                {`Este jogo espera ${[caixa.a, caixa.b]
                  .filter((l) => !l.inscricao)
                  .map((l) => (l.aguardando ?? "a definição do adversário").toLowerCase())
                  .join(" e ")}.`}
              </Aviso>
            ) : bloqueio ? (
              <Aviso>{bloqueio}</Aviso>
            ) : (
              <>
                <CamposDoResultado valores={valores} aoMudar={setValores} nomeA={nomeA} nomeB={nomeB} />
                <Campo rotulo="Data do jogo" obrigatorio>
                  <input
                    type="date"
                    value={data}
                    max={HOJE}
                    onChange={(e) => setData(e.target.value)}
                    className="campo"
                  />
                </Campo>
                {temResultado && partida.data && (
                  <p className="text-xs text-areia-500">
                    Resultado registrado para {formatarData(partida.data)}. Ao salvar, a correção fica
                    no histórico.
                  </p>
                )}
              </>
            )}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-areia-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {temResultado && !bloqueio && (
                <button
                  type="button"
                  onClick={() => setApagando(true)}
                  className="btn-fantasma w-full text-tijolo-700 hover:text-tijolo-800 sm:w-auto"
                >
                  Apagar resultado
                </button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={aoFechar} className="btn-secundario">
                {pronta && !bloqueio ? "Cancelar" : "Fechar"}
              </button>
              {pronta && !bloqueio && (
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
        aberto={apagando}
        titulo="Apagar resultado?"
        mensagem={
          partida.proximaPartidaId
            ? "O resultado sai e o vencedor deixa a partida seguinte. A alteração fica no histórico."
            : "O resultado sai e o torneio volta a ficar em andamento, se já estava encerrado. A alteração fica no histórico."
        }
        rotuloConfirmar="Apagar resultado"
        perigoso
        aoConfirmar={apagar}
        aoCancelar={() => setApagando(false)}
      />
    </>
  );
}
