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

  it("avisa possível duplicado pelo nome (sem acento) ou pelo e-mail", () => {
    expect(possiveisDuplicados(banco, { nome: "  joão   XUXA " }).map((d) => d.aluno.id)).toEqual(["a23"]);
    expect(
      possiveisDuplicados(banco, { nome: "Outra Pessoa", email: "GUILHERME.LIMA@email.com" }),
    ).toMatchObject([{ aluno: { id: "a01" }, mesmoNome: false, mesmoEmail: true }]);
    expect(possiveisDuplicados(banco, { nome: "Guilherme Lima" }, "a01")).toEqual([]);
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
