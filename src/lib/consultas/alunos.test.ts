/**
 * Testes das consultas de alunos e professores sobre os dados de exemplo.
 */

import { describe, expect, it } from "vitest";
import { HOJE } from "../banco/constantes";
import { executarOperacao } from "../banco/executar";
import { somarDias } from "../date";
import { congelarPlano } from "../banco/operacoes/alunos";
import { gerarBancoInicial } from "../banco/semente";
import {
  aulasDoAluno,
  filtrarAlunos,
  historicoDeAulas,
  idsDosAlunosDoProfessor,
  linhasDaListaDeAlunos,
  pagamentosDoAluno,
  possiveisDuplicados,
  previaDaReativacao,
  previaDoCongelamento,
  resumoDoAluno,
  ROTULO_CATEGORIA,
} from "./alunos";
import { agendaDaSemana, repassesDoProfessor } from "./professores";

// Os dados de exemplo sao ancorados em HOJE; as datas do teste tambem.
const banco = gerarBancoInicial();
const INICIO = somarDias(HOJE, 4);
const FIM = somarDias(HOJE, 32);
const VOLTA = somarDias(HOJE, 18);
const filtroVazio = { busca: "", plano: "todos", professor: "todos", situacao: "todas" as const };

describe("lista de alunos", () => {
  const linhas = linhasDaListaDeAlunos(banco, HOJE);

  it("conta cada situação e filtra por ela", () => {
    const todos = filtrarAlunos(banco, linhas, filtroVazio, HOJE);
    const { ativo, congelado, avulso, inativo } = todos.contagem;
    expect(ativo + congelado + avulso + inativo).toBe(banco.alunos.length);
    expect(congelado).toBeGreaterThan(0);
    const congelados = filtrarAlunos(banco, linhas, { ...filtroVazio, situacao: "congelado" }, HOJE);
    expect(congelados.linhas).toHaveLength(congelado);
    expect(congelados.linhas.every((l) => l.situacao === "congelado")).toBe(true);
  });

  it("busca sem acento, por telefone e combina com plano e professor", () => {
    const porNome = filtrarAlunos(banco, linhas, { ...filtroVazio, busca: "joao xuxa" }, HOJE);
    expect(porNome.linhas.map((l) => l.aluno.nome)).toEqual(["João Xuxa"]);
    const porTelefone = filtrarAlunos(banco, linhas, { ...filtroVazio, busca: "98812-4471" }, HOJE);
    expect(porTelefone.linhas.map((l) => l.aluno.id)).toEqual(["a01"]);
    const dupla = filtrarAlunos(
      banco,
      linhas,
      { ...filtroVazio, plano: "tipo:Dupla", professor: "prof-3" },
      HOJE,
    );
    expect(dupla.linhas.length).toBeGreaterThan(0);
    dupla.linhas.forEach((l) => {
      expect(l.plano?.tipo).toBe("Dupla");
      expect(l.aluno.professorPrincipalId).toBe("prof-3");
    });
  });

  it("perfil de professor (H9) vê só os próprios alunos", () => {
    const daRenata = filtrarAlunos(banco, linhas, { ...filtroVazio, soDoProfessorId: "prof-2" }, HOJE);
    const ids = idsDosAlunosDoProfessor(banco, "prof-2", HOJE);
    expect(daRenata.linhas.length).toBe(ids.size);
    expect(daRenata.linhas.length).toBeLessThan(banco.alunos.length);
    const principais = banco.alunos.filter((a) => a.professorPrincipalId === "prof-2");
    principais.forEach((a) => expect(ids.has(a.id)).toBe(true));
  });

  it("busca por pedaços do nome, como a busca rápida (?busca=)", () => {
    const resultado = filtrarAlunos(banco, linhas, { ...filtroVazio, busca: "gui lim" }, HOJE);
    expect(resultado.linhas.map((l) => l.aluno.id)).toContain("a01");
    resultado.linhas.forEach((l) => {
      expect(l.chaveDeBusca).toContain("gui");
      expect(l.chaveDeBusca).toContain("lim");
    });
  });

  it("avisa possível duplicado pelo nome (sem acento) ou pelo e-mail", () => {
    expect(possiveisDuplicados(banco, { nome: "  joão   XUXA " }).map((d) => d.aluno.id)).toEqual(["a23"]);
    expect(
      possiveisDuplicados(banco, { nome: "Outra Pessoa", email: "GUILHERME.LIMA@email.com" }),
    ).toMatchObject([{ aluno: { id: "a01" }, mesmoNome: false, mesmoEmail: true }]);
    expect(possiveisDuplicados(banco, { nome: "Guilherme Lima" }, "a01")).toEqual([]);
  });
});

describe("clientes: estado e grupos (H15)", () => {
  const linhas = linhasDaListaDeAlunos(banco, HOJE);
  const porId = new Map(linhas.map((l) => [l.aluno.id, l]));

  it("Ativos, Inativos e Todos separam pelo cadastro e contam cada um", () => {
    // Nos dados de exemplo ninguem saiu da arena: inativa um aluno so para o teste.
    const comInativo = {
      ...banco,
      alunos: banco.alunos.map((a) => (a.id === "a01" ? { ...a, ativo: false } : a)),
    };
    const todas = linhasDaListaDeAlunos(comInativo, HOJE);
    const ativos = filtrarAlunos(comInativo, todas, { ...filtroVazio, estado: "ativos" }, HOJE);
    const inativos = filtrarAlunos(comInativo, todas, { ...filtroVazio, estado: "inativos" }, HOJE);
    const todos = filtrarAlunos(comInativo, todas, { ...filtroVazio, estado: "todos" }, HOJE);

    expect(inativos.linhas.map((l) => l.aluno.id)).toEqual(["a01"]);
    expect(ativos.linhas.some((l) => l.aluno.id === "a01")).toBe(false);
    expect(ativos.linhas.every((l) => l.situacao !== "inativo")).toBe(true);
    expect(todos.linhas).toHaveLength(banco.alunos.length);
    // Os botoes mostram as tres contagens, qualquer que seja o escolhido.
    expect(ativos.porEstado).toEqual({
      ativos: banco.alunos.length - 1,
      inativos: 1,
      todos: banco.alunos.length,
    });
    expect(inativos.porEstado).toEqual(ativos.porEstado);
    // Sem o campo, nao filtra (o teste antigo usa o filtro de 4 campos).
    expect(filtrarAlunos(comInativo, todas, filtroVazio, HOJE).linhas).toHaveLength(banco.alunos.length);
  });

  it("cada grupo segue a regra da hipótese H15", () => {
    const inscritos = new Set(banco.torneioInscritos.flatMap((i) => i.alunosIds));
    linhas.forEach((l) => {
      expect(l.categorias.includes("ranking")).toBe(l.aluno.inscritoRanking);
      expect(l.categorias.includes("alunos")).toBe(
        ["Individual", "Dupla", "LAP"].includes(l.plano?.tipo ?? ""),
      );
      expect(l.categorias.includes("torneio")).toBe(inscritos.has(l.aluno.id));
      if (l.plano?.tipo === "Locação Mensal" || l.plano?.tipo === "Plano de locação") {
        expect(l.categorias).toContain("aluguel");
      }
    });

    for (const categoria of ["ranking", "alunos", "aluguel", "torneio"] as const) {
      const resultado = filtrarAlunos(banco, linhas, { ...filtroVazio, categoria }, HOJE);
      expect(resultado.linhas.length).toBeGreaterThan(0);
      expect(resultado.linhas.every((l) => l.categorias.includes(categoria))).toBe(true);
      expect(resultado.porCategoria[categoria]).toBe(resultado.linhas.length);
      expect(resultado.porCategoria.todas).toBe(banco.alunos.length);
    }
    expect(ROTULO_CATEGORIA.aluguel).toBe("Aluguel");
  });

  it("locatário avulso (sem plano) entra em Aluguel; convidado e locação cancelada não", () => {
    // Lucas Freitas aluga quadra avulsa, sem plano mensal.
    expect(porId.get("a20")?.plano).toBeUndefined();
    expect(porId.get("a20")?.categorias).toContain("aluguel");

    const novo = { ...banco.alunos[0], id: "x-1", nome: "Cliente Novo", inscritoRanking: false };
    const locacao = {
      id: "oc-x-1",
      quadraId: "2" as const,
      data: HOJE,
      horaInicio: "20:00",
      horaFim: "21:00",
      tipo: "Locação Avulsa" as const,
      situacao: "cancelada" as const,
      criadoEm: `${HOJE}T08:00:00`,
    };
    const participantes = [
      { id: "pa-x-1", ocupacaoId: "oc-x-1", alunoId: "x-1", presenca: "a_marcar" as const },
      { id: "pa-x-2", ocupacaoId: "oc-x-1", alunoId: "b04", presenca: "a_marcar" as const },
    ];
    const montar = (situacao: "cancelada" | "agendada") => {
      const outro = {
        ...banco,
        alunos: [...banco.alunos, novo],
        ocupacoes: [...banco.ocupacoes, { ...locacao, situacao }],
        ocupacaoAlunos: [...banco.ocupacaoAlunos, ...participantes],
      };
      return new Map(linhasDaListaDeAlunos(outro, HOJE).map((l) => [l.aluno.id, l.categorias]));
    };

    expect(montar("cancelada").get("x-1")).toEqual([]);
    const agendada = montar("agendada");
    expect(agendada.get("x-1")).toEqual(["aluguel"]);
    // O segundo da lista e convidado: continua so no grupo que ja tinha.
    expect(agendada.get("b04")).toEqual(porId.get("b04")?.categorias);
  });

  it("combina estado, grupo, plano e busca; cada contagem ignora só o próprio filtro", () => {
    const filtro = { ...filtroVazio, estado: "ativos" as const, categoria: "aluguel" as const, plano: "sem" };
    const semPlano = filtrarAlunos(banco, linhas, filtro, HOJE);
    expect(semPlano.linhas.length).toBeGreaterThan(1);
    semPlano.linhas.forEach((l) => {
      expect(l.plano).toBeUndefined();
      expect(l.categorias).toContain("aluguel");
      expect(l.situacao).not.toBe("inativo");
    });

    const comBusca = filtrarAlunos(banco, linhas, { ...filtro, busca: "caio" }, HOJE);
    expect(comBusca.linhas.length).toBeGreaterThan(0);
    expect(comBusca.linhas.length).toBeLessThan(semPlano.linhas.length);
    comBusca.linhas.forEach((l) => expect(l.chaveDeBusca).toContain("caio"));

    // Pilulas: plano "sem" e estado aplicados, grupo nao.
    const semGrupo = filtrarAlunos(banco, linhas, { ...filtro, categoria: "todas" }, HOJE);
    expect(semPlano.porCategoria.todas).toBe(semGrupo.linhas.length);
    expect(semPlano.porCategoria.aluguel).toBe(semPlano.linhas.length);
    // Ativos/Inativos/Todos: grupo e plano aplicados, estado nao.
    expect(semPlano.porEstado.todos).toBe(
      filtrarAlunos(banco, linhas, { ...filtro, estado: "todos" }, HOJE).linhas.length,
    );
    // Situacao continua valendo junto (?situacao= no endereco).
    const congelados = filtrarAlunos(
      banco,
      linhas,
      { ...filtroVazio, estado: "ativos", situacao: "congelado", categoria: "alunos" },
      HOJE,
    );
    expect(congelados.linhas.length).toBeGreaterThan(0);
    congelados.linhas.forEach((l) => {
      expect(l.situacao).toBe("congelado");
      expect(l.categorias).toContain("alunos");
    });
  });
});

describe("ficha do aluno", () => {
  it("pagamentos: só da própria pessoa e sem o consumo do balcão", () => {
    const { lista, totalPago, emAberto } = pagamentosDoAluno(banco, "a01", HOJE);
    expect(lista.length).toBeGreaterThan(0);
    lista.forEach(({ lancamento }) => {
      expect(lancamento.pessoaId).toBe("a01");
      expect(lancamento.tipo).toBe("receber");
      expect(lancamento.categoria).not.toBe("Consumo");
    });
    expect(totalPago + emAberto).toBeGreaterThan(0);
  });

  it("histórico de aulas vai até hoje, da mais recente para a mais antiga", () => {
    const historico = historicoDeAulas(aulasDoAluno(banco, "a01"), HOJE);
    expect(historico.length).toBeGreaterThan(10);
    expect(historico.every((a) => a.ocupacao.data <= HOJE)).toBe(true);
    expect(historico[0].ocupacao.data >= historico[historico.length - 1].ocupacao.data).toBe(true);
  });

  it("prévia do congelamento e da volta batem com o que a operação faz", () => {
    const previa = previaDoCongelamento(banco, "a01", INICIO, FIM);
    expect(previa.matricula?.alunoId).toBe("a01");
    expect(previa.suspensas.length).toBeGreaterThan(0);

    const ctx = { usuario: banco.colaboradores[1], agora: `${HOJE}T10:00:00`, hoje: HOJE };
    const resultado = executarOperacao(
      banco,
      congelarPlano,
      { alunoId: "a01", inicio: INICIO, fimPrevisto: FIM, motivo: "Viagem" },
      ctx,
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const depois = resultado.banco;
    const congelamento = depois.congelamentos.at(-1)!;
    expect(congelamento.aulasSuspensas).toHaveLength(previa.suspensas.length);
    expect(resumoDoAluno(depois, "a01", HOJE)?.congelamentoAgendado?.id).toBe(congelamento.id);

    // Desmarcar hoje: tudo volta; voltar no meio do periodo: so a segunda metade.
    expect(previaDaReativacao(depois, congelamento.id, HOJE, HOJE)).toMatchObject({
      cancela: true,
      naoVoltam: [],
    });
    const metade = previaDaReativacao(depois, congelamento.id, VOLTA, HOJE)!;
    expect(metade.cancela).toBe(false);
    expect(metade.fimReal).toBe(somarDias(VOLTA, -1));
    expect(metade.voltam.every((a) => a.ocupacao.data >= VOLTA)).toBe(true);
    expect(metade.voltam.length + metade.continuamSuspensas).toBe(previa.suspensas.length);
  });
});

describe("professores", () => {
  it("agenda da semana sai das ocupações reais e repasse compara previsto x pago", () => {
    const semana = agendaDaSemana(banco, "prof-1", HOJE);
    expect(semana.dias).toHaveLength(7);
    expect(semana.aulas).toBeGreaterThan(0);

    const repasses = repassesDoProfessor(banco, "prof-1", HOJE);
    expect(repasses[0]).toMatchObject({ competencia: HOJE.slice(0, 7), situacao: "em_andamento" });
    // O fechamento mais antigo da semente ja foi pago (o do mes passado pode ainda nao ter vencido).
    const fechado = repasses.filter((r) => r.situacao === "fechado").at(-1)!;
    expect(fechado.pago).toBe(fechado.previsto);
    expect(fechado.diferenca).toBe(0);
  });
});
