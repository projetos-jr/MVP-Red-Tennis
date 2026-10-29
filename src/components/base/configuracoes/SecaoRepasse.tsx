"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { IconeSeta, IconeUsuarios } from "@/components/ui/Icons";
import type { RegraRepasse } from "@/lib/banco/tipos";
import { podeAcessar } from "@/lib/consultas/base";
import { regrasDeRepasse } from "@/lib/consultas/configuracoes";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { SecaoDeConfiguracao, SeloHipotese } from "./Pecas";

function descreverRegra(regra: RegraRepasse): string {
  return regra.modo === "percentual"
    ? `${regra.valor}% das mensalidades dos alunos`
    : `${formatarMoeda(regra.valor)} por hora-aula`;
}

/**
 * Regra de repasse (Hipotese H6): e de cada professor e se ajusta na ficha
 * dele. Aqui so aparece o resumo, com o atalho para a ficha.
 */
export function SecaoRepasse() {
  const { banco, colaborador } = useApp();
  const podeAbrirFicha = podeAcessar(banco, colaborador, "professores");

  return (
    <SecaoDeConfiguracao
      id="repasse"
      titulo="Repasse aos professores"
      descricao="Cada professor tem a sua regra, ajustada na ficha dele."
      icone={<IconeUsuarios className="h-5 w-5" />}
    >
      <p className="flex flex-wrap items-start gap-2 border-b border-areia-100 px-5 py-3 text-xs leading-relaxed text-areia-600">
        <SeloHipotese numero={6} />
        <span className="min-w-0 flex-1">
          Valor por hora-aula, como no MVP, ou percentual das mensalidades. O repasse do mês sai das
          aulas dadas com a regra de cada professor.
        </span>
      </p>
      <ul className="divide-y divide-areia-100">
        {regrasDeRepasse(banco).map((professor) => (
          <li key={professor.id} className="flex items-center gap-3 px-5 py-3">
            <span aria-hidden="true">
              <Avatar id={professor.id} nome={professor.nome} tamanho="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-areia-900">{professor.nome}</p>
              <p className="text-xs text-areia-500">{descreverRegra(professor.repasse)}</p>
            </div>
            {podeAbrirFicha && (
              <Link
                href={`/professores/${professor.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-tijolo-700 hover:underline"
                aria-label={`Abrir a ficha de ${professor.nome}`}
              >
                Abrir ficha <IconeSeta className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </SecaoDeConfiguracao>
  );
}
