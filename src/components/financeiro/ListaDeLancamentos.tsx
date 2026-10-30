"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { EtiquetaNeutra } from "@/components/ui/EtiquetaDeSituacao";
import type {
  LinhaLancamento,
  OrdemDaLista,
  PessoaDoLancamento,
} from "@/lib/consultas/financeiro";
import { resumoDaLista } from "@/lib/consultas/financeiro";
import type { TipoLancamento } from "@/lib/banco/tipos";
import { formatarData } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { BadgeCongelado, BadgeSituacao } from "./Etiquetas";

/** Quantos lançamentos aparecem de cada vez (o resto vem em "Mostrar mais"). */
export const LANCAMENTOS_POR_PAGINA = 40;

function emAberto(linha: LinhaLancamento): boolean {
  return linha.situacao === "pendente" || linha.situacao === "em_atraso";
}

function linkDaPessoa(pessoa: PessoaDoLancamento): string {
  return pessoa.tipo === "aluno" ? `/alunos/${pessoa.id}` : `/professores/${pessoa.id}`;
}

/** Pessoa do lançamento (com link para a ficha) e, se for outra, quem paga ou recebe. */
function Pessoa({ linha, tipo, compacta }: { linha: LinhaLancamento; tipo: TipoLancamento; compacta?: boolean }) {
  const { pessoa, lancamento } = linha;
  const outro = lancamento.nomePagante && lancamento.nomePagante !== pessoa?.nome;
  return (
    <span className="block min-w-0">
      {pessoa ? (
        <Link
          href={linkDaPessoa(pessoa)}
          className="flex min-w-0 items-center gap-2 font-medium text-areia-800 hover:text-tijolo-700 hover:underline"
        >
          <Avatar id={pessoa.id} nome={pessoa.nome} src={pessoa.fotoUrl} tamanho={compacta ? "sm" : "xs"} />
          <span className="truncate">{pessoa.nome}</span>
        </Link>
      ) : (
        <span className="block truncate font-medium text-areia-800">
          {lancamento.nomePagante ?? "—"}
        </span>
      )}
      {pessoa && outro && (
        <span className={`mt-0.5 block truncate text-xs text-areia-500 ${compacta ? "pl-10" : "pl-8"}`}>
          {tipo === "receber" ? "pagante" : "favorecido"}: {lancamento.nomePagante}
        </span>
      )}
    </span>
  );
}

function Valor({ linha, className = "" }: { linha: LinhaLancamento; className?: string }) {
  const anulado = linha.situacao === "cancelado";
  return (
    <span className={`tabular-nums ${anulado ? "text-areia-400 line-through" : ""} ${className}`}>
      {formatarMoeda(linha.lancamento.valor)}
    </span>
  );
}

export function ListaDeLancamentos({
  tipo,
  linhas,
  limite,
  ordem,
  aoAlternarOrdem,
  aoMostrarMais,
  aoAbrir,
  aoPagar,
}: {
  tipo: TipoLancamento;
  linhas: LinhaLancamento[];
  limite: number;
  ordem: OrdemDaLista;
  aoAlternarOrdem: () => void;
  aoMostrarMais: () => void;
  aoAbrir: (id: string) => void;
  aoPagar: (id: string) => void;
}) {
  const visiveis = linhas.slice(0, limite);
  const { validos, anulados } = resumoDaLista(linhas);
  const restantes = linhas.length - visiveis.length;
  const rotuloAcao = tipo === "receber" ? "Receber" : "Pagar";

  if (linhas.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-sm text-areia-500">
        Nenhum lançamento encontrado com estes filtros.
      </p>
    );
  }

  return (
    <>
      {/* Celular: um cartão por lançamento — a tabela de 7 colunas exigiria rolagem lateral. */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {visiveis.map((linha) => {
          const { lancamento } = linha;
          return (
            <li
              key={lancamento.id}
              className={`px-4 py-3 ${linha.situacao === "em_atraso" ? "bg-tijolo-50/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <Pessoa linha={linha} tipo={tipo} compacta />
                </div>
                <Valor linha={linha} className="shrink-0 text-base font-bold text-areia-900" />
              </div>
              <button
                type="button"
                onClick={() => aoAbrir(lancamento.id)}
                className="mt-2 block text-left text-sm text-areia-700 underline decoration-areia-300 underline-offset-2 hover:text-tijolo-700"
              >
                {lancamento.item}
              </button>
              <p className="mt-1 text-xs text-areia-500">Vence em {formatarData(lancamento.vencimento)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <BadgeSituacao linha={linha} />
                <EtiquetaNeutra>{lancamento.categoria}</EtiquetaNeutra>
                {lancamento.formaPagamento && <EtiquetaNeutra>{lancamento.formaPagamento}</EtiquetaNeutra>}
                {linha.congelada && <BadgeCongelado />}
              </div>
              {emAberto(linha) && (
                <button
                  type="button"
                  onClick={() => aoPagar(lancamento.id)}
                  className="btn-secundario mt-3 w-full py-2"
                  aria-label={`Registrar pagamento: ${lancamento.item}`}
                >
                  Registrar pagamento
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rolagem-suave md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
              <th
                className="px-5 py-2.5 font-medium"
                aria-sort={ordem === "vencimento_desc" ? "descending" : "ascending"}
              >
                <button
                  type="button"
                  onClick={aoAlternarOrdem}
                  className="inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-areia-900"
                  title="Inverter a ordem"
                >
                  Vencimento
                  <span aria-hidden="true">{ordem === "vencimento_desc" ? "↓" : "↑"}</span>
                  <span className="sr-only">
                    {ordem === "vencimento_desc"
                      ? "(mais recentes primeiro; clique para inverter)"
                      : "(mais antigos primeiro; clique para inverter)"}
                  </span>
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">{tipo === "receber" ? "Pessoa" : "Favorecido"}</th>
              <th className="px-3 py-2.5 font-medium">Item</th>
              <th className="px-3 py-2.5 font-medium">Forma</th>
              <th className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th className="px-3 py-2.5 font-medium">Situação</th>
              <th className="px-5 py-2.5 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-areia-100">
            {visiveis.map((linha) => {
              const { lancamento } = linha;
              return (
                <tr
                  key={lancamento.id}
                  className={
                    linha.situacao === "em_atraso" ? "bg-tijolo-50/50" : "hover:bg-areia-50"
                  }
                >
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium tabular-nums text-areia-800">
                    {formatarData(lancamento.vencimento)}
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <Pessoa linha={linha} tipo={tipo} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => aoAbrir(lancamento.id)}
                      className="text-left text-areia-700 hover:text-tijolo-700 hover:underline"
                    >
                      {lancamento.item}
                    </button>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <EtiquetaNeutra>{lancamento.categoria}</EtiquetaNeutra>
                      {linha.congelada && <BadgeCongelado />}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {lancamento.formaPagamento ? (
                      <EtiquetaNeutra>{lancamento.formaPagamento}</EtiquetaNeutra>
                    ) : (
                      <span className="text-areia-400">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Não informada</span>
                      </span>
                    )}
                    {lancamento.valorConvenio !== undefined && (
                      <span className="mt-1 block whitespace-nowrap text-[11px] text-areia-500">
                        Convênio {formatarMoeda(lancamento.valorConvenio)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-areia-800">
                    <Valor linha={linha} />
                  </td>
                  <td className="px-3 py-2.5">
                    <BadgeSituacao linha={linha} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right">
                    {emAberto(linha) ? (
                      <button
                        type="button"
                        onClick={() => aoPagar(lancamento.id)}
                        className="btn-secundario px-3 py-1.5 text-xs"
                        aria-label={`Registrar pagamento: ${lancamento.item}`}
                      >
                        {rotuloAcao}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => aoAbrir(lancamento.id)}
                        className="btn-fantasma px-3 py-1.5 text-xs"
                        aria-label={`Ver detalhes: ${lancamento.item}`}
                      >
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col gap-2 border-t border-areia-200 px-5 py-3 text-xs text-areia-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong className="font-semibold text-areia-800">
            {validos.quantidade} {validos.quantidade === 1 ? "lançamento" : "lançamentos"}
          </strong>{" "}
          · total <strong className="font-semibold text-areia-800">{formatarMoeda(validos.valor)}</strong>
          {anulados.quantidade > 0 &&
            ` · ${anulados.quantidade} ${anulados.quantidade === 1 ? "anulado" : "anulados"} (${formatarMoeda(anulados.valor)}) fora do total`}
          {restantes > 0 && ` · mostrando ${visiveis.length} de ${linhas.length}`}
        </p>
        {restantes > 0 && (
          <button type="button" onClick={aoMostrarMais} className="btn-secundario px-3 py-1.5 text-xs">
            Mostrar mais {Math.min(LANCAMENTOS_POR_PAGINA, restantes)}
          </button>
        )}
      </footer>
    </>
  );
}
