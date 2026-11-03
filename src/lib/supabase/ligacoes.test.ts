import { describe, expect, it } from "vitest";
import * as agenda from "@/lib/banco/operacoes/agenda";
import * as alunos from "@/lib/banco/operacoes/alunos";
import * as base from "@/lib/banco/operacoes/base";
import * as configuracoes from "@/lib/banco/operacoes/configuracoes";
import * as estoque from "@/lib/banco/operacoes/estoque";
import * as financeiro from "@/lib/banco/operacoes/financeiro";
import * as professores from "@/lib/banco/operacoes/professores";
import * as ranking from "@/lib/banco/operacoes/ranking";
import type { Operacao } from "@/lib/banco/executar";
import { gravacaoDe } from "./gravar";
import "./operacoes";

/**
 * Toda operacao das telas precisa de uma forma de gravar no banco real; sem
 * ela, a tela mostraria "ainda não foi ligada ao banco" no modo Supabase.
 */

/** Operacoes que nenhuma tela usa (so servem de apoio a outras). */
const SEM_TELA = new Set(["Alterar configurações"]);

const MODULOS = { agenda, alunos, base, configuracoes, estoque, financeiro, professores, ranking };

function operacoesDo(modulo: Record<string, unknown>): [string, Operacao<unknown>][] {
  return Object.entries(modulo).filter(
    (entrada): entrada is [string, Operacao<unknown>] => {
      const valor = entrada[1] as Partial<Operacao<unknown>> | undefined;
      return typeof valor === "object" && valor !== null && typeof valor.aplicar === "function";
    },
  );
}

describe("todas as operações das telas estão ligadas ao banco real", () => {
  for (const [nomeDoModulo, modulo] of Object.entries(MODULOS)) {
    for (const [exportada, operacao] of operacoesDo(modulo)) {
      if (SEM_TELA.has(operacao.nome)) continue;
      it(`${nomeDoModulo}.${exportada} ("${operacao.nome}")`, () => {
        expect(gravacaoDe(operacao)).toBeDefined();
      });
    }
  }
});
