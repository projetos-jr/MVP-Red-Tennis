"use client";

import { useId } from "react";
import { Campo } from "@/components/ui/Formulario";
import { lerPlacar, type SetDoPlacar } from "@/lib/banco/regras/ranking";

export interface ValoresDoResultado {
  placar: string;
  vencedor: "" | "A" | "B";
  wo: boolean;
}

export const RESULTADO_VAZIO: ValoresDoResultado = { placar: "", vencedor: "", wo: false };

/** Quem venceu pelo placar digitado (vazio se ainda nao da para saber). */
function vencedorPeloPlacar(placar: string): "" | "A" | "B" {
  const sets = lerPlacar(placar);
  if (!sets || sets.some((s) => s.a === s.b)) return "";
  const setsA = sets.filter((s) => s.a > s.b).length;
  const setsB = sets.length - setsA;
  return setsA === setsB ? "" : setsA > setsB ? "A" : "B";
}

/** Mini placar para conferir o que foi digitado, com o nome de cada lado. */
function PreviaDoPlacar({ sets, nomeA, nomeB }: { sets: SetDoPlacar[]; nomeA: string; nomeB: string }) {
  const linhas: Array<{ nome: string; games: (s: SetDoPlacar) => number }> = [
    { nome: nomeA, games: (s) => s.a },
    { nome: nomeB, games: (s) => s.b },
  ];
  return (
    <div className="rounded-xl border border-areia-200 bg-areia-50 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-areia-500">
        Confira o placar
      </p>
      <table className="w-full text-sm">
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.nome}>
              <th scope="row" className="max-w-0 truncate py-0.5 pr-3 text-left font-medium text-areia-800">
                {linha.nome}
              </th>
              {sets.map((set, i) => {
                const meu = linha.games(set);
                const outro = linha === linhas[0] ? set.b : set.a;
                return (
                  <td
                    key={i}
                    className={`w-8 py-0.5 text-center tabular-nums ${
                      meu > outro ? "font-bold text-areia-900" : "text-areia-500"
                    }`}
                  >
                    {meu}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Campos do resultado de uma partida: vencedor, W.O. e placar. O placar e
 * sempre escrito do ponto de vista do lado A; a regra (`validarResultado`)
 * confere se ele combina com o vencedor.
 */
export function CamposDoResultado({
  valores,
  aoMudar,
  nomeA,
  nomeB,
}: {
  valores: ValoresDoResultado;
  aoMudar: (valores: ValoresDoResultado) => void;
  nomeA: string;
  nomeB: string;
}) {
  const nomeDoGrupo = useId();
  const sets = valores.wo ? undefined : lerPlacar(valores.placar);

  function mudarPlacar(placar: string) {
    // Conforto: sem vencedor escolhido, o placar completo ja sugere quem venceu.
    const sugerido = valores.vencedor ? "" : vencedorPeloPlacar(placar);
    aoMudar({ ...valores, placar, vencedor: sugerido || valores.vencedor });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-areia-800">
          Vencedor<span className="ml-0.5 text-tijolo-600">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(["A", "B"] as const).map((lado) => {
            const escolhido = valores.vencedor === lado;
            return (
              <label key={lado} className="block cursor-pointer">
                <input
                  type="radio"
                  name={nomeDoGrupo}
                  value={lado}
                  checked={escolhido}
                  onChange={() => aoMudar({ ...valores, vencedor: lado })}
                  className="peer sr-only"
                />
                <span
                  className={`block rounded-xl border px-3 py-2.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-saibro-500 ${
                    escolhido
                      ? "border-saibro-500 bg-saibro-50 text-saibro-900"
                      : "border-areia-300 bg-white text-areia-800 hover:border-saibro-300"
                  }`}
                >
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-areia-500">
                    {escolhido ? "Venceu" : `Lado ${lado}`}
                  </span>
                  <span className="block truncate text-sm font-semibold">
                    {lado === "A" ? nomeA : nomeB}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={valores.wo}
          onChange={(e) => aoMudar({ ...valores, wo: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-tijolo-600"
        />
        <span>
          <span className="font-medium text-areia-800">Vitória por W.O.</span>
          <span className="block text-xs text-areia-500">
            O adversário não compareceu. Não precisa de placar.
          </span>
        </span>
      </label>

      {!valores.wo && (
        <Campo
          rotulo="Placar"
          obrigatorio
          ajuda={`Sets separados por espaço, com os games de ${nomeA} primeiro. Ex.: 6/4 3/6 10/8.`}
        >
          <input
            value={valores.placar}
            onChange={(e) => mudarPlacar(e.target.value)}
            placeholder="6/4 3/6 10/8"
            autoComplete="off"
            className="campo tabular-nums"
          />
        </Campo>
      )}

      {sets && sets.length > 0 && <PreviaDoPlacar sets={sets} nomeA={nomeA} nomeB={nomeB} />}
    </div>
  );
}
