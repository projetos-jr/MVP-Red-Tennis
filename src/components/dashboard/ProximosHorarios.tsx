"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeRelogio } from "@/components/ui/Icons";
import { nomeCompacto } from "@/lib/consultas/base";
import type { AlunoResumido, HorariosDoPainel } from "@/lib/consultas/painel";
import { ESTILO_OCUPACAO } from "@/lib/theme";

/** Quantos nomes cabem na linha antes do "e mais N". */
const NOMES_NA_LINHA = 4;

function NomesDosAlunos({ alunos, comLink }: { alunos: AlunoResumido[]; comLink: boolean }) {
  if (alunos.length === 0) return <>Sem alunos</>;
  const visiveis = alunos.slice(0, NOMES_NA_LINHA);
  const restantes = alunos.length - visiveis.length;
  return (
    <>
      {visiveis.map((aluno, i) => (
        <Fragment key={aluno.id}>
          {i > 0 && " · "}
          {comLink ? (
            <Link
              href={`/alunos/${aluno.id}`}
              className="hover:text-tijolo-700 hover:underline"
            >
              {nomeCompacto(aluno.nome)}
            </Link>
          ) : (
            nomeCompacto(aluno.nome)
          )}
        </Fragment>
      ))}
      {restantes > 0 && ` e mais ${restantes}`}
    </>
  );
}

/**
 * Sequencia do dia nas quadras: o que esta acontecendo e o que vem a seguir.
 * Depois do ultimo horario, mostra os ultimos do dia.
 */
export function ProximosHorarios({
  horarios,
  linkDaAgenda,
  podeAbrirAlunos,
}: {
  horarios: HorariosDoPainel;
  /** Sem link quando o perfil nao abre a agenda. */
  linkDaAgenda?: string;
  podeAbrirAlunos: boolean;
}) {
  return (
    <Card className="min-w-0 lg:col-span-3">
      <CardHeader
        titulo={horarios.modo === "proximos" ? "Próximos horários de hoje" : "Últimos horários de hoje"}
        descricao="Sequência do dia nas quadras, com professor e alunos."
        icone={<IconeRelogio className="h-5 w-5" />}
        acao={
          linkDaAgenda && (
            <Link href={linkDaAgenda} className="link-acao alvo-de-toque inline-flex items-center text-sm">
              Ver agenda
            </Link>
          )
        }
      />
      <ul className="divide-y divide-areia-200">
        {horarios.itens.map(({ ocupacao, rotuloQuadra, alunos, professor, emAndamento }) => {
          const estilo = ESTILO_OCUPACAO[ocupacao.tipo];
          const bloqueio = ocupacao.tipo === "Bloqueio";
          return (
            <li
              key={ocupacao.id}
              className={`flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-areia-50 ${
                emAndamento ? "bg-emerald-50/50" : ""
              }`}
            >
              <span className="w-14 shrink-0 tabular-nums">
                <span className="block text-sm font-semibold text-areia-900">{ocupacao.horaInicio}</span>
                <span className="block text-[11px] text-areia-500">até {ocupacao.horaFim}</span>
              </span>
              <span
                className="h-9 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: estilo.cor }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge cor={estilo.texto} fundo={estilo.fundo} borda={estilo.borda} className="text-[11px]">
                    {ocupacao.tipo}
                  </Badge>
                  <span className="chip bg-areia-100 text-[11px] text-areia-600">{rotuloQuadra}</span>
                  {emAndamento && (
                    <span className="chip border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800">
                      Acontecendo agora
                    </span>
                  )}
                  {!bloqueio && ocupacao.descricao && (
                    <span className="chip bg-areia-100 text-[11px] text-areia-600">{ocupacao.descricao}</span>
                  )}
                  {ocupacao.situacao === "aguardando_pagamento" && (
                    <span className="chip border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                      Aguardando pagamento
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-areia-700">
                  {bloqueio ? (
                    (ocupacao.descricao ?? "Quadra fechada")
                  ) : (
                    <NomesDosAlunos alunos={alunos} comLink={podeAbrirAlunos} />
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center" aria-hidden="true">
                  {alunos.slice(0, 3).map((aluno) => (
                    <Avatar
                      key={aluno.id}
                      id={aluno.id}
                      nome={aluno.nome}
                      src={aluno.fotoUrl}
                      tamanho="sm"
                      comAnel
                      className="-ml-3 first:ml-0"
                    />
                  ))}
                </span>
                {professor && (
                  <span className="hidden text-xs text-areia-500 sm:block">{professor}</span>
                )}
              </div>
            </li>
          );
        })}

        {horarios.itens.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-areia-500">
            Nenhum horário marcado para hoje.
          </li>
        )}
      </ul>
    </Card>
  );
}
