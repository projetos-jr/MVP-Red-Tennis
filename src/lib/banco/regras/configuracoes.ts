/**
 * Regras da tela de Configuracoes.
 *
 * Cada parametro tem um limite simples (prazo maior que zero, pontos nao
 * negativos, nomes sem repeticao...). No banco real, viram CHECK constraints
 * da tabela `configuracoes` e das tabelas `siglas_reposicao` e `planos`, e a
 * regra de "plano em uso nao se apaga" vira a chave estrangeira de
 * `matriculas.plano_id`.
 */

import type {
  Banco,
  Configuracoes,
  Matricula,
  ModuloSistema,
  Perfil,
  Plano,
  SiglaReposicao,
  TipoPlano,
} from "../tipos";
import { exigir } from "./comum";

/** Todos os modulos, na ordem em que aparecem na matriz de permissoes. */
export const MODULOS_DO_SISTEMA: ModuloSistema[] = [
  "painel",
  "agenda",
  "alunos",
  "professores",
  "financeiro",
  "financeiro_pagar",
  "estoque",
  "ranking",
  "configuracoes",
  "historico",
];

export const PERFIS: Perfil[] = ["dono", "recepcao", "professor"];

export const TIPOS_DE_PLANO: TipoPlano[] = [
  "Individual",
  "Dupla",
  "LAP",
  "Locação Mensal",
  "Plano de locação",
];

/** Parametros simples (numeros, sim/nao e listas de texto). Siglas e permissoes tem regras proprias. */
export type ParametrosGerais = Omit<Configuracoes, "siglas" | "permissoes">;

/** Comparacao de textos sem diferenciar maiusculas, acentos e espacos nas pontas. */
export function mesmoTexto(a: string, b: string): boolean {
  const normalizar = (texto: string) =>
    texto.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return normalizar(a) === normalizar(b);
}

function inteiroAoMenos(valor: unknown, minimo: number): boolean {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= minimo;
}

function primeiroRepetido(lista: string[]): string | undefined {
  return lista.find((item, i) => lista.findIndex((outro) => mesmoTexto(outro, item)) !== i);
}

// ---------------------------------------------------------------------------
// Parametros gerais
// ---------------------------------------------------------------------------

/** Tira espacos das pontas das listas de texto antes de validar e gravar. */
export function normalizarParametros(
  dados: Partial<ParametrosGerais>,
): Partial<ParametrosGerais> {
  return {
    ...dados,
    ...(dados.formasPagamento && {
      formasPagamento: dados.formasPagamento.map((forma) => forma.trim()),
    }),
  };
}

/**
 * Recusa valores fora dos limites. `atual` e a configuracao gravada: os
 * parametros nao informados continuam como estao, e as regras que envolvem
 * dois campos (vitoria x derrota) olham o resultado final.
 */
export function validarParametros(
  atual: Configuracoes,
  novos: Partial<ParametrosGerais>,
): void {
  const c = { ...atual, ...novos };

  exigir(
    inteiroAoMenos(c.validadeReposicaoMeses, 1),
    "A validade da reposição precisa ser de pelo menos 1 mês (número inteiro).",
  );
  exigir(
    inteiroAoMenos(c.prazoPagamentoReservaHoras, 1),
    "O prazo para pagar a reserva precisa ser maior que zero (em horas inteiras).",
  );
  exigir(
    inteiroAoMenos(c.semanasGeradasAFrente, 1) && c.semanasGeradasAFrente <= 52,
    "As semanas da agenda geradas à frente precisam ficar entre 1 e 52.",
  );
  exigir(
    inteiroAoMenos(c.pontosVitoria, 0) && inteiroAoMenos(c.pontosDerrota, 0),
    "Os pontos por vitória e por derrota precisam ser números inteiros, sem valor negativo.",
  );
  exigir(
    c.pontosVitoria >= c.pontosDerrota,
    "A vitória precisa valer pelo menos tanto quanto a derrota.",
  );
  exigir(
    inteiroAoMenos(c.classificadosPorGrupo, 1),
    "Precisa passar pelo menos 1 jogador de cada grupo.",
  );
  exigir(
    inteiroAoMenos(c.prazoPagamentoConsumoDias, 1),
    "O prazo para pagar o consumo do balcão precisa ser de pelo menos 1 dia.",
  );
  exigir(
    typeof c.precoLocacaoHora === "number" && c.precoLocacaoHora > 0,
    "O preço da hora de locação das quadras precisa ser maior que zero.",
  );
  exigir(
    typeof c.precoParedaoHora === "number" && c.precoParedaoHora > 0,
    "O preço da hora de locação do paredão precisa ser maior que zero.",
  );
  exigir(
    typeof c.liberarReservaAutomaticamente === "boolean" &&
      typeof c.bloquearProfessorEmDuasAulas === "boolean" &&
      typeof c.torneioContaParaRanking === "boolean",
    "Opção de sim ou não inválida.",
  );

  // Formas de pagamento: pelo menos uma, sem nome vazio e sem repeticao.
  exigir(c.formasPagamento.length > 0, "Informe pelo menos uma forma de pagamento.");
  exigir(
    c.formasPagamento.every((forma) => forma.trim()),
    "Há uma forma de pagamento sem nome.",
  );
  const formaRepetida = primeiroRepetido(c.formasPagamento);
  exigir(!formaRepetida, `A forma de pagamento "${formaRepetida}" aparece duas vezes.`);

  // Criterios de desempate: o calculo do torneio conhece cada um pelo nome,
  // entao a lista so pode mudar de ordem.
  const mesmosCriterios =
    c.criteriosDesempate.length === atual.criteriosDesempate.length &&
    !primeiroRepetido(c.criteriosDesempate) &&
    c.criteriosDesempate.every((criterio) => atual.criteriosDesempate.includes(criterio));
  exigir(mesmosCriterios, "Os critérios de desempate só podem mudar de ordem.");
}

// ---------------------------------------------------------------------------
// Siglas de reposicao (Hipotese H1)
// ---------------------------------------------------------------------------

export function normalizarSigla(sigla: SiglaReposicao): SiglaReposicao {
  return {
    ...sigla,
    codigo: sigla.codigo.trim(),
    nome: sigla.nome.trim(),
    descricao: sigla.descricao.trim(),
  };
}

/** `outras` = as demais siglas cadastradas (sem a que esta sendo editada). */
export function validarSigla(sigla: SiglaReposicao, outras: SiglaReposicao[]): void {
  exigir(
    /^[0-9A-Za-zÀ-ÖØ-öø-ÿ]{1,6}$/.test(sigla.codigo),
    "O código da sigla precisa ter de 1 a 6 letras ou números, sem espaços.",
  );
  const repetida = outras.find((outra) => mesmoTexto(outra.codigo, sigla.codigo));
  exigir(!repetida, `Já existe a sigla "${repetida?.codigo}". Escolha outro código.`);
  exigir(sigla.nome, "Dê um nome à sigla.");
  exigir(
    sigla.aplicaA === "ocupacao" || sigla.aplicaA === "aluno" || sigla.aplicaA === "ambos",
    "Escolha onde a sigla vale: aula inteira, um aluno ou os dois.",
  );
  exigir(typeof sigla.geraCredito === "boolean", "Diga se a sigla gera crédito de reposição.");
}

/**
 * Quantas vezes o codigo ja foi gravado (aulas canceladas, faltas e creditos
 * de reposicao). Codigo em uso nao pode mudar: o historico guarda o texto.
 */
export function usosDaSigla(banco: Banco, codigo: string): number {
  return (
    banco.ocupacoes.filter((o) => o.motivoCancelamento === codigo).length +
    banco.ocupacaoAlunos.filter((p) => p.sigla === codigo).length +
    banco.reposicoes.filter((r) => r.sigla === codigo).length
  );
}

// ---------------------------------------------------------------------------
// Planos (Hipoteses H2 e H3)
// ---------------------------------------------------------------------------

export type DadosDoPlano = Omit<Plano, "id">;

export function normalizarPlano<T extends DadosDoPlano>(plano: T): T {
  return { ...plano, nome: plano.nome.trim() };
}

/** `outros` = os demais planos do catalogo (sem o que esta sendo editado). */
export function validarPlano(plano: DadosDoPlano, outros: Plano[]): void {
  exigir(plano.nome, "Dê um nome ao plano.");
  const repetido = outros.find((outro) => mesmoTexto(outro.nome, plano.nome));
  exigir(!repetido, `Já existe um plano chamado "${repetido?.nome}".`);
  exigir(TIPOS_DE_PLANO.includes(plano.tipo), "Escolha o tipo do plano.");
  exigir(
    typeof plano.valorMensal === "number" && plano.valorMensal > 0,
    "O valor mensal do plano precisa ser maior que zero.",
  );
  exigir(
    inteiroAoMenos(plano.aulasPorSemana, 1) && plano.aulasPorSemana <= 7,
    "As aulas por semana precisam ficar entre 1 e 7.",
  );
  exigir(
    inteiroAoMenos(plano.duracaoMinutos, 15) && plano.duracaoMinutos <= 240,
    "A duração da aula precisa ficar entre 15 e 240 minutos.",
  );
  exigir(
    plano.tabela === "nova" || plano.tabela === "antiga",
    "Diga se o plano é da tabela nova ou da antiga.",
  );
  exigir(typeof plano.ativo === "boolean", "Diga se o plano está ativo.");
}

export interface MatriculasDoPlano {
  /** Valem hoje ou comecam depois de hoje. */
  vigentes: Matricula[];
  /** Todas, inclusive as encerradas (historico). */
  todas: Matricula[];
}

export function matriculasDoPlano(banco: Banco, planoId: string, hoje: string): MatriculasDoPlano {
  const todas = banco.matriculas.filter((m) => m.planoId === planoId);
  return { todas, vigentes: todas.filter((m) => !m.fim || m.fim >= hoje) };
}

// ---------------------------------------------------------------------------
// Permissoes (Hipotese H9)
// ---------------------------------------------------------------------------

export type Permissoes = Configuracoes["permissoes"];

/** Remove repeticoes e poe os modulos de cada perfil na ordem padrao. */
export function normalizarPermissoes(permissoes: Permissoes): Permissoes {
  const ordenar = (lista: ModuloSistema[] = []) =>
    MODULOS_DO_SISTEMA.filter((modulo) => lista.includes(modulo));
  return {
    dono: ordenar(permissoes.dono),
    recepcao: ordenar(permissoes.recepcao),
    professor: ordenar(permissoes.professor),
  };
}

const NOME_DO_PERFIL: Record<Perfil, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  professor: "Professor",
};

export function validarPermissoes(permissoes: Permissoes): void {
  PERFIS.forEach((perfil) => {
    const modulos = permissoes[perfil] ?? [];
    exigir(
      modulos.every((modulo) => MODULOS_DO_SISTEMA.includes(modulo)),
      "Há um módulo desconhecido nas permissões.",
    );
    exigir(
      !modulos.includes("financeiro_pagar") || modulos.includes("financeiro"),
      `Para ver as contas a pagar, o perfil ${NOME_DO_PERFIL[perfil]} precisa ter acesso ao Financeiro.`,
    );
  });
  // Sem esta regra o dono poderia se trancar fora da tela que devolve o acesso.
  exigir(
    permissoes.dono.includes("configuracoes"),
    "O dono não pode tirar o próprio acesso às Configurações.",
  );
  exigir(
    !permissoes.recepcao.includes("configuracoes") &&
      !permissoes.professor.includes("configuracoes"),
    "Só o perfil Dono pode ter acesso às Configurações.",
  );
}
