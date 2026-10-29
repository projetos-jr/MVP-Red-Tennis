"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import {
  cancelarOcupacao,
  encerrarHorarioFixo,
  liberarReserva,
  remarcarOcupacao,
} from "@/lib/banco/operacoes/agenda";
import type { HorarioFixo, QuadraId } from "@/lib/banco/tipos";
import {
  MOTIVO_SEM_PAGAMENTO,
  checarHorario,
  disponibilidadeDasQuadras,
  previaDoCancelamento,
  previaDoEncerramento,
  quadrasDaArena,
  rotuloDaQuadra,
  siglasParaCancelarAula,
  tipoComDireitoAReposicao,
  type ItemAgenda,
} from "@/lib/consultas/agenda";
import { formatarData, formatarDiaMes } from "@/lib/date";
import { formatarMinutos, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { Aviso, CamposDeHora, CorpoRolavel, SeletorDeQuadra } from "./CamposDeHorario";

/**
 * Janelas das acoes do painel do horario: cancelar (motivo obrigatorio, com
 * os minutos de reposicao de cada aluno ANTES de confirmar), remarcar,
 * encerrar o horario fixo e liberar a reserva vencida.
 */

const OUTRO_MOTIVO = "__outro__";

export function ConfirmarCancelamento({
  item,
  agora,
  aoFechar,
}: {
  item: ItemAgenda;
  agora: string;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const siglas = siglasParaCancelarAula(banco);
  const [escolha, setEscolha] = useState("");
  const [texto, setTexto] = useState("");
  const motivo = escolha === OUTRO_MOTIVO ? texto.trim() : escolha;
  const bloqueio = item.ocupacao.tipo === "Bloqueio";

  const previa = useMemo(
    () => (motivo ? previaDoCancelamento(banco, item.ocupacao, motivo, agora) : undefined),
    [banco, item.ocupacao, motivo, agora],
  );

  function confirmar() {
    const minutos = previa?.minutosTotais ?? 0;
    const mensagem = bloqueio
      ? "Bloqueio cancelado: a quadra está livre nesse horário."
      : `Aula cancelada (${motivo}).${minutos > 0 ? ` Reposição gerada: ${formatarMinutos(minutos)}.` : ""}`;
    if (gravar(cancelarOcupacao, { id: item.ocupacao.id, motivo }, mensagem)) aoFechar();
  }

  return (
    <Confirmacao
      aberto
      titulo={bloqueio ? "Cancelar o bloqueio" : "Cancelar esta aula"}
      mensagem={
        <>
          {rotuloDaQuadra(item.ocupacao.quadraId)} · {formatarDiaMes(item.ocupacao.data)} ·{" "}
          {item.ocupacao.horaInicio}–{item.ocupacao.horaFim}. As outras semanas não mudam.
        </>
      }
      rotuloConfirmar={bloqueio ? "Sim, cancelar o bloqueio" : "Sim, cancelar a aula"}
      perigoso
      desabilitado={!motivo}
      aoConfirmar={confirmar}
      aoCancelar={aoFechar}
    >
      <Campo
        rotulo="Motivo"
        obrigatorio
        ajuda="Sigla das Configurações ou um texto (texto não gera reposição)."
      >
        <select value={escolha} onChange={(e) => setEscolha(e.target.value)} className="campo">
          <option value="">Escolha o motivo…</option>
          {siglas.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.codigo} — {s.nome}
              {s.geraCredito ? " (gera reposição)" : ""}
            </option>
          ))}
          <option value={OUTRO_MOTIVO}>Outro motivo (escrever)</option>
        </select>
      </Campo>
      {escolha === OUTRO_MOTIVO && (
        <Campo rotulo="Qual o motivo?" obrigatorio>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="campo"
            placeholder="Ex.: evento particular"
            maxLength={80}
          />
        </Campo>
      )}

      {previa && !bloqueio && (
        <div className="rounded-xl border border-areia-200 bg-areia-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-areia-500">
            Reposição que cada aluno ganha
          </p>
          {!tipoComDireitoAReposicao(item.ocupacao.tipo) ? (
            <p className="mt-1 text-sm text-areia-700">
              {item.ocupacao.tipo} é paga por uso: não gera reposição.
            </p>
          ) : previa.porAluno.length === 0 ? (
            <p className="mt-1 text-sm text-areia-700">Nenhum aluno nesta aula.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-sm">
              {previa.porAluno.map((p) => (
                <li key={p.alunoId} className="flex justify-between gap-3">
                  <span className="truncate text-areia-800">{p.nome}</span>
                  <span
                    className={`shrink-0 font-semibold ${p.minutos > 0 ? "text-emerald-700" : "text-areia-500"}`}
                  >
                    {p.minutos > 0
                      ? `+${formatarMinutos(p.minutos)}`
                      : p.jaTinhaCredito
                        ? "já recebeu (falta avisada)"
                        : "nada"}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-areia-200 pt-1 font-semibold">
                <span>Total</span>
                <span>{formatarMinutos(previa.minutosTotais)}</span>
              </li>
            </ul>
          )}
          {previa.cobrancaAnulada && (
            <p className="mt-2 text-xs text-areia-700">
              A cobrança de {formatarMoeda(previa.cobrancaAnulada.valor)} ainda não paga será
              anulada no Financeiro.
            </p>
          )}
          {previa.cobrancaPaga && (
            <p className="mt-2 text-xs font-medium text-amber-800">
              Esta reserva já foi paga ({formatarMoeda(previa.cobrancaPaga.valor)}): combine a
              devolução no Financeiro.
            </p>
          )}
        </div>
      )}
    </Confirmacao>
  );
}

export function ModalRemarcar({ item, aoFechar }: { item: ItemAgenda; aoFechar: () => void }) {
  const { banco } = useApp();
  const gravar = useGravar();
  const { ocupacao } = item;
  const [data, setData] = useState(ocupacao.data >= HOJE ? ocupacao.data : HOJE);
  const [inicio, setInicio] = useState(ocupacao.horaInicio);
  const [fim, setFim] = useState(ocupacao.horaFim);
  const [quadraId, setQuadraId] = useState<QuadraId>(ocupacao.quadraId);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data);

  const alvo = { id: ocupacao.id, quadraId, data, horaInicio: inicio, horaFim: fim };
  const checagem = valida
    ? checarHorario(banco, { ...alvo, professorId: ocupacao.professorId })
    : undefined;
  const disponibilidade = useMemo(
    () =>
      valida
        ? disponibilidadeDasQuadras(banco, {
            id: ocupacao.id,
            data,
            horaInicio: inicio,
            horaFim: fim,
          })
        : undefined,
    [banco, ocupacao.id, data, inicio, fim, valida],
  );

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (
      gravar(
        remarcarOcupacao,
        alvo,
        `Horário remarcado para ${rotuloDaQuadra(quadraId)} · ${formatarDiaMes(data)} · ${inicio}–${fim}.`,
      )
    ) {
      aoFechar();
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Remarcar"
      descricao={`Agora: ${ocupacao.tipo} · ${rotuloDaQuadra(ocupacao.quadraId)} · ${formatarDiaMes(ocupacao.data)} · ${ocupacao.horaInicio}–${ocupacao.horaFim}`}
    >
      <form onSubmit={salvar}>
        <CorpoRolavel className="space-y-4 px-5 py-4">
          <Campo rotulo="Nova data" obrigatorio>
            <input
              type="date"
              value={data}
              min={HOJE}
              onChange={(e) => setData(e.target.value)}
              className="campo"
              required
            />
          </Campo>
          <CamposDeHora
            inicio={inicio}
            fim={fim}
            aoMudar={(novoInicio, novoFim) => {
              setInicio(novoInicio);
              setFim(novoFim);
            }}
          />
          <SeletorDeQuadra
            quadras={quadrasDaArena(banco)}
            valor={quadraId}
            aoMudar={setQuadraId}
            disponibilidade={disponibilidade}
          />
          {checagem?.conflitoNaQuadra && <Aviso tom="erro">{checagem.conflitoNaQuadra}</Aviso>}
          {checagem?.professorOcupado && (
            <Aviso tom={checagem.professorBloqueia ? "erro" : "atencao"}>
              {checagem.professorOcupado}{" "}
              {checagem.professorBloqueia ? "" : "Dá para salvar mesmo assim (H10)."}
            </Aviso>
          )}
          {ocupacao.horarioFixoId && (
            <p className="text-xs text-areia-500">
              Só esta data muda: o horário fixo continua igual nas outras semanas.
            </p>
          )}
        </CorpoRolavel>
        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar="Remarcar"
          desabilitado={!valida}
        />
      </form>
    </Modal>
  );
}

export function ConfirmarEncerramento({
  item,
  horarioFixo,
  aoFechar,
}: {
  item: ItemAgenda;
  horarioFixo: HorarioFixo;
  aoFechar: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [fim, setFim] = useState(item.ocupacao.data);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(fim);
  const removidas = useMemo(
    () => (valida ? previaDoEncerramento(banco, horarioFixo.id, fim, HOJE) : []),
    [banco, horarioFixo.id, fim, valida],
  );

  return (
    <Confirmacao
      aberto
      titulo="Encerrar horário fixo"
      mensagem="O horário deixa de se repetir depois da data escolhida. Aulas que já aconteceram e canceladas ficam no histórico."
      rotuloConfirmar={`Encerrar${removidas.length > 0 ? ` e tirar ${removidas.length} ${removidas.length === 1 ? "aula" : "aulas"}` : ""}`}
      perigoso
      desabilitado={!valida}
      aoCancelar={aoFechar}
      aoConfirmar={() => {
        if (
          gravar(
            encerrarHorarioFixo,
            { horarioFixoId: horarioFixo.id, fim },
            `Horário fixo encerrado em ${formatarData(fim)}. ${removidas.length} ${removidas.length === 1 ? "aula saiu" : "aulas saíram"} da agenda.`,
          )
        ) {
          aoFechar();
        }
      }}
    >
      <Campo rotulo="Último dia do horário" obrigatorio>
        <input
          type="date"
          value={fim}
          min={horarioFixo.inicio}
          onChange={(e) => setFim(e.target.value)}
          className="campo"
        />
      </Campo>
      <div className="rounded-xl border border-areia-200 bg-areia-50 p-3 text-sm">
        {removidas.length === 0 ? (
          <p className="text-areia-700">Nenhuma aula futura sai da agenda.</p>
        ) : (
          <>
            <p className="font-medium text-areia-800">
              {removidas.length} {removidas.length === 1 ? "aula sai" : "aulas saem"} da agenda:
            </p>
            <p className="mt-1 text-xs leading-relaxed text-areia-600">
              {removidas.map((o) => formatarDiaMes(o.data)).join(", ")}
            </p>
          </>
        )}
      </div>
    </Confirmacao>
  );
}

export function ConfirmarLiberacao({ item, aoFechar }: { item: ItemAgenda; aoFechar: () => void }) {
  const gravar = useGravar();
  return (
    <Confirmacao
      aberto
      titulo="Liberar horário"
      mensagem={
        <>
          A reserva de <strong>{item.participantes[0]?.nome ?? "cliente"}</strong> passou do prazo
          sem pagamento. Ela será cancelada com o motivo “{MOTIVO_SEM_PAGAMENTO}” (sem reposição) e
          a cobrança será anulada. O horário fica livre para outra pessoa.
        </>
      }
      rotuloConfirmar="Liberar horário"
      perigoso
      aoCancelar={aoFechar}
      aoConfirmar={() => {
        if (
          gravar(
            liberarReserva,
            { id: item.ocupacao.id },
            "Horário liberado: a reserva sem pagamento foi cancelada.",
          )
        ) {
          aoFechar();
        }
      }}
    />
  );
}
