"use client";

import { IconeTrofeu } from "@/components/ui/Icons";
import type { CaixaDeFolga, CaixaDePartida, LadoNaCaixa } from "@/lib/consultas/ranking";
import { formatarDiaMes } from "@/lib/date";
import { AvataresDoLado } from "./AvataresDoLado";

function LinhaDoLado({
  lado,
  gamesDoOutro,
  wo,
}: {
  lado: LadoNaCaixa;
  gamesDoOutro: string[];
  wo: boolean;
}) {
  const definido = Boolean(lado.inscricao);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AvataresDoLado alunos={lado.inscricao?.alunos ?? []} />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${
          !definido
            ? "italic text-areia-400"
            : lado.venceu
              ? "font-semibold text-areia-900"
              : "text-areia-700"
        }`}
      >
        {lado.inscricao?.nome ?? lado.aguardando ?? "A definir"}
      </span>
      {lado.venceu && <IconeTrofeu className="h-3.5 w-3.5 shrink-0 text-saibro-600" />}
      {wo ? (
        lado.venceu && (
          <span className="shrink-0 text-[11px] font-bold text-saibro-700">W.O.</span>
        )
      ) : (
        <span className="flex shrink-0 gap-1 tabular-nums">
          {lado.games.map((games, i) => (
            <span
              key={i}
              className={`w-4 text-center text-[13px] ${
                Number(games) > Number(gamesDoOutro[i] ?? 0)
                  ? "font-bold text-areia-900"
                  : "text-areia-500"
              }`}
            >
              {games}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** Texto para leitor de tela: "Jogo 3: Ana contra Bia, venceu Ana, 6/4 6/3". */
export function descreverCaixa(caixa: CaixaDePartida): string {
  const nomeA = caixa.a.inscricao?.nome ?? caixa.a.aguardando ?? "a definir";
  const nomeB = caixa.b.inscricao?.nome ?? caixa.b.aguardando ?? "a definir";
  const { partida } = caixa;
  const resultado = partida.vencedor
    ? `, venceu ${partida.vencedor === "A" ? nomeA : nomeB}${partida.placar ? `, ${partida.placar}` : ""}`
    : ", sem resultado";
  return `Jogo ${caixa.numero}: ${nomeA} contra ${nomeB}${resultado}`;
}

/**
 * Cartao de uma partida de torneio (chave, grupos, rodadas). Clicar abre o
 * registro do resultado.
 */
export function CaixaDaPartida({
  caixa,
  aoAbrir,
}: {
  caixa: CaixaDePartida;
  aoAbrir: (partidaId: string) => void;
}) {
  const { partida } = caixa;
  const pronta = Boolean(caixa.a.inscricao && caixa.b.inscricao);
  const situacao = partida.vencedor
    ? partida.data
      ? formatarDiaMes(partida.data)
      : "Jogada"
    : pronta
      ? "Registrar"
      : "Aguardando";

  return (
    <button
      type="button"
      onClick={() => aoAbrir(partida.id)}
      aria-label={descreverCaixa(caixa)}
      className={`block w-full rounded-xl border bg-white px-3 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-saibro-300 hover:shadow-card-hover ${
        pronta && !partida.vencedor ? "border-saibro-300" : "border-areia-200"
      }`}
    >
      <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide">
        <span className="text-areia-500">Jogo {caixa.numero}</span>
        <span className={pronta && !partida.vencedor ? "text-saibro-700" : "text-areia-400"}>
          {situacao}
        </span>
      </span>
      <LinhaDoLado lado={caixa.a} gamesDoOutro={caixa.b.games} wo={Boolean(partida.wo)} />
      <span className="my-1 block border-t border-areia-100" />
      <LinhaDoLado lado={caixa.b} gamesDoOutro={caixa.a.games} wo={Boolean(partida.wo)} />
    </button>
  );
}

/** Vaga de folga na 1a rodada: o cabeca de chave passa direto. */
export function CaixaDaFolga({ caixa }: { caixa: CaixaDeFolga }) {
  return (
    <div className="w-full rounded-xl border border-dashed border-areia-300 bg-areia-50/80 px-3 py-2">
      <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-areia-500">
        <span>Folga</span>
        <span className="text-areia-400">Passa direto</span>
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <AvataresDoLado alunos={caixa.inscricao?.alunos ?? []} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-areia-700">
          {caixa.inscricao?.nome ?? "—"}
        </span>
      </div>
    </div>
  );
}
