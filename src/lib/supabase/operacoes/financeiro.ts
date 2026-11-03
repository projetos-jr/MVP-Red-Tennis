/**
 * Financeiro: lancamentos, pagamentos, anulacao, mensalidades e repasses.
 *
 * Todas as operacoes viram funcoes do banco (`supabase/migrations/
 * 20261030120300_funcoes_financeiro_estoque.sql`). Mapa completo em
 * `docs/modulos/financeiro.md`, secao "No banco (funções)".
 */

import {
  anularLancamento,
  criarLancamento,
  fecharRepasseDoMes,
  gerarMensalidades,
  registrarPagamento,
} from "@/lib/banco/operacoes/financeiro";
import { ligar, porFuncao } from "../gravar";

/** Campo de data vazio ("") vai como "nao informado". */
function dataOuVazio(data: string | undefined): string | undefined {
  return data ? data : undefined;
}

/** Id de um retorno em JSON (`{ "id": ... }`, `{ "movimento_id": ... }`). */
function campoDoRetorno(campo: string) {
  return (retorno: unknown): string | undefined => {
    if (!retorno || typeof retorno !== "object") return undefined;
    const valor = (retorno as Record<string, unknown>)[campo];
    return typeof valor === "string" ? valor : undefined;
  };
}

// O banco liga a mensalidade a matricula e define pessoa e competencia como a
// tela. Devolve o id do lancamento.
ligar(
  criarLancamento,
  porFuncao(
    "criar_lancamento",
    (d) => ({
      p_tipo: d.tipo,
      p_categoria: d.categoria,
      p_item: d.item,
      p_valor: d.valor,
      p_vencimento: d.vencimento,
      p_pessoa_id: d.pessoaId || undefined,
      p_nome_pagante: d.nomePagante,
      p_forma_pagamento: d.formaPagamento,
      p_comprovante: d.comprovante,
      p_pago_em: dataOuVazio(d.pagoEm),
      p_valor_convenio: d.valorConvenio,
      p_competencia: d.competencia || undefined,
    }),
    ["lancamentos"],
  ),
);

// Se a cobranca e de uma reserva aguardando pagamento, a reserva fica
// confirmada na mesma transacao (por isso le de novo tambem a agenda).
ligar(
  registrarPagamento,
  porFuncao(
    "registrar_pagamento",
    (d) => ({
      p_id: d.id,
      p_pago_em: dataOuVazio(d.pagoEm),
      p_forma_pagamento: d.formaPagamento,
      p_valor_convenio: d.valorConvenio,
      p_comprovante: d.comprovante,
      p_nome_pagante: d.nomePagante,
    }),
    ["lancamentos", "ocupacoes"],
    campoDoRetorno("id"),
  ),
);

ligar(
  anularLancamento,
  porFuncao("anular_lancamento", (d) => ({ p_id: d.id, p_motivo: d.motivo }), ["lancamentos"]),
);

// Mexe nas cobrancas de todos os alunos do mes; rodar de novo nao duplica.
ligar(
  gerarMensalidades,
  porFuncao("gerar_mensalidades", (d) => ({ p_competencia: d.competencia }), ["lancamentos"]),
);

// Grava os repasses do mes e as contas a pagar de cada professor.
ligar(
  fecharRepasseDoMes,
  porFuncao(
    "fechar_repasse_do_mes",
    (d) => ({ p_competencia: d.competencia, p_vencimento: dataOuVazio(d.vencimento) }),
    ["repasses", "lancamentos"],
  ),
);
