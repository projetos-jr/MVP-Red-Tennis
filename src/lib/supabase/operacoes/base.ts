/**
 * Base: comentarios. (Configuracoes e professores: `configuracoes.ts`.)
 *
 * Modelo para os outros modulos: cada operacao da tela e ligada a uma funcao
 * do banco (`porFuncao`) ou a uma gravacao direta na tabela (`espelhar`).
 * Mapa completo em `docs/modulos/base.md`, secao "No banco (funções)".
 */

import { adicionarComentario, apagarComentario, editarComentario } from "@/lib/banco/operacoes/base";
import { ligar, porFuncao } from "../gravar";

// O autor vem de quem esta logado (o banco ignora o que a tela mandar).
ligar(
  adicionarComentario,
  porFuncao(
    "adicionar_comentario",
    (d) => ({ p_entidade: d.entidade, p_entidade_id: d.entidadeId, p_texto: d.texto }),
    ["comentarios"],
  ),
);

ligar(
  editarComentario,
  porFuncao("editar_comentario", (d) => ({ p_id: d.id, p_texto: d.texto }), ["comentarios"]),
);

ligar(
  apagarComentario,
  porFuncao("apagar_comentario", (d) => ({ p_id: d.id }), ["comentarios"]),
);
