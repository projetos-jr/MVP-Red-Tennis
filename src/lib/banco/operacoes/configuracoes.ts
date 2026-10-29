/**
 * Operacoes da tela de Configuracoes: parametros das hipoteses (H1-H14),
 * siglas de reposicao, catalogo de planos e permissoes dos perfis.
 *
 * Todas sao so do dono. As que mexem no registro unico de configuracoes
 * validam os valores e depois reaproveitam `alterarConfiguracoes`
 * (operacoes/base.ts), que grava a mudanca.
 */

import { definirOperacao, type ContextoOperacao } from "../executar";
import { exigir, novoId } from "../regras/comum";
import {
  matriculasDoPlano,
  normalizarParametros,
  normalizarPermissoes,
  normalizarPlano,
  normalizarSigla,
  usosDaSigla,
  validarParametros,
  validarPermissoes,
  validarPlano,
  validarSigla,
  type DadosDoPlano,
  type ParametrosGerais,
  type Permissoes,
} from "../regras/configuracoes";
import type { Banco, Configuracoes, Plano, SiglaReposicao } from "../tipos";
import { alterarConfiguracoes } from "./base";

/** O que o formulario de sigla entrega (a situacao muda por operacao propria). */
export type DadosDaSigla = Omit<SiglaReposicao, "desativada">;

function exigirDono(ctx: ContextoOperacao): void {
  exigir(ctx.usuario.perfil === "dono", "Só o dono pode alterar as configurações.");
}

function mesmosCampos<T extends object>(a: T, b: T): boolean {
  const campos = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof T>;
  return [...campos].every((campo) => JSON.stringify(a[campo]) === JSON.stringify(b[campo]));
}

/** Grava so o que mudou: salvar sem mudar nada nao vai para o historico. */
function gravarConfiguracoes(
  banco: Banco,
  mudancas: Partial<Configuracoes>,
  ctx: ContextoOperacao,
): Banco {
  const atual: Partial<Configuracoes> = banco.configuracoes;
  const mudou = (Object.keys(mudancas) as Array<keyof Configuracoes>).some(
    (campo) => JSON.stringify(mudancas[campo]) !== JSON.stringify(atual[campo]),
  );
  return mudou ? alterarConfiguracoes.aplicar(banco, mudancas, ctx) : banco;
}

// ---------------------------------------------------------------------------
// Parametros (prazos, pontos, precos, formas de pagamento...)
// ---------------------------------------------------------------------------

/** Altera um ou mais parametros simples, depois de conferir os limites de cada um. */
export const salvarParametros = definirOperacao(
  "Alterar configurações",
  (banco, dados: Partial<ParametrosGerais>, ctx) => {
    exigirDono(ctx);
    const novos = normalizarParametros(dados);
    validarParametros(banco.configuracoes, novos);
    return gravarConfiguracoes(banco, novos, ctx);
  },
);

// ---------------------------------------------------------------------------
// Siglas de reposicao (Hipotese H1)
// ---------------------------------------------------------------------------

function camposDaSigla(dados: DadosDaSigla): DadosDaSigla {
  return normalizarSigla({
    codigo: dados.codigo,
    nome: dados.nome,
    descricao: dados.descricao,
    geraCredito: dados.geraCredito,
    aplicaA: dados.aplicaA,
  });
}

export const incluirSigla = definirOperacao(
  "Incluir sigla de reposição",
  (banco, dados: DadosDaSigla, ctx) => {
    exigirDono(ctx);
    const sigla = camposDaSigla(dados);
    validarSigla(sigla, banco.configuracoes.siglas);
    return gravarConfiguracoes(banco, { siglas: [...banco.configuracoes.siglas, sigla] }, ctx);
  },
);

/**
 * Edita nome, descricao, credito e onde vale. O codigo so muda enquanto
 * ninguem o usou: aulas e creditos antigos guardam o codigo como texto.
 */
export const editarSigla = definirOperacao(
  "Editar sigla de reposição",
  (banco, dados: { codigoAtual: string; sigla: DadosDaSigla }, ctx) => {
    exigirDono(ctx);
    const { siglas } = banco.configuracoes;
    const atual = siglas.find((s) => s.codigo === dados.codigoAtual);
    exigir(atual, "Sigla não encontrada.");

    const sigla: SiglaReposicao = { ...atual, ...camposDaSigla(dados.sigla) };
    exigir(
      sigla.codigo === atual.codigo || usosDaSigla(banco, atual.codigo) === 0,
      `A sigla ${atual.codigo} já foi usada em aulas ou créditos de reposição, por isso o código não pode mudar. Crie uma sigla nova e desative esta.`,
    );
    validarSigla(sigla, siglas.filter((s) => s !== atual));

    return gravarConfiguracoes(
      banco,
      { siglas: siglas.map((s) => (s === atual ? sigla : s)) },
      ctx,
    );
  },
);

function operacaoDeSituacaoDaSigla(nome: string, desativada: boolean) {
  return definirOperacao(nome, (banco, dados: { codigo: string }, ctx) => {
    exigirDono(ctx);
    const { siglas } = banco.configuracoes;
    exigir(
      siglas.some((s) => s.codigo === dados.codigo),
      "Sigla não encontrada.",
    );
    return gravarConfiguracoes(
      banco,
      { siglas: siglas.map((s) => (s.codigo === dados.codigo ? { ...s, desativada } : s)) },
      ctx,
    );
  });
}

/** A sigla sai dos formularios novos; o que ja foi gravado com ela continua valendo. */
export const desativarSigla = operacaoDeSituacaoDaSigla("Desativar sigla de reposição", true);
export const reativarSigla = operacaoDeSituacaoDaSigla("Reativar sigla de reposição", false);

// ---------------------------------------------------------------------------
// Planos (Hipoteses H2 e H3)
// ---------------------------------------------------------------------------

function camposDoPlano(dados: DadosDoPlano): DadosDoPlano {
  return normalizarPlano({
    nome: dados.nome,
    tipo: dados.tipo,
    valorMensal: dados.valorMensal,
    aulasPorSemana: dados.aulasPorSemana,
    duracaoMinutos: dados.duracaoMinutos,
    tabela: dados.tabela,
    ativo: dados.ativo,
  });
}

export const incluirPlano = definirOperacao(
  "Incluir plano",
  (banco, dados: DadosDoPlano, ctx) => {
    exigirDono(ctx);
    const plano: Plano = { id: novoId("pl"), ...camposDoPlano(dados) };
    validarPlano(plano, banco.planos);
    return { ...banco, planos: [...banco.planos, plano] };
  },
);

/**
 * Mudar o valor de um plano nao muda as matriculas: cada aluno mantem o valor
 * combinado (Hipotese H3). O tipo so muda enquanto o plano nao tem matricula.
 */
export const editarPlano = definirOperacao(
  "Editar plano",
  (banco, dados: DadosDoPlano & { id: string }, ctx) => {
    exigirDono(ctx);
    const atual = banco.planos.find((p) => p.id === dados.id);
    exigir(atual, "Plano não encontrado.");

    const plano: Plano = { id: atual.id, ...camposDoPlano(dados) };
    validarPlano(plano, banco.planos.filter((p) => p.id !== atual.id));
    exigir(
      plano.tipo === atual.tipo ||
        matriculasDoPlano(banco, atual.id, ctx.hoje).todas.length === 0,
      `O plano "${atual.nome}" já tem matrículas, por isso o tipo não pode mudar. Crie um plano novo e desative este.`,
    );

    if (mesmosCampos(plano, atual)) return banco;
    return { ...banco, planos: banco.planos.map((p) => (p.id === atual.id ? plano : p)) };
  },
);

function operacaoDeSituacaoDoPlano(nome: string, ativo: boolean) {
  return definirOperacao(nome, (banco, dados: { id: string }, ctx) => {
    exigirDono(ctx);
    const plano = banco.planos.find((p) => p.id === dados.id);
    exigir(plano, "Plano não encontrado.");
    if (plano.ativo === ativo) return banco;
    return {
      ...banco,
      planos: banco.planos.map((p) => (p.id === plano.id ? { ...p, ativo } : p)),
    };
  });
}

/** Plano desativado deixa de ser oferecido; quem ja tem continua com ele. */
export const desativarPlano = operacaoDeSituacaoDoPlano("Desativar plano", false);
export const reativarPlano = operacaoDeSituacaoDoPlano("Reativar plano", true);

/**
 * Apaga um plano criado por engano. Plano que aparece em alguma matricula
 * (vigente ou no historico) nao se apaga: desativa-se.
 */
export const apagarPlano = definirOperacao(
  "Apagar plano",
  (banco, dados: { id: string }, ctx) => {
    exigirDono(ctx);
    const plano = banco.planos.find((p) => p.id === dados.id);
    exigir(plano, "Plano não encontrado.");

    const { vigentes, todas } = matriculasDoPlano(banco, plano.id, ctx.hoje);
    exigir(
      vigentes.length === 0,
      `O plano "${plano.nome}" tem ${vigentes.length} matrícula(s) vigente(s) e não pode ser apagado. Desative-o: ele deixa de ser oferecido e quem já tem continua com ele.`,
    );
    exigir(
      todas.length === 0,
      `O plano "${plano.nome}" aparece no histórico de ${todas.length} matrícula(s) e não pode ser apagado. Desative-o para que deixe de ser oferecido.`,
    );

    return { ...banco, planos: banco.planos.filter((p) => p.id !== plano.id) };
  },
);

// ---------------------------------------------------------------------------
// Permissoes (Hipotese H9)
// ---------------------------------------------------------------------------

export const alterarPermissoes = definirOperacao(
  "Alterar permissões",
  (banco, dados: { permissoes: Permissoes }, ctx) => {
    exigirDono(ctx);
    const permissoes = normalizarPermissoes(dados.permissoes);
    validarPermissoes(permissoes);
    return gravarConfiguracoes(banco, { permissoes }, ctx);
  },
);
