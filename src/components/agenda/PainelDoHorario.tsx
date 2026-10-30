"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ComentariosDoRegistro } from "@/components/registro/ComentariosDoRegistro";
import { HistoricoDoRegistro } from "@/components/registro/HistoricoDoRegistro";
import { IconeAlerta, IconeFechar, IconeMais, IconeRelogio } from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import { comentariosDe } from "@/lib/consultas/base";
import {
  buscarSiglaDaAgenda,
  descreverCarimboDaAgenda,
  detalheDaOcupacao,
  duracaoEmMinutos,
  rotuloDaQuadra,
  tipoComDireitoAReposicao,
  type DetalheDaOcupacao,
} from "@/lib/consultas/agenda";
import {
  DIAS_SEMANA_LONGO,
  diaDaSemana,
  formatarData,
  formatarDataExtenso,
  formatarDataHora,
} from "@/lib/date";
import { ESTILO_OCUPACAO, formatarMinutos, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import {
  ConfirmarCancelamento,
  ConfirmarEncerramento,
  ConfirmarLiberacao,
  ModalRemarcar,
} from "./AcoesDoHorario";
import { Gaveta } from "./Gaveta";
import { IconeCancelar, IconeFimDoHorario, IconeRemarcar } from "./Icones";
import { IncluirAluno } from "./IncluirAluno";
import { ListaDePresenca } from "./ListaDePresenca";
import { Marcadores } from "./Marcadores";
import {
  FUNDO_BLOQUEIO,
  ROTULO_SITUACAO,
  comMaiuscula,
  intervalo,
  repeticaoSemanal,
} from "./estilos";

type Acao = "cancelar" | "remarcar" | "encerrar" | "liberar";

/** Nomes legiveis dos campos no historico de alteracoes. */
const ROTULOS_DO_HISTORICO: Record<string, string> = {
  situacao: "Situação",
  motivoCancelamento: "Motivo do cancelamento",
  canceladaEm: "Cancelada em",
  data: "Data",
  horaInicio: "Início",
  horaFim: "Término",
  quadraId: "Quadra",
  prazoPagamento: "Prazo de pagamento",
  descricao: "Descrição",
  professorId: "Professor",
};

/**
 * Painel do horario, aberto ao clicar numa ocupacao: alunos (com presenca),
 * professor, quadra, situacao, pagamento, reposicao, comentarios e
 * historico, e as acoes (remarcar, cancelar, encerrar o horario fixo,
 * liberar a reserva vencida, incluir aluno ou usar reposicao).
 */
export function PainelDoHorario({
  ocupacaoId,
  aoFechar,
  podeEditar,
  agora,
}: {
  ocupacaoId: string | null;
  aoFechar: () => void;
  podeEditar: boolean;
  agora: string;
}) {
  const { banco } = useApp();
  const detalhe = useMemo(
    () => (ocupacaoId ? detalheDaOcupacao(banco, ocupacaoId, agora, HOJE) : undefined),
    [banco, ocupacaoId, agora],
  );

  return (
    <Gaveta aberto={Boolean(ocupacaoId)} aoFechar={aoFechar} titulo="Painel do horário">
      {detalhe ? (
        <ConteudoDoPainel
          key={detalhe.item.ocupacao.id}
          detalhe={detalhe}
          aoFechar={aoFechar}
          podeEditar={podeEditar}
          agora={agora}
        />
      ) : (
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-areia-700">Este horário não está mais na agenda.</p>
            <button
              type="button"
              onClick={aoFechar}
              className="btn-fantasma px-2 py-1.5"
              aria-label="Fechar"
            >
              <IconeFechar className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Gaveta>
  );
}

function ConteudoDoPainel({
  detalhe,
  aoFechar,
  podeEditar,
  agora,
}: {
  detalhe: DetalheDaOcupacao;
  aoFechar: () => void;
  podeEditar: boolean;
  agora: string;
}) {
  const { banco } = useApp();
  const [acao, setAcao] = useState<Acao | null>(null);
  const [incluindo, setIncluindo] = useState(false);
  const [aba, setAba] = useState<"comentarios" | "historico">("comentarios");

  const { item, horarioFixo, quadra } = detalhe;
  const { ocupacao } = item;
  const estilo = ESTILO_OCUPACAO[ocupacao.tipo];
  const bloqueio = ocupacao.tipo === "Bloqueio";
  const ativa = !item.cancelada;
  const sigla = ocupacao.motivoCancelamento
    ? buscarSiglaDaAgenda(banco, ocupacao.motivoCancelamento)
    : undefined;
  const comentarios = comentariosDe(banco, "ocupacao", ocupacao.id).length;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-areia-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-start gap-3">
          <span
            className="mt-1 h-12 w-1.5 shrink-0 rounded-full"
            style={{
              backgroundColor: item.cancelada ? "#B3A897" : estilo.cor,
              backgroundImage: bloqueio ? FUNDO_BLOQUEIO : undefined,
            }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: estilo.texto }}
            >
              {bloqueio
                ? "Bloqueio de quadra"
                : `${ocupacao.tipo} · ${horarioFixo ? "horário fixo" : "avulso"}`}
            </p>
            <h2 className="text-lg font-semibold text-areia-900">
              {rotuloDaQuadra(ocupacao.quadraId)} · {intervalo(ocupacao)}
            </h2>
            <p className="text-sm text-areia-600">
              {DIAS_SEMANA_LONGO[diaDaSemana(ocupacao.data)]}, {formatarDataExtenso(ocupacao.data)}
              {ocupacao.data === HOJE && " (hoje)"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-areia-100 px-1.5 py-0.5 text-[11px] font-semibold text-areia-800">
                {ROTULO_SITUACAO[ocupacao.situacao]}
              </span>
              <Marcadores item={item} />
            </div>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="btn-fantasma shrink-0 px-2 py-1.5"
            aria-label="Fechar painel"
          >
            <IconeFechar className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-5">
        {item.cancelada && (
          <Faixa tom="neutro">
            Cancelada{ocupacao.canceladaEm ? ` em ${formatarDataHora(ocupacao.canceladaEm)}` : ""}.
            Motivo:{" "}
            <strong>
              {ocupacao.motivoCancelamento}
              {sigla ? ` — ${sigla.nome}` : ""}
            </strong>
            .
          </Faixa>
        )}
        {item.estadoReserva === "aguardando" && (
          <Faixa tom="atencao" icone={<IconeRelogio className="h-4 w-4" />}>
            Aguardando pagamento até{" "}
            <strong>{descreverCarimboDaAgenda(ocupacao.prazoPagamento ?? "")}</strong>. Quando o
            Financeiro registrar o pagamento, a reserva fica confirmada.
          </Faixa>
        )}
        {item.estadoReserva === "vencida" && (
          <Faixa tom="erro" icone={<IconeAlerta className="h-4 w-4" />}>
            O prazo de pagamento venceu em{" "}
            <strong>{descreverCarimboDaAgenda(ocupacao.prazoPagamento ?? "")}</strong>. A recepção
            decide se libera o horário (Hipótese H5).
            {podeEditar && (
              <button
                type="button"
                onClick={() => setAcao("liberar")}
                className="btn-perigo mt-2 w-full py-2 sm:w-auto"
              >
                Liberar horário
              </button>
            )}
          </Faixa>
        )}

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-2xl border border-areia-200 p-4 text-sm sm:grid-cols-2">
          {!bloqueio && (
            <Info rotulo="Professor">
              {item.professor ? (
                <Link
                  href={`/professores/${item.professor.id}`}
                  className="font-medium text-saibro-800 hover:underline"
                >
                  {item.professor.nome}
                </Link>
              ) : (
                <span className="text-areia-500">Sem professor</span>
              )}
            </Info>
          )}
          <Info rotulo="Quadra">
            {quadra?.nome ?? rotuloDaQuadra(ocupacao.quadraId)}
            {quadra && <span className="text-areia-500"> · {quadra.piso}</span>}
          </Info>
          <Info rotulo="Horário">
            {intervalo(ocupacao)} ({formatarMinutos(duracaoEmMinutos(ocupacao))})
          </Info>
          <Info rotulo="Repetição">
            {horarioFixo ? (
              <>
                {comMaiuscula(repeticaoSemanal(horarioFixo.diaSemana))}, {horarioFixo.horaInicio}–
                {horarioFixo.horaFim}
                <span className="block text-xs text-areia-500">
                  desde {formatarData(horarioFixo.inicio)}
                  {horarioFixo.fim
                    ? ` até ${formatarData(horarioFixo.fim)}`
                    : ", sem data para acabar"}
                </span>
              </>
            ) : (
              "Uma data só"
            )}
          </Info>
          {ocupacao.descricao && (
            <Info rotulo={bloqueio ? "Motivo do bloqueio" : "Observação"}>
              {ocupacao.descricao}
            </Info>
          )}
          <Info rotulo="Marcado em">{formatarDataHora(ocupacao.criadoEm)}</Info>
        </dl>

        {!bloqueio && (
          <Secao
            titulo={`Alunos (${item.participantes.length})`}
            acao={
              podeEditar &&
              ativa &&
              !incluindo && (
                <button
                  type="button"
                  onClick={() => setIncluindo(true)}
                  className="btn-secundario px-2.5 py-1.5 text-xs"
                >
                  <IconeMais className="h-3.5 w-3.5" />
                  Incluir aluno
                </button>
              )
            }
          >
            <ListaDePresenca item={item} podeEditar={podeEditar} />
            {incluindo && <IncluirAluno item={item} aoFechar={() => setIncluindo(false)} />}
            {ativa && ocupacao.data > HOJE && (
              <p className="border-t border-areia-100 px-4 py-2 text-xs text-areia-500">
                Presença e falta ficam liberadas no dia da aula. Falta avisada pode ser marcada
                antes.
              </p>
            )}
          </Secao>
        )}

        {!bloqueio && <SecaoPagamento detalhe={detalhe} />}

        {(detalhe.creditosGerados.length > 0 || detalhe.usos.length > 0) && (
          <Secao titulo="Reposição">
            <ul className="divide-y divide-areia-100 text-sm">
              {detalhe.creditosGerados.map(({ lancamento, nome }) => (
                <li
                  key={lancamento.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-areia-800">
                    {nome}{" "}
                    <span className="text-xs text-areia-500">· crédito {lancamento.sigla}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-semibold text-emerald-700">
                      +{formatarMinutos(lancamento.minutos)}
                    </span>
                    {lancamento.validade && (
                      <span className="block text-[11px] text-areia-500">
                        vale até {formatarData(lancamento.validade)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {detalhe.usos.map(({ lancamento, nome }) => (
                <li
                  key={lancamento.id}
                  className="flex items-baseline justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-areia-800">
                    {nome}{" "}
                    <span className="text-xs text-areia-500">· usou reposição nesta aula</span>
                  </span>
                  <span className="font-semibold text-violet-800">
                    −{formatarMinutos(-lancamento.minutos)}
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {podeEditar && ativa && (
          <div className="flex flex-wrap gap-2">
            {ocupacao.situacao !== "realizada" && (
              <button
                type="button"
                onClick={() => setAcao("remarcar")}
                className="btn-secundario py-2"
              >
                <IconeRemarcar className="h-4 w-4" />
                Remarcar
              </button>
            )}
            <button
              type="button"
              onClick={() => setAcao("cancelar")}
              className="btn border border-tijolo-200 bg-white py-2 text-tijolo-700 hover:bg-tijolo-50"
            >
              <IconeCancelar className="h-4 w-4" />
              {bloqueio ? "Cancelar bloqueio" : "Cancelar aula"}
            </button>
            {horarioFixo && (!horarioFixo.fim || horarioFixo.fim > ocupacao.data) && (
              <button
                type="button"
                onClick={() => setAcao("encerrar")}
                className="btn-fantasma py-2"
              >
                <IconeFimDoHorario className="h-4 w-4" />
                Encerrar horário fixo
              </button>
            )}
          </div>
        )}
        {podeEditar &&
          !ativa &&
          horarioFixo &&
          (!horarioFixo.fim || horarioFixo.fim > ocupacao.data) && (
            <button type="button" onClick={() => setAcao("encerrar")} className="btn-fantasma py-2">
              <IconeFimDoHorario className="h-4 w-4" />
              Encerrar horário fixo
            </button>
          )}

        <section className="rounded-2xl border border-areia-200">
          <div className="border-b border-areia-200 px-4 py-3">
            <Segmentado
              aria="Comentários ou histórico"
              valor={aba}
              aoMudar={setAba}
              opcoes={[
                {
                  valor: "comentarios",
                  rotulo: `Comentários${comentarios > 0 ? ` (${comentarios})` : ""}`,
                },
                { valor: "historico", rotulo: "Histórico" },
              ]}
            />
          </div>
          {aba === "comentarios" ? (
            <ComentariosDoRegistro entidade="ocupacao" entidadeId={ocupacao.id} semCartao />
          ) : (
            <HistoricoDoRegistro
              tabela="ocupacoes"
              registroId={ocupacao.id}
              rotulos={ROTULOS_DO_HISTORICO}
              semCartao
            />
          )}
        </section>
      </div>

      {acao === "cancelar" && (
        <ConfirmarCancelamento item={item} agora={agora} aoFechar={() => setAcao(null)} />
      )}
      {acao === "remarcar" && <ModalRemarcar item={item} aoFechar={() => setAcao(null)} />}
      {acao === "encerrar" && horarioFixo && (
        <ConfirmarEncerramento
          item={item}
          horarioFixo={horarioFixo}
          aoFechar={() => setAcao(null)}
        />
      )}
      {acao === "liberar" && <ConfirmarLiberacao item={item} aoFechar={() => setAcao(null)} />}
    </>
  );
}

const ROTULO_SITUACAO_LANCAMENTO = {
  pago: { texto: "Pago", classe: "bg-emerald-50 text-emerald-800" },
  pendente: { texto: "Pendente", classe: "bg-amber-50 text-amber-800" },
  em_atraso: { texto: "Em atraso", classe: "bg-tijolo-600 text-white" },
  cancelado: { texto: "Anulado", classe: "bg-areia-200 text-areia-700" },
} as const;

function SecaoPagamento({ detalhe }: { detalhe: DetalheDaOcupacao }) {
  const { item, cobrancas, usos } = detalhe;
  const tipo = item.ocupacao.tipo;
  return (
    <Secao titulo="Pagamento">
      {cobrancas.length > 0 ? (
        <ul className="divide-y divide-areia-100">
          {cobrancas.map(({ lancamento, situacao }) => (
            <li
              key={lancamento.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block font-medium text-areia-900">{lancamento.item}</span>
                <span className="block text-xs text-areia-500">
                  {lancamento.nomePagante} · vence {formatarData(lancamento.vencimento)}
                  {lancamento.pagoEm && ` · pago em ${formatarData(lancamento.pagoEm)}`}
                  {lancamento.formaPagamento && ` (${lancamento.formaPagamento})`}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-areia-900">
                  {formatarMoeda(lancamento.valor)}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${ROTULO_SITUACAO_LANCAMENTO[situacao].classe}`}
                >
                  {ROTULO_SITUACAO_LANCAMENTO[situacao].texto}
                </span>
              </span>
            </li>
          ))}
          {item.ocupacao.situacao === "aguardando_pagamento" && (
            <li className="px-4 py-2.5 text-xs text-areia-600">
              O pagamento é registrado no{" "}
              <Link href="/financeiro" className="font-semibold text-saibro-700 hover:underline">
                Financeiro
              </Link>
              ; ao pagar, a reserva fica confirmada.
            </li>
          )}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-areia-600">
          {usos.length > 0
            ? "Paga com minutos de reposição (ver abaixo)."
            : tipoComDireitoAReposicao(tipo)
              ? "Aula do plano mensal: cobrada na mensalidade de cada aluno."
              : "Sem cobrança ligada a este horário."}
        </p>
      )}
    </Secao>
  );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-areia-200">
      <header className="flex items-center justify-between gap-2 border-b border-areia-200 bg-areia-50/60 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-areia-900">{titulo}</h3>
        {acao}
      </header>
      {children}
    </section>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-areia-500">{rotulo}</dt>
      <dd className="mt-0.5 text-areia-900">{children}</dd>
    </div>
  );
}

function Faixa({
  tom,
  icone,
  children,
}: {
  tom: "neutro" | "atencao" | "erro";
  icone?: ReactNode;
  children: ReactNode;
}) {
  const classe = {
    neutro: "border-areia-300 bg-areia-100 text-areia-800",
    atencao: "border-amber-300 bg-amber-50 text-amber-900",
    erro: "border-tijolo-200 bg-tijolo-50 text-tijolo-800",
  }[tom];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${classe}`}>
      {icone && <span className="mt-0.5 shrink-0">{icone}</span>}
      <div className="leading-snug">{children}</div>
    </div>
  );
}
