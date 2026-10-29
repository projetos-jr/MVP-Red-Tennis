"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { IconeBusca } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { planoVigente, situacaoDoAluno } from "@/lib/banco/regras/alunos";
import { nomeDaPessoa } from "@/lib/consultas/base";
import { useApp } from "@/store/AppStore";

const ROTULO_SITUACAO = {
  ativo: "Ativo",
  congelado: "Congelado",
  avulso: "Sem plano",
  inativo: "Inativo",
} as const;

/**
 * Lista de alunos — versao inicial (busca por nome).
 * Filtros, cadastro e edicao chegam com o modulo de alunos.
 */
export default function PaginaAlunos() {
  const { banco } = useApp();
  const [busca, setBusca] = useState("");

  const alunos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return banco.alunos
      .filter((a) => !termo || a.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [banco.alunos, busca]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Alunos</h1>
        <p className="mt-1 text-sm text-areia-600">{banco.alunos.length} cadastrados</p>
      </div>

      <Card>
        <div className="border-b border-areia-200 p-4">
          <div className="relative">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno pelo nome…"
              className="campo py-2 pl-9"
              aria-label="Buscar aluno"
            />
          </div>
        </div>

        <ul className="divide-y divide-areia-100">
          {alunos.map((aluno) => {
            const plano = planoVigente(banco, aluno.id, HOJE);
            const situacao = situacaoDoAluno(banco, aluno, HOJE);
            return (
              <li key={aluno.id}>
                <Link
                  href={`/alunos/${aluno.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-areia-50"
                >
                  <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-areia-900">{aluno.nome}</p>
                    <p className="truncate text-xs text-areia-500">
                      {plano?.nome ?? "Sem plano mensal"}
                      {aluno.professorPrincipalId &&
                        ` · ${nomeDaPessoa(banco, aluno.professorPrincipalId)}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-areia-600">
                    {ROTULO_SITUACAO[situacao]}
                  </span>
                </Link>
              </li>
            );
          })}
          {alunos.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-areia-500">
              Nenhum aluno encontrado.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
