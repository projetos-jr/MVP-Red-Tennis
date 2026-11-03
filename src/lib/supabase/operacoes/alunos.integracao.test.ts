import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOJE } from "@/lib/banco/constantes";
import {
  cadastrarAluno,
  cancelarMatriculaAgendada,
  congelarPlano,
  corrigirMatricula,
  criarMatricula,
  editarAluno,
  encerrarMatricula,
  inativarAluno,
  reativarCadastro,
  reativarPlano,
  trocarPlano,
} from "@/lib/banco/operacoes/alunos";
import { cadastrarProfessor, editarProfessor } from "@/lib/banco/operacoes/professores";
import type { Aluno, Professor } from "@/lib/banco/tipos";
import { somarDias } from "@/lib/date";
import {
  EXECUCAO,
  SEM_BANCO_DE_TESTE,
  dataDeTeste,
  entrar,
  executar,
  reler as relerUmaVez,
  type Sessao,
} from "../integracao/ambiente";

/**
 * O banco local e dividido com os testes de outros modulos: com todos lendo
 * ao mesmo tempo, a fila de conexoes do banco as vezes estoura. Tenta de novo.
 */
async function comPaciencia<T>(fazer: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await fazer();
    } catch (erro) {
      if (tentativa >= 6 || !String(erro).includes("Timed out acquiring connection")) throw erro;
      await new Promise((pronto) => setTimeout(pronto, 2000 * tentativa));
    }
  }
}

const reler = (sessao: Sessao) => comPaciencia(() => relerUmaVez(sessao));

/**
 * Alunos e professores gravando no banco real. Cada execucao cria os proprios
 * alunos, professores e aulas (nomes com EXECUCAO, datas de `dataDeTeste`
 * entre 100 e 199), entao pode rodar varias vezes no mesmo banco.
 */
describe.skipIf(SEM_BANCO_DE_TESTE)("alunos e professores no banco real", { timeout: 120_000 }, () => {
  let dono: Sessao;
  let recepcao: Sessao;
  let professor: Sessao;
  /** Aulas criadas pelo teste (canceladas no fim, para liberar as quadras). */
  const aulasDoTeste: string[] = [];
  let contador = 0;

  beforeAll(async () => {
    // Um de cada vez: o banco local e dividido com outros testes.
    dono = await comPaciencia(() => entrar("dono"));
    recepcao = await comPaciencia(() => entrar("recepcao"));
    professor = await comPaciencia(() => entrar("professor"));
  }, 180_000);

  afterAll(async () => {
    if (!recepcao || aulasDoTeste.length === 0) return;
    await recepcao.cliente
      .from("ocupacoes")
      .update({ situacao: "cancelada", motivo_cancelamento: "Fim do teste", cancelada_em: new Date().toISOString() })
      .in("id", aulasDoTeste)
      .neq("situacao", "cancelada");
  });

  function idDoTeste(prefixo: string): string {
    contador += 1;
    return `${prefixo}-t${EXECUCAO}${contador}`;
  }

  /** Cadastra um aluno pela tela (grava direto) e devolve o registro relido. */
  async function novoAluno(sessao: Sessao, nome: string): Promise<Aluno> {
    const id = idDoTeste("al");
    const resultado = await executar(sessao, cadastrarAluno, {
      id,
      nome: `${nome} ${EXECUCAO}`,
      telefone: "(11) 98888-7777",
      email: `${nome.toLowerCase()}.${EXECUCAO}@teste.local`,
      inscritoRanking: false,
    });
    expect(resultado).toMatchObject({ ok: true, id });
    const aluno = sessao.banco.alunos.find((a) => a.id === id);
    expect(aluno).toBeDefined();
    return aluno!;
  }

  async function matricular(sessao: Sessao, alunoId: string): Promise<string> {
    const resultado = await executar(sessao, criarMatricula, {
      alunoId,
      planoId: "pl-ind",
      valorMensal: 300,
      diaVencimento: 10,
      inicio: HOJE,
    });
    expect(resultado.ok).toBe(true);
    return (resultado as { id: string }).id;
  }

  /**
   * Prepara na agenda (gravando direto, como apoio do teste) um horario fixo
   * com uma aula por data, numa quadra livre. Devolve os ids das aulas.
   */
  async function aulasFixas(alunoIds: string[], datas: string[]) {
    const cliente = recepcao.cliente;
    const horarioFixoId = idDoTeste("hf");
    const primeira = datas[0];
    const ocupadas = await cliente
      .from("ocupacoes")
      .select("quadra_id, hora_inicio, data")
      .in("data", datas)
      .neq("situacao", "cancelada");
    expect(ocupadas.error).toBeNull();
    const usados = new Set((ocupadas.data ?? []).map((o) => `${o.quadra_id}|${String(o.hora_inicio).slice(0, 2)}`));

    for (const quadra of ["4", "3", "2", "1"]) {
      for (let hora = 7; hora <= 20; hora += 1) {
        if (usados.has(`${quadra}|${String(hora).padStart(2, "0")}`)) continue;
        const inicio = `${String(hora).padStart(2, "0")}:00`;
        const fim = `${String(hora + 1).padStart(2, "0")}:00`;
        const fixo = await cliente.from("horarios_fixos").insert({
          id: horarioFixoId,
          quadra_id: quadra,
          dia_semana: new Date(`${primeira}T12:00:00Z`).getUTCDay(),
          hora_inicio: inicio,
          hora_fim: fim,
          tipo: alunoIds.length > 1 ? "Dupla" : "Individual",
          professor_id: "prof-2",
          inicio: primeira,
        });
        expect(fixo.error).toBeNull();
        const ids = datas.map(() => idDoTeste("oc"));
        const aulas = await cliente.from("ocupacoes").insert(
          datas.map((data, i) => ({
            id: ids[i],
            quadra_id: quadra,
            data,
            hora_inicio: inicio,
            hora_fim: fim,
            tipo: alunoIds.length > 1 ? "Dupla" : "Individual",
            professor_id: "prof-2",
            horario_fixo_id: horarioFixoId,
          })),
        );
        if (aulas.error?.code === "23P01") {
          // Alguem ocupou a quadra agora: tenta o proximo horario.
          await cliente.from("horarios_fixos").delete().eq("id", horarioFixoId);
          continue;
        }
        expect(aulas.error).toBeNull();
        aulasDoTeste.push(...ids);
        const vinculos = await cliente
          .from("horario_alunos")
          .insert(alunoIds.map((aluno_id) => ({ horario_fixo_id: horarioFixoId, aluno_id })));
        expect(vinculos.error).toBeNull();
        const presencas = await cliente
          .from("ocupacao_alunos")
          .insert(ids.flatMap((ocupacao_id) => alunoIds.map((aluno_id) => ({ ocupacao_id, aluno_id }))));
        expect(presencas.error).toBeNull();
        return { horarioFixoId, ids, quadra, inicio, fim };
      }
    }
    throw new Error("Nenhuma quadra livre para o teste.");
  }

  // -------------------------------------------------------------------------
  // Cadastro e matricula
  // -------------------------------------------------------------------------

  it("cadastra (com o id da tela), edita e guarda o nome da operação no histórico", async () => {
    const aluno = await novoAluno(recepcao, "Cadastro");
    const editado = await executar(recepcao, editarAluno, {
      id: aluno.id,
      nome: aluno.nome,
      telefone: "(11) 97777-6666",
      email: "",
      inscritoRanking: true,
      categoriaRanking: "C",
    });
    expect(editado.ok).toBe(true);
    const depois = recepcao.banco.alunos.find((a) => a.id === aluno.id);
    expect(depois).toMatchObject({ telefone: "(11) 97777-6666", email: "", inscritoRanking: true, categoriaRanking: "C" });
    expect(depois?.criadoEm).toBe(aluno.criadoEm);

    // Historico (so o dono le): quem fez e o nome da operacao, nas gravacoes diretas.
    const { data: historico, error } = await dono.cliente
      .from("auditoria")
      .select("acao, operacao, usuario_nome, antes, depois")
      .eq("tabela", "alunos")
      .eq("registro_id", aluno.id)
      .order("id");
    expect(error).toBeNull();
    expect(historico?.map((r) => [r.acao, r.operacao, r.usuario_nome])).toEqual([
      ["criar", "Cadastrar aluno", "Recepção Local"],
      ["alterar", "Editar cadastro do aluno", "Recepção Local"],
    ]);
  });

  it("matrícula: cria, troca de plano, desmarca a troca, corrige e encerra", async () => {
    const aluno = await novoAluno(recepcao, "Matricula");
    const m1 = await matricular(recepcao, aluno.id);
    expect(recepcao.banco.matriculas.find((m) => m.id === m1)).toMatchObject({
      alunoId: aluno.id,
      planoId: "pl-ind",
      valorMensal: 300,
      diaVencimento: 10,
      inicio: HOJE,
    });

    const troca = somarDias(HOJE, 30);
    const trocado = await executar(recepcao, trocarPlano, {
      matriculaId: m1,
      planoId: "pl-dup",
      valorMensal: 250,
      diaVencimento: 5,
      inicio: troca,
    });
    expect(trocado.ok).toBe(true);
    const m2 = (trocado as { id: string }).id;
    expect(m2).not.toBe(m1);
    expect(recepcao.banco.matriculas.find((m) => m.id === m1)?.fim).toBe(somarDias(troca, -1));
    expect(recepcao.banco.matriculas.find((m) => m.id === m2)).toMatchObject({ planoId: "pl-dup", inicio: troca });

    const desmarcado = await executar(recepcao, cancelarMatriculaAgendada, { matriculaId: m2 });
    expect(desmarcado).toMatchObject({ ok: true, id: undefined });
    expect(recepcao.banco.matriculas.some((m) => m.id === m2)).toBe(false);
    expect(recepcao.banco.matriculas.find((m) => m.id === m1)?.fim).toBeUndefined();

    expect((await executar(recepcao, corrigirMatricula, { matriculaId: m1, valorMensal: 280.5, diaVencimento: 15 })).ok).toBe(true);
    expect(recepcao.banco.matriculas.find((m) => m.id === m1)).toMatchObject({ valorMensal: 280.5, diaVencimento: 15 });

    const ultimoDia = somarDias(HOJE, 10);
    expect((await executar(recepcao, encerrarMatricula, { matriculaId: m1, ultimoDia })).ok).toBe(true);
    expect(recepcao.banco.matriculas.find((m) => m.id === m1)?.fim).toBe(ultimoDia);

    // O banco recusa duas matriculas no mesmo periodo, mesmo burlando a tela.
    const { error } = await recepcao.cliente.rpc("criar_matricula", {
      p_aluno_id: aluno.id,
      p_plano_id: "pl-ind",
      p_valor_mensal: 300,
      p_dia_vencimento: 10,
      p_inicio: somarDias(HOJE, 5),
    });
    expect(error?.message).toMatch(/já tem uma matrícula/);
    // E a correcao direta na tabela respeita o dia de vencimento de 1 a 28.
    const direto = await recepcao.cliente.from("matriculas").update({ dia_vencimento: 31 }).eq("id", m1);
    expect(direto.error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Inativacao
  // -------------------------------------------------------------------------

  it("inativa: encerra a matrícula, tira das aulas fixas e grava o motivo; depois reativa", async () => {
    const aluno = await novoAluno(recepcao, "Inativo");
    const colega = await novoAluno(recepcao, "Colega");
    const matricula = await matricular(recepcao, aluno.id);
    const sozinho = await aulasFixas([aluno.id], [dataDeTeste(110)]);
    const turma = await aulasFixas([aluno.id, colega.id], [dataDeTeste(111)]);
    await reler(recepcao);

    const motivo = `Mudou de cidade ${EXECUCAO}`;
    const resultado = await executar(recepcao, inativarAluno, { alunoId: aluno.id, ultimoDia: HOJE, motivo });
    expect(resultado.ok).toBe(true);

    const banco = await reler(recepcao);
    expect(banco.alunos.find((a) => a.id === aluno.id)?.ativo).toBe(false);
    expect(banco.matriculas.find((m) => m.id === matricula)?.fim).toBe(HOJE);
    expect(banco.ocupacoes.find((o) => o.id === sozinho.ids[0])).toMatchObject({
      situacao: "cancelada",
      motivoCancelamento: "Aluno inativado",
    });
    expect(banco.horariosFixos.find((h) => h.id === sozinho.horarioFixoId)?.fim).toBe(dataDeTeste(110));
    // Na turma, a aula continua e so ele sai.
    expect(banco.ocupacoes.find((o) => o.id === turma.ids[0])?.situacao).toBe("agendada");
    const naTurma = banco.ocupacaoAlunos.filter((p) => p.ocupacaoId === turma.ids[0]).map((p) => p.alunoId);
    expect(naTurma).toEqual([colega.id]);
    expect(banco.horarioAlunos.filter((v) => v.horarioFixoId === turma.horarioFixoId).map((v) => v.alunoId)).toEqual([colega.id]);
    expect(banco.comentarios.find((c) => c.entidadeId === aluno.id)).toMatchObject({
      texto: `Aluno inativado. Motivo: ${motivo}`,
      autorNome: "Recepção Local",
    });

    expect((await executar(recepcao, reativarCadastro, { alunoId: aluno.id })).ok).toBe(true);
    expect(recepcao.banco.alunos.find((a) => a.id === aluno.id)?.ativo).toBe(true);

    // O banco recusa saida no futuro, mesmo burlando a tela.
    const { error } = await recepcao.cliente.rpc("inativar_aluno", {
      p_aluno_id: aluno.id,
      p_ultimo_dia: somarDias(HOJE, 1),
    });
    expect(error?.message).toMatch(/não pode ser depois de hoje/);
  });

  // -------------------------------------------------------------------------
  // Congelamento
  // -------------------------------------------------------------------------

  it("congela (suspende as aulas fixas) e reativa (devolve as que podem voltar)", async () => {
    const aluno = await novoAluno(recepcao, "Congelado");
    const colega = await novoAluno(recepcao, "Turma");
    await matricular(recepcao, aluno.id);
    const sozinho = await aulasFixas([aluno.id], [dataDeTeste(130), dataDeTeste(137)]);
    const turma = await aulasFixas([aluno.id, colega.id], [dataDeTeste(131)]);
    await reler(recepcao);

    const inicio = somarDias(HOJE, 1);
    const congelado = await executar(recepcao, congelarPlano, {
      alunoId: aluno.id,
      inicio,
      fimPrevisto: dataDeTeste(199),
      motivo: `Viagem ${EXECUCAO}`,
    });
    expect(congelado.ok).toBe(true);
    const congelamentoId = (congelado as { id: string }).id;
    const congelamento = recepcao.banco.congelamentos.find((c) => c.id === congelamentoId);
    expect(congelamento).toMatchObject({ inicio, fimPrevisto: dataDeTeste(199), motivo: `Viagem ${EXECUCAO}` });
    expect(congelamento?.aulasSuspensas).toEqual([
      { ocupacaoId: sozinho.ids[0], acao: "cancelada" },
      { ocupacaoId: turma.ids[0], acao: "retirado" },
      { ocupacaoId: sozinho.ids[1], acao: "cancelada" },
    ]);
    for (const id of sozinho.ids) {
      expect(recepcao.banco.ocupacoes.find((o) => o.id === id)).toMatchObject({
        situacao: "cancelada",
        motivoCancelamento: "Congelamento",
      });
    }
    expect(recepcao.banco.ocupacaoAlunos.some((p) => p.ocupacaoId === turma.ids[0] && p.alunoId === aluno.id)).toBe(false);

    // Enquanto isso, alguem ocupa a quadra da primeira aula: ela nao pode voltar.
    const outra = idDoTeste("oc");
    const ocupou = await recepcao.cliente.from("ocupacoes").insert({
      id: outra,
      quadra_id: sozinho.quadra,
      data: dataDeTeste(130),
      hora_inicio: sozinho.inicio,
      hora_fim: sozinho.fim,
      tipo: "Locação Avulsa",
    });
    expect(ocupou.error).toBeNull();
    aulasDoTeste.push(outra);
    await reler(recepcao);

    const volta = somarDias(HOJE, 2);
    expect((await executar(recepcao, reativarPlano, { congelamentoId, dataVolta: volta })).ok).toBe(true);
    const banco = await reler(recepcao);
    expect(banco.congelamentos.find((c) => c.id === congelamentoId)?.fimReal).toBe(somarDias(volta, -1));
    expect(banco.ocupacoes.find((o) => o.id === sozinho.ids[0])?.situacao).toBe("cancelada");
    expect(banco.ocupacoes.find((o) => o.id === sozinho.ids[1])?.situacao).toBe("agendada");
    expect(banco.ocupacaoAlunos.some((p) => p.ocupacaoId === turma.ids[0] && p.alunoId === aluno.id)).toBe(true);

    // O banco recusa reativar de novo e recusa o professor (sem permissao).
    const deNovo = await recepcao.cliente.rpc("reativar_plano", { p_congelamento_id: congelamentoId, p_data_volta: volta });
    expect(deNovo.error?.message).toBe("Este congelamento já foi encerrado.");
    const pelaProfessora = await professor.cliente.rpc("congelar_plano", {
      p_aluno_id: aluno.id,
      p_inicio: somarDias(HOJE, 3),
      p_fim_previsto: somarDias(HOJE, 4),
      p_motivo: "Invasão",
    });
    expect(pelaProfessora.error?.code).toBe("42501");
  });

  // -------------------------------------------------------------------------
  // Permissoes
  // -------------------------------------------------------------------------

  it("o professor não cadastra alunos (nem pela tela, nem direto no banco)", async () => {
    const id = idDoTeste("al");
    const pelaTela = await executar(professor, cadastrarAluno, {
      id,
      nome: `Invasor ${EXECUCAO}`,
      inscritoRanking: false,
    });
    expect(pelaTela.ok).toBe(false);

    const { error } = await professor.cliente.from("alunos").insert({ id, nome: `Invasor ${EXECUCAO}` });
    expect(error).not.toBeNull();
  });

  it("professores: só o dono cadastra e muda o repasse; a recepção corrige o contato", async () => {
    const id = idDoTeste("prof");
    const dados = {
      nome: `Professor ${EXECUCAO}`,
      cor: "#336699",
      especialidade: "Iniciantes",
      telefone: "(11) 96666-5555",
      repasse: { modo: "por_hora" as const, valor: 50 },
    };
    expect(await executar(dono, cadastrarProfessor, { ...dados, id })).toMatchObject({ ok: true, id });
    expect(dono.banco.professores.find((p) => p.id === id)).toMatchObject({
      nome: dados.nome,
      cor: "#336699",
      repasse: { modo: "por_hora", valor: 50 },
      ativo: true,
    });

    await reler(recepcao);
    const email = `professor.${EXECUCAO}@teste.local`;
    expect((await executar(recepcao, editarProfessor, { ...dados, id, email })).ok).toBe(true);
    expect(recepcao.banco.professores.find((p) => p.id === id)?.email).toBe(email);

    // Repasse: a tela recusa a recepcao...
    const pelaTela = await executar(recepcao, editarProfessor, {
      ...dados,
      id,
      email,
      repasse: { modo: "percentual", valor: 40 },
    });
    expect(pelaTela.ok).toBe(false);
    // ...e o banco tambem, se alguem burlar a tela.
    const direto = await recepcao.cliente
      .from("professores")
      .update({ repasse_modo: "percentual", repasse_valor: 40 })
      .eq("id", id);
    expect(direto.error?.message).toBe("Só o dono cadastra professores e altera a regra de repasse.");
    const cadastroDireto = await recepcao.cliente
      .from("professores")
      .insert({ id: idDoTeste("prof"), nome: `Outro ${EXECUCAO}`, cor: "#112233" });
    expect(cadastroDireto.error).not.toBeNull();

    await reler(dono);
    expect(
      (await executar(dono, editarProfessor, { ...dados, id, email, repasse: { modo: "percentual", valor: 40 } })).ok,
    ).toBe(true);
    const professorGravado: Professor | undefined = dono.banco.professores.find((p) => p.id === id);
    expect(professorGravado?.repasse).toEqual({ modo: "percentual", valor: 40 });
  });
});
