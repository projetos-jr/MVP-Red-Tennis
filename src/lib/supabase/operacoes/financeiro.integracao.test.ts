import { beforeAll, describe, expect, it } from "vitest";
import { HOJE } from "@/lib/banco/constantes";
import {
  anularLancamento,
  criarLancamento,
  fecharRepasseDoMes,
  gerarMensalidades,
  registrarPagamento,
} from "@/lib/banco/operacoes/financeiro";
import { mesCurto } from "@/lib/banco/regras/financeiro";
import {
  EXECUCAO,
  SEM_BANCO_DE_TESTE,
  dataDeTeste,
  entrar,
  executar,
  reler,
  type Sessao,
} from "../integracao/ambiente";

/** Mes "YYYY-MM" a `indice` meses de janeiro de `anoBase`. */
function mes(anoBase: number, indice: number): string {
  const ano = anoBase + Math.floor(indice / 12);
  return `${ano}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

/** Primeiro dia do mes seguinte ("2030-12" -> "2031-01-01"). */
function inicioDoMesSeguinte(competencia: string): string {
  const [ano, m] = competencia.split("-").map(Number);
  return m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, "0")}-01`;
}

const NUMERO_DA_EXECUCAO = Number.parseInt(EXECUCAO, 36);

describe.skipIf(SEM_BANCO_DE_TESTE)("financeiro no banco real", () => {
  let dono: Sessao;
  let recepcao: Sessao;
  let professor: Sessao;
  let alunoId: string;
  const nomeDoAluno = `Aluno Financeiro ${EXECUCAO}`;

  beforeAll(async () => {
    dono = await entrar("dono");
    recepcao = await entrar("recepcao");
    professor = await entrar("professor");

    // Aluno proprio deste teste (as cobrancas e a reserva ficam so nele).
    const { data, error } = await dono.cliente
      .from("alunos")
      .insert({ nome: nomeDoAluno })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    alunoId = (data as { id: string }).id;
    await reler(dono);
    await reler(recepcao);
  });

  /** Operacoes gravadas no historico para um registro. */
  async function operacoesNoHistorico(registroId: string): Promise<string[]> {
    const { data, error } = await dono.cliente
      .from("auditoria")
      .select("operacao")
      .eq("registro_id", registroId);
    if (error) throw new Error(error.message);
    return (data as { operacao: string }[]).map((r) => r.operacao);
  }

  it("lança, recebe e anula uma conta a receber", async () => {
    const criado = await executar(recepcao, criarLancamento, {
      tipo: "receber",
      categoria: "Aula avulsa",
      pessoaId: alunoId,
      item: `Aula avulsa ${EXECUCAO}`,
      valor: 85.5,
      vencimento: HOJE,
    });
    expect(criado).toMatchObject({ ok: true });
    const id = criado.ok ? criado.id : undefined;
    expect(id).toBeTruthy();
    expect(recepcao.banco.lancamentos.find((l) => l.id === id)).toMatchObject({
      tipo: "receber",
      categoria: "Aula avulsa",
      pessoaId: alunoId,
      pessoaTipo: "aluno",
      nomePagante: nomeDoAluno,
      valor: 85.5,
      vencimento: HOJE,
    });

    const pago = await executar(recepcao, registrarPagamento, {
      id: id!,
      pagoEm: HOJE,
      formaPagamento: "Dinheiro",
      nomePagante: "Mãe do aluno",
    });
    expect(pago).toMatchObject({ ok: true, id });
    expect(recepcao.banco.lancamentos.find((l) => l.id === id)).toMatchObject({
      pagoEm: HOJE,
      formaPagamento: "Dinheiro",
      nomePagante: "Mãe do aluno",
    });

    // O banco recusa pagar duas vezes, mesmo burlando a tela.
    const deNovo = await recepcao.cliente.rpc("registrar_pagamento", {
      p_id: id,
      p_pago_em: HOJE,
      p_forma_pagamento: "Stone",
    });
    expect(deNovo.error?.message).toContain("já foi pago");

    const anulado = await executar(recepcao, anularLancamento, { id: id!, motivo: "Lançado por engano" });
    expect(anulado.ok).toBe(true);
    const depois = recepcao.banco.lancamentos.find((l) => l.id === id);
    expect(depois?.canceladoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(depois?.motivoCancelamento).toBe("Lançado por engano");

    expect(await operacoesNoHistorico(id!)).toEqual(
      expect.arrayContaining(["Novo lançamento", "Registrar pagamento", "Anular lançamento"]),
    );
  });

  it("o banco recusa valor zero e conta a pagar sem permissão", async () => {
    const zero = await recepcao.cliente.rpc("criar_lancamento", {
      p_tipo: "receber",
      p_categoria: "Outros",
      p_item: `Zero ${EXECUCAO}`,
      p_valor: 0,
      p_vencimento: HOJE,
      p_nome_pagante: "Alguém",
    });
    expect(zero.error?.message).toBe("O valor precisa ser maior que zero.");

    // A recepcao nao lanca contas a pagar: a tela recusa...
    const despesa = {
      tipo: "pagar" as const,
      categoria: "Despesa" as const,
      nomePagante: "Companhia de luz",
      item: `Conta de luz ${EXECUCAO}`,
      valor: 300,
      vencimento: HOJE,
    };
    expect(await executar(recepcao, criarLancamento, despesa)).toMatchObject({
      ok: false,
      erro: "Seu perfil não tem acesso às contas a pagar.",
    });
    // ...e o banco tambem.
    const direto = await recepcao.cliente.rpc("criar_lancamento", {
      p_tipo: "pagar",
      p_categoria: "Despesa",
      p_item: despesa.item,
      p_valor: 300,
      p_vencimento: HOJE,
      p_nome_pagante: despesa.nomePagante,
    });
    expect(direto.error?.message).toBe("Seu perfil não tem permissão para esta operação.");

    // O professor nao mexe no financeiro.
    const doProfessor = await professor.cliente.rpc("criar_lancamento", {
      p_tipo: "receber",
      p_categoria: "Outros",
      p_item: `Professor ${EXECUCAO}`,
      p_valor: 10,
      p_vencimento: HOJE,
      p_nome_pagante: "Alguém",
    });
    expect(doProfessor.error).not.toBeNull();
  });

  it("pagar a cobrança de uma reserva confirma a reserva na agenda", async () => {
    // Locacao avulsa: nasce "aguardando pagamento", com a cobranca ligada.
    let reservaId: string | undefined;
    for (let tentativa = 0; tentativa < 15 && !reservaId; tentativa++) {
      const { data, error } = await dono.cliente.rpc("criar_horario_avulso", {
        p_quadra_id: "paredao",
        p_data: dataDeTeste(300 + tentativa * 7),
        p_hora_inicio: "21:00",
        p_hora_fim: "22:00",
        p_tipo: "Locação Avulsa",
        p_alunos_ids: [alunoId],
      });
      if (!error) reservaId = data as string;
    }
    expect(reservaId).toBeTruthy();
    await reler(recepcao);
    const cobranca = recepcao.banco.lancamentos.find((l) => l.ocupacaoId === reservaId);
    expect(cobranca).toMatchObject({ categoria: "Locação", pessoaId: alunoId });

    // Anular a cobranca de uma reserva que aguarda pagamento: o banco recusa.
    const anular = await recepcao.cliente.rpc("anular_lancamento", {
      p_id: cobranca!.id,
      p_motivo: "Teste",
    });
    expect(anular.error?.message).toContain("ainda aguarda pagamento");

    const pago = await executar(recepcao, registrarPagamento, {
      id: cobranca!.id,
      pagoEm: HOJE,
      formaPagamento: "Stone",
    });
    expect(pago).toMatchObject({ ok: true, id: cobranca!.id });
    expect(recepcao.banco.ocupacoes.find((o) => o.id === reservaId)?.situacao).toBe("agendada");
    expect(recepcao.banco.lancamentos.find((l) => l.id === cobranca!.id)?.pagoEm).toBe(HOJE);
  });

  it("gera as mensalidades de um mês futuro sem duplicar", async () => {
    // Um mes de 2030 em diante, so desta execucao (sem nenhum lancamento).
    let competencia = "";
    for (let i = NUMERO_DA_EXECUCAO % 600; !competencia; i++) {
      const candidata = mes(2030, i);
      const { count, error } = await recepcao.cliente
        .from("lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("competencia", candidata);
      if (error) throw new Error(error.message);
      if (count === 0) competencia = candidata;
    }

    // O professor nao gera mensalidades (nem pela tela, nem direto no banco).
    expect((await executar(professor, gerarMensalidades, { competencia })).ok).toBe(false);
    expect((await professor.cliente.rpc("gerar_mensalidades", { p_competencia: competencia })).error).not.toBeNull();

    const gerado = await executar(recepcao, gerarMensalidades, { competencia });
    expect(gerado.ok).toBe(true);
    const doMes = () =>
      recepcao.banco.lancamentos.filter(
        (l) => l.categoria === "Mensalidade" && l.competencia === competencia,
      );
    const criadas = doMes();
    expect(criadas.length).toBeGreaterThan(0);
    const matriculas = new Map(recepcao.banco.matriculas.map((m) => [m.id, m]));
    for (const l of criadas) {
      const matricula = matriculas.get(l.matriculaId ?? "");
      expect(matricula).toBeDefined();
      expect(l).toMatchObject({
        tipo: "receber",
        pessoaId: matricula!.alunoId,
        pessoaTipo: "aluno",
        valor: matricula!.valorMensal,
      });
      expect(l.vencimento.startsWith(competencia)).toBe(true);
      expect(l.item.startsWith(`Mensalidade ${mesCurto(competencia)}`)).toBe(true);
      expect(l.pagoEm).toBeUndefined();
    }
    // Uma por matricula.
    expect(new Set(criadas.map((l) => l.matriculaId)).size).toBe(criadas.length);

    // De novo: nada a criar (pela tela e direto no banco).
    expect((await executar(recepcao, gerarMensalidades, { competencia })).ok).toBe(true);
    expect(doMes()).toHaveLength(criadas.length);
    const direto = await recepcao.cliente.rpc("gerar_mensalidades", { p_competencia: competencia });
    expect(direto.data).toEqual({ criadas: 0, ja_geradas: criadas.length });
  });

  it("fecha o repasse de um mês terminado, descontando o adiantamento, uma vez só", async () => {
    // Um mes passado (1990–2019) sem aulas nem repasses: so desta execucao.
    let competencia = "";
    for (let i = NUMERO_DA_EXECUCAO % 360; !competencia; i = (i + 1) % 360) {
      const candidata = mes(1990, i);
      const aulas = await dono.cliente
        .from("ocupacoes")
        .select("id", { count: "exact", head: true })
        .gte("data", `${candidata}-01`)
        .lt("data", inicioDoMesSeguinte(candidata));
      const repasses = await dono.cliente
        .from("repasses")
        .select("id", { count: "exact", head: true })
        .eq("competencia", candidata);
      if (aulas.error || repasses.error) throw new Error((aulas.error ?? repasses.error)!.message);
      if (aulas.count === 0 && repasses.count === 0) competencia = candidata;
    }

    // Uma aula de 1 hora dada pelo prof-1 nesse mes.
    const aula = await dono.cliente.from("ocupacoes").insert({
      quadra_id: "1",
      data: `${competencia}-10`,
      hora_inicio: "08:00",
      hora_fim: "09:00",
      tipo: "Individual",
      professor_id: "prof-1",
      situacao: "realizada",
    });
    expect(aula.error).toBeNull();

    // Adiantamento lancado a mao: o fechamento lanca so o que falta.
    const adiantamento = await executar(dono, criarLancamento, {
      tipo: "pagar",
      categoria: "Repasse",
      pessoaId: "prof-1",
      item: `Adiantamento ${EXECUCAO}`,
      valor: 20,
      vencimento: HOJE,
      competencia,
    });
    expect(adiantamento).toMatchObject({ ok: true });
    expect(dono.banco.lancamentos.find((l) => l.id === (adiantamento.ok && adiantamento.id))).toMatchObject({
      pessoaTipo: "professor",
      competencia,
      valor: 20,
    });
    await reler(dono);
    await reler(recepcao);

    // A recepcao nao fecha repasse: a tela recusa, e o banco tambem.
    const dados = { competencia, vencimento: HOJE };
    expect(await executar(recepcao, fecharRepasseDoMes, dados)).toMatchObject({
      ok: false,
      erro: "Seu perfil não tem acesso às contas a pagar.",
    });
    const direto = await recepcao.cliente.rpc("fechar_repasse_do_mes", {
      p_competencia: competencia,
      p_vencimento: HOJE,
    });
    expect(direto.error?.message).toBe("Seu perfil não tem permissão para esta operação.");

    const fechado = await executar(dono, fecharRepasseDoMes, dados);
    expect(fechado.ok).toBe(true);
    const valorDaHora = dono.banco.professores.find((p) => p.id === "prof-1")!.repasse.valor;
    const repasse = dono.banco.repasses.find(
      (r) => r.professorId === "prof-1" && r.competencia === competencia,
    );
    expect(repasse).toMatchObject({ aulasDadas: 1, minutosDados: 60, valorPrevisto: valorDaHora });
    expect(dono.banco.repasses.filter((r) => r.competencia === competencia)).toHaveLength(1);
    const conta = dono.banco.lancamentos.find((l) => l.repasseId === repasse!.id);
    expect(conta).toMatchObject({
      tipo: "pagar",
      categoria: "Repasse",
      pessoaId: "prof-1",
      competencia,
      vencimento: HOJE,
      valor: Math.round((valorDaHora - 20) * 100) / 100,
      item: `Repasse ${mesCurto(competencia)} · 1 aulas`,
    });

    // Fechado, nao fecha de novo (a tela recusa; o banco tambem).
    const deNovo = await executar(dono, fecharRepasseDoMes, dados);
    expect(deNovo).toMatchObject({ ok: false });
    expect(!deNovo.ok && deNovo.erro).toContain("já foi fechado");
    const deNovoDireto = await dono.cliente.rpc("fechar_repasse_do_mes", {
      p_competencia: competencia,
      p_vencimento: HOJE,
    });
    expect(deNovoDireto.error?.message).toContain("já foi fechado");
  });
});
