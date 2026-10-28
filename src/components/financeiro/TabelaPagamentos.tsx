"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconeAlerta, IconeCheck } from "@/components/ui/Icons";
import { formatarData } from "@/lib/date";
import { caminhoAvatar } from "@/lib/dados";
import { nomeDoAluno } from "@/lib/selectors";
import { ESTILO_FORMA_PAGAMENTO, formatarMoeda } from "@/lib/theme";
import type { Pagamento } from "@/lib/types";

export function TabelaPagamentos({ pagamentos }: { pagamentos: Pagamento[] }) {
  if (pagamentos.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-areia-500">
        Nenhum lançamento encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <>
      {/* Celular: cada lançamento vira um cartão — a tabela de 7 colunas
          exigiria rolagem horizontal. */}
      <ul className="divide-y divide-areia-100 md:hidden">
        {pagamentos.map((pagamento) => {
          const forma = ESTILO_FORMA_PAGAMENTO[pagamento.formaPagamento];
          const confirmado = pagamento.status === "confirmado";
          const atrasado = pagamento.diasEmAtraso > 0;
          const nome = nomeDoAluno(pagamento.alunoId);

          return (
            <li
              key={pagamento.id}
              className={`px-4 py-3 ${atrasado ? "bg-tijolo-50/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/alunos/${pagamento.alunoId}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Avatar
                    id={pagamento.alunoId}
                    nome={nome}
                    src={caminhoAvatar(pagamento.alunoId)}
                    tamanho="sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-areia-900">
                      {nome}
                    </span>
                    <span className="block truncate text-xs text-areia-500">
                      {formatarData(pagamento.data)}
                      {pagamento.nomePagante !== nome &&
                        ` · pago por ${pagamento.nomePagante}`}
                    </span>
                  </span>
                </Link>
                <span className="shrink-0 text-base font-bold tabular-nums text-areia-900">
                  {formatarMoeda(pagamento.valor)}
                </span>
              </div>

              <p className="mt-2 text-sm text-areia-700">{pagamento.item}</p>

              {pagamento.valorTotalPass !== undefined && (
                <p className="mt-0.5 text-xs text-areia-500">
                  Convênio {formatarMoeda(pagamento.valorTotalPass)} + complemento{" "}
                  {formatarMoeda(pagamento.valor - pagamento.valorTotalPass)}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge cor={forma.cor} fundo={forma.fundo}>
                  {forma.label}
                </Badge>
                {confirmado ? (
                  <Badge cor="#15803D" fundo="#F0FDF4">
                    <IconeCheck className="h-3.5 w-3.5" />
                    {pagamento.participantesConfirmados
                      ? "Confirmado"
                      : "Pago · conferir turma"}
                  </Badge>
                ) : atrasado ? (
                  <Badge cor="#8A2118" fundo="#FBE3E0" borda="#EC9A90">
                    <IconeAlerta className="h-3.5 w-3.5" />
                    {pagamento.diasEmAtraso} dias em atraso
                  </Badge>
                ) : (
                  <Badge cor="#A16207" fundo="#FEFBEB" borda="#F5D97A">
                    Aguardando compensação
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rolagem-suave md:block">
        <table className="w-full min-w-[940px] text-sm">
        <thead>
          <tr className="border-b border-areia-200 text-left text-xs uppercase tracking-wide text-areia-500">
            <th className="px-5 py-2.5 font-medium">Data</th>
            <th className="px-3 py-2.5 font-medium">Pessoa</th>
            <th className="px-3 py-2.5 font-medium">Pagante</th>
            <th className="px-3 py-2.5 font-medium">Item / serviço</th>
            <th className="px-3 py-2.5 font-medium">Forma</th>
            <th className="px-3 py-2.5 text-right font-medium">Valor</th>
            <th className="px-5 py-2.5 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-areia-100">
          {pagamentos.map((pagamento) => {
            const forma = ESTILO_FORMA_PAGAMENTO[pagamento.formaPagamento];
            const confirmado = pagamento.status === "confirmado";
            const atrasado = pagamento.diasEmAtraso > 0;
            const nome = nomeDoAluno(pagamento.alunoId);
            const pagantePropio = pagamento.nomePagante === nome;

            return (
              <tr
                key={pagamento.id}
                className={atrasado ? "bg-tijolo-50/50" : "hover:bg-areia-50"}
              >
                <td className="whitespace-nowrap px-5 py-2.5 font-medium text-areia-800">
                  {formatarData(pagamento.data)}
                </td>

                <td className="px-3 py-2.5">
                  <Link
                    href={`/alunos/${pagamento.alunoId}`}
                    className="flex items-center gap-2 font-medium text-areia-800 hover:text-tijolo-700 hover:underline"
                  >
                    <Avatar
                      id={pagamento.alunoId}
                      nome={nome}
                      src={caminhoAvatar(pagamento.alunoId)}
                      tamanho="xs"
                    />
                    {nome}
                  </Link>
                </td>

                <td className="px-3 py-2.5 text-areia-600">
                  {pagamento.nomePagante}
                  {!pagantePropio && (
                    <span className="ml-1.5 rounded bg-areia-100 px-1.5 py-0.5 text-[10px] font-medium text-areia-500">
                      terceiro
                    </span>
                  )}
                </td>

                <td className="px-3 py-2.5 text-areia-600">{pagamento.item}</td>

                <td className="px-3 py-2.5">
                  <Badge cor={forma.cor} fundo={forma.fundo} title={forma.detalhe}>
                    {forma.label}
                  </Badge>
                  {pagamento.valorTotalPass !== undefined && (
                    <span className="mt-1 block text-[11px] text-areia-500">
                      Convênio {formatarMoeda(pagamento.valorTotalPass)} +
                      complemento{" "}
                      {formatarMoeda(pagamento.valor - pagamento.valorTotalPass)}
                    </span>
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-areia-800">
                  {formatarMoeda(pagamento.valor)}
                </td>

                <td className="px-5 py-2.5">
                  {confirmado ? (
                    <Badge cor="#15803D" fundo="#F0FDF4">
                      <IconeCheck className="h-3.5 w-3.5" />
                      {pagamento.participantesConfirmados
                        ? "Confirmado"
                        : "Pago · conferir turma"}
                    </Badge>
                  ) : atrasado ? (
                    <Badge cor="#8A2118" fundo="#FBE3E0" borda="#EC9A90">
                      <IconeAlerta className="h-3.5 w-3.5" />
                      {pagamento.diasEmAtraso} dias em atraso
                    </Badge>
                  ) : (
                    <Badge cor="#A16207" fundo="#FEFBEB" borda="#F5D97A">
                      Aguardando compensação
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
