"use client";

import { useState } from "react";
import { IconeEscudo } from "@/components/base/Icones";
import { ESTILO_DO_PERFIL } from "@/components/base/perfis";
import { IconeCadeado } from "@/components/ui/Icons";
import { alterarPermissoes } from "@/lib/banco/operacoes/configuracoes";
import {
  MODULOS_DO_SISTEMA,
  PERFIS,
  normalizarPermissoes,
  type Permissoes,
} from "@/lib/banco/regras/configuracoes";
import type { ModuloSistema, Perfil } from "@/lib/banco/tipos";
import { NOMES_DOS_MODULOS, NOMES_DOS_PERFIS } from "@/lib/consultas/configuracoes";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { FormularioDeSecao, RodapeDeSalvar, SecaoDeConfiguracao, SeloHipotese } from "./Pecas";

/** Celulas que nao mudam, e por que (as mesmas regras da operacao). */
function motivoDaTrava(perfil: Perfil, modulo: ModuloSistema): string | undefined {
  if (modulo !== "configuracoes") return undefined;
  return perfil === "dono"
    ? "O dono não pode tirar o próprio acesso às Configurações."
    : "Só o perfil Dono pode ter acesso às Configurações.";
}

/** Matriz perfil x area (Hipotese H9). Vale na hora para quem estiver usando o sistema. */
export function SecaoPermissoes() {
  const { banco } = useApp();
  const gravar = useGravar();
  const salvo = normalizarPermissoes(banco.configuracoes.permissoes);
  const [rascunho, setRascunho] = useState<Permissoes>(salvo);
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(salvo);

  function alternar(perfil: Perfil, modulo: ModuloSistema, marcado: boolean) {
    setRascunho((atual) => {
      let lista = atual[perfil].filter((m) => m !== modulo);
      if (marcado) lista = [...lista, modulo];
      // Contas a pagar ficam dentro do Financeiro: uma depende da outra.
      if (modulo === "financeiro" && !marcado) lista = lista.filter((m) => m !== "financeiro_pagar");
      if (modulo === "financeiro_pagar" && marcado && !lista.includes("financeiro")) {
        lista = [...lista, "financeiro"];
      }
      return normalizarPermissoes({ ...atual, [perfil]: lista });
    });
  }

  function salvar() {
    gravar(alterarPermissoes, { permissoes: rascunho }, "Permissões salvas. Já valem para todos.");
  }

  return (
    <SecaoDeConfiguracao
      id="permissoes"
      titulo="Permissões"
      descricao="Quais áreas cada perfil abre. Quem não pode abrir uma área não a vê no menu."
      icone={<IconeEscudo className="h-5 w-5" />}
    >
      <FormularioDeSecao aoSalvar={salvar}>
        <p className="flex flex-wrap items-start gap-2 border-b border-areia-100 px-5 py-3 text-xs leading-relaxed text-areia-600">
          <SeloHipotese numero={9} />
          <span className="min-w-0 flex-1">
            Dono: tudo. Recepção: agenda, alunos, financeiro a receber, estoque e ranking.
            Professor: a própria agenda e os próprios alunos, só para consulta (cada área mostra ao
            professor só o que é dele).
          </span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Áreas que cada perfil pode abrir</caption>
            <thead>
              <tr className="border-b border-areia-200">
                <th scope="col" className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-areia-500">
                  Área
                </th>
                {PERFIS.map((perfil) => (
                  <th key={perfil} scope="col" className="w-20 px-1 py-2.5 text-center sm:w-28">
                    <span className={`chip border px-2 py-0.5 text-[11px] ${ESTILO_DO_PERFIL[perfil]}`}>
                      {NOMES_DOS_PERFIS[perfil]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-areia-100">
              {MODULOS_DO_SISTEMA.map((modulo) => (
                <tr key={modulo} className="hover:bg-areia-50/60">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal">
                    <span className="block font-medium text-areia-900">{NOMES_DOS_MODULOS[modulo].nome}</span>
                    <span className="hidden text-xs text-areia-500 sm:block">
                      {NOMES_DOS_MODULOS[modulo].descricao}
                    </span>
                  </th>
                  {PERFIS.map((perfil) => {
                    const trava = motivoDaTrava(perfil, modulo);
                    const marcado = rascunho[perfil].includes(modulo);
                    return (
                      <td key={perfil} className="px-1 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1" title={trava}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={Boolean(trava)}
                            onChange={(e) => alternar(perfil, modulo, e.target.checked)}
                            aria-label={`${NOMES_DOS_PERFIS[perfil]} abre ${NOMES_DOS_MODULOS[modulo].nome}`}
                            aria-describedby={trava ? `trava-${perfil}` : undefined}
                            className="h-5 w-5 cursor-pointer accent-tijolo-600 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          {trava && <IconeCadeado className="h-3.5 w-3.5 text-areia-400" aria-hidden="true" />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-1 border-t border-areia-100 px-5 py-3 text-xs text-areia-500">
          <li id="trava-dono" className="flex items-center gap-1.5">
            <IconeCadeado className="h-3.5 w-3.5" aria-hidden="true" />
            O dono não pode tirar o próprio acesso às Configurações.
          </li>
          <li id="trava-recepcao" className="flex items-center gap-1.5">
            <IconeCadeado className="h-3.5 w-3.5" aria-hidden="true" />
            Só o perfil Dono pode ter acesso às Configurações.
          </li>
          <li id="trava-professor" className="sr-only">
            Só o perfil Dono pode ter acesso às Configurações.
          </li>
          <li>
            As contas a pagar ficam dentro do Financeiro: quem vê “a pagar” também vê “a receber”.
          </li>
        </ul>

        <RodapeDeSalvar alterado={alterado} aoDesfazer={() => setRascunho(salvo)} rotulo="Salvar permissões" />
      </FormularioDeSecao>
    </SecaoDeConfiguracao>
  );
}
