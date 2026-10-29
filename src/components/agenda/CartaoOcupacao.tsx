"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { nomeCompacto } from "@/lib/consultas/base";
import { rotuloDaQuadra, type ItemAgenda } from "@/lib/consultas/agenda";
import { ESTILO_OCUPACAO } from "@/lib/theme";
import { FUNDO_BLOQUEIO, intervalo, rotuloCurtoDaQuadra } from "./estilos";
import { Marcadores, MarcadoresMini } from "./Marcadores";

/**
 * Um horario na grade. O cartao inteiro e um botao (abre o painel do
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
    item.cancelada ? `cancelada (${o.motivoCancelamento ?? "sem motivo"})` : undefined,
    item.estadoReserva === "aguardando" ? "aguardando pagamento" : undefined,
    item.estadoReserva === "vencida" ? "prazo de pagamento vencido" : undefined,
    item.estadoReserva === "paga" ? "paga" : undefined,
    item.reposicao ? "reposição" : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export function estiloDoCartao(item: ItemAgenda) {
  const estilo = ESTILO_OCUPACAO[item.ocupacao.tipo];
  const vencida = item.estadoReserva === "vencida";
  return {
    estilo,
    style: {
      backgroundColor: item.cancelada ? "#FAF9F7" : estilo.fundo,
      backgroundImage:
        item.ocupacao.tipo === "Bloqueio" && !item.cancelada ? FUNDO_BLOQUEIO : undefined,
      borderLeftColor: item.cancelada ? "#B3A897" : estilo.cor,
      boxShadow: vencida
        ? "inset 0 0 0 2px #C43F2F"
        : `inset 0 0 0 1px ${item.cancelada ? "#E8E3DB" : estilo.borda}`,
    },
  };
}

const NOMES_NO_MODO_COMPACTO = 2;

/**
 * Chip da grade semanal. `compacto` quando as 5 quadras dividem a celula:
 * mostra 2 nomes e quantos faltam (a turma inteira esta no painel).
 */
export function ChipOcupacao({
  item,
  compacto,
  passado,
  aoAbrir,
}: {
  item: ItemAgenda;
  compacto: boolean;
  passado: boolean;
  aoAbrir: (item: ItemAgenda) => void;
}) {
  const { ocupacao, participantes, cancelada } = item;
  const { estilo, style } = estiloDoCartao(item);
  const visiveis = compacto ? participantes.slice(0, NOMES_NO_MODO_COMPACTO) : participantes;
  const ocultos = participantes.length - visiveis.length;
  const foraDoPadrao = ocupacao.horaInicio.slice(3) !== "00" || ocupacao.horaFim.slice(3) !== "00";
  const horaVisivel = foraDoPadrao || ocupacao.tipo === "Bloqueio" || !compacto;

  return (
    <article
      className={`relative rounded-lg border-l-[3px] px-2 py-1.5 text-left transition-shadow hover:shadow-sm ${
        passado || cancelada ? "opacity-60" : ""
      }`}
      style={style}
    >
      <button
        type="button"
        onClick={() => aoAbrir(item)}
        className="absolute inset-0 rounded-lg"
        aria-label={`Abrir horário: ${descricaoAcessivel(item)}`}
      />
      <header className="pointer-events-none relative flex items-center gap-1">
        <span
          className="rounded px-1 text-[10px] font-bold leading-4 text-white"
          style={{ backgroundColor: cancelada ? "#8C8172" : estilo.cor }}
        >
          {rotuloCurtoDaQuadra(ocupacao.quadraId)}
        </span>
        {horaVisivel && (
          <span className="truncate text-[10px] font-semibold tabular-nums text-areia-700">
            {ocupacao.tipo === "Bloqueio" || !compacto ? intervalo(ocupacao) : ocupacao.horaInicio}
          </span>
        )}
        {!compacto && ocupacao.tipo !== "Bloqueio" && (
          <span
            className="truncate text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: estilo.texto }}
          >
            {ocupacao.tipo}
          </span>
        )}
        <MarcadoresMini item={item} />
      </header>

      {ocupacao.tipo === "Bloqueio" ? (
        <p className="pointer-events-none relative mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight text-areia-800">
          Bloqueio{ocupacao.descricao ? ` · ${ocupacao.descricao}` : ""}
        </p>
      ) : (
        <ul className="pointer-events-none relative mt-0.5 space-y-px">
          {visiveis.map(({ participacao, nome }) => (
            <li key={participacao.id} className="truncate leading-tight">
              <Link
                href={`/alunos/${participacao.alunoId}`}
                className={`pointer-events-auto relative text-[11px] font-medium text-areia-800 underline-offset-2 hover:underline ${
                  cancelada ? "line-through decoration-areia-400" : ""
                }`}
              >
                {compacto ? nomeCompacto(nome) : nome}
              </Link>
            </li>
          ))}
          {ocultos > 0 && (
            <li className="text-[10px] font-medium leading-tight text-areia-500">
              +{ocultos} na turma
            </li>
          )}
        </ul>
      )}

      {item.professor && (
        <p className="pointer-events-none relative mt-0.5 truncate text-[10px] text-areia-600">
          {item.professor.nome}
        </p>
      )}
    </article>
  );
}

/**
 * Bloco da visao do dia por quadra: posicionado pela hora e com a altura da
 * duracao. `posicao` vem de quem desenha a coluna.
 */
export function BlocoNoDia({
  item,
  posicao,
  aoAbrir,
}: {
  item: ItemAgenda;
  posicao: { top: number; height: number; left: string; width: string };
  aoAbrir: (item: ItemAgenda) => void;
}) {
  const { ocupacao, participantes, cancelada } = item;
  const { estilo, style } = estiloDoCartao(item);
  const baixo = posicao.height < 50;
  return (
    <article
      className={`absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left transition-shadow hover:z-10 hover:shadow-card-hover ${
        cancelada ? "opacity-60" : ""
      }`}
      style={{ ...style, ...posicao }}
    >
      <button
        type="button"
        onClick={() => aoAbrir(item)}
        className="absolute inset-0 rounded-lg"
        aria-label={`Abrir horário: ${descricaoAcessivel(item)}`}
      />
      <header className="pointer-events-none relative flex items-center gap-1">
        <span className="truncate text-[11px] font-semibold tabular-nums text-areia-800">
          {intervalo(ocupacao)}
        </span>
        {!baixo && (
          <span
            className="truncate text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: estilo.texto }}
          >
            {ocupacao.tipo === "Bloqueio" ? "" : ocupacao.tipo}
          </span>
        )}
        <MarcadoresMini item={item} />
      </header>
      {ocupacao.tipo === "Bloqueio" ? (
        <p className="pointer-events-none relative text-xs font-medium leading-tight text-areia-800">
          Bloqueio{ocupacao.descricao ? ` · ${ocupacao.descricao}` : ""}
        </p>
      ) : (
        <p
          className={`pointer-events-none relative text-xs leading-snug text-areia-800 ${
            baixo ? "truncate" : "line-clamp-2"
          }`}
        >
          {participantes.map(({ participacao, nome }, i) => (
            <span key={participacao.id}>
              {i > 0 && ", "}
              <Link
                href={`/alunos/${participacao.alunoId}`}
                className={`pointer-events-auto relative font-medium underline-offset-2 hover:underline ${
                  cancelada ? "line-through decoration-areia-400" : ""
                }`}
              >
                {nome}
              </Link>
            </span>
          ))}
          {participantes.length === 0 && <span className="italic text-areia-500">Sem alunos</span>}
        </p>
      )}
      {item.professor && !baixo && (
        <p className="pointer-events-none relative truncate text-[10px] text-areia-600">
          {item.professor.nome}
        </p>
      )}
    </article>
  );
}

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
      className={`flex w-full items-center gap-1 truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[10px] font-medium text-areia-600 hover:bg-areia-100 ${
        item.cancelada ? "opacity-60" : ""
      }`}
      style={{
        borderLeftColor: item.cancelada ? "#B3A897" : estilo.cor,
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
 * Cartao maior (celular e lista do dia): todos os alunos com foto, o
 * professor e as marcas com texto.
 */
export function CartaoOcupacao({
  item,
  aoAbrir,
}: {
  item: ItemAgenda;
  aoAbrir: (item: ItemAgenda) => void;
}) {
  const { ocupacao, participantes, cancelada } = item;
  const { estilo, style } = estiloDoCartao(item);
  return (
    <article
      className={`relative rounded-xl border-l-4 p-3 ${cancelada ? "opacity-70" : ""}`}
      style={style}
    >
      <button
        type="button"
        onClick={() => aoAbrir(item)}
        className="absolute inset-0 rounded-xl"
        aria-label={`Abrir horário: ${descricaoAcessivel(item)}`}
      />
      <header className="pointer-events-none relative flex flex-wrap items-center gap-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: cancelada ? "#8C8172" : estilo.cor }}
        >
          {rotuloDaQuadra(ocupacao.quadraId)}
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: estilo.texto }}
        >
          {ocupacao.tipo}
        </span>
        <span className="text-[11px] tabular-nums text-areia-600">{intervalo(ocupacao)}</span>
        <Marcadores item={item} className="ml-auto" />
      </header>

      {ocupacao.tipo === "Bloqueio" ? (
        <p className="pointer-events-none relative mt-2 text-sm font-medium text-areia-800">
          {ocupacao.descricao ?? "Quadra fechada"}
        </p>
      ) : (
        <ul className="pointer-events-none relative mt-2 space-y-1.5">
          {participantes.map(({ participacao, aluno, nome }) => (
            <li key={participacao.id}>
              <Link
                href={`/alunos/${participacao.alunoId}`}
                className={`pointer-events-auto relative inline-flex items-center gap-2 text-sm font-medium text-areia-800 underline-offset-2 hover:underline ${
                  cancelada ? "line-through decoration-areia-400" : ""
                }`}
              >
                <Avatar id={participacao.alunoId} nome={nome} src={aluno?.fotoUrl} tamanho="xs" />
                {nome}
              </Link>
            </li>
          ))}
          {participantes.length === 0 && (
            <li className="text-xs italic text-areia-500">Sem alunos</li>
          )}
        </ul>
      )}

      {item.professor && (
        <p className="pointer-events-none relative mt-2 text-xs text-areia-600">
          {item.professor.nome}
        </p>
      )}
    </article>
  );
}
