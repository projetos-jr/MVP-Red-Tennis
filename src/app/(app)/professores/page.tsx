"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { rotuloDaRegraDeRepasse } from "@/components/aluno/estilos";
import { FormularioProfessor } from "@/components/professor/FormularioProfessor";
import { Badge } from "@/components/ui/Badge";
import { CabecalhoDaPagina, LinkDeVolta } from "@/components/ui/CabecalhoDaPagina";
import { IconeMais, IconeSeta, IconeTelefone } from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import { podeAlterarRepasse } from "@/lib/consultas/alunos";
import { listarProfessores, type LinhaDaListaDeProfessores } from "@/lib/consultas/professores";
import { formatarMesAno } from "@/lib/date";
import { formatarMinutos, formatarMoeda, iniciais } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

/** Lista de professores, com os numeros da semana e o repasse previsto do mes. */
export default function PaginaProfessores() {
  const router = useRouter();
  const { banco, colaborador } = useApp();
  const [formularioAberto, setFormularioAberto] = useState(false);
  const linhas = useMemo(() => listarProfessores(banco, HOJE), [banco]);
  // Hipotese H9: so o dono cadastra professor (a regra de repasse define pagamentos).
  const podeCadastrar = podeAlterarRepasse(colaborador);
  const totalDoMes = linhas.reduce((soma, l) => soma + l.repasseDoMes.valorPrevisto, 0);

  return (
    <div className="space-y-5">
      <LinkDeVolta href="/alunos">Alunos</LinkDeVolta>

      <CabecalhoDaPagina
        titulo="Professores"
        descricao={
          <>
            {linhas.length} cadastrados · repasse previsto em {formatarMesAno(HOJE)}:{" "}
            <strong className="font-semibold text-areia-800">{formatarMoeda(totalDoMes)}</strong> até hoje
          </>
        }
        acoes={
          podeCadastrar ? (
            <button type="button" onClick={() => setFormularioAberto(true)} className="btn-primario">
              <IconeMais className="h-4 w-4" />
              Novo professor
            </button>
          ) : (
            <p className="max-w-xs text-xs text-areia-500">
              Só o dono cadastra professores, porque a regra de repasse define pagamentos.
            </p>
          )
        }
      />

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {linhas.map((linha) => (
          <CartaoDoProfessor key={linha.professor.id} linha={linha} />
        ))}
      </ul>

      <FormularioProfessor
        aberto={formularioAberto}
        aoFechar={() => setFormularioAberto(false)}
        aoSalvar={(id) => router.push(`/professores/${id}`)}
      />
    </div>
  );
}

function CartaoDoProfessor({ linha }: { linha: LinhaDaListaDeProfessores }) {
  const { professor, alunosPrincipais, aulasNaSemana, minutosNaSemana, repasseDoMes } = linha;
  return (
    <li>
      <Link
        href={`/professores/${professor.id}`}
        className="card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-card-hover"
      >
        <span className="h-1.5 w-full" style={{ backgroundColor: professor.cor }} />
        <span className="flex items-start gap-3 px-5 pt-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
            style={{ backgroundColor: professor.cor }}
            aria-hidden="true"
          >
            {iniciais(professor.nome)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-areia-900">{professor.nome}</span>
              {!professor.ativo && <Badge>Inativo</Badge>}
            </span>
            <span className="block text-sm text-areia-600">
              {professor.especialidade || "Sem especialidade informada"}
            </span>
            {professor.telefone && (
              <span className="mt-1 flex items-center gap-1.5 text-xs text-areia-500">
                <IconeTelefone className="h-3.5 w-3.5" />
                {professor.telefone}
              </span>
            )}
          </span>
        </span>

        <span className="px-5 pt-3">
          <Badge>{rotuloDaRegraDeRepasse(professor.repasse)}</Badge>
        </span>

        <span className="mt-4 grid grid-cols-3 gap-px border-t border-areia-200 bg-areia-200">
          <Numero rotulo="Alunos principais" valor={String(alunosPrincipais)} />
          <Numero
            rotulo="Aulas na semana"
            valor={String(aulasNaSemana)}
            detalhe={formatarMinutos(minutosNaSemana)}
          />
          <Numero
            rotulo="Repasse do mês"
            valor={formatarMoeda(repasseDoMes.valorPrevisto)}
            detalhe={`${repasseDoMes.aulasDadas} aulas dadas`}
          />
        </span>

        <span className="mt-auto flex items-center justify-end gap-1.5 border-t border-areia-200 px-5 py-2.5 text-sm font-medium text-tijolo-700">
          Abrir ficha
          <IconeSeta className="h-4 w-4" />
        </span>
      </Link>
    </li>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <span className="bg-white px-3 py-2.5">
      <span className="block text-[11px] font-medium uppercase leading-tight tracking-wide text-areia-500">
        {rotulo}
      </span>
      <span className="mt-1 block text-sm font-bold tabular-nums text-areia-900">{valor}</span>
      {detalhe && <span className="block text-[11px] text-areia-500">{detalhe}</span>}
    </span>
  );
}
