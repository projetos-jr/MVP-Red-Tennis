"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IconeBusca } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { incluirAluno, usarReposicao } from "@/lib/banco/operacoes/agenda";
import {
  buscarAlunosParaAgenda,
  duracaoEmMinutos,
  tipoComDireitoAReposicao,
  type ItemAgenda,
} from "@/lib/consultas/agenda";
import { formatarMinutos } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { IconeReposicao } from "./Icones";

/**
 * Incluir um aluno numa aula: normalmente, ou usando os minutos de
 * reposicao dele (a regra recusa se o saldo nao bastar).
 */
export function IncluirAluno({ item, aoFechar }: { item: ItemAgenda; aoFechar: () => void }) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [busca, setBusca] = useState("");
  const { ocupacao } = item;
  const minutos = duracaoEmMinutos(ocupacao);
  const aceitaReposicao = tipoComDireitoAReposicao(ocupacao.tipo) && ocupacao.data >= HOJE;
  const opcoes = buscarAlunosParaAgenda(banco, busca, HOJE, {
    excluir: item.participantes.map((p) => p.participacao.alunoId),
    limite: 8,
  });

  return (
    <div className="border-t border-areia-200 bg-areia-50/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-areia-900">Incluir aluno</p>
        <button
          type="button"
          onClick={aoFechar}
          className="text-xs font-semibold text-saibro-700 hover:underline"
        >
          Fechar
        </button>
      </div>
      <div className="relative">
        <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno pelo nome…"
          aria-label="Buscar aluno para incluir"
          className="campo py-2 pl-9"
        />
      </div>
      {aceitaReposicao && (
        <p className="mt-2 text-xs text-areia-600">
          Com reposição, a aula usa {formatarMinutos(minutos)} do saldo do aluno.
        </p>
      )}
      <ul className="mt-2 divide-y divide-areia-100 rounded-xl border border-areia-200 bg-white">
        {opcoes.map(({ aluno, detalhe, saldo }) => (
          <li key={aluno.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2">
            <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-areia-900">
                {aluno.nome}
              </span>
              <span className="block truncate text-xs text-areia-500">{detalhe}</span>
            </span>
            <span className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (
                    gravar(
                      incluirAluno,
                      { ocupacaoId: ocupacao.id, alunoId: aluno.id },
                      `${aluno.nome} entrou na aula.`,
                    )
                  ) {
                    setBusca("");
                  }
                }}
                className="btn-secundario px-2.5 py-1.5 text-xs"
              >
                Incluir
              </button>
              {aceitaReposicao && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      gravar(
                        usarReposicao,
                        { ocupacaoId: ocupacao.id, alunoId: aluno.id },
                        `${aluno.nome} entrou na aula com reposição. Saldo usado: ${formatarMinutos(minutos)}.`,
                      )
                    ) {
                      setBusca("");
                    }
                  }}
                  className="btn inline-flex border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs text-violet-800 hover:bg-violet-100"
                >
                  <IconeReposicao className="h-3.5 w-3.5" />
                  Usar reposição
                  <span className="font-normal">
                    ({saldo > 0 ? `saldo ${formatarMinutos(saldo)}` : "sem saldo"})
                  </span>
                </button>
              )}
            </span>
          </li>
        ))}
        {opcoes.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-areia-500">Nenhum aluno encontrado.</li>
        )}
      </ul>
    </div>
  );
}
