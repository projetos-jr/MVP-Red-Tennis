/**
 * Testes das operacoes da tela de Configuracoes.
 * Os mesmos casos viram testes do banco real (pgTAP) quando o Supabase entrar.
 */

import { describe, expect, it } from "vitest";
import { podeAcessar } from "../../consultas/base";
import { siglasAtivas } from "../../consultas/configuracoes";
import { HOJE } from "../constantes";
import { executarOperacao, type ContextoOperacao, type Operacao } from "../executar";
import type { Permissoes } from "../regras/configuracoes";
import { gerarBancoInicial } from "../semente";
import type { Banco, Colaborador, Perfil, Plano } from "../tipos";
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
  type DadosDaSigla,
} from "./configuracoes";

const banco: Banco = gerarBancoInicial();

function colaborador(perfil: Perfil): Colaborador {
  const encontrado = banco.colaboradores.find((c) => c.perfil === perfil);
  if (!encontrado) throw new Error(`Sem colaborador com perfil ${perfil} nos dados de exemplo.`);
  return encontrado;
}

const dono = colaborador("dono");
const recepcao = colaborador("recepcao");
const professor = colaborador("professor");

function ctx(usuario: Colaborador): ContextoOperacao {
  return { usuario, agora: `${HOJE}T09:00:00`, hoje: HOJE };
}

/** Executa como dono (ou outro usuario) e devolve o banco novo; falha o teste se a regra recusar. */
function gravar<Dados>(operacao: Operacao<Dados>, dados: Dados, base = banco, usuario = dono): Banco {
  const resultado = executarOperacao(base, operacao, dados, ctx(usuario));
  if (!resultado.ok) throw new Error(`Recusado: ${resultado.erro}`);
  return resultado.banco;
}

/** Executa e devolve a mensagem de erro; falha o teste se a operacao passar. */
function recusa<Dados>(operacao: Operacao<Dados>, dados: Dados, base = banco, usuario = dono): string {
  const resultado = executarOperacao(base, operacao, dados, ctx(usuario));
  if (resultado.ok) throw new Error("A operação deveria ter sido recusada.");
  return resultado.erro;
}

const plano = (id: string): Plano => {
  const encontrado = banco.planos.find((p) => p.id === id);
  if (!encontrado) throw new Error(`Plano ${id} não existe nos dados de exemplo.`);
  return encontrado;
};

const novaSigla: DadosDaSigla = {
  codigo: "AT",
  nome: "Atestado",
  descricao: "Aluno apresentou atestado.",
  geraCredito: true,
  aplicaA: "aluno",
};

const novoPlano = {
  nome: "Individual · 2x por semana",
  tipo: "Individual" as const,
  valorMensal: 1280,
  aulasPorSemana: 2,
  duracaoMinutos: 60,
  tabela: "nova" as const,
  ativo: true,
};

describe("so o dono altera configuracoes e planos", () => {
  const permissoesValidas: Permissoes = {
    ...banco.configuracoes.permissoes,
    recepcao: [...banco.configuracoes.permissoes.recepcao, "historico"],
  };

  const tentativas: Array<[string, (usuario: Colaborador) => string]> = [
    ["salvar parâmetros", (u) => recusa(salvarParametros, { prazoPagamentoReservaHoras: 48 }, banco, u)],
    ["incluir sigla", (u) => recusa(incluirSigla, novaSigla, banco, u)],
    [
      "editar sigla",
      (u) => recusa(editarSigla, { codigoAtual: "CH", sigla: { ...banco.configuracoes.siglas[0], nome: "Chuva forte" } }, banco, u),
    ],
    ["desativar sigla", (u) => recusa(desativarSigla, { codigo: "TIP" }, banco, u)],
    ["reativar sigla", (u) => recusa(reativarSigla, { codigo: "TIP" }, banco, u)],
    ["incluir plano", (u) => recusa(incluirPlano, novoPlano, banco, u)],
    ["editar plano", (u) => recusa(editarPlano, { ...plano("pl-ind"), valorMensal: 750 }, banco, u)],
    ["desativar plano", (u) => recusa(desativarPlano, { id: "pl-ind" }, banco, u)],
    ["reativar plano", (u) => recusa(reativarPlano, { id: "pl-ind" }, banco, u)],
    ["apagar plano", (u) => recusa(apagarPlano, { id: "pl-pdl" }, banco, u)],
    ["alterar permissões", (u) => recusa(alterarPermissoes, { permissoes: permissoesValidas }, banco, u)],
  ];

  it.each(tentativas)("recepção e professor não podem %s", (_, tentar) => {
    expect(tentar(recepcao)).toBe("Só o dono pode alterar as configurações.");
    expect(tentar(professor)).toBe("Só o dono pode alterar as configurações.");
  });

  it("o dono grava e a alteração vai para o histórico com quem fez", () => {
    const novo = gravar(salvarParametros, { prazoPagamentoReservaHoras: 48 });
    expect(novo.configuracoes.prazoPagamentoReservaHoras).toBe(48);
    expect(novo.auditoria).toHaveLength(1);
    expect(novo.auditoria[0]).toMatchObject({
      tabela: "configuracoes",
      acao: "alterar",
      usuarioId: dono.id,
      operacao: "Alterar configurações",
    });
  });

  it("salvar sem mudar nada não grava histórico", () => {
    const novo = gravar(salvarParametros, {
      prazoPagamentoReservaHoras: banco.configuracoes.prazoPagamentoReservaHoras,
    });
    expect(novo.auditoria).toHaveLength(0);
    expect(novo.configuracoes).toBe(banco.configuracoes);
  });
});

describe("validacoes dos parametros", () => {
  it("validade da reposição precisa ser maior que zero (meses inteiros)", () => {
    expect(recusa(salvarParametros, { validadeReposicaoMeses: 0 })).toMatch(/validade da reposição/);
    expect(recusa(salvarParametros, { validadeReposicaoMeses: 1.5 })).toMatch(/validade da reposição/);
    expect(gravar(salvarParametros, { validadeReposicaoMeses: 6 }).configuracoes.validadeReposicaoMeses).toBe(6);
  });

  it("prazos precisam ser maiores que zero", () => {
    expect(recusa(salvarParametros, { prazoPagamentoReservaHoras: 0 })).toMatch(/prazo para pagar a reserva/);
    expect(recusa(salvarParametros, { prazoPagamentoReservaHoras: -5 })).toMatch(/prazo para pagar a reserva/);
    expect(recusa(salvarParametros, { prazoPagamentoConsumoDias: 0 })).toMatch(/consumo do balcão/);
    expect(gravar(salvarParametros, { prazoPagamentoReservaHoras: 1 }).configuracoes.prazoPagamentoReservaHoras).toBe(1);
  });

  it("pontos não podem ser negativos, e a vitória vale pelo menos a derrota", () => {
    expect(recusa(salvarParametros, { pontosVitoria: -1 })).toMatch(/sem valor negativo/);
    expect(recusa(salvarParametros, { pontosDerrota: -2 })).toMatch(/sem valor negativo/);
    expect(recusa(salvarParametros, { pontosVitoria: 1, pontosDerrota: 3 })).toBe(
      "A vitória precisa valer pelo menos tanto quanto a derrota.",
    );
    const novo = gravar(salvarParametros, { pontosVitoria: 3, pontosDerrota: 0 });
    expect(novo.configuracoes).toMatchObject({ pontosVitoria: 3, pontosDerrota: 0 });
  });

  it("semanas da agenda, classificados e preços ficam dentro dos limites", () => {
    expect(recusa(salvarParametros, { semanasGeradasAFrente: 0 })).toMatch(/entre 1 e 52/);
    expect(recusa(salvarParametros, { semanasGeradasAFrente: 53 })).toMatch(/entre 1 e 52/);
    expect(recusa(salvarParametros, { classificadosPorGrupo: 0 })).toMatch(/pelo menos 1 jogador/);
    expect(recusa(salvarParametros, { precoLocacaoHora: 0 })).toMatch(/quadras precisa ser maior que zero/);
    expect(recusa(salvarParametros, { precoParedaoHora: -10 })).toMatch(/paredão precisa ser maior que zero/);
  });

  it("formas de pagamento: pelo menos uma, sem nome vazio e sem duplicata", () => {
    expect(recusa(salvarParametros, { formasPagamento: ["Stone", "Pix", " stone "] })).toBe(
      'A forma de pagamento "stone" aparece duas vezes.',
    );
    expect(recusa(salvarParametros, { formasPagamento: [] })).toBe("Informe pelo menos uma forma de pagamento.");
    expect(recusa(salvarParametros, { formasPagamento: ["Stone", "  "] })).toBe("Há uma forma de pagamento sem nome.");
    const novo = gravar(salvarParametros, { formasPagamento: [" Pix ", "Dinheiro"] });
    expect(novo.configuracoes.formasPagamento).toEqual(["Pix", "Dinheiro"]);
  });

  it("critérios de desempate só mudam de ordem", () => {
    const invertidos = [...banco.configuracoes.criteriosDesempate].reverse();
    expect(gravar(salvarParametros, { criteriosDesempate: invertidos }).configuracoes.criteriosDesempate).toEqual(invertidos);
    expect(
      recusa(salvarParametros, { criteriosDesempate: ["Vitórias", "Sorteio", "Saldo de sets", "Saldo de games"] }),
    ).toBe("Os critérios de desempate só podem mudar de ordem.");
  });
});

describe("siglas de reposicao (H1)", () => {
  it("inclui uma sigla nova com código único", () => {
    const novo = gravar(incluirSigla, { ...novaSigla, codigo: " AT " });
    expect(novo.configuracoes.siglas.at(-1)).toEqual({ ...novaSigla, codigo: "AT" });
    expect(novo.auditoria[0].operacao).toBe("Incluir sigla de reposição");
  });

  it("recusa código repetido (sem diferenciar maiúsculas), inválido ou sem nome", () => {
    expect(recusa(incluirSigla, { ...novaSigla, codigo: "ch" })).toBe('Já existe a sigla "CH". Escolha outro código.');
    expect(recusa(incluirSigla, { ...novaSigla, codigo: "C H" })).toMatch(/1 a 6 letras ou números/);
    expect(recusa(incluirSigla, { ...novaSigla, codigo: "" })).toMatch(/1 a 6 letras ou números/);
    expect(recusa(incluirSigla, { ...novaSigla, codigo: "ABCDEFG" })).toMatch(/1 a 6 letras ou números/);
    expect(recusa(incluirSigla, { ...novaSigla, nome: "  " })).toBe("Dê um nome à sigla.");
  });

  it("edita nome e crédito; o código de uma sigla já usada não muda", () => {
    const chuva = banco.configuracoes.siglas.find((s) => s.codigo === "CH")!;
    const editado = gravar(editarSigla, { codigoAtual: "CH", sigla: { ...chuva, nome: "Chuva forte" } });
    expect(editado.configuracoes.siglas.find((s) => s.codigo === "CH")?.nome).toBe("Chuva forte");

    expect(recusa(editarSigla, { codigoAtual: "CH", sigla: { ...chuva, codigo: "CHU" } })).toMatch(
      /já foi usada em aulas ou créditos/,
    );
  });

  it("o código de uma sigla ainda não usada pode mudar, desde que não repita outra", () => {
    const comNova = gravar(incluirSigla, novaSigla);
    const renomeada = gravar(editarSigla, { codigoAtual: "AT", sigla: { ...novaSigla, codigo: "ATM" } }, comNova);
    expect(renomeada.configuracoes.siglas.map((s) => s.codigo)).toContain("ATM");
    expect(recusa(editarSigla, { codigoAtual: "AT", sigla: { ...novaSigla, codigo: "FP" } }, comNova)).toBe(
      'Já existe a sigla "FP". Escolha outro código.',
    );
  });

  it("desativar tira a sigla dos formulários sem apagá-la; reativar devolve", () => {
    const desativada = gravar(desativarSigla, { codigo: "TIP" });
    expect(desativada.configuracoes.siglas.find((s) => s.codigo === "TIP")?.desativada).toBe(true);
    expect(siglasAtivas(desativada.configuracoes).map((s) => s.codigo)).not.toContain("TIP");
    expect(desativada.configuracoes.siglas).toHaveLength(banco.configuracoes.siglas.length);

    const reativada = gravar(reativarSigla, { codigo: "TIP" }, desativada);
    expect(siglasAtivas(reativada.configuracoes).map((s) => s.codigo)).toContain("TIP");
    expect(recusa(desativarSigla, { codigo: "XYZ" })).toBe("Sigla não encontrada.");
  });
});

describe("planos (H2, H3)", () => {
  it("plano com matrícula vigente não é apagado", () => {
    const vigentes = banco.matriculas.filter((m) => m.planoId === "pl-ind" && (!m.fim || m.fim >= HOJE));
    expect(vigentes.length).toBeGreaterThan(0);
    expect(recusa(apagarPlano, { id: "pl-ind" })).toMatch(/matrícula\(s\) vigente\(s\) e não pode ser apagado/);
  });

  it("plano que só aparece no histórico de matrículas também não é apagado", () => {
    const comPlano = gravar(incluirPlano, novoPlano);
    const id = comPlano.planos.at(-1)!.id;
    const comHistorico: Banco = {
      ...comPlano,
      matriculas: [
        ...comPlano.matriculas,
        { id: "mt-teste", alunoId: "a01", planoId: id, valorMensal: 1280, diaVencimento: 5, inicio: "2025-01-01", fim: "2025-06-30" },
      ],
    };
    expect(recusa(apagarPlano, { id }, comHistorico)).toMatch(/histórico de 1 matrícula/);
  });

  it("plano sem matrícula é apagado e o histórico guarda como ele era", () => {
    expect(banco.matriculas.some((m) => m.planoId === "pl-pdl")).toBe(false);
    const novo = gravar(apagarPlano, { id: "pl-pdl" });
    expect(novo.planos.some((p) => p.id === "pl-pdl")).toBe(false);
    expect(novo.auditoria[0]).toMatchObject({ tabela: "planos", acao: "apagar", registroId: "pl-pdl" });
    expect(novo.auditoria[0].antes).toEqual(plano("pl-pdl"));
  });

  it("desativar plano funciona e não mexe nas matrículas; reativar devolve", () => {
    const desativado = gravar(desativarPlano, { id: "pl-ind" });
    expect(desativado.planos.find((p) => p.id === "pl-ind")?.ativo).toBe(false);
    expect(desativado.matriculas).toBe(banco.matriculas);
    expect(desativado.auditoria[0]).toMatchObject({ tabela: "planos", acao: "alterar", operacao: "Desativar plano" });

    const reativado = gravar(reativarPlano, { id: "pl-ind" }, desativado);
    expect(reativado.planos.find((p) => p.id === "pl-ind")?.ativo).toBe(true);
  });

  it("inclui plano novo e recusa nome repetido ou números inválidos", () => {
    const novo = gravar(incluirPlano, novoPlano);
    expect(novo.planos.at(-1)).toMatchObject(novoPlano);
    expect(recusa(incluirPlano, { ...novoPlano, nome: "  LAP · 1X POR SEMANA " })).toBe(
      'Já existe um plano chamado "LAP · 1x por semana".',
    );
    expect(recusa(incluirPlano, { ...novoPlano, valorMensal: 0 })).toMatch(/valor mensal/);
    expect(recusa(incluirPlano, { ...novoPlano, aulasPorSemana: 0 })).toMatch(/entre 1 e 7/);
    expect(recusa(incluirPlano, { ...novoPlano, duracaoMinutos: 10 })).toMatch(/entre 15 e 240 minutos/);
    expect(recusa(incluirPlano, { ...novoPlano, nome: "" })).toBe("Dê um nome ao plano.");
  });

  it("mudar o valor do plano não muda o valor das matrículas (H3)", () => {
    const novo = gravar(editarPlano, { ...plano("pl-ind"), valorMensal: 800 });
    expect(novo.planos.find((p) => p.id === "pl-ind")?.valorMensal).toBe(800);
    novo.matriculas
      .filter((m) => m.planoId === "pl-ind")
      .forEach((m) => expect(m.valorMensal).toBe(720));
  });

  it("o tipo só muda em plano sem matrícula", () => {
    expect(recusa(editarPlano, { ...plano("pl-ind"), tipo: "Dupla" })).toMatch(/o tipo não pode mudar/);
    const novo = gravar(editarPlano, { ...plano("pl-pdl"), tipo: "Locação Mensal" });
    expect(novo.planos.find((p) => p.id === "pl-pdl")?.tipo).toBe("Locação Mensal");
  });
});

describe("permissoes (H9)", () => {
  const atuais = banco.configuracoes.permissoes;

  it("o dono não remove o próprio acesso às Configurações", () => {
    expect(
      recusa(alterarPermissoes, {
        permissoes: { ...atuais, dono: atuais.dono.filter((m) => m !== "configuracoes") },
      }),
    ).toBe("O dono não pode tirar o próprio acesso às Configurações.");
  });

  it("só o perfil Dono tem acesso às Configurações", () => {
    expect(
      recusa(alterarPermissoes, {
        permissoes: { ...atuais, recepcao: [...atuais.recepcao, "configuracoes"] },
      }),
    ).toBe("Só o perfil Dono pode ter acesso às Configurações.");
  });

  it("contas a pagar exigem acesso ao Financeiro", () => {
    expect(
      recusa(alterarPermissoes, {
        permissoes: { ...atuais, professor: [...atuais.professor, "financeiro_pagar"] },
      }),
    ).toBe("Para ver as contas a pagar, o perfil Professor precisa ter acesso ao Financeiro.");
  });

  it("dar o Histórico à recepção passa a valer na hora", () => {
    expect(podeAcessar(banco, recepcao, "historico")).toBe(false);
    const novo = gravar(alterarPermissoes, {
      permissoes: { ...atuais, recepcao: ["historico", ...atuais.recepcao, "historico"] },
    });
    expect(podeAcessar(novo, recepcao, "historico")).toBe(true);
    // Sem repeticao e na ordem padrao dos modulos.
    expect(novo.configuracoes.permissoes.recepcao).toEqual([...atuais.recepcao, "historico"]);
  });
});
