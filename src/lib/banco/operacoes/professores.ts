/**
 * Operacoes de professores: cadastro e edicao, com a regra de repasse
 * (Hipotese H6: por hora-aula ou percentual).
 *
 * Permissoes (Hipotese H9): so o dono cadastra professores e muda a regra de
 * repasse, porque ela define quanto a arena paga; a recepcao corrige os
 * demais dados (contato, cor, especialidade).
 */

import { definirOperacao } from "../executar";
import {
  garantirPodeAlterarCadastros,
  garantirPodeAlterarRepasse,
  validarCadastroProfessor,
  type DadosCadastroProfessor,
} from "../regras/alunos";
import { exigir, novoId } from "../regras/comum";
import type { Professor } from "../tipos";
import { semMudanca } from "./alunos";

/** `id` opcional: a tela pode gerar o id antes, para abrir a ficha nova em seguida. */
export const cadastrarProfessor = definirOperacao(
  "Cadastrar professor",
  (banco, dados: DadosCadastroProfessor & { id?: string }, ctx) => {
    garantirPodeAlterarRepasse(ctx.usuario);
    const cadastro = validarCadastroProfessor(banco, dados);
    const id = dados.id ?? novoId("prof");
    exigir(!banco.professores.some((p) => p.id === id), "Já existe um professor com este código.");
    const professor: Professor = { id, ...cadastro, ativo: true };
    return { ...banco, professores: [...banco.professores, professor] };
  },
);

export const editarProfessor = definirOperacao(
  "Editar cadastro do professor",
  (banco, dados: DadosCadastroProfessor & { id: string }, ctx) => {
    garantirPodeAlterarCadastros(ctx.usuario);
    const atual = banco.professores.find((p) => p.id === dados.id);
    exigir(atual, "Professor não encontrado.");
    const cadastro = validarCadastroProfessor(banco, dados, atual.id);
    if (
      cadastro.repasse.modo !== atual.repasse.modo ||
      cadastro.repasse.valor !== atual.repasse.valor
    ) {
      garantirPodeAlterarRepasse(ctx.usuario);
    }
    const novo: Professor = { ...atual, ...cadastro };
    if (semMudanca(atual, novo)) return banco;
    return {
      ...banco,
      professores: banco.professores.map((p) => (p.id === novo.id ? novo : p)),
    };
  },
);
