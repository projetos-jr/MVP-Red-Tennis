/**
 * Operacoes da base: comentarios e configuracoes.
 *
 * Servem tambem de modelo para as operacoes dos modulos: funcao pura,
 * `exigir(...)` para recusar com mensagem clara, copias em vez de alterar
 * objetos no lugar.
 */

import { definirOperacao } from "../executar";
import { exigir, novoId } from "../regras/comum";
import type { Configuracoes, EntidadeComentavel } from "../tipos";

export const adicionarComentario = definirOperacao(
  "Adicionar comentário",
  (
    banco,
    dados: { entidade: EntidadeComentavel; entidadeId: string; texto: string },
    ctx,
  ) => {
    const texto = dados.texto.trim();
    exigir(texto, "Escreva o comentário antes de salvar.");
    return {
      ...banco,
      comentarios: [
        ...banco.comentarios,
        {
          id: novoId("cm"),
          entidade: dados.entidade,
          entidadeId: dados.entidadeId,
          texto,
          autorId: ctx.usuario.id,
          autorNome: ctx.usuario.nome,
          criadoEm: ctx.agora,
        },
      ],
    };
  },
);

/** Cada pessoa edita so os proprios comentarios. */
export const editarComentario = definirOperacao(
  "Editar comentário",
  (banco, dados: { id: string; texto: string }, ctx) => {
    const comentario = banco.comentarios.find((c) => c.id === dados.id);
    exigir(comentario, "Comentário não encontrado.");
    exigir(
      comentario.autorId === ctx.usuario.id,
      "Só quem escreveu o comentário pode editá-lo.",
    );
    const texto = dados.texto.trim();
    exigir(texto, "O comentário não pode ficar vazio.");
    return {
      ...banco,
      comentarios: banco.comentarios.map((c) =>
        c.id === dados.id ? { ...c, texto, editadoEm: ctx.agora } : c,
      ),
    };
  },
);

/** Cada pessoa apaga so os proprios comentarios (a auditoria guarda o texto). */
export const apagarComentario = definirOperacao(
  "Apagar comentário",
  (banco, dados: { id: string }, ctx) => {
    const comentario = banco.comentarios.find((c) => c.id === dados.id);
    exigir(comentario, "Comentário não encontrado.");
    exigir(
      comentario.autorId === ctx.usuario.id,
      "Só quem escreveu o comentário pode apagá-lo.",
    );
    return {
      ...banco,
      comentarios: banco.comentarios.filter((c) => c.id !== dados.id),
    };
  },
);

/** Altera uma ou mais regras da tela de Configuracoes (so o dono). */
export const alterarConfiguracoes = definirOperacao(
  "Alterar configurações",
  (banco, dados: Partial<Configuracoes>, ctx) => {
    exigir(ctx.usuario.perfil === "dono", "Só o dono pode alterar as configurações.");
    return { ...banco, configuracoes: { ...banco.configuracoes, ...dados } };
  },
);
