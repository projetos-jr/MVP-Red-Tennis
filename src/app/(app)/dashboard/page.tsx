"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useHoraAtual } from "@/components/base/useHoraAtual";
import { CardQuadra } from "@/components/dashboard/CardQuadra";
import {
  PrecisaDeAtencao,
  plural,
  resumoDasPendencias,
} from "@/components/dashboard/PrecisaDeAtencao";
import { ProximosHorarios } from "@/components/dashboard/ProximosHorarios";
import { corDaQuadra } from "@/components/dashboard/Quadra3D";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  IconeAgenda,
  IconeAlerta,
  IconeQuadras,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { StatCard } from "@/components/ui/StatCard";
import { HOJE } from "@/lib/banco/constantes";
import { podeAcessar } from "@/lib/consultas/base";
import {
  ocupacaoDasQuadras,
  precisaDeAtencao,
  proximosHorarios,
  resumoDoDia,
  saudacao,
} from "@/lib/consultas/painel";
import { DIAS_SEMANA_LONGO, diaDaSemana, formatarDataExtenso } from "@/lib/date";
import { useApp } from "@/store/AppStore";

/**
 * Painel: as quadras de hoje em 3D, os indicadores do dia, os proximos
 * horarios e o quadro "Precisa de atenção". Tudo vem de
 * `lib/consultas/painel.ts`; os numeros dos cartoes sao o tamanho das listas.
 */
export default function PaginaPainel() {
  const { banco, colaborador } = useApp();
  const agora = useHoraAtual();

  const quadras = useMemo(() => ocupacaoDasQuadras(banco, HOJE, agora), [banco, agora]);
  const resumo = useMemo(() => resumoDoDia(banco, quadras), [banco, quadras]);
  const horarios = useMemo(() => proximosHorarios(banco, quadras, agora), [banco, quadras, agora]);
  const atencao = useMemo(
    () => precisaDeAtencao(banco, colaborador, HOJE, agora),
    [banco, colaborador, agora],
  );

  const podeAbrirAgenda = podeAcessar(banco, colaborador, "agenda");
  const pendencias = atencao.total;

  return (
    <div className="space-y-6">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-areia-600">
            {saudacao(agora)}, {colaborador.nome.split(" ")[0]} 👋
          </p>
          <h1 className="mt-1 text-2xl font-bold text-areia-900 sm:text-3xl">Visão das quadras</h1>
          <p className="mt-1 text-sm text-areia-600">
            {DIAS_SEMANA_LONGO[diaDaSemana(HOJE)]}, {formatarDataExtenso(HOJE)}
          </p>
        </div>

        {/* No celular a agenda já está na barra inferior */}
        {podeAbrirAgenda && (
          <Link href="/agenda" className="btn-secundario hidden md:inline-flex">
            <IconeAgenda className="h-4 w-4" />
            Abrir agenda completa
          </Link>
        )}
      </div>

      {/* Indicadores do dia */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Aulas e locações hoje"
          rotuloCurto="Hoje"
          valor={String(resumo.total)}
          detalhe={
            resumo.total === 0
              ? "Nenhum horário marcado hoje"
              : [
                  plural(resumo.aulas, "aula", "aulas"),
                  plural(resumo.locacoes, "locação", "locações"),
                  resumo.partidas > 0 && plural(resumo.partidas, "partida de ranking", "partidas de ranking"),
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
          icone={<IconeAgenda className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Alunos em quadra"
          rotuloCurto="Alunos"
          valor={String(resumo.alunosEmQuadra)}
          detalhe="Pessoas com horário marcado hoje"
          icone={<IconeUsuarios className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Ocupação média"
          rotuloCurto="Ocupação"
          valor={`${Math.round(resumo.ocupacaoMedia * 100)}%`}
          detalhe={
            resumo.quadraMaisCheia
              ? `Maior procura: ${resumo.quadraMaisCheia}`
              : "Quadras livres o dia todo"
          }
          icone={<IconeQuadras className="h-5 w-5" />}
        />
        {/* O numero e a soma das listas do quadro "Precisa de atenção" */}
        <a
          href="#precisa-de-atencao"
          className="flex rounded-2xl *:flex-1"
          aria-label={`Pendências: ${plural(pendencias, "item", "itens")} (${resumoDasPendencias(atencao.grupos)}). Ir para o quadro Precisa de atenção.`}
        >
          <StatCard
            rotulo="Pendências"
            valor={String(pendencias)}
            detalhe={resumoDasPendencias(atencao.grupos)}
            icone={<IconeAlerta className="h-5 w-5" />}
            tom={pendencias > 0 ? "alerta" : "positivo"}
          />
        </a>
      </div>

      {/* Quadras em perspectiva */}
      <Card>
        <CardHeader
          titulo="Ocupação de hoje"
          descricao={
            podeAbrirAgenda
              ? "Quanto mais escuro o piso, mais cheia está a quadra. Clique para abrir a agenda daquela quadra."
              : "Quanto mais escuro o piso, mais cheia está a quadra."
          }
          icone={<IconeQuadras className="h-5 w-5" />}
          acao={<EscalaOcupacao />}
        />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
          {quadras.map((quadra) => (
            <CardQuadra
              key={quadra.quadra.id}
              quadra={quadra}
              href={podeAbrirAgenda ? `/agenda?quadra=${quadra.quadra.id}` : undefined}
            />
          ))}
        </div>
      </Card>

      {/* 3/5 + 2/5: no tablet a coluna da atenção fica larga o bastante para os nomes. */}
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <ProximosHorarios
          horarios={horarios}
          linkDaAgenda={podeAbrirAgenda ? "/agenda" : undefined}
          podeAbrirAlunos={podeAcessar(banco, colaborador, "alunos")}
        />

        <div id="precisa-de-atencao" className="min-w-0 scroll-mt-32 lg:col-span-2">
          <PrecisaDeAtencao
            atencao={atencao}
            configuracoes={banco.configuracoes}
            podeRegistrarPagamento={podeAcessar(banco, colaborador, "financeiro")}
          />
        </div>
      </div>
    </div>
  );
}

/** Escala de referencia do gradiente de ocupacao, para os dois tipos de piso. */
function EscalaOcupacao() {
  const passos = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex" aria-hidden="true">
      {(["saibro", "cimento"] as const).map((piso) => (
        <div key={piso} className="flex items-center gap-2">
          <span className="text-[11px] capitalize text-areia-500">{piso}</span>
          <div className="flex overflow-hidden rounded-full border border-areia-200">
            {passos.map((taxa) => (
              <span
                key={taxa}
                className="h-3.5 w-5"
                style={{ backgroundColor: corDaQuadra(taxa, piso).media }}
              />
            ))}
          </div>
        </div>
      ))}
      <span className="text-[11px] text-areia-500">livre → lotada</span>
    </div>
  );
}
