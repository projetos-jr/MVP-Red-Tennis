"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  IconeAgenda,
  IconeAlerta,
  IconeCheck,
  IconeEstoque,
  IconeFinanceiro,
  IconeRelogio,
  IconeSeta,
} from "@/components/ui/Icons";
import { HOJE } from "@/lib/banco/constantes";
import type { Configuracoes } from "@/lib/banco/tipos";
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
import { ESTILO_CATEGORIA_PRODUTO, formatarMinutos, formatarMoeda } from "@/lib/theme";

/** Itens visiveis antes do "Mostrar todos": a contagem do grupo sempre e a da lista inteira. */
const ITENS_RECOLHIDOS = 3;

const TONS = {
  alerta: "border-tijolo-200 bg-tijolo-50 text-tijolo-800",
  atencao: "border-amber-200 bg-amber-50 text-amber-800",
  neutro: "border-areia-200 bg-areia-50 text-areia-700",
} as const;

export function plural(quantidade: number, singular: string, formaPlural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : formaPlural}`;
}

/** "hoje", "ontem", "amanhã" ou "sex 30/10". */
function quando(data: string): string {
  if (data === HOJE) return "hoje";
  if (data === somarDias(HOJE, -1)) return "ontem";
  if (data === somarDias(HOJE, 1)) return "amanhã";
  return `${DIAS_SEMANA_CURTO[diaDaSemana(data)].toLowerCase()} ${formatarDiaMes(data)}`;
}

function rotuloDoPrazo(reserva: ReservaSemPagamento): { texto: string; tom: keyof typeof TONS } {
  if (!reserva.prazo) return { texto: "Sem prazo para pagar", tom: "neutro" };
  const dia = reserva.prazo.slice(0, 10);
  const hora = reserva.prazo.slice(11, 16);
  if (reserva.vencida) return { texto: `Prazo vencido ${quando(dia)} às ${hora}`, tom: "alerta" };
  return { texto: `Pagar até ${quando(dia)} às ${hora}`, tom: dia === HOJE ? "atencao" : "neutro" };
}

function FotoDoAluno({ aluno }: { aluno?: AlunoResumido }) {
  if (!aluno) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-areia-100 text-areia-500">
        <IconeAgenda className="h-4 w-4" />
      </span>
    );
  }
  return <Avatar id={aluno.id} nome={aluno.nome} src={aluno.fotoUrl} tamanho="sm" />;
}

/**
 * Linha clicavel de um item: foto, nome, detalhe e o selo (prazo, atraso...)
 * embaixo do texto; a direita fica so o valor, para o nome nao ser cortado
 * na coluna estreita do tablet.
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
        className="flex items-start gap-3 rounded-xl border border-areia-200 p-2.5 transition-colors hover:border-saibro-300 hover:bg-saibro-50/40"
      >
        <span aria-hidden="true">{foto}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-areia-900">{titulo}</span>
            {valor && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-areia-900">{valor}</span>
            )}
          </span>
          <span className="block truncate text-xs text-areia-500">{detalhe}</span>
          <span className="mt-1 flex">{marca}</span>
        </span>
      </Link>
    </li>
  );
}

function Grupo({
  icone,
  titulo,
  detalhe,
  vazio,
  itens,
  links,
}: {
  icone: ReactNode;
  titulo: string;
  detalhe: string;
  vazio: string;
  itens: ReactNode[];
  links: Array<{ href: string; rotulo: string }>;
}) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, ITENS_RECOLHIDOS);
  const quantidade = itens.length;

  return (
    <section className="px-5 py-4" aria-label={`${titulo}: ${quantidade}`}>
      <header className="flex items-start gap-2.5">
        <span className="mt-0.5 text-areia-500">{icone}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-areia-900">{titulo}</h3>
          <p className="text-xs text-areia-500">{detalhe}</p>
        </div>
        <span
          className={`chip shrink-0 border tabular-nums ${
            quantidade > 0 ? TONS.alerta : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {quantidade}
        </span>
      </header>

      {quantidade === 0 ? (
        <p className="mt-2.5 flex items-center gap-2 text-xs text-emerald-800">
          <IconeCheck className="h-4 w-4" />
          {vazio}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">{visiveis}</ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {quantidade > ITENS_RECOLHIDOS && (
          <button
            type="button"
            onClick={() => setTodos((atual) => !atual)}
            aria-expanded={todos}
            className="text-xs font-semibold text-areia-700 hover:underline"
          >
            {todos ? "Mostrar menos" : `Mostrar todos os ${quantidade}`}
          </button>
        )}
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-tijolo-700 hover:underline"
          >
            {link.rotulo} <IconeSeta className="h-3.5 w-3.5" />
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
      icone={<IconeAgenda className="h-4 w-4" />}
      titulo="Reservas sem pagamento"
      detalhe={`Prazo para pagar: ${configuracoes.prazoPagamentoReservaHoras} h (H5). ${
        configuracoes.liberarReservaAutomaticamente
          ? "Vencido o prazo, o horário é liberado sozinho."
          : "Vencido o prazo, a recepção decide se libera o horário."
      }`}
      vazio="Nenhuma reserva aguardando pagamento."
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
              <span className={`chip border px-2 py-0.5 text-[11px] ${TONS[prazo.tom]}`}>
                {prazo.tom === "alerta" && <IconeAlerta className="h-3 w-3" />}
                {prazo.texto}
              </span>
            }
          />
        );
      })}
      links={[
        { href: "/agenda", rotulo: "Abrir agenda" },
        ...(podeRegistrarPagamento ? [{ href: "/financeiro", rotulo: "Registrar pagamento" }] : []),
      ]}
    />
  );
}

function GrupoDeMensalidades({ itens, valorTotal }: { itens: MensalidadeEmAtraso[]; valorTotal: number }) {
  return (
    <Grupo
      icone={<IconeFinanceiro className="h-4 w-4" />}
      titulo="Mensalidades em atraso"
      detalhe={itens.length > 0 ? `${formatarMoeda(valorTotal)} em aberto` : "Vencidas e sem pagamento"}
      vazio="Nenhuma mensalidade em atraso."
      itens={itens.map(({ lancamento, aluno, diasEmAtraso }) => (
        <Item
          key={lancamento.id}
          href={aluno ? `/alunos/${aluno.id}` : "/financeiro"}
          foto={<FotoDoAluno aluno={aluno} />}
          titulo={aluno?.nome ?? lancamento.nomePagante ?? "Aluno removido"}
          detalhe={lancamento.item}
          valor={formatarMoeda(lancamento.valor)}
          marca={
            <span className={`chip border px-2 py-0.5 text-[11px] ${TONS.alerta}`}>
              Venceu em {formatarData(lancamento.vencimento)} · {plural(diasEmAtraso, "dia", "dias")} de atraso
            </span>
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
      icone={<IconeEstoque className="h-4 w-4" />}
      titulo="Produtos abaixo do mínimo"
      detalhe="Saldo menor que o estoque mínimo do cadastro"
      vazio="Todos os produtos acima do mínimo."
      itens={itens.map(({ produto, saldo }) => {
        const cor = ESTILO_CATEGORIA_PRODUTO[produto.categoria];
        return (
          <Item
            key={produto.id}
            href="/estoque"
            foto={
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                style={{ color: cor.cor, backgroundColor: cor.fundo, borderColor: cor.borda }}
              >
                <IconeEstoque className="h-4 w-4" />
              </span>
            }
            titulo={produto.nome}
            detalhe={`Saldo ${saldo} · mínimo ${produto.estoqueMinimo} (${produto.unidade})`}
            marca={
              <span
                className={`chip border px-2 py-0.5 text-[11px] ${saldo <= 0 ? TONS.alerta : TONS.atencao}`}
              >
                {saldo <= 0
                  ? "Esgotado"
                  : `Faltam ${produto.estoqueMinimo - saldo} para o mínimo`}
              </span>
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
      icone={<IconeRelogio className="h-4 w-4" />}
      titulo="Reposições perto de vencer"
      detalhe="Créditos de aula que vencem em até 30 dias"
      vazio="Nenhum crédito de reposição vence nos próximos 30 dias."
      itens={itens.map(({ aluno, minutos, validade, diasParaVencer }) => (
        <Item
          key={aluno.id}
          href={`/alunos/${aluno.id}`}
          foto={<FotoDoAluno aluno={aluno} />}
          titulo={aluno.nome}
          detalhe={`${formatarMinutos(minutos)} de reposição para marcar`}
          marca={
            <span
              className={`chip border px-2 py-0.5 text-[11px] ${
                diasParaVencer <= 7 ? TONS.atencao : TONS.neutro
              }`}
            >
              {diasParaVencer === 0
                ? "Vence hoje"
                : `Vence em ${plural(diasParaVencer, "dia", "dias")} (${formatarDiaMes(validade)})`}
            </span>
          }
        />
      ))}
      links={[{ href: "/alunos", rotulo: "Ver alunos" }]}
    />
  );
}

/** "6 reservas · 14 mensalidades · 7 produtos · 5 reposições" (o detalhe do cartão Pendências). */
export function resumoDasPendencias(grupos: GrupoDeAtencao[]): string {
  const partes = grupos
    .filter((g) => g.itens.length > 0)
    .map((g) => {
      const n = g.itens.length;
      switch (g.tipo) {
        case "reservas":
          return plural(n, "reserva", "reservas");
        case "mensalidades":
          return plural(n, "mensalidade", "mensalidades");
        case "produtos":
          return plural(n, "produto", "produtos");
        case "reposicoes":
          return plural(n, "reposição", "reposições");
      }
    });
  return partes.length > 0 ? partes.join(" · ") : "Nada pendente agora";
}

/**
 * Quadro "Precisa de atenção": junta o que pede uma acao hoje. Cada grupo
 * mostra a contagem da lista inteira e cada item leva a tela certa.
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
  return (
    <Card>
      <CardHeader
        titulo="Precisa de atenção"
        descricao="O que pede uma ação hoje."
        icone={<IconeAlerta className="h-5 w-5" />}
        acao={
          <span
            className={`chip border ${
              atencao.total > 0 ? TONS.alerta : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {plural(atencao.total, "item", "itens")}
          </span>
        }
      />
      {atencao.grupos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-areia-500">
          Nada para acompanhar nas áreas do seu perfil.
        </p>
      ) : (
        <div className="divide-y divide-areia-200">
          {atencao.grupos.map((grupo) => {
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
        </div>
      )}
    </Card>
  );
}
