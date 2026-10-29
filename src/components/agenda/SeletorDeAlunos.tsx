"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IconeBusca, IconeCheck, IconeFechar } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { buscarAlunoDaAgenda, buscarAlunosParaAgenda, saldoDoAluno } from "@/lib/consultas/agenda";
import { formatarMinutos } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

/**
 * Escolha de alunos por busca de nome. Os escolhidos aparecem como
 * etiquetas em cima (clique para tirar). Com `titularNoPrimeiro`, o primeiro
 * da lista e marcado como titular — quem paga a locacao avulsa.
 */
export function SeletorDeAlunos({
  selecionados,
  aoMudar,
  unico,
  mostrarSaldo,
  titularNoPrimeiro,
  rotulo = "Alunos",
}: {
  selecionados: string[];
  aoMudar: (ids: string[]) => void;
  /** So um aluno (aula de reposicao). */
  unico?: boolean;
  /** Mostra os minutos de reposicao de cada aluno. */
  mostrarSaldo?: boolean;
  titularNoPrimeiro?: boolean;
  rotulo?: string;
}) {
  const { banco } = useApp();
  const [busca, setBusca] = useState("");
  const opcoes = buscarAlunosParaAgenda(banco, busca, HOJE, { limite: 40 });

  function alternar(id: string) {
    if (unico) {
      aoMudar(selecionados.includes(id) ? [] : [id]);
      return;
    }
    aoMudar(
      selecionados.includes(id) ? selecionados.filter((a) => a !== id) : [...selecionados, id],
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-areia-800">
        {rotulo}
        <span className="ml-0.5 text-tijolo-600">*</span>
        {selecionados.length > 0 && !unico && (
          <span className="font-normal text-areia-500"> · {selecionados.length} na turma</span>
        )}
      </p>

      {selecionados.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Alunos escolhidos">
          {selecionados.map((id, indice) => {
            const aluno = buscarAlunoDaAgenda(banco, id);
            if (!aluno) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => alternar(id)}
                  className="flex items-center gap-1.5 rounded-full bg-saibro-100 py-1 pl-1 pr-2 text-xs font-medium text-saibro-900 hover:bg-saibro-200"
                  aria-label={`Tirar ${aluno.nome}`}
                >
                  <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="xs" />
                  {aluno.nome}
                  {titularNoPrimeiro && indice === 0 && (
                    <span className="rounded bg-white/80 px-1 text-[10px] font-semibold text-saibro-800">
                      titular
                    </span>
                  )}
                  {mostrarSaldo && (
                    <span className="text-[10px] font-semibold text-saibro-700">
                      {formatarMinutos(saldoDoAluno(banco, id, HOJE))}
                    </span>
                  )}
                  <IconeFechar className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno pelo nome…"
          aria-label={`Buscar aluno para ${rotulo.toLowerCase()}`}
          className="campo py-2 pl-9"
        />
      </div>

      <ul className="mt-2 max-h-48 divide-y divide-areia-100 overflow-y-auto rolagem-suave rounded-xl border border-areia-200">
        {opcoes.map(({ aluno, detalhe, saldo }) => {
          const marcado = selecionados.includes(aluno.id);
          return (
            <li key={aluno.id}>
              <button
                type="button"
                onClick={() => alternar(aluno.id)}
                aria-pressed={marcado}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  marcado ? "bg-saibro-50" : "hover:bg-areia-50"
                }`}
              >
                <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-areia-900">{aluno.nome}</span>
                  <span className="block truncate text-xs text-areia-500">
                    {detalhe}
                    {mostrarSaldo &&
                      ` · reposição: ${saldo > 0 ? formatarMinutos(saldo) : "sem saldo"}`}
                  </span>
                </span>
                {marcado && <IconeCheck className="h-4 w-4 shrink-0 text-saibro-600" />}
              </button>
            </li>
          );
        })}
        {opcoes.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-areia-500">Nenhum aluno encontrado.</li>
        )}
      </ul>
    </div>
  );
}
