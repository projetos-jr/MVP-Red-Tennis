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
import { PiramideDoRanking } from "@/components/ranking/PiramideDoRanking";
import { CabecalhoDaPagina } from "@/components/ui/CabecalhoDaPagina";
import { Card, CardHeader } from "@/components/ui/Card";
import { Carregando } from "@/components/ui/Carregando";
import {
  IconeAgenda,
  IconeBola,
  IconeMais,
  IconeTrofeu,
  IconeUsuarios,
} from "@/components/ui/Icons";
import { BotaoMaisOpcoes, PainelDeOpcoes } from "@/components/ui/MaisOpcoes";
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
    <Suspense fallback={<Carregando />}>
      <ConteudoDoRanking />
    </Suspense>
  );
}

/** Filtro de categoria com botoes grandes (o dono bate o olho e toca). */
function FiltroDeCategoria({
  valor,
  aoMudar,
}: {
  valor: CategoriaRanking | "todas";
  aoMudar: (valor: CategoriaRanking | "todas") => void;
}) {
  // No celular so a letra (cabe numa linha); do tablet para cima, "Cat. A".
  const opcoes: Array<{ valor: CategoriaRanking | "todas"; rotulo: string; titulo?: string }> = [
    { valor: "todas", rotulo: "Todas" },
    ...CATEGORIAS.map((c) => ({
      valor: c,
      rotulo: c,
      titulo: `${ESTILO_CATEGORIA[c].label} · ${ESTILO_CATEGORIA[c].descricao}`,
    })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por categoria">
      {opcoes.map((opcao) => {
        const ativo = valor === opcao.valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => aoMudar(opcao.valor)}
            aria-pressed={ativo}
            title={opcao.titulo}
            className={`btn alvo-de-toque min-w-[3.25rem] border px-3.5 py-2.5 text-base sm:min-w-[4.5rem] sm:px-4 ${
              ativo
                ? "border-saibro-600 bg-saibro-600 text-white shadow-sm"
                : "border-areia-300 bg-white text-areia-800 hover:border-saibro-400 hover:bg-saibro-50 hover:text-saibro-800"
            }`}
          >
            {opcao.valor === "todas" ? (
              opcao.rotulo
            ) : (
              <span>
                <span className="sr-only sm:not-sr-only">Cat. </span>
                {opcao.rotulo}
              </span>
            )}
          </button>
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
  const [verLista, setVerLista] = useState(false);

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
      <CabecalhoDaPagina
        titulo="Ranking & Torneios"
        descricao={`${resumo.jogadores} jogadores no ranking · vitória vale ${pontosVitoria} pontos e derrota ${pontosDerrota}`}
        acoes={
          <button
            type="button"
            onClick={() => abrirNovaPartida("resultado")}
            className="btn-primario px-5 py-3 text-base"
          >
            <IconeMais className="h-5 w-5" />
            Registrar partida
          </button>
        }
      />

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
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FiltroDeCategoria valor={categoria} aoMudar={setCategoria} />
            <BotaoMaisOpcoes
              aberto={verLista}
              aoAlternar={() => setVerLista((atual) => !atual)}
              controla="ranking-lista-e-numeros"
              rotulo="Ver lista e números"
              rotuloAberto="Esconder lista e números"
            />
          </div>

          <PainelDeOpcoes
            id="ranking-lista-e-numeros"
            aberto={verLista}
            rotulo="Lista e números do ranking"
            className="space-y-4"
          >
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
            <Card>
              <CardHeader
                titulo={categoria === "todas" ? "Lista completa" : `Lista · ${ESTILO_CATEGORIA[categoria].label}`}
                descricao="Calculado das partidas com resultado. Quem perde por W.O. não ganha os pontos da derrota."
                icone={<IconeTrofeu className="h-5 w-5" />}
              />
              <ListaRanking linhas={linhas} />
              <footer className="border-t border-areia-200 px-5 py-3 text-sm text-areia-600">
                “7 dias”: posições ganhas ou perdidas na última semana. Clique num jogador para abrir a
                ficha.
              </footer>
            </Card>
          </PainelDeOpcoes>

          <Card className="overflow-hidden">
            <PiramideDoRanking
              linhas={linhas}
              titulo={categoria === "todas" ? "Ranking geral" : `Ranking · ${ESTILO_CATEGORIA[categoria].label}`}
            />
          </Card>
        </>
      )}

      {aba === "partidas" && (
        <>
          <Card>
            <CardHeader
              titulo="Próximas partidas"
              descricao="Marcadas e ainda sem resultado."
              icone={<IconeAgenda className="h-5 w-5" />}
              acao={
                <button type="button" onClick={() => abrirNovaPartida("marcar")} className="btn-secundario">
                  <IconeMais className="h-4 w-4" />
                  Marcar partida
                </button>
              }
            />
            <ul className="divide-y divide-areia-100">
              {proximas.map((item) => (
                <li key={item.partida.id}>
                  <LinhaDaPartida item={item} aoAbrir={abrirPartida} larga />
                </li>
              ))}
              {proximas.length === 0 && (
                <li className="px-5 py-8 text-center text-base text-areia-600">Nenhuma partida marcada.</li>
              )}
            </ul>
          </Card>
          <ListaPartidas aoAbrir={abrirPartida} />
        </>
      )}

      {aba === "torneios" && (
        <Card>
          <CardHeader
            titulo="Torneios"
            descricao="Clique num torneio para ver a chave, registrar resultados e comentar."
            icone={<IconeTrofeu className="h-5 w-5" />}
            acao={
              <button type="button" onClick={() => setNovoTorneio(Date.now())} className="btn-secundario">
                <IconeTrofeu className="h-4 w-4" />
                Novo torneio
              </button>
            }
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
