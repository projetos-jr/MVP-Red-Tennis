"use client";

import { useState, type ReactNode } from "react";
import { IconeTrofeu } from "@/components/ui/Icons";
import { Segmentado } from "@/components/ui/Segmentado";
import type { InscricaoNaTela, RodadaNaTela } from "@/lib/consultas/ranking";
import { AvataresDoLado } from "./AvataresDoLado";
import { CaixaDaFolga, CaixaDaPartida } from "./CaixaDaPartida";

/** Altura da vaga de uma partida da 1a rodada; a cada rodada, a vaga dobra. */
const ALTURA_DA_VAGA = 100;
/** Espaco entre as colunas, por onde passam as linhas da chave. */
const VAO = 40;
/** As colunas dividem a largura disponivel; abaixo disto, a chave rola para o lado. */
const LARGURA_MINIMA_DA_COLUNA = 224;

/**
 * Uma vaga da chave com as linhas que a ligam a proxima rodada: saida pela
 * direita ate o meio do vao e, em cada par de vagas, a linha vertical que
 * junta as duas na altura da partida seguinte.
 */
function Vaga({
  altura,
  entrada,
  saida,
  juntaComPar,
  primeiraDoPar,
  children,
}: {
  altura: number;
  entrada: boolean;
  saida: boolean;
  juntaComPar: boolean;
  primeiraDoPar: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex items-center" style={{ height: altura }}>
      {entrada && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-px bg-areia-300"
          style={{ left: -VAO / 2, width: VAO / 2 }}
        />
      )}
      {saida && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-px bg-areia-300"
          style={{ right: -VAO / 2, width: VAO / 2 }}
        />
      )}
      {saida && juntaComPar && (
        <span
          aria-hidden="true"
          className="absolute w-px bg-areia-300"
          style={{ right: -VAO / 2, height: "50%", top: primeiraDoPar ? "50%" : 0 }}
        />
      )}
      <div className="w-full">{children}</div>
    </div>
  );
}

function Coluna({
  titulo,
  detalhe,
  ultima,
  children,
}: {
  titulo: string;
  detalhe?: string;
  ultima?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{ flex: "1 1 0", minWidth: LARGURA_MINIMA_DA_COLUNA, marginRight: ultima ? 0 : VAO }}
    >
      <div className="mb-2 flex h-9 items-baseline justify-between gap-2 border-b border-areia-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-areia-700">{titulo}</h3>
        {detalhe && <span className="text-[11px] text-areia-500">{detalhe}</span>}
      </div>
      {children}
    </div>
  );
}

function CaixaDoCampeao({ campeao }: { campeao?: InscricaoNaTela }) {
  return (
    <div
      className={`w-full rounded-xl border px-3 py-3 text-center ${
        campeao ? "border-saibro-300 bg-saibro-50 shadow-sm" : "border-dashed border-areia-300 bg-areia-50/70"
      }`}
    >
      <IconeTrofeu className={`mx-auto h-5 w-5 ${campeao ? "text-saibro-600" : "text-areia-400"}`} />
      {campeao ? (
        <>
          <span className="mt-1.5 flex justify-center">
            <AvataresDoLado alunos={campeao.alunos} tamanho="sm" />
          </span>
          <p className="mt-1.5 truncate text-sm font-semibold text-saibro-800">{campeao.nome}</p>
        </>
      ) : (
        <p className="mt-1 text-xs italic text-areia-500">A definir na final</p>
      )}
    </div>
  );
}

function contarJogos(rodada: RodadaNaTela): string {
  const jogos = rodada.caixas.filter((c) => c.tipo === "partida").length;
  const folgas = rodada.caixas.length - jogos;
  return `${jogos} ${jogos === 1 ? "jogo" : "jogos"}${folgas ? ` · ${folgas} ${folgas === 1 ? "folga" : "folgas"}` : ""}`;
}

/**
 * Desenho da eliminatoria por rodadas. No computador e no tablet, a chave
 * inteira com as linhas ligando as partidas; no celular, uma rodada por vez.
 */
export function ChaveEliminatoria({
  rodadas,
  campeao,
  aoAbrir,
}: {
  rodadas: RodadaNaTela[];
  campeao?: InscricaoNaTela;
  aoAbrir: (partidaId: string) => void;
}) {
  // No celular, abre na primeira rodada com jogo esperando resultado.
  const comPendencia = rodadas.find((r) =>
    r.caixas.some((c) => c.tipo === "partida" && !c.partida.vencedor && c.a.inscricao && c.b.inscricao),
  );
  const [rodadaNoCelular, setRodadaNoCelular] = useState(
    String(comPendencia?.rodada ?? rodadas[rodadas.length - 1]?.rodada ?? 1),
  );
  const escolhida = rodadas.find((r) => String(r.rodada) === rodadaNoCelular) ?? rodadas[0];
  const ultima = rodadas.length - 1;

  if (rodadas.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-x-auto px-5 pb-5 pt-4 rolagem-suave md:block">
        <div className="flex">
          {rodadas.map((rodada, r) => (
            <Coluna key={rodada.rodada} titulo={rodada.nome} detalhe={contarJogos(rodada)}>
              {rodada.caixas.map((caixa, i) => (
                <Vaga
                  key={i}
                  altura={ALTURA_DA_VAGA * 2 ** r}
                  entrada={r > 0}
                  saida
                  juntaComPar={r < ultima}
                  primeiraDoPar={i % 2 === 0}
                >
                  {caixa.tipo === "partida" ? (
                    <CaixaDaPartida caixa={caixa} aoAbrir={aoAbrir} />
                  ) : (
                    <CaixaDaFolga caixa={caixa} />
                  )}
                </Vaga>
              ))}
            </Coluna>
          ))}
          <Coluna titulo="Campeão" ultima>
            <Vaga
              altura={ALTURA_DA_VAGA * 2 ** ultima}
              entrada
              saida={false}
              juntaComPar={false}
              primeiraDoPar
            >
              <CaixaDoCampeao campeao={campeao} />
            </Vaga>
          </Coluna>
        </div>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Segmentado
            aria="Rodada da chave"
            valor={String(escolhida.rodada)}
            aoMudar={setRodadaNoCelular}
            opcoes={rodadas.map((r) => ({ valor: String(r.rodada), rotulo: r.nome }))}
            className="whitespace-nowrap"
          />
        </div>
        <ul className="space-y-2.5">
          {escolhida.caixas.map((caixa, i) => (
            <li key={i}>
              {caixa.tipo === "partida" ? (
                <CaixaDaPartida caixa={caixa} aoAbrir={aoAbrir} />
              ) : (
                <CaixaDaFolga caixa={caixa} />
              )}
            </li>
          ))}
        </ul>
        {escolhida.rodada === rodadas[ultima].rodada && campeao && <CaixaDoCampeao campeao={campeao} />}
      </div>
    </>
  );
}
