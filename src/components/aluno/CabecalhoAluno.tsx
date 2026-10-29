"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  IconeAgenda,
  IconeCongelado,
  IconeEmail,
  IconeTelefone,
  IconeVoltar,
} from "@/components/ui/Icons";
import type { ResumoDoAluno } from "@/lib/consultas/alunos";
import { formatarData, somarDias } from "@/lib/date";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { IconeEditar, IconeSaida } from "./Icones";
import { ESTILO_SITUACAO_ALUNO, ESTILO_TABELA, idade } from "./estilos";

interface CabecalhoAlunoProps {
  resumo: ResumoDoAluno;
  hoje: string;
  /** Perfil pode alterar (Hipotese H9: professor so consulta). */
  podeEditar: boolean;
  aoEditar: () => void;
  aoCongelar: () => void;
  aoReativarPlano: () => void;
  aoInativar: () => void;
  aoReativarCadastro: () => void;
}

/** Cabecalho da ficha: identidade, situacao, plano, professor e as acoes principais. */
export function CabecalhoAluno({
  resumo,
  hoje,
  podeEditar,
  aoEditar,
  aoCongelar,
  aoReativarPlano,
  aoInativar,
  aoReativarCadastro,
}: CabecalhoAlunoProps) {
  const { aluno, situacao, plano, professor, congelamento, congelamentoAgendado, matricula } = resumo;
  const estilo = ESTILO_SITUACAO_ALUNO[situacao];
  const categoria = aluno.categoriaRanking ? ESTILO_CATEGORIA[aluno.categoriaRanking] : undefined;

  return (
    <div className="space-y-4">
      <Link
        href="/alunos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-areia-600 transition-colors hover:text-tijolo-700"
      >
        <IconeVoltar className="h-4 w-4" />
        Alunos
      </Link>

      <section className="card overflow-hidden">
        {/* Faixa de saibro no topo do cartao */}
        <div className="h-20 bg-gradient-to-r from-saibro-600 via-saibro-500 to-saibro-700" />

        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
          <Avatar
            id={aluno.id}
            nome={aluno.nome}
            src={aluno.fotoUrl}
            tamanho="xl"
            comAnel
            className="-mt-12 shadow-card sm:self-start"
          />

          <div className="min-w-0 flex-1 sm:pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-areia-900">{aluno.nome}</h1>
              <Badge cor={estilo.cor} fundo={estilo.fundo} borda={estilo.borda}>
                {situacao === "congelado" && <IconeCongelado className="h-3.5 w-3.5" />}
                {estilo.rotulo}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-areia-600">
              {aluno.telefone && (
                <a
                  href={`tel:+55${aluno.telefone.replace(/\D/g, "")}`}
                  className="flex items-center gap-1.5 hover:text-tijolo-700"
                >
                  <IconeTelefone className="h-4 w-4 text-areia-400" />
                  {aluno.telefone}
                </a>
              )}
              {aluno.email && (
                <a
                  href={`mailto:${aluno.email}`}
                  className="flex min-w-0 items-center gap-1.5 break-all hover:text-tijolo-700"
                >
                  <IconeEmail className="h-4 w-4 shrink-0 text-areia-400" />
                  {aluno.email}
                </a>
              )}
              {aluno.dataNascimento && (
                <span className="flex items-center gap-1.5">
                  <IconeAgenda className="h-4 w-4 text-areia-400" />
                  {formatarData(aluno.dataNascimento)} ({idade(aluno.dataNascimento, hoje)} anos)
                </span>
              )}
              {!aluno.telefone && !aluno.email && (
                <span className="text-areia-500">Sem telefone nem e-mail no cadastro.</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {plano && aluno.ativo ? (
                <Badge cor="#9A4720" fundo="#FAE8DA" borda="#F3CEAF">
                  {plano.nome}
                </Badge>
              ) : (
                <Badge>Sem plano mensal</Badge>
              )}
              {plano?.tabela === "antiga" && aluno.ativo && (
                <Badge cor={ESTILO_TABELA.antiga.cor} fundo={ESTILO_TABELA.antiga.fundo}>
                  {ESTILO_TABELA.antiga.rotulo}
                </Badge>
              )}
              {categoria && (
                <Badge cor={categoria.cor} fundo={categoria.fundo} borda={categoria.borda}>
                  {categoria.label} · {categoria.descricao}
                </Badge>
              )}
              {professor ? (
                <Link
                  href={`/professores/${professor.id}`}
                  className="chip border border-transparent bg-areia-100 text-areia-700 hover:border-saibro-300 hover:text-saibro-800"
                >
                  Professor: {professor.nome}
                </Link>
              ) : (
                <Badge>Sem professor principal</Badge>
              )}
              <Badge>Aluno desde {formatarData(aluno.criadoEm.slice(0, 10))}</Badge>
            </div>
          </div>

          {podeEditar && (
            <div className="flex flex-wrap gap-2 sm:pt-2">
              {aluno.ativo ? (
                <>
                  <button type="button" onClick={aoEditar} className="btn-secundario w-full sm:w-auto">
                    <IconeEditar className="h-4 w-4" />
                    Editar cadastro
                  </button>
                  {/* Com a volta ja registrada (data futura), nao ha o que reativar. */}
                  {congelamento ? (
                    !congelamento.fimReal && (
                      <button type="button" onClick={aoReativarPlano} className="btn-primario w-full sm:w-auto">
                        <IconeCongelado className="h-4 w-4" />
                        Reativar plano
                      </button>
                    )
                  ) : (
                    matricula &&
                    !congelamentoAgendado && (
                      <button type="button" onClick={aoCongelar} className="btn-secundario w-full sm:w-auto">
                        <IconeCongelado className="h-4 w-4" />
                        Congelar plano
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={aoInativar}
                    className="btn-fantasma w-full text-tijolo-700 hover:bg-tijolo-50 hover:text-tijolo-800 sm:w-auto"
                  >
                    <IconeSaida className="h-4 w-4" />
                    Inativar aluno
                  </button>
                </>
              ) : (
                <button type="button" onClick={aoReativarCadastro} className="btn-primario w-full sm:w-auto">
                  Reativar cadastro
                </button>
              )}
            </div>
          )}
        </div>

        {congelamento && (
          <p className="border-t border-areia-200 bg-sky-50/60 px-5 py-2.5 text-sm text-sky-900">
            <strong className="font-semibold">Plano congelado</strong>{" "}
            {congelamento.fimReal
              ? `de ${formatarData(congelamento.inicio)} até ${formatarData(congelamento.fimReal)} · volta em ${formatarData(somarDias(congelamento.fimReal, 1))}`
              : congelamento.fimPrevisto && congelamento.fimPrevisto >= hoje
                ? `de ${formatarData(congelamento.inicio)} até ${formatarData(congelamento.fimPrevisto)} (previsto)`
                : `desde ${formatarData(congelamento.inicio)}${
                    congelamento.fimPrevisto
                      ? ` · o fim previsto era ${formatarData(congelamento.fimPrevisto)}: reative o plano quando o aluno voltar`
                      : ""
                  }`}
            {" · "}
            <strong className="font-semibold">Motivo:</strong> {congelamento.motivo}
          </p>
        )}
        {!congelamento && congelamentoAgendado && (
          <p className="border-t border-areia-200 bg-amber-50/70 px-5 py-2.5 text-sm text-amber-900">
            <strong className="font-semibold">Congelamento marcado</strong> de{" "}
            {formatarData(congelamentoAgendado.inicio)}
            {congelamentoAgendado.fimPrevisto && ` a ${formatarData(congelamentoAgendado.fimPrevisto)}`}
            {" · "}
            <strong className="font-semibold">Motivo:</strong> {congelamentoAgendado.motivo}
          </p>
        )}
        {!aluno.ativo && (
          <p className="border-t border-areia-200 bg-tijolo-50/70 px-5 py-2.5 text-sm text-tijolo-800">
            <strong className="font-semibold">Aluno inativo.</strong> Não aparece mais nas aulas fixas da
            agenda. O histórico, os pagamentos e os comentários continuam guardados.
          </p>
        )}
      </section>
    </div>
  );
}
