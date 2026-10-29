"use client";

import { useState, type FormEvent } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconeMais, IconeNota } from "@/components/ui/Icons";
import {
  adicionarComentario,
  apagarComentario,
  editarComentario,
} from "@/lib/banco/operacoes/base";
import type { EntidadeComentavel } from "@/lib/banco/tipos";
import { comentariosDe } from "@/lib/consultas/base";
import { formatarDataHora } from "@/lib/date";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";

/**
 * Comentarios de qualquer registro (aluno, aula, lancamento, produto...).
 * Autor e data sao gravados sozinhos; cada pessoa edita e apaga so os seus.
 *
 *   <ComentariosDoRegistro entidade="ocupacao" entidadeId={ocupacao.id} />
 */
export function ComentariosDoRegistro({
  entidade,
  entidadeId,
  titulo = "Comentários",
  descricao,
  semCartao,
}: {
  entidade: EntidadeComentavel;
  entidadeId: string;
  titulo?: string;
  descricao?: string;
  /** true para usar dentro de um painel ou modal que ja tem moldura. */
  semCartao?: boolean;
}) {
  const { banco, colaborador } = useApp();
  const gravar = useGravar();
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);

  const comentarios = comentariosDe(banco, entidade, entidadeId);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (gravar(adicionarComentario, { entidade, entidadeId, texto })) setTexto("");
  }

  function salvarEdicao(evento: FormEvent) {
    evento.preventDefault();
    if (editando && gravar(editarComentario, editando, "Comentário atualizado.")) {
      setEditando(null);
    }
  }

  const conteudo = (
    <>
      <form onSubmit={enviar} className="border-b border-areia-200 p-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Escreva um comentário…"
          className="campo resize-none"
          aria-label="Novo comentário"
        />
        <button type="submit" disabled={!texto.trim()} className="btn-primario mt-2.5 w-full">
          <IconeMais className="h-4 w-4" />
          Adicionar comentário
        </button>
      </form>

      <ul className="divide-y divide-areia-100">
        {comentarios.map((comentario) => {
          const meu = comentario.autorId === colaborador.id;
          const emEdicao = editando?.id === comentario.id;
          return (
            <li key={comentario.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-areia-800">
                  {comentario.autorNome}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-areia-500">
                  {formatarDataHora(comentario.criadoEm)}
                  {comentario.editadoEm && " · editado"}
                </span>
              </div>

              {emEdicao ? (
                <form onSubmit={salvarEdicao} className="mt-2 space-y-2">
                  <textarea
                    value={editando.texto}
                    onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                    rows={2}
                    className="campo resize-none"
                    aria-label="Editar comentário"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primario px-3 py-1.5 text-xs">
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditando(null)}
                      className="btn-secundario px-3 py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-areia-700">
                  {comentario.texto}
                </p>
              )}

              {meu && !emEdicao && (
                <div className="mt-1.5 flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setEditando({ id: comentario.id, texto: comentario.texto })}
                    className="text-saibro-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      gravar(apagarComentario, { id: comentario.id }, "Comentário apagado.")
                    }
                    className="text-tijolo-700 hover:underline"
                  >
                    Apagar
                  </button>
                </div>
              )}
            </li>
          );
        })}

        {comentarios.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-areia-500">
            Nenhum comentário ainda.
          </li>
        )}
      </ul>
    </>
  );

  if (semCartao) return conteudo;

  return (
    <Card>
      <CardHeader titulo={titulo} descricao={descricao} icone={<IconeNota className="h-5 w-5" />} />
      {conteudo}
    </Card>
  );
}
