"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { IconeCheck, IconeFechar, IconeLixeira } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { marcarPresenca, removerAluno } from "@/lib/banco/operacoes/agenda";
import type { Presenca } from "@/lib/banco/tipos";
import {
  duracaoEmMinutos,
  siglasParaFaltaDeAluno,
  tipoComDireitoAReposicao,
  type ItemAgenda,
  type ParticipanteNaAgenda,
} from "@/lib/consultas/agenda";
import { formatarMinutos } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { IconeReposicao } from "./Icones";
import { ESTILO_PRESENCA, ROTULO_PRESENCA } from "./estilos";

/**
 * Alunos de um horario com a presenca de cada um: presente, falta ou falta
 * avisada (com a sigla — se ela der direito, o credito e so desse aluno; em
 * aula Individual a falta avisada cancela a aula). Clicar de novo na opcao
 * marcada desfaz a marcacao. `grande` e o modo quadra (tablet).
 */
export function ListaDePresenca({
  item,
  podeEditar,
  grande,
}: {
  item: ItemAgenda;
  podeEditar: boolean;
  grande?: boolean;
}) {
  if (item.participantes.length === 0) {
    return <p className="px-4 py-4 text-sm text-areia-500">Nenhum aluno neste horário.</p>;
  }
  return (
    <ul className="divide-y divide-areia-100">
      {item.participantes.map((participante, indice) => (
        <LinhaDoAluno
          key={participante.participacao.id}
          item={item}
          participante={participante}
          titular={item.ocupacao.tipo === "Locação Avulsa" && indice === 0}
          podeEditar={podeEditar}
          grande={grande}
        />
      ))}
    </ul>
  );
}

function LinhaDoAluno({
  item,
  participante,
  titular,
  podeEditar,
  grande,
}: {
  item: ItemAgenda;
  participante: ParticipanteNaAgenda;
  titular: boolean;
  podeEditar: boolean;
  grande?: boolean;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const siglas = siglasParaFaltaDeAluno(banco);
  const [avisando, setAvisando] = useState(false);
  const [sigla, setSigla] = useState(siglas[0]?.codigo ?? "");
  const [removendo, setRemovendo] = useState(false);

  const { ocupacao } = item;
  const { participacao, aluno, nome } = participante;
  const futuro = ocupacao.data > HOJE;
  const editavel = podeEditar && !item.cancelada;
  const estilo = ESTILO_PRESENCA[participacao.presenca];
  const regra = siglas.find((s) => s.codigo === sigla);
  const minutosDeCredito =
    regra?.geraCredito && tipoComDireitoAReposicao(ocupacao.tipo) ? duracaoEmMinutos(ocupacao) : 0;

  function marcar(presenca: Presenca, mensagem: string, comSigla?: string) {
    // Clicar de novo na opcao ja marcada desfaz a marcacao.
    const desfazer = presenca === participacao.presenca && presenca !== "falta_avisada";
    const gravou = gravar(
      marcarPresenca,
      {
        ocupacaoId: ocupacao.id,
        alunoId: participacao.alunoId,
        presenca: desfazer ? "a_marcar" : presenca,
        sigla: comSigla,
      },
      desfazer ? `Marcação de ${nome} desfeita.` : mensagem,
    );
    if (gravou) setAvisando(false);
  }

  function confirmarAviso() {
    const credito =
      minutosDeCredito > 0
        ? `${nome} ganhou ${formatarMinutos(minutosDeCredito)} de reposição.`
        : "Esta falta não gera reposição.";
    const mensagem =
      ocupacao.tipo === "Individual"
        ? `Falta avisada (${sigla}): a aula individual foi cancelada. ${credito}`
        : `Falta avisada (${sigla}) registrada. ${credito}`;
    marcar("falta_avisada", mensagem, sigla);
  }

  const botao = grande
    ? "min-h-[56px] flex-1 rounded-xl px-4 text-base font-semibold"
    : "alvo-de-toque rounded-lg px-2.5 py-1.5 text-xs font-semibold";

  return (
    <li className={grande ? "px-4 py-4" : "px-4 py-3"}>
      <div className={`flex flex-wrap items-center gap-3 ${grande ? "md:flex-nowrap" : ""}`}>
        {/* min-w: sem espaco para os botoes ao lado, eles descem para a linha de baixo */}
        <Link
          href={`/alunos/${participacao.alunoId}`}
          className="flex min-w-[11rem] flex-1 items-center gap-2.5 underline-offset-2 hover:underline"
        >
          <Avatar
            id={participacao.alunoId}
            nome={nome}
            src={aluno?.fotoUrl}
            tamanho={grande ? "md" : "sm"}
          />
          <span className="min-w-0">
            <span
              className={`block truncate font-semibold text-areia-900 ${grande ? "text-lg" : "text-sm"}`}
            >
              {nome}
            </span>
            <span className="flex flex-wrap items-center gap-1">
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ color: estilo.cor, backgroundColor: estilo.fundo }}
              >
                {ROTULO_PRESENCA[participacao.presenca]}
                {participacao.sigla ? ` · ${participacao.sigla}` : ""}
              </span>
              {titular && (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
                  Titular
                </span>
              )}
              {participante.porReposicao && (
                <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800">
                  <IconeReposicao className="h-3 w-3" />
                  Reposição
                </span>
              )}
            </span>
          </span>
        </Link>

        {editavel && (
          <div
            className={`flex items-center gap-1.5 ${grande ? "w-full md:w-auto md:min-w-[420px]" : ""}`}
          >
            <button
              type="button"
              disabled={futuro}
              aria-pressed={participacao.presenca === "presente"}
              title={futuro ? "Presença só no dia da aula" : "Clique de novo para desmarcar"}
              onClick={() => marcar("presente", `Presença de ${nome} marcada.`)}
              className={`${botao} inline-flex items-center justify-center gap-1.5 border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                participacao.presenca === "presente"
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <IconeCheck className={grande ? "h-5 w-5" : "h-3.5 w-3.5"} />
              Presente
            </button>
            <button
              type="button"
              disabled={futuro}
              aria-pressed={participacao.presenca === "falta"}
              title={futuro ? "Falta só no dia da aula" : "Clique de novo para desmarcar"}
              onClick={() => marcar("falta", `Falta de ${nome} marcada.`)}
              className={`${botao} inline-flex items-center justify-center gap-1.5 border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                participacao.presenca === "falta"
                  ? "border-tijolo-700 bg-tijolo-700 text-white"
                  : "border-tijolo-200 bg-tijolo-50 text-tijolo-800 hover:bg-tijolo-100"
              }`}
            >
              <IconeFechar className={grande ? "h-5 w-5" : "h-3.5 w-3.5"} />
              Falta
            </button>
            <button
              type="button"
              aria-pressed={participacao.presenca === "falta_avisada"}
              aria-expanded={avisando}
              onClick={() =>
                participacao.presenca === "falta_avisada"
                  ? marcar("a_marcar", `Falta avisada de ${nome} desfeita.`)
                  : setAvisando((atual) => !atual)
              }
              title={
                participacao.presenca === "falta_avisada"
                  ? "Clique para desfazer a falta avisada"
                  : undefined
              }
              className={`${botao} border transition-colors ${
                participacao.presenca === "falta_avisada"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              Avisou
            </button>
            {!grande && (
              <button
                type="button"
                onClick={() => setRemovendo(true)}
                className="btn-fantasma px-2 py-1.5"
                aria-label={`Tirar ${nome} desta aula`}
                title="Tirar da aula"
              >
                <IconeLixeira className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {avisando && editavel && (
        <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <label className="block text-sm font-medium text-areia-800">
            Sigla da falta avisada
            <select
              value={sigla}
              onChange={(e) => setSigla(e.target.value)}
              className={`campo mt-1.5 ${grande ? "py-3 text-base" : ""}`}
            >
              {siglas.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.codigo} — {s.nome}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-areia-700">
            {minutosDeCredito > 0
              ? `${nome} ganha ${formatarMinutos(minutosDeCredito)} de reposição.`
              : "Esta falta não gera reposição."}{" "}
            {ocupacao.tipo === "Individual" &&
              "Em aula individual, a falta avisada cancela a aula."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmarAviso}
              disabled={!sigla}
              className={`btn-primario ${grande ? "min-h-[48px] flex-1 text-base" : "px-3 py-1.5 text-xs"}`}
            >
              Confirmar falta avisada
            </button>
            <button
              type="button"
              onClick={() => setAvisando(false)}
              className={`btn-secundario ${grande ? "min-h-[48px] text-base" : "px-3 py-1.5 text-xs"}`}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      <Confirmacao
        aberto={removendo}
        titulo="Tirar aluno da aula"
        mensagem={
          <>
            Tirar <strong>{nome}</strong> desta aula?
            {participante.porReposicao &&
              " Ele estava aqui por reposição: os minutos voltam para o saldo dele."}
          </>
        }
        rotuloConfirmar="Tirar da aula"
        perigoso
        aoCancelar={() => setRemovendo(false)}
        aoConfirmar={() => {
          if (
            gravar(
              removerAluno,
              { ocupacaoId: ocupacao.id, alunoId: participacao.alunoId },
              `${nome} saiu da aula.`,
            )
          ) {
            setRemovendo(false);
          }
        }}
      />
    </li>
  );
}
