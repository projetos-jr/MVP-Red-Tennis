"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import type { SituacaoOcupacao } from "@/lib/banco/tipos";
import { detalheDoLancamento, nomeDoMes, type DetalheLancamento } from "@/lib/consultas/financeiro";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarData, formatarDataHora, formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { BadgeCongelado, BadgeSituacao } from "./Etiquetas";

/** Nomes dos campos no histórico de alterações. */
const ROTULOS_DO_HISTORICO: Record<string, string> = {
  pagoEm: "Pago em",
  formaPagamento: "Forma de pagamento",
  valorConvenio: "Parte do convênio",
  comprovante: "Comprovante",
  nomePagante: "Quem pagou",
  canceladoEm: "Anulado em",
  motivoCancelamento: "Motivo da anulação",
};

const SITUACAO_DA_RESERVA: Record<SituacaoOcupacao, string> = {
  agendada: "confirmada",
  aguardando_pagamento: "aguardando pagamento",
  realizada: "realizada",
  cancelada: "cancelada",
};

function Dado({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-areia-500">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-areia-800">{children}</dd>
    </div>
  );
}

/** Registros que geraram o lançamento: reserva, matrícula, consumo, torneio, repasse. */
function ligacoes(detalhe: DetalheLancamento): Array<{ chave: string; texto: string }> {
  const lista: Array<{ chave: string; texto: string }> = [];
  const { reserva, matricula, plano, consumo, torneio, repasse } = detalhe;
  if (reserva) {
    const o = reserva.ocupacao;
    const prazo =
      reserva.aguardandoPagamento && o.prazoPagamento
        ? ` (prazo até ${formatarDataHora(o.prazoPagamento).replace(" · ", " às ")})`
        : "";
    lista.push({
      chave: "reserva",
      texto: `Reserva · ${reserva.quadra} · ${DIAS_SEMANA_CURTO[diaDaSemana(o.data)]} ${formatarDiaMes(o.data)} · ${o.horaInicio}–${o.horaFim} · ${SITUACAO_DA_RESERVA[o.situacao]}${prazo}`,
    });
  }
  if (matricula) {
    lista.push({
      chave: "matricula",
      texto: `Matrícula · ${plano?.nome ?? "plano"} · ${formatarMoeda(matricula.valorMensal)} por mês · vence todo dia ${matricula.diaVencimento}`,
    });
  }
  if (consumo) {
    lista.push({
      chave: "consumo",
      texto: `Consumo no balcão · ${consumo.quantidade}× ${consumo.produtoNome} · ${formatarDataHora(consumo.data)}`,
    });
  }
  if (torneio) {
    lista.push({ chave: "torneio", texto: `Torneio · ${torneio.nome} · ${formatarData(torneio.data)}` });
  }
  if (repasse) {
    lista.push({
      chave: "repasse",
      texto: `Fechamento do repasse de ${nomeDoMes(repasse.competencia)} · ${repasse.aulasDadas} aulas · fechado em ${formatarData(repasse.fechadoEm)}`,
    });
  }
  return lista;
}

export function DetalheDoLancamento({
  id,
  aoFechar,
  aoPagar,
  aoAnular,
}: {
  id: string;
  aoFechar: () => void;
  aoPagar: (id: string) => void;
  aoAnular: (id: string) => void;
}) {
  const { banco } = useApp();
  const detalhe = useMemo(() => detalheDoLancamento(banco, id, HOJE), [banco, id]);

  if (!detalhe) {
    return (
      <Modal aberto aoFechar={aoFechar} titulo="Lançamento não encontrado">
        <p className="px-5 py-6 text-sm text-areia-600">
          Este lançamento não existe. Confira o endereço ou procure na lista.
        </p>
      </Modal>
    );
  }

  const { linha } = detalhe;
  const { lancamento: l, pessoa } = linha;
  const anulado = linha.situacao === "cancelado";
  const aberto = linha.situacao === "pendente" || linha.situacao === "em_atraso";
  const receber = l.tipo === "receber";
  const ligados = ligacoes(detalhe);

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={l.item}
      descricao={`${receber ? "Conta a receber" : "Conta a pagar"} · ${l.categoria}`}
      largura="lg"
    >
      <div className="space-y-5 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className={`text-3xl font-bold leading-none ${anulado ? "text-areia-400 line-through" : "text-areia-900"}`}
            >
              {formatarMoeda(l.valor)}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <BadgeSituacao linha={linha} />
              {linha.congelada && <BadgeCongelado />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {aberto && (
              <button type="button" onClick={() => aoPagar(l.id)} className="btn-primario">
                Registrar pagamento
              </button>
            )}
            {!anulado && (
              <button
                type="button"
                onClick={() => aoAnular(l.id)}
                className="btn-secundario text-tijolo-700 hover:border-tijolo-300 hover:bg-tijolo-50 hover:text-tijolo-800"
              >
                Anular
              </button>
            )}
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {pessoa && (
            <Dado rotulo={pessoa.tipo === "aluno" ? "Aluno" : "Professor"}>
              <Link
                href={pessoa.tipo === "aluno" ? `/alunos/${pessoa.id}` : `/professores/${pessoa.id}`}
                className="font-medium text-tijolo-700 hover:underline"
              >
                {pessoa.nome}
              </Link>
            </Dado>
          )}
          <Dado rotulo={receber ? (l.pagoEm ? "Quem pagou" : "Quem paga") : "Favorecido"}>
            {l.nomePagante ?? "—"}
          </Dado>
          <Dado rotulo="Vencimento">{formatarData(l.vencimento)}</Dado>
          <Dado rotulo="Pago em">
            {l.pagoEm ? formatarData(l.pagoEm) : anulado ? "Não foi pago" : "Ainda não pago"}
          </Dado>
          <Dado rotulo="Forma de pagamento">{l.formaPagamento ?? "Não informada"}</Dado>
          {l.valorConvenio !== undefined && (
            <Dado rotulo="Parte do convênio">
              {formatarMoeda(l.valorConvenio)} · complemento {formatarMoeda(l.valor - l.valorConvenio)}
            </Dado>
          )}
          <Dado rotulo="Comprovante">{l.comprovante ?? "Nenhum"}</Dado>
          {l.competencia && <Dado rotulo="Mês de referência">{nomeDoMes(l.competencia)}</Dado>}
          <Dado rotulo="Lançado em">{formatarDataHora(l.criadoEm)}</Dado>
          {l.canceladoEm && <Dado rotulo="Anulado em">{formatarDataHora(l.canceladoEm)}</Dado>}
          {l.motivoCancelamento && (
            <Dado rotulo="Motivo da anulação" className="sm:col-span-2">
              {l.motivoCancelamento}
            </Dado>
          )}
        </dl>

        {ligados.length > 0 && (
          <section className="rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-areia-500">Ligado a</h3>
            <ul className="mt-1.5 space-y-1 text-sm text-areia-700">
              {ligados.map((item) => (
                <li key={item.chave}>{item.texto}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="grid border-t border-areia-200 md:grid-cols-2 md:divide-x md:divide-areia-200">
        <section className="min-w-0">
          <h3 className="px-4 pt-4 text-sm font-semibold text-areia-900">Comentários</h3>
          <ComentariosDoRegistro entidade="lancamento" entidadeId={l.id} semCartao />
        </section>
        <section className="min-w-0 border-t border-areia-200 md:border-t-0">
          <h3 className="px-4 pt-4 text-sm font-semibold text-areia-900">Histórico</h3>
          <HistoricoDoRegistro
            tabela="lancamentos"
            registroId={l.id}
            rotulos={ROTULOS_DO_HISTORICO}
            semCartao
          />
        </section>
      </div>
    </Modal>
  );
}
