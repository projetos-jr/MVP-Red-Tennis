"use client";

import { useMemo, useState } from "react";
import { ListaRanking } from "@/components/ranking/ListaRanking";
import { PiramideTorneio } from "@/components/ranking/PiramideTorneio";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { IconeBola, IconeTrofeu, IconeUsuarios } from "@/components/ui/Icons";
import { formatarData } from "@/lib/date";
import { IDS_INSCRITOS_RANKING, TORNEIOS } from "@/lib/dados";
import { nomeCompacto, piramideDaEtapa, rankingGeral } from "@/lib/selectors";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import type { CategoriaRanking } from "@/lib/types";

const CATEGORIAS: CategoriaRanking[] = ["A", "B", "C", "D"];

export default function PaginaRanking() {
  const [categoria, setCategoria] = useState<CategoriaRanking | "todas">("todas");

  const geral = useMemo(() => rankingGeral(), []);
  const faixas = useMemo(() => piramideDaEtapa(), []);

  const etapaAtual = TORNEIOS[0];
  const lider = geral[0];

  if (!etapaAtual || !lider) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">
          Ranking &amp; Torneios
        </h1>
        <p className="text-sm text-areia-600">
          Ainda não há torneios ou alunos cadastrados no ranking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">
            Ranking &amp; Torneios
          </h1>
          <p className="mt-1 text-sm text-areia-600">
            {geral.length} jogadores pontuando · {etapaAtual.inscritos} inscritos na
            etapa atual
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard
          rotulo="Líder do ranking"
          rotuloCurto="Líder"
          valor={nomeCompacto(lider.nome)}
          detalhe={`${lider.rankingPontuacao} pontos · Categoria ${lider.categoriaRanking}`}
          icone={<IconeTrofeu className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Jogadores no ranking"
          rotuloCurto="Jogadores"
          valor={String(geral.length)}
          detalhe="Todos os matriculados pontuam ao longo das etapas"
          icone={<IconeUsuarios className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Próxima etapa"
          rotuloCurto="Próxima etapa"
          valor={formatarData(etapaAtual.data)}
          detalhe={etapaAtual.nome}
          icone={<IconeBola className="h-5 w-5" />}
        />
      </div>

      {/* Chave do torneio */}
      <Card>
        <CardHeader
          titulo={etapaAtual.nome}
          descricao={`${etapaAtual.formato} · ${etapaAtual.inscritos} inscritos`}
          icone={<IconeTrofeu className="h-5 w-5" />}
          acao={
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoria("todas")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  categoria === "todas"
                    ? "bg-saibro-600 text-white"
                    : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                }`}
              >
                Todas
              </button>
              {CATEGORIAS.map((c) => {
                const estilo = ESTILO_CATEGORIA[c];
                const ativo = categoria === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoria(c)}
                    className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      color: ativo ? "#fff" : estilo.cor,
                      backgroundColor: ativo ? estilo.cor : estilo.fundo,
                      borderColor: estilo.borda,
                    }}
                  >
                    Cat. {c}
                  </button>
                );
              })}
            </div>
          }
        />

        <PiramideTorneio faixas={faixas} categoriaEmFoco={categoria} />

        <footer className="border-t border-areia-200 px-5 py-3 text-xs text-areia-500">
          Posições correspondem à situação após a última rodada disputada. Clique em
          um jogador para abrir a ficha completa.
        </footer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ranking geral */}
        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Ranking geral"
            descricao="Todos os jogadores da arena, ordenados por pontuação."
            icone={<IconeTrofeu className="h-5 w-5" />}
          />
          <div className="max-h-[560px] overflow-y-auto rolagem-suave">
            <ListaRanking jogadores={geral} inscritos={IDS_INSCRITOS_RANKING} />
          </div>
        </Card>

        {/* Torneios */}
        <Card>
          <CardHeader
            titulo="Torneios"
            descricao="Etapas recentes e próximas."
            icone={<IconeBola className="h-5 w-5" />}
          />
          <ul className="divide-y divide-areia-100">
            {TORNEIOS.map((torneio) => (
              <li key={torneio.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-areia-900">
                    {torneio.nome}
                  </h3>
                  <Badge
                    cor={
                      torneio.status === "encerrado"
                        ? "#6B6255"
                        : torneio.status === "em andamento"
                          ? "#15803D"
                          : "#9A4720"
                    }
                    fundo={
                      torneio.status === "encerrado"
                        ? "#F4F1EC"
                        : torneio.status === "em andamento"
                          ? "#F0FDF4"
                          : "#FAE8DA"
                    }
                    className="shrink-0 whitespace-nowrap text-[11px]"
                  >
                    {torneio.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-areia-600">{torneio.formato}</p>
                <p className="mt-1.5 text-xs text-areia-500">
                  {formatarData(torneio.data)} · {torneio.inscritos} inscritos
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-areia-200 p-4">
            <p className="rounded-xl border border-dashed border-areia-300 px-3.5 py-3 text-xs leading-relaxed text-areia-500">
              O chaveamento automático por nível e disponibilidade de horário está
              fora do escopo deste MVP — a chave exibida é um estado fixo de
              demonstração.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
