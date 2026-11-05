/**
 * Placa de atenção do Início: só aparece quando há pendência. Sem nada para
 * fazer, o Início fica só com as quadras e o mosaico (pedido do cliente).
 * As listas não ficam na página: só dentro da janela que a placa abre.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotaoDeAtencao } from "@/components/ui/PlacaDeAtencao";
import { HOJE } from "@/lib/banco/constantes";
import { gerarBancoInicial } from "@/lib/banco/semente";
import type { Banco, Colaborador } from "@/lib/banco/tipos";
import { precisaDeAtencao } from "@/lib/consultas/painel";
import { AtencaoDoInicio } from "./AtencaoDoInicio";

const banco = gerarBancoInicial();
const dono = banco.colaboradores.find((c) => c.perfil === "dono") as Colaborador;

/** O mesmo banco, com tudo em dia: reservas pagas, mensalidades quitadas, estoque acima do mínimo, sem créditos a vencer. */
function bancoEmDia(): Banco {
  return {
    ...banco,
    ocupacoes: banco.ocupacoes.map((o) =>
      o.situacao === "aguardando_pagamento" ? { ...o, situacao: "agendada" } : o,
    ),
    lancamentos: banco.lancamentos.map((l) => (l.pagoEm ? l : { ...l, pagoEm: HOJE, formaPagamento: "Dinheiro" })),
    produtos: banco.produtos.map((p) => ({ ...p, estoqueMinimo: 0 })),
    reposicoes: [],
  };
}

function desenhar(dados: Banco): string {
  return renderToStaticMarkup(
    createElement(AtencaoDoInicio, {
      atencao: precisaDeAtencao(dados, dono, HOJE, "18:10"),
      configuracoes: dados.configuracoes,
      podeRegistrarPagamento: true,
    }),
  );
}

describe("placa de atenção do Início", () => {
  it("com pendências: aparece a placa com o total, e as listas ficam fora da página", () => {
    const atencao = precisaDeAtencao(banco, dono, HOJE, "18:10");
    // Os dados de exemplo têm pendências; sem isso o teste não prova nada.
    expect(atencao.total).toBeGreaterThan(0);

    const html = desenhar(banco);
    expect(html).toContain("Atenção");
    expect(html).toContain(`${atencao.total} itens precisam de você`);
    expect(html).toContain("<button");
    // A janela começa fechada: nada das listas na página.
    expect(html).not.toContain("Reservas sem pagamento");
    expect(html).not.toContain("Mensalidades em atraso");
  });

  it("sem pendências: a placa não aparece (nada é desenhado)", () => {
    const emDia = bancoEmDia();
    expect(precisaDeAtencao(emDia, dono, HOJE, "18:10").total).toBe(0);
    expect(desenhar(emDia)).toBe("");
  });

  it("o botão da placa não se desenha com quantidade 0", () => {
    expect(BotaoDeAtencao({ quantidade: 0, aoAbrir: () => {} })).toBeNull();
  });
});
