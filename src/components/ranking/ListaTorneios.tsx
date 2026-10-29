"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { IconeAgenda, IconeProximo, IconeTrofeu, IconeUsuarios } from "@/components/ui/Icons";
import type { SituacaoTorneio } from "@/lib/banco/tipos";
import {
  ROTULO_FORMATO,
  ROTULO_SITUACAO_TORNEIO,
  type TorneioNaLista,
} from "@/lib/consultas/ranking";
import { formatarData } from "@/lib/date";
import { AvataresDoLado } from "./AvataresDoLado";
import { ESTILO_SITUACAO_TORNEIO } from "./estilos";

export function SituacaoDoTorneio({ situacao }: { situacao: SituacaoTorneio }) {
  const estilo = ESTILO_SITUACAO_TORNEIO[situacao];
  return (
    <Badge
      cor={estilo.cor}
      fundo={estilo.fundo}
      borda={estilo.borda}
      className="shrink-0 whitespace-nowrap text-[11px]"
    >
      {ROTULO_SITUACAO_TORNEIO[situacao]}
    </Badge>
  );
}

function ItemDoTorneio({
  item,
  comAndamento,
  className,
}: {
  item: TorneioNaLista;
  comAndamento: boolean;
  className: string;
}) {
  const { torneio, inscricoes, partidas, jogadas, campeao } = item;
  const porcentagem = partidas ? Math.round((jogadas / partidas) * 100) : 0;
  const unidade = torneio.duplas
    ? inscricoes === 1
      ? "dupla"
      : "duplas"
    : inscricoes === 1
      ? "inscrito"
      : "inscritos";

  return (
    <Link
      href={`/ranking/torneio?id=${torneio.id}`}
      className={`group flex items-start gap-3 transition-colors hover:bg-areia-50 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-areia-900 group-hover:text-tijolo-700">
            {torneio.nome}
          </h3>
          <SituacaoDoTorneio situacao={torneio.situacao} />
        </div>
        <p className="mt-1 text-xs text-areia-600">
          {[
            torneio.duplas ? "Duplas" : "Simples",
            ROTULO_FORMATO[torneio.formato],
            torneio.categoria ? `Categoria ${torneio.categoria}` : "Livre",
          ].join(" · ")}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-areia-500">
          <span className="inline-flex items-center gap-1">
            <IconeAgenda className="h-3.5 w-3.5" />
            {formatarData(torneio.data)}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconeUsuarios className="h-3.5 w-3.5" />
            {inscricoes} {unidade}
          </span>
          {partidas > 0 && (
            <span>
              {jogadas} de {partidas} jogos
            </span>
          )}
        </p>

        {comAndamento && partidas > 0 && (
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-areia-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentagem}
            aria-label={`Andamento: ${jogadas} de ${partidas} jogos`}
          >
            <div className="h-full rounded-full bg-saibro-500" style={{ width: `${porcentagem}%` }} />
          </div>
        )}

        {campeao && (
          <p className="mt-2.5 flex items-center gap-2 rounded-lg bg-saibro-50 px-2.5 py-1.5 text-xs text-saibro-800">
            <IconeTrofeu className="h-4 w-4 shrink-0 text-saibro-600" />
            <AvataresDoLado alunos={campeao.alunos} />
            <span className="truncate">
              {torneio.duplas ? "Campeões" : "Campeão"}: <strong>{campeao.nome}</strong>
            </span>
          </p>
        )}
      </div>
      <IconeProximo className="mt-0.5 h-4 w-4 shrink-0 text-areia-400" />
    </Link>
  );
}

/**
 * Torneios com situacao, formato, data, inscritos, andamento e campeao.
 * `emGrade`: cartoes lado a lado (aba Torneios); sem ele, lista simples
 * (coluna lateral do ranking).
 */
export function ListaTorneios({
  torneios,
  emGrade,
}: {
  torneios: TorneioNaLista[];
  emGrade?: boolean;
}) {
  if (torneios.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-areia-500">Nenhum torneio cadastrado.</p>;
  }
  if (emGrade) {
    return (
      <ul className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {torneios.map((item) => (
          <li key={item.torneio.id}>
            <ItemDoTorneio
              item={item}
              comAndamento
              className="h-full rounded-xl border border-areia-200 p-4 hover:border-saibro-300"
            />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-areia-100">
      {torneios.map((item) => (
        <li key={item.torneio.id}>
          <ItemDoTorneio item={item} comAndamento={false} className="px-5 py-4" />
        </li>
      ))}
    </ul>
  );
}
