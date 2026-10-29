"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeAgenda } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { registrarPagamento } from "@/lib/banco/operacoes/financeiro";
import { detalheDoLancamento } from "@/lib/consultas/financeiro";
import { formatarData, formatarDiaMes } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { CampoComprovante } from "./CampoComprovante";
import { BadgeSituacao } from "./Etiquetas";
import { lerValor } from "./utilitarios";

/**
 * Registrar pagamento de um lançamento. Se for a cobrança de uma reserva que
 * aguarda pagamento, a tela avisa que a reserva fica confirmada na agenda.
 */
export function ModalPagamento({
  id,
  aoFechar,
  aoConcluir,
}: {
  id: string;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const detalhe = useMemo(() => detalheDoLancamento(banco, id, HOJE), [banco, id]);
  const lancamento = detalhe?.linha.lancamento;

  const [pagoEm, setPagoEm] = useState(HOJE);
  const [forma, setForma] = useState(lancamento?.formaPagamento ?? "");
  const [nomePagante, setNomePagante] = useState(lancamento?.nomePagante ?? "");
  const [convenio, setConvenio] = useState(
    lancamento?.valorConvenio !== undefined ? String(lancamento.valorConvenio).replace(".", ",") : "",
  );
  const [comprovante, setComprovante] = useState(lancamento?.comprovante ?? "");

  if (!detalhe || !lancamento) return null;
  const receber = lancamento.tipo === "receber";
  const reserva = detalhe.reserva?.aguardandoPagamento ? detalhe.reserva : undefined;
  const valorConvenio = lerValor(convenio);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const gravou = gravar(
      registrarPagamento,
      {
        id,
        pagoEm,
        formaPagamento: forma,
        valorConvenio: receber ? valorConvenio : undefined,
        comprovante,
        nomePagante: receber ? nomePagante : undefined,
      },
      reserva
        ? "Pagamento registrado. A reserva está confirmada na agenda."
        : "Pagamento registrado.",
    );
    if (gravou) aoConcluir();
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Registrar pagamento"
      descricao={receber ? "Conta a receber" : "Conta a pagar"}
    >
      <form onSubmit={enviar} noValidate>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-areia-200 bg-areia-50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-areia-900">
                  {detalhe.linha.pessoa?.nome ?? lancamento.nomePagante}
                </p>
                <p className="mt-0.5 text-sm text-areia-700">{lancamento.item}</p>
                <p className="mt-1 text-xs text-areia-500">
                  Vence em {formatarData(lancamento.vencimento)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-areia-900">{formatarMoeda(lancamento.valor)}</p>
                <div className="mt-1">
                  <BadgeSituacao linha={detalhe.linha} />
                </div>
              </div>
            </div>
          </div>

          {reserva && (
            <p className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-900">
              <IconeAgenda className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Ao registrar o pagamento, a reserva da {reserva.quadra} em{" "}
                {formatarDiaMes(reserva.ocupacao.data)}, das {reserva.ocupacao.horaInicio} às{" "}
                {reserva.ocupacao.horaFim}, fica <strong>confirmada</strong> na agenda.
              </span>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data do pagamento" obrigatorio>
              <input
                type="date"
                value={pagoEm}
                max={HOJE}
                onChange={(e) => setPagoEm(e.target.value)}
                className="campo"
              />
            </Campo>
            <Campo rotulo="Forma de pagamento" obrigatorio>
              <select value={forma} onChange={(e) => setForma(e.target.value)} className="campo">
                <option value="">Escolha…</option>
                {banco.configuracoes.formasPagamento.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {receber && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Quem pagou" ajuda="Pode ser outra pessoa: pai, mãe, empresa.">
                <input
                  value={nomePagante}
                  onChange={(e) => setNomePagante(e.target.value)}
                  className="campo"
                />
              </Campo>
              <Campo
                rotulo="Parte coberta por convênio (R$)"
                ajuda={
                  valorConvenio && valorConvenio > 0 && valorConvenio <= lancamento.valor
                    ? `Complemento pago à parte: ${formatarMoeda(lancamento.valor - valorConvenio)}`
                    : "Opcional. Só registro, sem ligação com o convênio."
                }
              >
                <input
                  inputMode="decimal"
                  value={convenio}
                  onChange={(e) => setConvenio(e.target.value)}
                  placeholder="0,00"
                  className="campo"
                />
              </Campo>
            </div>
          )}

          <CampoComprovante nome={comprovante} aoEscolher={setComprovante} />
        </div>

        <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Registrar pagamento" />
      </form>
    </Modal>
  );
}
