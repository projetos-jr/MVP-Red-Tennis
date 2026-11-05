"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EtiquetaDeSituacao, type Situacao } from "@/components/ui/EtiquetaDeSituacao";
import {
  IconeAgenda,
  IconeCheck,
  IconeEstoque,
  IconeFinanceiro,
  IconeRelogio,
  IconeSeta,
} from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import type { Configuracoes } from "@/lib/banco/tipos";
import { nivelDoEstoque } from "@/lib/consultas/estoque";
import type {
  AlunoResumido,
  GrupoDeAtencao,
  MensalidadeEmAtraso,
  PrecisaDeAtencao as DadosDeAtencao,
  ProdutoAbaixoDoMinimo,
  ReposicaoAVencer,
  ReservaSemPagamento,
} from "@/lib/consultas/painel";
import { DIAS_SEMANA_CURTO, diaDaSemana, formatarData, formatarDiaMes, somarDias } from "@/lib/date";
import {
  ESTILO_CATEGORIA_PRODUTO,
  ESTILO_NIVEL_ESTOQUE,
  formatarMinutos,
  formatarMoeda,
} from "@/lib/theme";

/** Itens visiveis antes do "Mostrar todos": a contagem do grupo sempre e a da lista inteira. */
const ITENS_RECOLHIDOS = 3;

/** Titulo de cada grupo. */
const NOME_DO_GRUPO: Record<GrupoDeAtencao["tipo"], string> = {
  reservas: "Reservas sem pagamento",
  mensalidades: "Mensalidades em atraso",
  produtos: "Produtos abaixo do mínimo",
  reposicoes: "Reposições perto de vencer",
};

/** Nome curto do assunto, na linha "Em dia" dos grupos sem nada. */
const ASSUNTO_DO_GRUPO: Record<GrupoDeAtencao["tipo"], string> = {
  reservas: "reservas",
  mensalidades: "mensalidades",
  produtos: "estoque",
  reposicoes: "reposições",
};

/** "a", "a e b", "a, b e c". */
function juntar(partes: string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * Etiquetas um pouco maiores que as das tabelas (a janela e para ler de
 * relance); no celular um pouco menores, para caber numa linha so.
 */
const ETIQUETA = "px-2 py-0.5 text-[0.8125rem] sm:px-2.5 sm:py-1 sm:text-sm";

function plural(quantidade: number, singular: string, formaPlural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : formaPlural}`;
}

/** "hoje", "ontem", "amanhã" ou "sex 30/10". */
function quando(data: string): string {
  if (data === HOJE) return "hoje";
  if (data === somarDias(HOJE, -1)) return "ontem";
  if (data === somarDias(HOJE, 1)) return "amanhã";
  return `${DIAS_SEMANA_CURTO[diaDaSemana(data)].toLowerCase()} ${formatarDiaMes(data)}`;
}

/** Mesmas etiquetas das reservas no financeiro: vencida, vence hoje, no prazo. */
function rotuloDoPrazo(reserva: ReservaSemPagamento): { texto: string; situacao?: Situacao } {
  if (!reserva.prazo) return { texto: "Sem prazo para pagar" };
  const dia = reserva.prazo.slice(0, 10);
  const hora = reserva.prazo.slice(11, 16);
  if (reserva.vencida) return { texto: `Prazo vencido ${quando(dia)} às ${hora}`, situacao: "em_atraso" };
  return {
    texto: `Pagar até ${quando(dia)} às ${hora}`,
    situacao: dia === HOJE ? "pendente" : "em_andamento",
  };
}

function FotoDoAluno({ aluno }: { aluno?: AlunoResumido }) {
  if (!aluno) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-areia-100 text-areia-500">
        <IconeAgenda className="h-5 w-5" />
      </span>
    );
  }
  return <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="md" />;
}

/**
 * Linha clicavel de um item: foto, nome, detalhe e o selo (prazo, atraso...)
 * embaixo do texto; a direita fica so o valor, para o nome nao ser cortado
 * no celular.
 */
function Item({
  href,
  foto,
  titulo,
  detalhe,
  valor,
  marca,
}: {
  href: string;
  foto: ReactNode;
  titulo: string;
  detalhe: string;
  valor?: string;
  marca: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-2xl border border-areia-200 bg-white p-3 transition-colors hover:border-saibro-300 hover:bg-saibro-50 sm:gap-4 sm:p-3.5"
      >
        <span aria-hidden="true">{foto}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-base font-semibold text-areia-900 sm:text-lg">{titulo}</span>
            {valor && (
              <span className="shrink-0 text-base font-bold tabular-nums text-areia-900 sm:text-lg">{valor}</span>
            )}
          </span>
          <span className="block text-sm text-areia-600 sm:text-base">{detalhe}</span>
          <span className="mt-1.5 flex">{marca}</span>
        </span>
      </Link>
    </li>
  );
}

function Grupo({
  icone,
  titulo,
  detalhe,
  itens,
  links,
}: {
  icone: ReactNode;
  titulo: string;
  detalhe: string;
  itens: ReactNode[];
  links: Array<{ href: string; rotulo: string }>;
}) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, ITENS_RECOLHIDOS);
  const quantidade = itens.length;

  return (
    <section className="px-4 py-5 sm:px-6" aria-label={`${titulo}: ${quantidade}`}>
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saibro-50 text-saibro-700">
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold leading-tight text-areia-900 sm:text-2xl">{titulo}</h3>
          <p className="text-sm text-areia-600 sm:text-base">{detalhe}</p>
        </div>
        <span
          className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-tijolo-700 px-2.5 font-display text-lg font-bold tabular-nums text-white"
          aria-hidden="true"
        >
          {quantidade}
        </span>
      </header>

      <ul className="mt-4 space-y-2.5">{visiveis}</ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        {quantidade > ITENS_RECOLHIDOS && (
          <button
            type="button"
            onClick={() => setTodos((atual) => !atual)}
            aria-expanded={todos}
            className="alvo-de-toque text-base font-semibold text-areia-800 underline-offset-2 hover:underline"
          >
            {todos ? "Mostrar menos" : `Mostrar todos os ${quantidade}`}
          </button>
        )}
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="alvo-de-toque inline-flex items-center gap-1 text-base font-semibold text-saibro-700 underline-offset-2 hover:underline"
          >
            {link.rotulo} <IconeSeta className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function GrupoDeReservas({
  itens,
  configuracoes,
  podeRegistrarPagamento,
}: {
  itens: ReservaSemPagamento[];
  configuracoes: Configuracoes;
  podeRegistrarPagamento: boolean;
}) {
  return (
    <Grupo
      icone={<IconeAgenda className="h-6 w-6" />}
      titulo={NOME_DO_GRUPO.reservas}
      detalhe={`Prazo para pagar: ${configuracoes.prazoPagamentoReservaHoras} h. ${
        configuracoes.liberarReservaAutomaticamente
          ? "Vencido o prazo, o horário é liberado sozinho."
          : "Vencido o prazo, a recepção decide se libera o horário."
      }`}
      itens={itens.map((reserva) => {
        const prazo = rotuloDoPrazo(reserva);
        const { ocupacao } = reserva;
        return (
          <Item
            key={ocupacao.id}
            href={`/agenda?data=${ocupacao.data}&quadra=${ocupacao.quadraId}`}
            foto={<FotoDoAluno aluno={reserva.titular} />}
            titulo={reserva.titular?.nome ?? "Reserva sem titular"}
            detalhe={`${reserva.rotuloQuadra} · ${quando(ocupacao.data)} · ${ocupacao.horaInicio}–${ocupacao.horaFim}`}
            valor={formatarMoeda(reserva.valor)}
            marca={
              <EtiquetaDeSituacao situacao={prazo.situacao} className={ETIQUETA}>
                {prazo.texto}
              </EtiquetaDeSituacao>
            }
          />
        );
      })}
      links={[
        { href: "/agenda", rotulo: "Abrir agenda" },
        ...(podeRegistrarPagamento ? [{ href: "/financeiro?reservas=abrir", rotulo: "Registrar pagamento" }] : []),
      ]}
    />
  );
}

function GrupoDeMensalidades({ itens, valorTotal }: { itens: MensalidadeEmAtraso[]; valorTotal: number }) {
  return (
    <Grupo
      icone={<IconeFinanceiro className="h-6 w-6" />}
      titulo={NOME_DO_GRUPO.mensalidades}
      detalhe={`${formatarMoeda(valorTotal)} em aberto`}
      itens={itens.map(({ lancamento, aluno, diasEmAtraso }) => (
        <Item
          key={lancamento.id}
          href={aluno ? `/alunos/${aluno.id}` : "/financeiro"}
          foto={<FotoDoAluno aluno={aluno} />}
          titulo={aluno?.nome ?? lancamento.nomePagante ?? "Aluno removido"}
          detalhe={lancamento.item}
          valor={formatarMoeda(lancamento.valor)}
          marca={
            <EtiquetaDeSituacao situacao="em_atraso" className={ETIQUETA}>
              Venceu em {formatarData(lancamento.vencimento)} · {plural(diasEmAtraso, "dia", "dias")} de atraso
            </EtiquetaDeSituacao>
          }
        />
      ))}
      links={[{ href: "/financeiro", rotulo: "Abrir financeiro" }]}
    />
  );
}

function GrupoDeProdutos({ itens }: { itens: ProdutoAbaixoDoMinimo[] }) {
  return (
    <Grupo
      icone={<IconeEstoque className="h-6 w-6" />}
      titulo={NOME_DO_GRUPO.produtos}
      detalhe="Saldo menor que o estoque mínimo do cadastro"
      itens={itens.map(({ produto, saldo }) => {
        const cor = ESTILO_CATEGORIA_PRODUTO[produto.categoria];
        // Mesmas cores do estoque: "Esgotado" e "Repor já".
        const nivel = ESTILO_NIVEL_ESTOQUE[nivelDoEstoque(saldo, produto.estoqueMinimo)];
        return (
          <Item
            key={produto.id}
            href="/estoque"
            foto={
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                style={{ color: cor.cor, backgroundColor: cor.fundo, borderColor: cor.borda }}
              >
                <IconeEstoque className="h-5 w-5" />
              </span>
            }
            titulo={produto.nome}
            detalhe={`Saldo ${saldo} · mínimo ${produto.estoqueMinimo} (${produto.unidade})`}
            marca={
              <Badge cor={nivel.cor} fundo={nivel.fundo} borda={nivel.borda} className={ETIQUETA}>
                {saldo <= 0 ? "Esgotado" : `Faltam ${produto.estoqueMinimo - saldo} para o mínimo`}
              </Badge>
            }
          />
        );
      })}
      links={[{ href: "/estoque", rotulo: "Abrir estoque" }]}
    />
  );
}

function GrupoDeReposicoes({ itens }: { itens: ReposicaoAVencer[] }) {
  return (
    <Grupo
      icone={<IconeRelogio className="h-6 w-6" />}
      titulo={NOME_DO_GRUPO.reposicoes}
      detalhe="Créditos de aula que vencem em até 30 dias"
      itens={itens.map(({ aluno, minutos, validade, diasParaVencer }) => (
        <Item
          key={aluno.id}
          href={`/alunos/${aluno.id}`}
          foto={<FotoDoAluno aluno={aluno} />}
          titulo={aluno.nome}
          detalhe={`${formatarMinutos(minutos)} de reposição para marcar`}
          marca={
            <EtiquetaDeSituacao tom={diasParaVencer <= 7 ? "atencao" : "neutro"} className={ETIQUETA}>
              {diasParaVencer === 0
                ? "Vence hoje"
                : `Vence em ${plural(diasParaVencer, "dia", "dias")} (${formatarDiaMes(validade)})`}
            </EtiquetaDeSituacao>
          }
        />
      ))}
      links={[{ href: "/alunos", rotulo: "Ver clientes" }]}
    />
  );
}

/**
 * Conteudo da janela "Precisa de atenção" (aberta pela placa do Início):
 * junta o que pede uma acao hoje. So os grupos com algo aparecem, cada um
 * com a contagem da lista inteira, os tres primeiros itens e "Mostrar todos";
 * cada item leva a tela certa. Os grupos sem nada viram uma linha "Em dia"
 * no fim, para a pessoa saber que foram conferidos.
 */
export function PrecisaDeAtencao({
  atencao,
  configuracoes,
  podeRegistrarPagamento,
}: {
  atencao: DadosDeAtencao;
  configuracoes: Configuracoes;
  podeRegistrarPagamento: boolean;
}) {
  const comItens = atencao.grupos.filter((g) => g.itens.length > 0);
  const emDia = atencao.grupos.filter((g) => g.itens.length === 0);

  return (
    <div className="divide-y divide-areia-200">
      {comItens.map((grupo) => {
        switch (grupo.tipo) {
          case "reservas":
            return (
              <GrupoDeReservas
                key={grupo.tipo}
                itens={grupo.itens}
                configuracoes={configuracoes}
                podeRegistrarPagamento={podeRegistrarPagamento}
              />
            );
          case "mensalidades":
            return <GrupoDeMensalidades key={grupo.tipo} itens={grupo.itens} valorTotal={grupo.valorTotal} />;
          case "produtos":
            return <GrupoDeProdutos key={grupo.tipo} itens={grupo.itens} />;
          case "reposicoes":
            return <GrupoDeReposicoes key={grupo.tipo} itens={grupo.itens} />;
        }
      })}
      {emDia.length > 0 && (
        <p className="flex items-start gap-2.5 rounded-b-2xl bg-quadra-50 px-4 py-4 text-base text-quadra-800 sm:px-6">
          <IconeCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong className="font-semibold">Em dia:</strong>{" "}
            {juntar(emDia.map((g) => ASSUNTO_DO_GRUPO[g.tipo]))}.
          </span>
        </p>
      )}
    </div>
  );
}
