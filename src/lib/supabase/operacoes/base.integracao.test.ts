import { beforeAll, describe, expect, it } from "vitest";
import { adicionarComentario, apagarComentario, editarComentario } from "@/lib/banco/operacoes/base";
import { EXECUCAO, SEM_BANCO_DE_TESTE, entrar, executar, type Sessao } from "../integracao/ambiente";

describe.skipIf(SEM_BANCO_DE_TESTE)("comentários no banco real", () => {
  let recepcao: Sessao;
  let professor: Sessao;
  const texto = `Comentário de teste ${EXECUCAO}`;

  beforeAll(async () => {
    recepcao = await entrar("recepcao");
    professor = await entrar("professor");
  });

  it("grava, edita e apaga, com autor e nome da operação no histórico", async () => {
    const aluno = recepcao.banco.alunos[0];
    const criado = await executar(recepcao, adicionarComentario, {
      entidade: "aluno",
      entidadeId: aluno.id,
      texto,
    });
    expect(criado).toMatchObject({ ok: true });
    const comentario = recepcao.banco.comentarios.find((c) => c.texto === texto);
    expect(comentario).toMatchObject({ autorNome: "Recepção Local", entidadeId: aluno.id });
    expect(criado.ok && criado.id).toBe(comentario!.id);

    const editado = await executar(recepcao, editarComentario, { id: comentario!.id, texto: `${texto} (editado)` });
    expect(editado.ok).toBe(true);
    const depois = recepcao.banco.comentarios.find((c) => c.id === comentario!.id);
    expect(depois?.texto).toBe(`${texto} (editado)`);
    expect(depois?.editadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

    expect((await executar(recepcao, apagarComentario, { id: comentario!.id })).ok).toBe(true);
    expect(recepcao.banco.comentarios.some((c) => c.id === comentario!.id)).toBe(false);
  });

  it("o banco recusa editar o comentário de outra pessoa", async () => {
    await executar(recepcao, adicionarComentario, {
      entidade: "aluno",
      entidadeId: recepcao.banco.alunos[0].id,
      texto: `${texto} (da recepção)`,
    });
    const alheio = recepcao.banco.comentarios.find((c) => c.texto === `${texto} (da recepção)`)!;

    // A regra da tela recusa antes de enviar...
    professor.banco = { ...professor.banco, comentarios: [...professor.banco.comentarios, alheio] };
    const pelaTela = await executar(professor, editarComentario, { id: alheio.id, texto: "Invadido" });
    expect(pelaTela).toMatchObject({ ok: false, erro: "Só quem escreveu o comentário pode editá-lo." });

    // ...e o banco recusa mesmo se alguem burlar a tela.
    const { error } = await professor.cliente.rpc("editar_comentario", { p_id: alheio.id, p_texto: "Invadido" });
    expect(error).not.toBeNull();
  });
});
