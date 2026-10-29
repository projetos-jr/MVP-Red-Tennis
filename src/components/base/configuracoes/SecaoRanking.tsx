"use client";

import { useState } from "react";
import { IconeDescer, IconeSubir } from "@/components/base/Icones";
import { IconeTrofeu } from "@/components/ui/Icons";
import { salvarParametros } from "@/lib/banco/operacoes/configuracoes";
import type { Configuracoes } from "@/lib/banco/tipos";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import {
  CampoDeConfiguracao,
  EntradaComUnidade,
  FormularioDeSecao,
  Interruptor,
  RodapeDeSalvar,
  SecaoDeConfiguracao,
  erroDeInteiro,
  paraNumero,
} from "./Pecas";

function rascunhoDe(c: Configuracoes) {
  return {
    vitoria: String(c.pontosVitoria),
    derrota: String(c.pontosDerrota),
    torneioConta: c.torneioContaParaRanking,
    classificados: String(c.classificadosPorGrupo),
    criterios: c.criteriosDesempate,
  };
}

/** Pontuacao do ranking (H7) e regras de torneio (H8). */
export function SecaoRanking() {
  const { banco } = useApp();
  const gravar = useGravar();
  const salvo = rascunhoDe(banco.configuracoes);
  const [rascunho, setRascunho] = useState(salvo);
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(salvo);

  const vitoria = paraNumero(rascunho.vitoria);
  const derrota = paraNumero(rascunho.derrota);
  const erroDaVitoria = erroDeInteiro(rascunho.vitoria, 0, "Use um número inteiro, sem valor negativo.");
  const erroDaDerrota =
    erroDeInteiro(rascunho.derrota, 0, "Use um número inteiro, sem valor negativo.") ??
    (derrota > vitoria ? "A derrota não pode valer mais que a vitória." : undefined);
  const erroDosClassificados = erroDeInteiro(
    rascunho.classificados,
    1,
    "Use um número inteiro, a partir de 1.",
  );
  const exemplo =
    !erroDaVitoria && !erroDaDerrota
      ? `Exemplo: 3 vitórias e 2 derrotas = 3 × ${vitoria} + 2 × ${derrota} = ${3 * vitoria + 2 * derrota} pontos.`
      : "";

  function mover(indice: number, passo: -1 | 1) {
    const criterios = [...rascunho.criterios];
    const destino = indice + passo;
    [criterios[indice], criterios[destino]] = [criterios[destino], criterios[indice]];
    setRascunho({ ...rascunho, criterios });
  }

  function salvar() {
    gravar(
      salvarParametros,
      {
        pontosVitoria: vitoria,
        pontosDerrota: derrota,
        torneioContaParaRanking: rascunho.torneioConta,
        classificadosPorGrupo: paraNumero(rascunho.classificados),
        criteriosDesempate: rascunho.criterios,
      },
      "Regras do ranking e dos torneios salvas.",
    );
  }

  return (
    <SecaoDeConfiguracao
      id="ranking"
      titulo="Ranking e torneios"
      descricao="Pontos de cada partida e como se decide quem passa num torneio."
      icone={<IconeTrofeu className="h-5 w-5" />}
    >
      <FormularioDeSecao aoSalvar={salvar}>
        <div className="divide-y divide-areia-100">
          <CampoDeConfiguracao
            rotulo="Pontos por vitória"
            hipotese={7}
            ajuda={`Valores de teste. O ranking é recalculado a partir das partidas registradas. ${exemplo}`}
            erro={rascunho.vitoria !== salvo.vitoria ? erroDaVitoria : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.vitoria}
                aoMudar={(valor) => setRascunho({ ...rascunho, vitoria: valor })}
                unidade="pontos"
                invalido={rascunho.vitoria !== salvo.vitoria && Boolean(erroDaVitoria)}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Pontos por derrota"
            hipotese={7}
            ajuda="Pontos de participação de quem perde. No W.O., quem não compareceu não ganha estes pontos."
            erro={rascunho.derrota !== salvo.derrota || rascunho.vitoria !== salvo.vitoria ? erroDaDerrota : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.derrota}
                aoMudar={(valor) => setRascunho({ ...rascunho, derrota: valor })}
                unidade="pontos"
                invalido={rascunho.derrota !== salvo.derrota && Boolean(erroDaDerrota)}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Partidas de torneio contam para o ranking"
            ajuda="Sim: o resultado de uma partida de torneio também soma pontos no ranking geral. Partidas de duplas nunca contam (o ranking é individual)."
          >
            {(id) => (
              <Interruptor
                id={id}
                ligado={rascunho.torneioConta}
                aoMudar={(torneioConta) => setRascunho({ ...rascunho, torneioConta })}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Classificados por grupo"
            hipotese={8}
            ajuda="No formato grupos + eliminatória, quantos jogadores de cada grupo passam para a fase seguinte. Valor inicial: 2."
            erro={rascunho.classificados !== salvo.classificados ? erroDosClassificados : undefined}
          >
            {(id) => (
              <EntradaComUnidade
                id={id}
                valor={rascunho.classificados}
                aoMudar={(valor) => setRascunho({ ...rascunho, classificados: valor })}
                unidade="por grupo"
                invalido={rascunho.classificados !== salvo.classificados && Boolean(erroDosClassificados)}
              />
            )}
          </CampoDeConfiguracao>

          <CampoDeConfiguracao
            rotulo="Ordem dos critérios de desempate"
            hipotese={8}
            ajuda="Quando dois jogadores empatam num grupo, o primeiro critério decide; se continuar empatado, vale o segundo, e assim por diante. Use as setas para mudar a ordem. No W.O., a vitória é de quem compareceu."
          >
            {(id) => (
              <ol
                id={id}
                aria-label="Ordem dos critérios de desempate"
                aria-describedby={`${id}-ajuda`}
                className="space-y-1.5"
              >
                {rascunho.criterios.map((criterio, i) => (
                  <li
                    key={criterio}
                    className="flex items-center gap-2 rounded-xl border border-areia-200 bg-white py-1.5 pl-3 pr-1.5 text-sm"
                  >
                    <span className="w-4 text-xs font-semibold tabular-nums text-areia-500">{i + 1}º</span>
                    <span className="flex-1 font-medium text-areia-800">{criterio}</span>
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="btn-fantasma p-1.5"
                      aria-label={`Subir "${criterio}"`}
                    >
                      <IconeSubir className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === rascunho.criterios.length - 1}
                      className="btn-fantasma p-1.5"
                      aria-label={`Descer "${criterio}"`}
                    >
                      <IconeDescer className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </CampoDeConfiguracao>
        </div>
        <RodapeDeSalvar alterado={alterado} aoDesfazer={() => setRascunho(salvo)} />
      </FormularioDeSecao>
    </SecaoDeConfiguracao>
  );
}
