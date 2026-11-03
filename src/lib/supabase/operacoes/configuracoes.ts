/**
 * Ligacoes das operacoes da tela de Configuracoes
 * (`src/lib/banco/operacoes/configuracoes.ts`) ao banco real. Todas so do dono.
 *
 * Mapa completo em `docs/modulos/base.md`, secao "No banco (funções)". As
 * siglas, as formas de pagamento e as permissoes ficam na linha unica de
 * `configuracoes`; a tela grava sempre pelas funcoes (que conferem os
 * valores), nunca com `update` direto nessa tabela.
 */

import {
  alterarPermissoes,
  apagarPlano,
  desativarPlano,
  desativarSigla,
  editarPlano,
  editarSigla,
  incluirPlano,
  incluirSigla,
  reativarPlano,
  reativarSigla,
  salvarParametros,
} from "@/lib/banco/operacoes/configuracoes";
import type { DadosDoPlano, ParametrosGerais } from "@/lib/banco/regras/configuracoes";
import { paraSnake } from "../conversao";
import { espelhar, ligar, porFuncao } from "../gravar";

// ---------------------------------------------------------------------------
// Parametros
// ---------------------------------------------------------------------------

/**
 * Os parametros que `salvar_parametros` conhece (um `p_` para cada). Se um
 * parametro novo entrar em `Configuracoes`, o TypeScript acusa aqui: a funcao
 * do banco precisa ganhar o parametro tambem.
 */
const PARAMETROS: Record<keyof ParametrosGerais, true> = {
  validadeReposicaoMeses: true,
  prazoPagamentoReservaHoras: true,
  liberarReservaAutomaticamente: true,
  semanasGeradasAFrente: true,
  bloquearProfessorEmDuasAulas: true,
  pontosVitoria: true,
  pontosDerrota: true,
  torneioContaParaRanking: true,
  classificadosPorGrupo: true,
  criteriosDesempate: true,
  formasPagamento: true,
  prazoPagamentoConsumoDias: true,
  precoLocacaoHora: true,
  precoParedaoHora: true,
};

// So vao os parametros que a tela mandou; os outros ficam como estao.
ligar(
  salvarParametros,
  porFuncao(
    "salvar_parametros",
    (d) =>
      Object.fromEntries(
        (Object.keys(PARAMETROS) as Array<keyof ParametrosGerais>)
          .filter((campo) => d[campo] !== undefined)
          .map((campo) => [`p_${paraSnake(campo)}`, d[campo]]),
      ),
    ["configuracoes"],
  ),
);

// ---------------------------------------------------------------------------
// Siglas de reposicao
// ---------------------------------------------------------------------------

ligar(
  incluirSigla,
  porFuncao(
    "incluir_sigla",
    (d) => ({
      p_codigo: d.codigo,
      p_nome: d.nome,
      p_descricao: d.descricao,
      p_gera_credito: d.geraCredito,
      p_aplica_a: d.aplicaA,
    }),
    ["configuracoes"],
  ),
);

ligar(
  editarSigla,
  porFuncao(
    "editar_sigla",
    (d) => ({
      p_codigo_atual: d.codigoAtual,
      p_sigla: {
        codigo: d.sigla.codigo,
        nome: d.sigla.nome,
        descricao: d.sigla.descricao,
        geraCredito: d.sigla.geraCredito,
        aplicaA: d.sigla.aplicaA,
      },
    }),
    ["configuracoes"],
  ),
);

ligar(desativarSigla, porFuncao("desativar_sigla", (d) => ({ p_codigo: d.codigo }), ["configuracoes"]));
ligar(reativarSigla, porFuncao("reativar_sigla", (d) => ({ p_codigo: d.codigo }), ["configuracoes"]));

// ---------------------------------------------------------------------------
// Catalogo de planos
// ---------------------------------------------------------------------------

function argumentosDoPlano(d: DadosDoPlano) {
  return {
    p_nome: d.nome,
    p_tipo: d.tipo,
    p_valor_mensal: d.valorMensal,
    p_aulas_por_semana: d.aulasPorSemana,
    p_duracao_minutos: d.duracaoMinutos,
    p_tabela: d.tabela,
    p_ativo: d.ativo,
  };
}

// Devolve o id do plano criado pelo banco.
ligar(incluirPlano, porFuncao("incluir_plano", (d) => argumentosDoPlano(d), ["planos"]));

ligar(
  editarPlano,
  porFuncao("editar_plano", (d) => ({ p_id: d.id, ...argumentosDoPlano(d) }), ["planos"]),
);

ligar(desativarPlano, espelhar(["planos"]));
ligar(reativarPlano, espelhar(["planos"]));

ligar(apagarPlano, porFuncao("apagar_plano", (d) => ({ p_id: d.id }), ["planos"]));

// ---------------------------------------------------------------------------
// Permissoes dos perfis
// ---------------------------------------------------------------------------

ligar(
  alterarPermissoes,
  porFuncao("alterar_permissoes", (d) => ({ p_permissoes: d.permissoes }), ["configuracoes"]),
);
