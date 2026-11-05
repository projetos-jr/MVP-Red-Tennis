"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ITENS_POR_PAGINA, MostrarMais } from "@/components/ui/MostrarMais";
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
export const LANCAMENTOS_POR_PAGINA = ITENS_POR_PAGINA;

/**
 * Rodapé "Mostrar mais" em letra maior: o componente comum é compacto, e
 * aqui a lista é o centro da tela (pedido do dono da arena).
 */
const RODAPE_GRANDE =
  "[&_footer]:px-4 [&_footer]:py-3.5 [&_footer]:text-base sm:[&_footer]:px-5 [&_footer_button]:px-4 [&_footer_button]:py-2.5 [&_footer_button]:text-base";

function emAberto(linha: LinhaLancamento): boolean {
  return linha.situacao === "pendente" || linha.situacao === "em_atraso";
}

function linkDaPessoa(pessoa: PessoaDoLancamento): string {
  return pessoa.tipo === "aluno" ? `/alunos/${pessoa.id}` : `/professores/${pessoa.id}`;
}

/** Pessoa do lançamento (com link para a ficha) e, se for outra, quem paga ou recebe. */
function Pessoa({ linha, tipo }: { linha: LinhaLancamento; tipo: TipoLancamento }) {
  const { pessoa, lancamento } = linha;
  const outro = lancamento.nomePagante && lancamento.nomePagante !== pessoa?.nome;
  return (
    <span className="block min-w-0">
      {pessoa ? (
        <Link
          href={linkDaPessoa(pessoa)}
          className="alvo-de-toque flex min-w-0 items-center gap-2.5 font-semibold text-areia-900 hover:text-saibro-700 hover:underline"
        >
          <Avatar id={pessoa.id} nome={pessoa.nome} src={pessoa.fotoUrl} tamanho="sm" />
          <span className="truncate">{pessoa.nome}</span>
        </Link>
      ) : (
        <span className="block truncate font-semibold text-areia-900">
          {lancamento.nomePagante ?? "—"}
        </span>
      )}
      {pessoa && outro && (
        <span className="mt-0.5 block truncate pl-[2.625rem] text-sm text-areia-600">
          {tipo === "receber" ? "pagante" : "favorecido"}: {lancamento.nomePagante}
        </span>
      )}
    </span>
  );
}

function Valor({ linha, className = "" }: { linha: LinhaLancamento; className?: string }) {
  const anulado = linha.situacao === "cancelado";
  return (
    <span className={`tabular-nums ${anulado ? "text-areia-500 line-through" : ""} ${className}`}>
      {formatarMoeda(linha.lancamento.valor)}
    </span>
  );
}

/** Linha de apoio do item: categoria, forma de pagamento e convênio, em texto. */
function DetalheDoItem({ linha }: { linha: LinhaLancamento }) {
  const { lancamento } = linha;
  const partes: string[] = [lancamento.categoria];
  if (lancamento.formaPagamento) partes.push(lancamento.formaPagamento);
  if (lancamento.valorConvenio !== undefined) {
    partes.push(`convênio ${formatarMoeda(lancamento.valorConvenio)}`);
  }
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-areia-600">
      <span>{partes.join(" · ")}</span>
      {linha.congelada && <BadgeCongelado />}
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
  const rotuloAcao = tipo === "receber" ? "Receber" : "Pagar";

  if (linhas.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-base text-areia-600">
        Nenhum lançamento encontrado com estes filtros.
      </p>
    );
  }

  return (
    <>
      {/* Celular: um cartão por lançamento — a tabela exigiria rolagem lateral. */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {visiveis.map((linha) => {
          const { lancamento } = linha;
          return (
            <li
              key={lancamento.id}
              className={`px-4 py-3.5 ${linha.situacao === "em_atraso" ? "bg-tijolo-50/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-base">
                  <Pessoa linha={linha} tipo={tipo} />
                </div>
                <Valor linha={linha} className="shrink-0 pt-2.5 text-lg font-bold text-areia-900" />
              </div>
              <button
                type="button"
                onClick={() => aoAbrir(lancamento.id)}
                className="alvo-de-toque mt-1 block text-left text-base text-areia-800 underline decoration-areia-300 underline-offset-2 hover:text-saibro-700"
              >
                {lancamento.item}
              </button>
              <DetalheDoItem linha={linha} />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <BadgeSituacao linha={linha} className="text-sm" />
                <span className="text-sm text-areia-600">
                  Vence em {formatarData(lancamento.vencimento)}
                </span>
              </div>
              {emAberto(linha) && (
                <button
                  type="button"
                  onClick={() => aoPagar(lancamento.id)}
                  className="btn-secundario mt-3 w-full py-3 text-base"
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
        <table className="w-full min-w-[760px] text-base">
          <thead>
            <tr className="border-b border-areia-200 text-left text-sm text-areia-600">
              <th
                className="px-5 py-3 font-semibold"
                aria-sort={ordem === "vencimento_desc" ? "descending" : "ascending"}
              >
                <button
                  type="button"
                  onClick={aoAlternarOrdem}
                  className="alvo-de-toque inline-flex items-center gap-1 font-semibold hover:text-areia-900"
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
              <th className="px-3 py-3 font-semibold">{tipo === "receber" ? "Pessoa" : "Favorecido"}</th>
              <th className="px-3 py-3 font-semibold">Item</th>
              <th className="px-3 py-3 text-right font-semibold">Valor</th>
              <th className="px-3 py-3 font-semibold">Situação</th>
              <th className="px-5 py-3 font-semibold">
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
                  <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums text-areia-800">
                    {formatarData(lancamento.vencimento)}
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <Pessoa linha={linha} tipo={tipo} />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => aoAbrir(lancamento.id)}
                      className="alvo-de-toque text-left text-areia-800 hover:text-saibro-700 hover:underline"
                    >
                      {lancamento.item}
                    </button>
                    <DetalheDoItem linha={linha} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-lg font-bold text-areia-900">
                    <Valor linha={linha} />
                  </td>
                  <td className="px-3 py-3">
                    <BadgeSituacao linha={linha} className="text-sm" />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {emAberto(linha) ? (
                      <button
                        type="button"
                        onClick={() => aoPagar(lancamento.id)}
                        className="btn-secundario px-5 py-2.5 text-base"
                        aria-label={`Registrar pagamento: ${lancamento.item}`}
                      >
                        {rotuloAcao}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => aoAbrir(lancamento.id)}
                        className="btn-fantasma px-4 py-2.5 text-base"
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

      <div className={RODAPE_GRANDE}>
        <MostrarMais
          mostrando={visiveis.length}
          total={linhas.length}
          passo={LANCAMENTOS_POR_PAGINA}
          aoMostrarMais={aoMostrarMais}
        >
          <strong className="font-semibold text-areia-900">
            {validos.quantidade} {validos.quantidade === 1 ? "lançamento" : "lançamentos"}
          </strong>{" "}
          · total <strong className="font-semibold text-areia-900">{formatarMoeda(validos.valor)}</strong>
          {anulados.quantidade > 0 &&
            ` · ${anulados.quantidade} ${anulados.quantidade === 1 ? "anulado" : "anulados"} (${formatarMoeda(anulados.valor)}) fora do total`}
        </MostrarMais>
      </div>
    </>
  );
}
