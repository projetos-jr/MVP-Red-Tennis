import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeUsuarios } from "@/components/ui/Icons";
import type { AlunoDoProfessor } from "@/lib/consultas/professores";
import { ESTILO_SITUACAO_ALUNO } from "@/components/aluno/estilos";

/** Alunos do professor: os que o tem como principal e os das turmas fixas dele. */
export function AlunosDoProfessor({
  professorId,
  alunos,
}: {
  professorId: string;
  alunos: AlunoDoProfessor[];
}) {
  const principais = alunos.filter((a) => a.principal).length;

  return (
    <Card>
      <CardHeader
        titulo="Alunos"
        descricao={`${principais} com este professor como principal; os demais estão nas turmas fixas dele.`}
        icone={<IconeUsuarios className="h-5 w-5" />}
      />
      <ul className="max-h-96 divide-y divide-areia-100 overflow-y-auto rolagem-suave">
        {alunos.map(({ aluno, plano, situacao, principal }) => {
          const estilo = ESTILO_SITUACAO_ALUNO[situacao];
          return (
            <li key={aluno.id}>
              <Link
                href={`/alunos/${aluno.id}`}
                className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-areia-50"
              >
                <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-areia-900">{aluno.nome}</span>
                  <span className="block truncate text-xs text-areia-500">
                    {plano?.nome ?? "Sem plano mensal"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className="px-2 py-0.5 text-[10px]">{principal ? "Principal" : "Em turma"}</Badge>
                  {situacao !== "ativo" && (
                    <Badge cor={estilo.cor} fundo={estilo.fundo} className="px-2 py-0.5 text-[10px]">
                      {estilo.rotulo}
                    </Badge>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        {alunos.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-areia-500">Nenhum aluno ainda.</li>
        )}
      </ul>
      <Link
        href={`/alunos?professor=${professorId}`}
        className="block border-t border-areia-200 px-5 py-3 text-sm font-medium text-tijolo-700 hover:bg-areia-50"
      >
        Ver os alunos principais na lista de alunos
      </Link>
    </Card>
  );
}
