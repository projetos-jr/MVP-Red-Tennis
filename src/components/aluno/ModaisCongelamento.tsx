"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Campo, MensagemDeErro, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { congelarPlano, reativarPlano } from "@/lib/banco/operacoes/alunos";
import type { Aluno, Congelamento } from "@/lib/banco/tipos";
import { previaDaReativacao, previaDoCongelamento } from "@/lib/consultas/alunos";
import { formatarData, somarDias } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { ListaCompactaDeAulas } from "./ListaCompactaDeAulas";
import { classeDoCampo, plural } from "./estilos";

const SUGESTOES_DE_MOTIVO = ["Viagem", "Férias", "Trabalho", "Pausa a pedido do aluno"];

// ---------------------------------------------------------------------------
// Congelar (Hipotese H4)
// ---------------------------------------------------------------------------

export function ModalCongelar({
  aberto,
  aoFechar,
  aluno,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aluno: Aluno;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Congelar plano"
      descricao={`${aluno.nome} · as aulas fixas do período ficam suspensas, sem gerar reposição.`}
    >
      <ConteudoCongelar aoFechar={aoFechar} aluno={aluno} />
    </Modal>
  );
}

function ConteudoCongelar({ aoFechar, aluno }: { aoFechar: () => void; aluno: Aluno }) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [inicio, setInicio] = useState(HOJE);
  const [fimPrevisto, setFimPrevisto] = useState(somarDias(HOJE, 29));
  const [motivo, setMotivo] = useState("");
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const previa = useMemo(
    () => previaDoCongelamento(banco, aluno.id, inicio, fimPrevisto),
    [banco, aluno.id, inicio, fimPrevisto],
  );
  const canceladas = previa.suspensas.filter((a) => a.acao === "cancelada").length;
  const emTurma = previa.suspensas.length - canceladas;
  const datasValidas = Boolean(inicio && fimPrevisto && fimPrevisto >= inicio);

  function validar(): Record<string, string> {
    const encontrados: Record<string, string> = {};
    if (!inicio) encontrados.inicio = "Informe o início do congelamento.";
    if (!fimPrevisto) encontrados.fim = "Informe o fim previsto.";
    else if (inicio && fimPrevisto < inicio) {
      encontrados.fim = "O fim previsto precisa ser no mesmo dia do início ou depois.";
    }
    if (!motivo.trim()) encontrados.motivo = "Informe o motivo do congelamento.";
    return encontrados;
  }
  const erros = tentouSalvar ? validar() : {};

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentouSalvar(true);
    if (Object.keys(validar()).length > 0) return;

    const mensagem =
      previa.suspensas.length > 0
        ? `Plano congelado. ${plural(previa.suspensas.length, "aula suspensa", "aulas suspensas")}.`
        : "Plano congelado.";
    if (gravar(congelarPlano, { alunoId: aluno.id, inicio, fimPrevisto, motivo }, mensagem)) {
      aoFechar();
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Início" obrigatorio erro={erros.inicio}>
            <input
              type="date"
              className={classeDoCampo(erros.inicio)}
              aria-invalid={Boolean(erros.inicio)}
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Fim previsto"
            obrigatorio
            erro={erros.fim}
            ajuda="Último dia congelado. Dá para reativar antes."
          >
            <input
              type="date"
              className={classeDoCampo(erros.fim)}
              aria-invalid={Boolean(erros.fim)}
              value={fimPrevisto}
              min={inicio || undefined}
              onChange={(e) => setFimPrevisto(e.target.value)}
            />
          </Campo>
        </div>

        <div>
          <Campo rotulo="Motivo" obrigatorio erro={erros.motivo}>
            <input
              className={classeDoCampo(erros.motivo)}
              aria-invalid={Boolean(erros.motivo)}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Ex.: viagem a trabalho"
            />
          </Campo>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="sr-only">Sugestões de motivo:</span>
            {SUGESTOES_DE_MOTIVO.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                onClick={() => setMotivo(sugestao)}
                className="chip border border-areia-200 bg-white text-areia-700 hover:border-saibro-300 hover:text-saibro-800"
              >
                {sugestao}
              </button>
            ))}
          </div>
        </div>

        {datasValidas && !previa.matricula ? (
          <MensagemDeErro>
            {aluno.nome} não tem matrícula valendo em {formatarData(inicio)}: não há plano para
            congelar nessa data.
          </MensagemDeErro>
        ) : (
          datasValidas && (
            <section
              aria-label="O que acontece com as aulas"
              className="space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-sm text-sky-950"
            >
              {previa.suspensas.length === 0 ? (
                <p>Nenhuma aula fixa agendada nesse período.</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {plural(previa.suspensas.length, "aula fixa fica suspensa", "aulas fixas ficam suspensas")}
                    , sem gerar reposição:
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {canceladas > 0 && (
                      <li>
                        {plural(canceladas, "aula é cancelada", "aulas são canceladas")} (eram só do
                        aluno; a quadra fica livre);
                      </li>
                    )}
                    {emTurma > 0 && (
                      <li>
                        em {plural(emTurma, "aula de turma", "aulas de turma")} o aluno sai da lista e
                        a aula continua para os outros.
                      </li>
                    )}
                  </ul>
                  <ListaCompactaDeAulas
                    itens={previa.suspensas.map((a) => ({
                      ocupacao: a.ocupacao,
                      detalhe: a.acao === "cancelada" ? "cancelada" : "sai da turma",
                    }))}
                  />
                </>
              )}
              {previa.avulsas.length > 0 && (
                <p className="text-xs">
                  {plural(previa.avulsas.length, "reserva avulsa ou reposição", "reservas avulsas ou reposições")}{" "}
                  no período não {previa.avulsas.length === 1 ? "muda" : "mudam"}: cancele pela agenda,
                  se for o caso.
                </p>
              )}
              <p className="text-xs text-sky-800">
                Se o aluno voltar antes, as aulas a partir da volta retornam para a agenda. A
                mensalidade não muda sozinha (Hipótese H4).
              </p>
            </section>
          )
        )}
      </div>
      <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Congelar plano" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Reativar (ou cancelar um congelamento que ainda nao comecou)
// ---------------------------------------------------------------------------

export function ModalReativar({
  aberto,
  aoFechar,
  congelamento,
}: {
  aberto: boolean;
  aoFechar: () => void;
  congelamento: Congelamento;
}) {
  const agendado = congelamento.inicio > HOJE;
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={agendado ? "Desmarcar congelamento" : "Reativar plano"}
      descricao={
        agendado
          ? `Congelamento marcado para ${formatarData(congelamento.inicio)}. As aulas suspensas voltam para a agenda.`
          : "Informe quando o aluno volta. As aulas suspensas a partir desse dia retornam para a agenda."
      }
    >
      <ConteudoReativar aoFechar={aoFechar} congelamento={congelamento} agendado={agendado} />
    </Modal>
  );
}

function ConteudoReativar({
  aoFechar,
  congelamento,
  agendado,
}: {
  aoFechar: () => void;
  congelamento: Congelamento;
  agendado: boolean;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [dataVolta, setDataVolta] = useState(HOJE);
  const previa = useMemo(
    () => previaDaReativacao(banco, congelamento.id, dataVolta, HOJE),
    [banco, congelamento.id, dataVolta],
  );
  const semRegistroDeAulas = congelamento.aulasSuspensas === undefined;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!dataVolta) return;
    const voltam = previa?.voltam.length ?? 0;
    const mensagem = agendado
      ? "Congelamento desmarcado."
      : previa?.cancela
        ? "Congelamento cancelado."
        : `Plano reativado.${voltam > 0 ? ` ${plural(voltam, "aula voltou", "aulas voltaram")} para a agenda.` : ""}`;
    if (gravar(reativarPlano, { congelamentoId: congelamento.id, dataVolta }, mensagem)) aoFechar();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="space-y-4 px-5 py-4">
        {!agendado && (
          <Campo rotulo="Data de volta" obrigatorio ajuda="Primeiro dia em que o aluno volta às aulas.">
            <input
              type="date"
              className="campo"
              value={dataVolta}
              onChange={(e) => setDataVolta(e.target.value)}
            />
          </Campo>
        )}

        {previa && (
          <section
            aria-label="O que acontece com as aulas"
            className="space-y-2.5 rounded-xl border border-areia-200 bg-areia-50 p-3.5 text-sm text-areia-800"
          >
            <p>
              {agendado
                ? "O congelamento é desmarcado e não vale para nenhum dia."
                : previa.cancela
                  ? "Como a volta é no dia do início (ou antes), o congelamento é cancelado e não vale para nenhum dia."
                  : `O plano fica congelado até ${formatarData(previa.fimReal)}.`}
            </p>

            {semRegistroDeAulas ? (
              <p className="text-xs text-areia-600">
                Este congelamento é anterior ao registro das aulas suspensas: nenhuma aula volta
                sozinha. Marque os horários do aluno pela agenda.
              </p>
            ) : (
              <>
                {previa.voltam.length > 0 ? (
                  <>
                    <p className="font-semibold text-emerald-800">
                      {plural(previa.voltam.length, "aula volta", "aulas voltam")} para a agenda:
                    </p>
                    <ListaCompactaDeAulas
                      itens={previa.voltam.map((a) => ({
                        ocupacao: a.ocupacao,
                        detalhe: a.acao === "cancelada" ? "reagendada" : "volta para a turma",
                      }))}
                    />
                  </>
                ) : (
                  <p>Nenhuma aula suspensa a partir dessa data.</p>
                )}
                {previa.naoVoltam.length > 0 && (
                  <>
                    <p className="font-semibold text-tijolo-800">
                      {plural(previa.naoVoltam.length, "aula não pode voltar", "aulas não podem voltar")}{" "}
                      (continuam suspensas):
                    </p>
                    <ListaCompactaDeAulas
                      itens={previa.naoVoltam.map((a) => ({ ocupacao: a.ocupacao, detalhe: a.motivo }))}
                    />
                  </>
                )}
                {previa.continuamSuspensas - previa.naoVoltam.length > 0 && (
                  <p className="text-xs text-areia-600">
                    {plural(
                      previa.continuamSuspensas - previa.naoVoltam.length,
                      "aula antes da volta continua suspensa",
                      "aulas antes da volta continuam suspensas",
                    )}
                    .
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>
      <RodapeDoFormulario
        aoCancelar={aoFechar}
        rotuloConfirmar={agendado ? "Desmarcar congelamento" : "Reativar plano"}
        desabilitado={!dataVolta}
      />
    </form>
  );
}
