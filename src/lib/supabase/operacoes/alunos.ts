/**
 * Ligacoes das operacoes de alunos (`src/lib/banco/operacoes/alunos.ts`) e de
 * professores (`src/lib/banco/operacoes/professores.ts`) ao banco real.
 *
 * Mapa completo em `docs/modulos/alunos.md`, secao "No banco (funções)".
 *  - Cadastros de uma linha (aluno, professor, reativar cadastro, corrigir
 *    matricula) gravam direto na tabela (`espelhar`): o id gerado pela tela e
 *    o mesmo gravado, entao a tela abre a ficha nova sem esperar o retorno.
 *  - Matricula, congelamento e inativacao chamam funcoes do banco: mexem em
 *    varias tabelas (inclusive na agenda) e sao tudo ou nada.
 */

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
import { espelhar, ligar, porFuncao } from "../gravar";

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

ligar(cadastrarAluno, espelhar(["alunos"]));
ligar(editarAluno, espelhar(["alunos"]));
ligar(reativarCadastro, espelhar(["alunos"]));

// Tudo o que a saida do aluno muda: matriculas, congelamentos, horarios fixos,
// aulas e o comentario com o motivo.
ligar(
  inativarAluno,
  porFuncao(
    "inativar_aluno",
    (d) => ({ p_aluno_id: d.alunoId, p_ultimo_dia: d.ultimoDia, p_motivo: d.motivo }),
    [
      "alunos",
      "matriculas",
      "congelamentos",
      "horariosFixos",
      "horarioAlunos",
      "ocupacoes",
      "ocupacaoAlunos",
      "comentarios",
    ],
  ),
);

// ---------------------------------------------------------------------------
// Matricula
// ---------------------------------------------------------------------------

ligar(
  criarMatricula,
  porFuncao(
    "criar_matricula",
    (d) => ({
      p_aluno_id: d.alunoId,
      p_plano_id: d.planoId,
      p_valor_mensal: d.valorMensal,
      p_dia_vencimento: d.diaVencimento,
      p_inicio: d.inicio,
    }),
    ["matriculas"],
  ),
);

// Devolve o id da matricula nova.
ligar(
  trocarPlano,
  porFuncao(
    "trocar_plano",
    (d) => ({
      p_matricula_id: d.matriculaId,
      p_plano_id: d.planoId,
      p_valor_mensal: d.valorMensal,
      p_dia_vencimento: d.diaVencimento,
      p_inicio: d.inicio,
    }),
    ["matriculas"],
  ),
);

ligar(
  encerrarMatricula,
  porFuncao(
    "encerrar_matricula",
    (d) => ({ p_matricula_id: d.matriculaId, p_ultimo_dia: d.ultimoDia }),
    ["matriculas", "congelamentos"],
  ),
);

// A funcao devolve o id da matricula que VOLTOU a valer (outro registro):
// nao e um registro criado, entao nao vai como `id` do resultado.
ligar(
  cancelarMatriculaAgendada,
  porFuncao(
    "cancelar_matricula_agendada",
    (d) => ({ p_matricula_id: d.matriculaId }),
    ["matriculas", "congelamentos"],
    () => undefined,
  ),
);

ligar(corrigirMatricula, espelhar(["matriculas"]));

// ---------------------------------------------------------------------------
// Congelamento: suspende e devolve aulas da agenda na mesma transacao
// ---------------------------------------------------------------------------

/** Pega um campo de texto do objeto devolvido pela funcao. */
function campoDoRetorno(campo: string) {
  return (retorno: unknown): string | undefined => {
    const valor = (retorno as Record<string, unknown> | null)?.[campo];
    return typeof valor === "string" ? valor : undefined;
  };
}

ligar(
  congelarPlano,
  porFuncao(
    "congelar_plano",
    (d) => ({
      p_aluno_id: d.alunoId,
      p_inicio: d.inicio,
      p_fim_previsto: d.fimPrevisto,
      p_motivo: d.motivo,
    }),
    ["congelamentos", "ocupacoes", "ocupacaoAlunos"],
    campoDoRetorno("congelamento_id"),
  ),
);

// Devolve { voltaram, nao_voltaram }: a mensagem da tela vem da previa, que
// usa as mesmas regras; a agenda relida mostra o que de fato voltou.
ligar(
  reativarPlano,
  porFuncao(
    "reativar_plano",
    (d) => ({ p_congelamento_id: d.congelamentoId, p_data_volta: d.dataVolta }),
    ["congelamentos", "ocupacoes", "ocupacaoAlunos"],
    () => undefined,
  ),
);

// ---------------------------------------------------------------------------
// Professores (RLS: so o dono cadastra; um gatilho deixa so o dono mudar o repasse)
// ---------------------------------------------------------------------------

ligar(cadastrarProfessor, espelhar(["professores"]));
ligar(editarProfessor, espelhar(["professores"]));
