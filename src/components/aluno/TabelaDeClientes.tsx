"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EtiquetaDeSituacao, EtiquetaNeutra, type Situacao, type Tom } from "@/components/ui/EtiquetaDeSituacao";
import { MostrarMais } from "@/components/ui/MostrarMais";
import type { Aluno } from "@/lib/banco/tipos";
import type { CategoriaDoCliente, LinhaDaListaDeAlunos, SituacaoAluno } from "@/lib/consultas/alunos";
import { formatarMoeda } from "@/lib/theme";
import { ESTILO_SITUACAO_ALUNO } from "./estilos";
import { IconeEditar, IconeSaida } from "./Icones";

/** Quantos clientes aparecem de cada vez (o resto vem em "Mostrar mais"). */
export const CLIENTES_POR_VEZ = 50;

export type OrdemDosClientes = "asc" | "desc";

/** Situacao do cliente na etiqueta: o mesmo tom das outras telas (congelado com o floco). */
const ETIQUETA_DA_SITUACAO: Record<SituacaoAluno, { tom?: Tom; situacao?: Situacao }> = {
  ativo: { tom: "positivo" },
  congelado: { situacao: "congelado" },
  avulso: { tom: "neutro" },
  inativo: { tom: "alerta" },
};

/** Na linha, o grupo vai no singular ("Aluno"); nos filtros, no plural ("Alunos"). */
const ETIQUETA_DO_GRUPO: Record<CategoriaDoCliente, string> = {
  ranking: "Ranking",
  alunos: "Aluno",
  aluguel: "Aluguel",
  torneio: "Torneio",
};

/** Traço para campo vazio, com o texto para leitor de tela. */
function Vazio({ texto }: { texto: string }) {
  return (
    <span className="text-areia-500">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{texto}</span>
    </span>
  );
}

function EtiquetaDoCliente({ situacao }: { situacao: SituacaoAluno }) {
  const etiqueta = ETIQUETA_DA_SITUACAO[situacao];
  const estilo = ESTILO_SITUACAO_ALUNO[situacao];
  return (
    <EtiquetaDeSituacao {...etiqueta} pequena title={estilo.descricao} className="whitespace-nowrap">
      {estilo.rotulo}
    </EtiquetaDeSituacao>
  );
}

function Grupos({ linha }: { linha: LinhaDaListaDeAlunos }) {
  const { categorias, aluno } = linha;
  if (categorias.length === 0) return <Vazio texto="Sem grupo" />;
  return (
    <span className="flex flex-wrap gap-1">
      {categorias.map((c) =>
        c === "ranking" && aluno.categoriaRanking ? (
          <EtiquetaNeutra key={c} title={`Ranking, categoria ${aluno.categoriaRanking}`}>
            Ranking {aluno.categoriaRanking}
          </EtiquetaNeutra>
        ) : (
          <EtiquetaNeutra key={c}>{ETIQUETA_DO_GRUPO[c]}</EtiquetaNeutra>
        ),
      )}
    </span>
  );
}

function EmAtraso({ valor }: { valor: number }) {
  if (valor <= 0) return <Vazio texto="Nada em atraso" />;
  return (
    <EtiquetaDeSituacao
      situacao="em_atraso"
      pequena
      title="Cobranças vencidas e não pagas"
      className="whitespace-nowrap tabular-nums"
    >
      {formatarMoeda(valor)}
    </EtiquetaDeSituacao>
  );
}

/** Botão só com ícone: 28px com mouse, 44px no toque. */
function BotaoIcone({
  rotulo,
  aoClicar,
  perigo,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  perigo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className={`alvo-de-toque inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-areia-600 transition-colors [@media(pointer:coarse)]:w-11 ${
        perigo ? "hover:bg-tijolo-50 hover:text-tijolo-700" : "hover:bg-saibro-100 hover:text-saibro-800"
      }`}
    >
      {children}
    </button>
  );
}

function Acoes({
  aluno,
  aoEditar,
  aoInativar,
}: {
  aluno: Aluno;
  aoEditar: (aluno: Aluno) => void;
  aoInativar: (aluno: Aluno) => void;
}) {
  // Inativo nao tem acao aqui: reativar o cadastro e pela ficha.
  if (!aluno.ativo) return null;
  return (
    <span className="flex items-center justify-end gap-0.5">
      <BotaoIcone rotulo={`Editar cadastro de ${aluno.nome}`} aoClicar={() => aoEditar(aluno)}>
        <IconeEditar className="h-4 w-4" />
      </BotaoIcone>
      <BotaoIcone rotulo={`Inativar ${aluno.nome}`} aoClicar={() => aoInativar(aluno)} perigo>
        <IconeSaida className="h-4 w-4" />
      </BotaoIcone>
    </span>
  );
}

/**
 * Lista de clientes em tabela densa (computador e tablet deitado) ou em
 * cartões (abaixo de 1024px), 50 por vez. As ações (editar e inativar) só
 * aparecem para quem pode alterar cadastros (Hipótese H9) e só nos ativos.
 */
export function TabelaDeClientes({
  linhas,
  limite,
  ordem,
  podeAlterar,
  vazio,
  aoAlternarOrdem,
  aoMostrarMais,
  aoEditar,
  aoInativar,
}: {
  linhas: LinhaDaListaDeAlunos[];
  limite: number;
  ordem: OrdemDosClientes;
  podeAlterar: boolean;
  /** O que mostrar quando nenhum cliente passa nos filtros. */
  vazio: ReactNode;
  aoAlternarOrdem: () => void;
  aoMostrarMais: () => void;
  aoEditar: (aluno: Aluno) => void;
  aoInativar: (aluno: Aluno) => void;
}) {
  const visiveis = linhas.slice(0, limite);

  if (linhas.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-areia-600">{vazio}</div>;
  }

  return (
    <>
      {/* Celular e tablet em pé: um cartão por cliente (8 colunas não cabem). */}
      <ul className="divide-y divide-areia-100 lg:hidden">
        {visiveis.map((linha) => {
          const { aluno, plano, professor } = linha;
          return (
            <li key={aluno.id} className="flex gap-3 px-4 py-3">
              <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" className="mt-1.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/alunos/${aluno.id}`}
                    className="alvo-de-toque flex min-w-0 items-center text-[15px] font-semibold text-areia-900 hover:text-saibro-700 hover:underline"
                  >
                    <span className="truncate">{aluno.nome}</span>
                  </Link>
                  {podeAlterar && <Acoes aluno={aluno} aoEditar={aoEditar} aoInativar={aoInativar} />}
                </div>
                <p className="truncate text-xs text-areia-600">
                  {plano?.nome ?? "Sem plano mensal"}
                  {professor && ` · ${professor.nome}`}
                </p>
                {aluno.telefone && (
                  <p className="text-xs tabular-nums text-areia-600">{aluno.telefone}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <EtiquetaDoCliente situacao={linha.situacao} />
                  {linha.valorEmAtraso > 0 && <EmAtraso valor={linha.valorEmAtraso} />}
                  {linha.categorias.length > 0 && <Grupos linha={linha} />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden lg:block">
        <table className="w-full table-fixed text-sm">
          {/* Abaixo de 1280px (tablet deitado) o celular vai para baixo do nome:
              no toque a linha ja tem 44px, entao nao perde densidade. */}
          <colgroup>
            <col />
            <col className="hidden w-[9rem] xl:table-column" />
            <col className="w-[20%] xl:w-[22%]" />
            <col className="w-[8.5rem] xl:w-[9.5rem]" />
            <col className="w-[12.5rem] xl:w-[13.5rem]" />
            <col className="w-[7rem]" />
            <col className="w-[7rem] xl:w-[7.5rem]" />
            {podeAlterar && <col className="w-[5rem] [@media(pointer:coarse)]:w-[7rem]" />}
          </colgroup>
          <thead>
            <tr className="bg-saibro-600 text-left font-display text-[13px] font-semibold uppercase tracking-wide text-white">
              <th
                scope="col"
                className="py-0 pl-4 pr-2"
                aria-sort={ordem === "asc" ? "ascending" : "descending"}
              >
                <button
                  type="button"
                  onClick={aoAlternarOrdem}
                  className="alvo-de-toque inline-flex items-center gap-1 py-2 font-semibold uppercase tracking-wide hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  title="Inverter a ordem"
                >
                  Nome
                  <span aria-hidden="true">{ordem === "asc" ? "↑" : "↓"}</span>
                  <span className="sr-only">
                    {ordem === "asc" ? "(de A a Z; clique para inverter)" : "(de Z a A; clique para inverter)"}
                  </span>
                </button>
              </th>
              <th scope="col" className="hidden px-2 py-2 xl:table-cell">Celular</th>
              <th scope="col" className="px-2 py-2">Plano</th>
              <th scope="col" className="px-2 py-2">Professor</th>
              <th scope="col" className="px-2 py-2">Categorias</th>
              <th scope="col" className="px-2 py-2">Situação</th>
              <th scope="col" className={`py-2 pl-2 text-right ${podeAlterar ? "pr-2" : "pr-4"}`}>
                Em atraso
              </th>
              {podeAlterar && (
                <th scope="col" className="py-2 pl-2 pr-3 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => {
              const { aluno, plano, professor } = linha;
              return (
                <tr
                  key={aluno.id}
                  className="border-b border-areia-100 bg-white transition-colors even:bg-areia-50 hover:bg-saibro-50"
                >
                  <td className="py-1.5 pl-4 pr-2 [@media(pointer:coarse)]:py-0">
                    <Link
                      href={`/alunos/${aluno.id}`}
                      className="alvo-de-toque flex min-w-0 items-center gap-2 font-semibold text-areia-900 hover:text-saibro-700 hover:underline"
                    >
                      <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="xs" />
                      <span className="min-w-0">
                        <span className="block truncate">{aluno.nome}</span>
                        {aluno.telefone && (
                          <span className="block truncate text-xs font-normal tabular-nums text-areia-600 xl:hidden">
                            {aluno.telefone}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 tabular-nums text-areia-700 xl:table-cell">
                    {aluno.telefone || <Vazio texto="Sem celular" />}
                  </td>
                  <td className="truncate px-2 py-1.5 text-areia-800" title={plano?.nome}>
                    {plano?.nome ?? <Vazio texto="Sem plano mensal" />}
                  </td>
                  <td className="truncate px-2 py-1.5 text-areia-700" title={professor?.nome}>
                    {professor?.nome ?? <Vazio texto="Sem professor principal" />}
                  </td>
                  <td className="px-2 py-1.5">
                    <Grupos linha={linha} />
                  </td>
                  <td className="px-2 py-1.5">
                    <EtiquetaDoCliente situacao={linha.situacao} />
                  </td>
                  <td className={`py-1.5 pl-2 text-right ${podeAlterar ? "pr-2" : "pr-4"}`}>
                    <EmAtraso valor={linha.valorEmAtraso} />
                  </td>
                  {podeAlterar && (
                    <td className="py-1 pl-2 pr-3 [@media(pointer:coarse)]:py-0">
                      <Acoes aluno={aluno} aoEditar={aoEditar} aoInativar={aoInativar} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MostrarMais
        mostrando={visiveis.length}
        total={linhas.length}
        passo={CLIENTES_POR_VEZ}
        aoMostrarMais={aoMostrarMais}
      />
    </>
  );
}
