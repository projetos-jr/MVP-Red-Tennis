"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Campo } from "@/components/ui/Formulario";
import { IconeBola, IconeBusca } from "@/components/ui/Icons";
import { ITENS_POR_PAGINA, MostrarMais } from "@/components/ui/MostrarMais";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import {
  listarPartidas,
  type PartidaNaLista,
  type SituacaoDePartida,
  type TipoDePartida,
} from "@/lib/consultas/ranking";
import { somarDias } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { LinhaDaPartida } from "./LinhaDaPartida";

type Periodo = "30" | "90" | "tudo";
const POR_PAGINA = ITENS_POR_PAGINA;

/** Historico de partidas (ranking e torneios) com filtros. */
export function ListaPartidas({ aoAbrir }: { aoAbrir: (item: PartidaNaLista) => void }) {
  const { banco } = useApp();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoDePartida>("todas");
  const [situacao, setSituacao] = useState<SituacaoDePartida>("todas");
  const [periodo, setPeriodo] = useState<Periodo>("90");
  const [quantas, setQuantas] = useState(POR_PAGINA);

  const partidas = useMemo(
    () =>
      listarPartidas(banco, {
        busca,
        tipo,
        situacao,
        desde: periodo === "tudo" ? undefined : somarDias(HOJE, -Number(periodo)),
      }),
    [banco, busca, tipo, situacao, periodo],
  );
  const visiveis = partidas.slice(0, quantas);

  return (
    <Card>
      <CardHeader
        titulo="Histórico de partidas"
        descricao="Partidas de ranking e de torneio. Clique para ver, corrigir o resultado ou comentar."
        icone={<IconeBola className="h-5 w-5" />}
      />

      <div className="grid grid-cols-2 gap-3 border-b border-areia-200 p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <Campo rotulo="Buscar" className="col-span-2 lg:col-span-1">
          <span className="relative block">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setQuantas(POR_PAGINA);
              }}
              placeholder="Nome do jogador ou do torneio…"
              className="campo pl-9"
            />
          </span>
        </Campo>
        <div className="col-span-2 lg:col-span-1">
          <span className="mb-1.5 block text-sm font-medium text-areia-800">Tipo</span>
          <Segmentado
            aria="Tipo de partida"
            valor={tipo}
            aoMudar={(valor) => {
              setTipo(valor);
              setQuantas(POR_PAGINA);
            }}
            opcoes={[
              { valor: "todas", rotulo: "Todas" },
              { valor: "ranking", rotulo: "Ranking" },
              { valor: "torneio", rotulo: "Torneios" },
            ]}
          />
        </div>
        <Campo rotulo="Situação">
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as SituacaoDePartida)}
            className="campo"
          >
            <option value="todas">Todas</option>
            <option value="jogadas">Com resultado</option>
            <option value="marcadas">Sem resultado</option>
          </select>
        </Campo>
        <Campo rotulo="Período">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="campo"
          >
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="tudo">Todo o histórico</option>
          </select>
        </Campo>
      </div>

      <p className="border-b border-areia-100 px-4 py-2 text-xs text-areia-500 sm:px-5" aria-live="polite">
        {partidas.length} {partidas.length === 1 ? "partida" : "partidas"}
        {banco.configuracoes.torneioContaParaRanking
          ? " · partidas simples de torneio contam para o ranking"
          : " · partidas de torneio não contam para o ranking (Configurações)"}
      </p>

      <ul className="divide-y divide-areia-100">
        {visiveis.map((item) => (
          <li key={item.partida.id}>
            <LinhaDaPartida item={item} aoAbrir={aoAbrir} larga />
          </li>
        ))}
        {partidas.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-areia-500">
            Nenhuma partida com esses filtros.
          </li>
        )}
      </ul>

      <MostrarMais
        mostrando={visiveis.length}
        total={partidas.length}
        aoMostrarMais={() => setQuantas((atual) => atual + POR_PAGINA)}
      />
    </Card>
  );
}
