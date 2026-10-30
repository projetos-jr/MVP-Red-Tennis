"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { LinhaDaPartida } from "@/components/ranking/LinhaDaPartida";
import { ListaPartidas } from "@/components/ranking/ListaPartidas";
import { ListaRanking } from "@/components/ranking/ListaRanking";
import { ListaTorneios } from "@/components/ranking/ListaTorneios";
import { ModalNovaPartida, type ModoDaPartida } from "@/components/ranking/ModalNovaPartida";
import { ModalPartida } from "@/components/ranking/ModalPartida";
import { ModalTorneio } from "@/components/ranking/ModalTorneio";
import { PodioRanking } from "@/components/ranking/PodioRanking";
import { BotaoFiltro } from "@/components/ui/BotaoFiltro";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  IconeAgenda,
  IconeBola,
  IconeMais,
  IconeTrofeu,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import { StatCard } from "@/components/ui/StatCard";
import { HOJE } from "@/lib/banco/constantes";
import type { CategoriaRanking } from "@/lib/banco/tipos";
import { nomeCompacto } from "@/lib/consultas/base";
import {
  buscarPartida,
  listarTorneios,
  proximasPartidas,
  rankingDaArena,
  resumoDoRanking,
  type PartidaNaLista,
} from "@/lib/consultas/ranking";
import { formatarData } from "@/lib/date";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { useApp } from "@/store/AppStore";

type Aba = "ranking" | "partidas" | "torneios";
const ABAS: Aba[] = ["ranking", "partidas", "torneios"];
const CATEGORIAS: CategoriaRanking[] = ["A", "B", "C", "D"];

export default function PaginaRanking() {
  // A aba fica na URL (?aba=partidas), entao a tela le os parametros dentro
  // de um Suspense, como pede o Next.
  return (
    <Suspense fallback={null}>
      <ConteudoDoRanking />
    </Suspense>
  );
}

function FiltroDeCategoria({
  valor,
  aoMudar,
}: {
  valor: CategoriaRanking | "todas";
  aoMudar: (valor: CategoriaRanking | "todas") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por categoria">
      <BotaoFiltro ativo={valor === "todas"} aoClicar={() => aoMudar("todas")}>
        Todas
      </BotaoFiltro>
      {CATEGORIAS.map((c) => {
        const estilo = ESTILO_CATEGORIA[c];
        return (
          <BotaoFiltro
            key={c}
            ativo={valor === c}
            aoClicar={() => aoMudar(c)}
            cores={estilo}
            title={`${estilo.label} · ${estilo.descricao}`}
          >
            Cat. {c}
          </BotaoFiltro>
        );
      })}
    </div>
  );
}

function ConteudoDoRanking() {
  const { banco } = useApp();
  const router = useRouter();
  const parametros = useSearchParams();
  const pedida = parametros.get("aba") as Aba | null;
  const aba: Aba = pedida && ABAS.includes(pedida) ? pedida : "ranking";

  const [categoria, setCategoria] = useState<CategoriaRanking | "todas">("todas");
  const [novaPartida, setNovaPartida] = useState<{ modo: ModoDaPartida; vez: number } | null>(null);
  const [partidaAberta, setPartidaAberta] = useState<string | null>(null);
  const [novoTorneio, setNovoTorneio] = useState<number | null>(null);

  const geral = useMemo(() => rankingDaArena(banco, HOJE), [banco]);
  const linhas = useMemo(
    () => (categoria === "todas" ? geral : rankingDaArena(banco, HOJE, categoria)),
    [banco, geral, categoria],
  );
  const resumo = useMemo(() => resumoDoRanking(banco, HOJE, geral), [banco, geral]);
  const torneios = useMemo(() => listarTorneios(banco), [banco]);
  const proximas = useMemo(() => proximasPartidas(banco), [banco]);
  const itemAberto = partidaAberta ? buscarPartida(banco, partidaAberta) : undefined;
  const { pontosVitoria, pontosDerrota } = banco.configuracoes;

  function trocarAba(nova: Aba) {
    router.replace(nova === "ranking" ? "/ranking" : `/ranking?aba=${nova}`, { scroll: false });
  }

  function abrirPartida(item: PartidaNaLista) {
    if (item.torneio) router.push(`/ranking/torneio?id=${item.torneio.id}`);
    else setPartidaAberta(item.partida.id);
  }

  function abrirNovaPartida(modo: ModoDaPartida) {
    setNovaPartida((atual) => ({ modo, vez: (atual?.vez ?? 0) + 1 }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Ranking &amp; Torneios</h1>
          <p className="mt-1 text-sm text-areia-600">
            {resumo.jogadores} jogadores no ranking · vitória vale {pontosVitoria} pontos e derrota{" "}
            {pontosDerrota}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setNovoTorneio(Date.now())}
            className="btn-secundario flex-1 sm:flex-none"
          >
            <IconeTrofeu className="h-4 w-4" />
            Novo torneio
          </button>
          <button
            type="button"
            onClick={() => abrirNovaPartida("resultado")}
            className="btn-primario flex-1 sm:flex-none"
          >
            <IconeMais className="h-4 w-4" />
            Registrar partida
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          rotulo="Líder do ranking"
          rotuloCurto="Líder"
          valor={resumo.lider ? nomeCompacto(resumo.lider.aluno.nome) : "—"}
          detalhe={
            resumo.lider
              ? `${resumo.lider.pontos} pontos · ${resumo.lider.vitorias} vitórias${
                  resumo.lider.aluno.categoriaRanking ? ` · Categoria ${resumo.lider.aluno.categoriaRanking}` : ""
                }`
              : undefined
          }
          icone={<IconeTrofeu className="h-5 w-5" />}
          tom="saibro"
        />
        <StatCard
          rotulo="Jogadores no ranking"
          rotuloCurto="Jogadores"
          valor={String(resumo.jogadores)}
          detalhe="Inscritos nas categorias A a D"
          icone={<IconeUsuarios className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Partidas em 30 dias"
          rotuloCurto="Partidas (30d)"
          valor={String(resumo.partidasRecentes)}
          detalhe="Partidas de ranking com resultado"
          icone={<IconeBola className="h-5 w-5" />}
        />
        <StatCard
          rotulo="Próximo torneio"
          rotuloCurto="Torneio"
          valor={resumo.proximoTorneio ? formatarData(resumo.proximoTorneio.data) : "—"}
          detalhe={resumo.proximoTorneio?.nome ?? "Nenhum torneio marcado"}
          icone={<IconeAgenda className="h-5 w-5" />}
        />
      </div>

      <div className="overflow-x-auto">
        <Segmentado
          aria="Seções do ranking"
          valor={aba}
          aoMudar={trocarAba}
          opcoes={[
            { valor: "ranking", rotulo: "Ranking" },
            { valor: "partidas", rotulo: "Partidas" },
            { valor: "torneios", rotulo: `Torneios (${torneios.length})` },
          ]}
        />
      </div>

      {aba === "ranking" && (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              titulo={categoria === "todas" ? "Ranking geral" : `Ranking · ${ESTILO_CATEGORIA[categoria].label}`}
              descricao="Calculado das partidas com resultado. Quem perde por W.O. não ganha os pontos da derrota."
              icone={<IconeTrofeu className="h-5 w-5" />}
              acao={<FiltroDeCategoria valor={categoria} aoMudar={setCategoria} />}
            />
            {linhas.length > 0 && (
              <div className="border-b border-areia-200 bg-gradient-to-b from-saibro-50/70 to-white">
                <PodioRanking linhas={linhas} />
              </div>
            )}
            <ListaRanking linhas={linhas} />
            <footer className="border-t border-areia-200 px-5 py-3 text-xs text-areia-500">
              “7 dias”: posições ganhas ou perdidas na última semana. Clique num jogador para abrir a
              ficha.
            </footer>
          </Card>

          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader
                titulo="Próximas partidas"
                descricao="Ainda sem resultado."
                icone={<IconeAgenda className="h-5 w-5" />}
                acao={
                  <button
                    type="button"
                    onClick={() => abrirNovaPartida("marcar")}
                    className="btn-fantasma px-2.5 py-1.5 text-xs"
                  >
                    <IconeMais className="h-3.5 w-3.5" />
                    Marcar
                  </button>
                }
              />
              <ul className="divide-y divide-areia-100">
                {proximas.map((item) => (
                  <li key={item.partida.id}>
                    <LinhaDaPartida item={item} aoAbrir={abrirPartida} />
                  </li>
                ))}
                {proximas.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-areia-500">
                    Nenhuma partida marcada.
                  </li>
                )}
              </ul>
            </Card>

            <Card>
              <CardHeader
                titulo="Torneios"
                descricao="Em andamento, abertos e encerrados."
                icone={<IconeTrofeu className="h-5 w-5" />}
                acao={
                  <button
                    type="button"
                    onClick={() => trocarAba("torneios")}
                    className="btn-fantasma px-2.5 py-1.5 text-xs"
                  >
                    Ver todos
                  </button>
                }
              />
              <ListaTorneios torneios={torneios.slice(0, 3)} />
            </Card>
          </div>
        </div>
      )}

      {aba === "partidas" && <ListaPartidas aoAbrir={abrirPartida} />}

      {aba === "torneios" && (
        <Card>
          <CardHeader
            titulo="Torneios"
            descricao="Clique num torneio para ver a chave, registrar resultados e comentar."
            icone={<IconeTrofeu className="h-5 w-5" />}
          />
          <ListaTorneios torneios={torneios} emGrade />
        </Card>
      )}

      {novaPartida && (
        <ModalNovaPartida
          key={novaPartida.vez}
          modoInicial={novaPartida.modo}
          aoFechar={() => setNovaPartida(null)}
        />
      )}
      {itemAberto && (
        <ModalPartida key={itemAberto.partida.id} item={itemAberto} aoFechar={() => setPartidaAberta(null)} />
      )}
      {novoTorneio !== null && <ModalTorneio key={novoTorneio} aoFechar={() => setNovoTorneio(null)} />}
    </div>
  );
}
