"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { inativarAluno, reativarCadastro } from "@/lib/banco/operacoes/alunos";
import type { Aluno } from "@/lib/banco/tipos";
import { previaDaInativacao } from "@/lib/consultas/alunos";
import { formatarData } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { ListaCompactaDeAulas } from "./ListaCompactaDeAulas";
import { plural } from "./estilos";

// ---------------------------------------------------------------------------
// Inativar
// ---------------------------------------------------------------------------

export function ModalInativar({
  aberto,
  aoFechar,
  aluno,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aluno: Aluno;
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Inativar aluno" descricao={aluno.nome}>
      <ConteudoInativar aoFechar={aoFechar} aluno={aluno} />
    </Modal>
  );
}

function ConteudoInativar({ aoFechar, aluno }: { aoFechar: () => void; aluno: Aluno }) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [ultimoDia, setUltimoDia] = useState(HOJE);
  const [motivo, setMotivo] = useState("");
  const previa = useMemo(
    () => previaDaInativacao(banco, aluno.id, ultimoDia, HOJE),
    [banco, aluno.id, ultimoDia],
  );
  const canceladas = previa.aulas.filter((a) => a.acao === "cancelada").length;
  const emTurma = previa.aulas.length - canceladas;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (gravar(inativarAluno, { alunoId: aluno.id, ultimoDia, motivo }, `${aluno.nome} foi inativado.`)) {
      aoFechar();
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="space-y-4 px-5 py-4 text-sm text-areia-700">
        <p className="leading-relaxed">
          O aluno sai da arena: fica inativo e deixa as aulas fixas da agenda. Pagamentos,
          histórico e comentários continuam guardados, e o cadastro pode ser reativado depois.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Último dia na arena"
            obrigatorio
            ajuda="As aulas fixas depois desse dia saem da agenda."
          >
            <input
              type="date"
              className="campo"
              value={ultimoDia}
              max={HOJE}
              onChange={(e) => setUltimoDia(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Motivo" ajuda="Opcional. Vira um comentário na ficha.">
            <input
              className="campo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              placeholder="Ex.: mudou de cidade"
            />
          </Campo>
        </div>

        <section
          aria-label="O que acontece ao inativar"
          className="space-y-2.5 rounded-xl border border-tijolo-200 bg-tijolo-50/60 p-3.5 text-tijolo-950"
        >
          <p className="font-semibold">Ao inativar:</p>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {previa.matricula ? (
              <li>
                a matrícula do plano <strong>{previa.plano?.nome ?? "—"}</strong> termina em{" "}
                {ultimoDia ? formatarData(ultimoDia) : "—"};
              </li>
            ) : (
              <li>o aluno não tem matrícula valendo nessa data;</li>
            )}
            {previa.matriculasAgendadas > 0 && (
              <li>
                {plural(
                  previa.matriculasAgendadas,
                  "matrícula marcada para depois é desmarcada",
                  "matrículas marcadas para depois são desmarcadas",
                )}
                ;
              </li>
            )}
            {canceladas > 0 && (
              <li>
                {plural(canceladas, "aula fixa é cancelada", "aulas fixas são canceladas")} (eram só
                do aluno);
              </li>
            )}
            {emTurma > 0 && <li>o aluno sai de {plural(emTurma, "aula de turma", "aulas de turma")};</li>}
            {previa.horariosFixos > 0 && (
              <li>o aluno sai de {plural(previa.horariosFixos, "horário fixo", "horários fixos")};</li>
            )}
            {previa.aulas.length === 0 && previa.horariosFixos === 0 && (
              <li>não há aulas fixas futuras para tirar da agenda;</li>
            )}
            <li>nenhuma reposição é gerada.</li>
          </ul>
          <ListaCompactaDeAulas
            itens={previa.aulas.map((a) => ({
              ocupacao: a.ocupacao,
              detalhe: a.acao === "cancelada" ? "cancelada" : "sai da turma",
            }))}
            limite={4}
          />
          {previa.avulsas.length > 0 && (
            <p className="text-xs">
              <strong className="font-semibold">Atenção:</strong>{" "}
              {plural(
                previa.avulsas.length,
                "reserva avulsa ou reposição futura continua marcada",
                "reservas avulsas ou reposições futuras continuam marcadas",
              )}
              . Cancele pela agenda, se for o caso.
            </p>
          )}
        </section>
      </div>
      <RodapeDoFormulario
        aoCancelar={aoFechar}
        rotuloConfirmar="Inativar aluno"
        perigoso
        desabilitado={!ultimoDia}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Reativar cadastro
// ---------------------------------------------------------------------------

export function ConfirmarReativacaoDoCadastro({
  aberto,
  aoFechar,
  aluno,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aluno: Aluno;
}) {
  const gravar = useGravar();
  return (
    <Confirmacao
      aberto={aberto}
      titulo="Reativar cadastro"
      rotuloConfirmar="Reativar cadastro"
      mensagem={
        <>
          <strong>{aluno.nome}</strong> volta a aparecer como aluno ativo, ainda sem plano. Depois,
          crie a matrícula nesta ficha e marque os horários na agenda.
        </>
      }
      aoCancelar={aoFechar}
      aoConfirmar={() => {
        if (gravar(reativarCadastro, { alunoId: aluno.id }, "Cadastro reativado.")) aoFechar();
      }}
    />
  );
}
