/**
 * Agenda e reposicao: ligacoes das operacoes de
 * `src/lib/banco/operacoes/agenda.ts` ao banco real.
 *
 * Todas viram funcoes do banco (migracao `20261030120100_funcoes_agenda.sql`):
 * cada uma tem alguma regra que as constraints sozinhas nao garantem (aula
 * cancelada, aluno inativo, saldo de reposicao, credito ja usado...). Mapa
 * completo em `docs/modulos/agenda.md`, secao "No banco (funções)".
 *
 * Os ids das linhas criadas sao gerados pelo banco (diferentes dos que a
 * operacao da tela inventou); quando ha um registro principal criado, ele
 * volta em `resultado.id`.
 */

import {
  bloquearQuadra,
  cancelarOcupacao,
  cancelarPorChuva,
  criarHorarioAvulso,
  criarHorarioFixo,
  encerrarHorarioFixo,
  incluirAluno,
  liberarReserva,
  liberarReservasVencidas,
  marcarAulaDeReposicao,
  marcarPresenca,
  remarcarOcupacao,
  removerAluno,
  usarReposicao,
} from "@/lib/banco/operacoes/agenda";
import type { TabelaDoBanco } from "@/lib/banco/tipos";
import { ligar, porFuncao } from "../gravar";

/**
 * Tabelas que a rotina de cancelamento do banco muda: a ocupacao, as
 * presencas, os creditos de reposicao e a cobranca anulada.
 */
const CANCELAMENTO: TabelaDoBanco[] = ["ocupacoes", "ocupacaoAlunos", "reposicoes", "lancamentos"];

/** Le um campo de texto do json que a funcao devolve. */
function campo(nome: string) {
  return (retorno: unknown): string | undefined => {
    const valor = (retorno as Record<string, unknown> | null)?.[nome];
    return typeof valor === "string" ? valor : undefined;
  };
}

// ---------------------------------------------------------------------------
// Novo horario
// ---------------------------------------------------------------------------

// Locacao avulsa grava tambem a cobranca no financeiro. Devolve o id da ocupacao.
ligar(
  criarHorarioAvulso,
  porFuncao(
    "criar_horario_avulso",
    (d) => ({
      p_quadra_id: d.quadraId,
      p_data: d.data,
      p_hora_inicio: d.horaInicio,
      p_hora_fim: d.horaFim,
      p_tipo: d.tipo,
      p_alunos_ids: d.alunosIds,
      p_professor_id: d.professorId,
      p_descricao: d.descricao,
    }),
    ["ocupacoes", "ocupacaoAlunos", "lancamentos"],
  ),
);

// As datas em conflito que a pessoa decidiu pular (a tela mostra a lista
// antes de salvar) vao em `p_datas_puladas`; o banco confere de novo as
// restantes. Devolve o id do horario fixo (molde).
ligar(
  criarHorarioFixo,
  porFuncao(
    "criar_horario_fixo",
    (d) => ({
      p_quadra_id: d.quadraId,
      p_data_inicio: d.dataInicio,
      p_hora_inicio: d.horaInicio,
      p_hora_fim: d.horaFim,
      p_tipo: d.tipo,
      p_alunos_ids: d.alunosIds,
      p_professor_id: d.professorId,
      p_fim: d.fim || undefined,
      p_datas_puladas: d.datasPuladas?.length ? d.datasPuladas : undefined,
    }),
    ["horariosFixos", "horarioAlunos", "ocupacoes", "ocupacaoAlunos"],
    campo("horario_fixo_id"),
  ),
);

// Aula nova paga com minutos de reposicao. Devolve o id da ocupacao.
ligar(
  marcarAulaDeReposicao,
  porFuncao(
    "marcar_aula_de_reposicao",
    (d) => ({
      p_aluno_id: d.alunoId,
      p_quadra_id: d.quadraId,
      p_data: d.data,
      p_hora_inicio: d.horaInicio,
      p_hora_fim: d.horaFim,
      p_tipo: d.tipo,
      p_professor_id: d.professorId,
    }),
    ["ocupacoes", "ocupacaoAlunos", "reposicoes"],
  ),
);

// ---------------------------------------------------------------------------
// Alunos da aula e presenca
// ---------------------------------------------------------------------------

// Devolve o id da participacao.
ligar(
  incluirAluno,
  porFuncao(
    "incluir_aluno",
    (d) => ({ p_ocupacao_id: d.ocupacaoId, p_aluno_id: d.alunoId }),
    ["ocupacaoAlunos"],
  ),
);

ligar(
  usarReposicao,
  porFuncao(
    "usar_reposicao",
    (d) => ({ p_ocupacao_id: d.ocupacaoId, p_aluno_id: d.alunoId }),
    ["ocupacaoAlunos", "reposicoes"],
  ),
);

// Se o aluno estava ali por reposicao, o uso e apagado (os minutos voltam).
ligar(
  removerAluno,
  porFuncao(
    "remover_aluno",
    (d) => ({ p_ocupacao_id: d.ocupacaoId, p_aluno_id: d.alunoId }),
    ["ocupacaoAlunos", "reposicoes"],
  ),
);

// Falta avisada em aula Individual cancela a aula inteira (rotina de
// cancelamento); presenca e falta mudam a aula para "realizada".
ligar(
  marcarPresenca,
  porFuncao(
    "marcar_presenca",
    (d) => ({
      p_ocupacao_id: d.ocupacaoId,
      p_aluno_id: d.alunoId,
      p_presenca: d.presenca,
      p_sigla: d.sigla,
    }),
    CANCELAMENTO,
  ),
);

// ---------------------------------------------------------------------------
// Cancelar, remarcar, encerrar
// ---------------------------------------------------------------------------

ligar(
  cancelarOcupacao,
  porFuncao("cancelar_ocupacao", (d) => ({ p_id: d.id, p_motivo: d.motivo }), CANCELAMENTO),
);

// A cobranca ainda nao paga da locacao acompanha a nova data e duracao.
ligar(
  remarcarOcupacao,
  porFuncao(
    "remarcar_ocupacao",
    (d) => ({
      p_id: d.id,
      p_quadra_id: d.quadraId,
      p_data: d.data,
      p_hora_inicio: d.horaInicio,
      p_hora_fim: d.horaFim,
    }),
    ["ocupacoes", "lancamentos"],
  ),
);

// Apaga as aulas futuras do molde (com alunos, creditos e usos de reposicao)
// e anula as cobrancas delas.
ligar(
  encerrarHorarioFixo,
  porFuncao(
    "encerrar_horario_fixo",
    (d) => ({ p_horario_fixo_id: d.horarioFixoId, p_fim: d.fim }),
    ["horariosFixos", ...CANCELAMENTO],
  ),
);

// ---------------------------------------------------------------------------
// Bloqueio de quadra e chuva
// ---------------------------------------------------------------------------

// Cancela com IAC as aulas do periodo e cria um bloqueio por quadra.
// Devolve o id do primeiro bloqueio.
ligar(
  bloquearQuadra,
  porFuncao(
    "bloquear_quadra",
    (d) => ({
      p_quadras_ids: d.quadrasIds,
      p_data: d.data,
      p_hora_inicio: d.horaInicio,
      p_hora_fim: d.horaFim,
      p_descricao: d.descricao,
    }),
    CANCELAMENTO,
    (retorno) => {
      const bloqueios = (retorno as { bloqueios?: unknown } | null)?.bloqueios;
      return Array.isArray(bloqueios) && typeof bloqueios[0] === "string" ? bloqueios[0] : undefined;
    },
  ),
);

// Sem horario = dia inteiro (o banco usa 07:00 as 22:00, como a tela).
ligar(
  cancelarPorChuva,
  porFuncao(
    "cancelar_por_chuva",
    (d) => ({
      p_data: d.data,
      p_quadras_ids: d.quadrasIds,
      p_hora_inicio: d.horaInicio,
      p_hora_fim: d.horaFim,
    }),
    CANCELAMENTO,
  ),
);

// ---------------------------------------------------------------------------
// Reservas sem pagamento (Hipotese H5)
// ---------------------------------------------------------------------------

ligar(liberarReserva, porFuncao("liberar_reserva", (d) => ({ p_id: d.id }), CANCELAMENTO));

// O banco libera as que estiverem vencidas no relogio DELE (devolve quantas;
// nao ha registro principal criado).
ligar(
  liberarReservasVencidas,
  porFuncao("liberar_reservas_vencidas", () => ({}), CANCELAMENTO, () => undefined),
);
