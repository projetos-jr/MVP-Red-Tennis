"use client";

import Link from "next/link";
import { memo, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { TipoOcupacao } from "@/lib/banco/tipos";
import { nomeCompacto } from "@/lib/consultas/base";
import { rotuloDaQuadra, type ItemAgenda } from "@/lib/consultas/agenda";
import { PALETA } from "@/lib/paleta";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { FUNDO_BLOQUEIO, estiloDoBloco, intervalo, rotuloCurtoDaQuadra } from "./estilos";
import { densidadeDoBloco, linhasDoBloco } from "./grade";
import { Marcadores, MarcadoresMini } from "./Marcadores";

/**
 * Um horario na agenda. O cartao inteiro e um botao (abre o painel do
 * horario) e os nomes dos alunos ficam por cima, como links para a ficha:
 * o botao fica atras do conteudo, sem um elemento clicavel dentro do outro.
 */

/** Texto para leitor de tela: "Individual, Quadra 2, 19:00 às 20:00, cancelada". */
export function descricaoAcessivel(item: ItemAgenda): string {
  const o = item.ocupacao;
  return [
    o.tipo === "Bloqueio" ? `Bloqueio${o.descricao ? ` (${o.descricao})` : ""}` : o.tipo,
    rotuloDaQuadra(o.quadraId),
    `${o.horaInicio} às ${o.horaFim}`,
    item.participantes.length > 0
      ? item.participantes.map((p) => p.nome).join(", ")
      : undefined,
    item.professor ? `professor ${item.professor.nome}` : undefined,
    item.cancelada ? `cancelada (${o.motivoCancelamento ?? "sem motivo"})` : undefined,
    item.estadoReserva === "aguardando" ? "aguardando pagamento" : undefined,
    item.estadoReserva === "vencida" ? "prazo de pagamento vencido" : undefined,
    item.estadoReserva === "paga" ? "paga" : undefined,
    item.reposicao ? "reposição" : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Nome curto do tipo, para o selo dentro do bloco (o nome inteiro fica na legenda e no painel). */
const TIPO_CURTO: Record<TipoOcupacao, string> = {
  Individual: "Indiv.",
  "Locação Mensal": "Mensal",
  Dupla: "Dupla",
  LAP: "LAP",
  "Locação Avulsa": "Avulsa",
  Ranking: "Ranking",
  "Plano de locação": "Plano",
  Bloqueio: "Bloqueio",
};

/**
 * Bloco da grade (Diaria, Quadra, Professor): posicionado pela hora, com a
 * altura da duracao, na cor cheia do tipo. Quanto texto aparece depende da
 * altura (`densidadeDoBloco`).
 *
 * `nomesComoLink`: com mouse, cada nome abre a ficha. No toque o nome seria
 * um alvo pequeno demais; o bloco abre o painel, e la cada nome abre a ficha.
 */
export const BlocoNaGrade = memo(function BlocoNaGrade({
  item,
  posicao,
  mostrarQuadra,
  mostrarProfessor,
  nomesComoLink,
  aoAbrir,
}: {
  item: ItemAgenda;
  posicao: { top: number; height: number; left: string; width: string };
  /** Selo da quadra (visao Professor: as aulas sao em quadras diferentes). */
  mostrarQuadra: boolean;
  /** Nome do professor (fica de fora na visao Professor). */
  mostrarProfessor: boolean;
  nomesComoLink: boolean;
  aoAbrir: (item: ItemAgenda) => void;
}) {
  const { ocupacao, participantes } = item;
  const visual = estiloDoBloco(item);
  const densidade = densidadeDoBloco(posicao.height);
  const linhas = linhasDoBloco(posicao.height, mostrarProfessor && Boolean(item.professor));
  const bloqueio = ocupacao.tipo === "Bloqueio";
  const selo = `rounded-[3px] px-1 text-[10px] font-bold leading-[14px] ${visual.selo}`;
  const riscado = visual.riscado ? "line-through" : "";
  // Um nome por linha quando cabem todos (ou quase); senao, separados por virgula.
  const umPorLinha = densidade === "ampla" && participantes.length <= linhas.nomes;

  const nome = (participacao: { id: string; alunoId: string }, texto: string) =>
    nomesComoLink ? (
      <Link
        href={`/alunos/${participacao.alunoId}`}
        className={`pointer-events-auto relative underline-offset-2 hover:underline ${riscado}`}
        title={`Abrir a ficha de ${texto}`}
      >
        {texto}
      </Link>
    ) : (
      <span className={riscado}>{texto}</span>
    );

  const nomes = bloqueio ? null : participantes.length === 0 ? (
    <span className="italic">Sem alunos</span>
  ) : umPorLinha ? (
    participantes.map(({ participacao, nome: completo }) => (
      <span key={participacao.id} className="block truncate">
        {nome(participacao, completo)}
      </span>
    ))
  ) : (
    participantes.map(({ participacao, nome: completo }, i) => (
      <span key={participacao.id}>
        {i > 0 && ", "}
        {nome(participacao, nomeCompacto(completo))}
      </span>
    ))
  );

  return (
    <article
      className="absolute z-10 overflow-hidden rounded-md px-1.5 py-[3px] text-left transition-shadow hover:z-20 hover:shadow-card-hover focus-within:z-20"
      style={{ ...visual.style, ...posicao }}
      data-fundo-de-contraste={visual.fundoDeContraste}
    >
      <button
        type="button"
        onClick={() => aoAbrir(item)}
        className="absolute inset-0 rounded-md"
        aria-label={`Abrir horário: ${descricaoAcessivel(item)}`}
      />
      <header className="pointer-events-none relative flex h-[14px] min-w-0 items-center gap-1">
        {visual.alerta && (
          <span className="shrink-0 text-[11px] font-bold leading-[14px]" title="Prazo de pagamento vencido">
            ⚠
          </span>
        )}
        {mostrarQuadra && (
          <span className={`${selo} shrink-0`}>{rotuloCurtoDaQuadra(ocupacao.quadraId)}</span>
        )}
        <span className="shrink-0 text-[11px] font-bold tabular-nums leading-[14px]">
          {ocupacao.horaInicio}
        </span>
        {(densidade === "normal" || densidade === "ampla") && (
          <span className={`${selo} min-w-0 truncate uppercase tracking-wide`} title={ocupacao.tipo}>
            {TIPO_CURTO[ocupacao.tipo]}
          </span>
        )}
        {linhas.nomes === 0 && (
          <span className="min-w-0 truncate text-[11px] font-medium leading-[14px]">
            {bloqueio ? (ocupacao.descricao ?? "Bloqueio") : nomes}
          </span>
        )}
        <MarcadoresMini item={item} />
      </header>

      {linhas.nomes > 0 &&
        (bloqueio ? (
          <p
            className="pointer-events-none relative overflow-hidden break-words text-xs font-semibold leading-[14px] hyphens-auto"
            style={{ maxHeight: linhas.nomes * 14 }}
          >
            {densidade === "compacta" ? "Bloqueio" : (ocupacao.descricao ?? "Quadra fechada")}
          </p>
        ) : (
          <p
            className={`pointer-events-none relative text-xs font-medium leading-[14px] ${
              linhas.nomes === 1 ? "truncate" : "overflow-hidden"
            }`}
            style={
              linhas.nomes > 1 && !umPorLinha
                ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: linhas.nomes }
                : undefined
            }
          >
            {nomes}
          </p>
        ))}

      {linhas.professor && item.professor && (
        <p className="pointer-events-none relative truncate text-[11px] leading-[13px]">
          {item.professor.nome}
        </p>
      )}
    </article>
  );
});

/** Marca discreta nas faixas seguintes de um horario longo ("Q4 · Bloqueio até 13:00"). */
export function ContinuacaoOcupacao({
  item,
  aoAbrir,
}: {
  item: ItemAgenda;
  aoAbrir: (item: ItemAgenda) => void;
}) {
  const estilo = ESTILO_OCUPACAO[item.ocupacao.tipo];
  return (
    <button
      type="button"
      onClick={() => aoAbrir(item)}
      className={`alvo-de-toque flex w-full items-center gap-1 truncate rounded-md border-l-[3px] bg-areia-50 px-1.5 py-0.5 text-left text-[11px] font-medium text-areia-600 hover:bg-areia-100 ${
        item.cancelada ? "line-through" : ""
      }`}
      style={{
        borderLeftColor: item.cancelada ? PALETA.areia[400] : estilo.cor,
        backgroundImage: item.ocupacao.tipo === "Bloqueio" ? FUNDO_BLOQUEIO : undefined,
      }}
      aria-label={`Continuação: ${descricaoAcessivel(item)}`}
    >
      <span aria-hidden="true">↳</span>
      <span className="font-bold">{rotuloCurtoDaQuadra(item.ocupacao.quadraId)}</span>
      <span className="truncate">
        {item.ocupacao.tipo} até {item.ocupacao.horaFim}
      </span>
    </button>
  );
}

/**
 * Cartao maior (lista do dia no celular): todos os alunos com foto, o
 * professor e as marcas com texto, na mesma cor cheia dos blocos da grade.
 */
export function CartaoOcupacao({
  item,
  aoAbrir,
}: {
  item: ItemAgenda;
  aoAbrir: (item: ItemAgenda) => void;
}) {
  const { ocupacao, participantes } = item;
  const visual = estiloDoBloco(item);
  const selo = `rounded px-1.5 py-0.5 text-[11px] font-bold ${visual.selo}`;
  const estilo: CSSProperties = visual.style;
  return (
    <article
      className="relative rounded-xl p-3"
      style={estilo}
      data-fundo-de-contraste={visual.fundoDeContraste}
    >
      <button
        type="button"
        onClick={() => aoAbrir(item)}
        className="absolute inset-0 rounded-xl"
        aria-label={`Abrir horário: ${descricaoAcessivel(item)}`}
      />
      <header className="pointer-events-none relative flex flex-wrap items-center gap-1.5">
        {visual.alerta && <span aria-hidden="true">⚠</span>}
        <span className={selo}>{rotuloDaQuadra(ocupacao.quadraId)}</span>
        <span className={`${selo} uppercase tracking-wide`}>{ocupacao.tipo}</span>
        <span className="text-xs font-semibold tabular-nums">{intervalo(ocupacao)}</span>
        <Marcadores item={item} className="ml-auto" />
      </header>

      {ocupacao.tipo === "Bloqueio" ? (
        <p className="pointer-events-none relative mt-2 text-sm font-semibold">
          {ocupacao.descricao ?? "Quadra fechada"}
        </p>
      ) : (
        <ul className="pointer-events-none relative mt-1.5 space-y-0.5">
          {participantes.map(({ participacao, aluno, nome }) => (
            <li key={participacao.id}>
              <Link
                href={`/alunos/${participacao.alunoId}`}
                className={`alvo-de-toque pointer-events-auto relative inline-flex items-center gap-2 text-sm font-semibold underline-offset-2 hover:underline ${
                  visual.riscado ? "line-through" : ""
                }`}
              >
                <Avatar id={participacao.alunoId} nome={nome} src={aluno?.fotoUrl} tamanho="xs" />
                {nome}
              </Link>
            </li>
          ))}
          {participantes.length === 0 && <li className="py-1 text-xs italic">Sem alunos</li>}
        </ul>
      )}

      {item.professor && (
        <p className="pointer-events-none relative mt-1 text-xs font-medium">
          {item.professor.nome}
        </p>
      )}
    </article>
  );
}
