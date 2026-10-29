/**
 * ============================================================================
 *  MODELO DE DADOS — banco de exemplo em memoria
 * ============================================================================
 *  Cada interface abaixo e uma tabela do banco descrito em
 *  `docs/MODELO-E-TELAS.md`. O objeto `Banco` reune todas elas e e o unico
 *  estado de dados do front: as telas leem por `src/lib/selectors/` e gravam
 *  por operacoes em `src/lib/banco/operacoes/`.
 *
 *  Quando o Supabase entrar, cada tabela daqui vira uma tabela de verdade com
 *  o mesmo nome (em snake_case) e as operacoes viram funcoes do Postgres.
 *
 *  Convencoes:
 *   - todo registro tem `id` (texto);
 *   - datas "YYYY-MM-DD" e horas "HH:mm" no fuso da arena (America/Sao_Paulo);
 *     carimbos de data e hora "YYYY-MM-DDTHH:mm:ss", tambem no fuso da arena;
 *   - nada que possa ser calculado e guardado (saldo de reposicao, saldo de
 *     estoque, situacao de um lancamento, pontuacao do ranking): as regras de
 *     calculo ficam em `src/lib/banco/regras/`.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Valores fixos
// ---------------------------------------------------------------------------

/** Quadras 1 a 4 e paredao. Os ids sao os mesmos da tabela `quadras` do Supabase. */
export type QuadraId = "1" | "2" | "3" | "4" | "paredao";

export type PisoQuadra = "saibro" | "cimento";

/**
 * Tipos de ocupacao da quadra — definem a cor na agenda.
 * "Bloqueio" e a quadra fechada (manutencao, evento, torneio).
 */
export type TipoOcupacao =
  | "Individual"
  | "Locação Mensal"
  | "Dupla"
  | "LAP"
  | "Locação Avulsa"
  | "Ranking"
  | "Plano de locação"
  | "Bloqueio";

/** Tipos de plano que um aluno pode contratar. */
export type TipoPlano =
  | "Individual"
  | "Dupla"
  | "LAP"
  | "Locação Mensal"
  | "Plano de locação";

/** Categorias do ranking, do topo (A) para a base (D). */
export type CategoriaRanking = "A" | "B" | "C" | "D";

export type CategoriaProduto = "Bebidas" | "Cervejas" | "Lanches" | "Acessórios";

/** Perfis de acesso (Hipotese H9 do documento de modelo). */
export type Perfil = "dono" | "recepcao" | "professor";

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** Pessoa da equipe que faz login. */
export interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  perfil: Perfil;
  /** Preenchido quando o colaborador tambem e professor. */
  professorId?: string;
  ativo: boolean;
}

/** Sigla de falta ou cancelamento (Hipotese H1). Lista editavel nas Configuracoes. */
export interface SiglaReposicao {
  /** Codigo exibido: "CH", "24h", "FP", "IAC", "TIP"... */
  codigo: string;
  nome: string;
  descricao: string;
  /** Se gera credito de minutos de reposicao. */
  geraCredito: boolean;
  /**
   * Onde a sigla se aplica:
   *  - "ocupacao": cancela a aula inteira (chuva, falta do professor);
   *  - "aluno": falta de um aluno so (aviso previo de 24h);
   *  - "ambos": pode ser usada nos dois casos.
   */
  aplicaA: "ocupacao" | "aluno" | "ambos";
  /**
   * true = desativada nas Configuracoes: sai dos formularios novos, mas
   * continua valendo para as aulas e creditos que ja usam o codigo.
   * Vazio = ativa.
   */
  desativada?: boolean;
}

/**
 * Regras ajustaveis sem programar (tela de Configuracoes).
 * Os valores iniciais sao as hipoteses da secao 4 do documento de modelo.
 */
export interface Configuracoes {
  siglas: SiglaReposicao[];
  /** Validade de cada credito de reposicao, em meses. */
  validadeReposicaoMeses: number;
  /** Prazo para pagar uma reserva avulsa, em horas (H5 — valor de teste). */
  prazoPagamentoReservaHoras: number;
  /** H5: vencido o prazo, so alerta (false) ou libera o horario sozinho (true). */
  liberarReservaAutomaticamente: boolean;
  /** Ate quantas semanas a frente as aulas fixas viram ocupacoes. */
  semanasGeradasAFrente: number;
  /** H10: professor em duas aulas ao mesmo tempo — avisa (false) ou impede (true). */
  bloquearProfessorEmDuasAulas: boolean;
  /** H7: pontuacao do ranking (valores de teste). */
  pontosVitoria: number;
  pontosDerrota: number;
  /** Partidas de torneio contam para o ranking? */
  torneioContaParaRanking: boolean;
  /** H8: regras de torneio. */
  classificadosPorGrupo: number;
  criteriosDesempate: string[];
  /** Formas de pagamento oferecidas nos formularios. */
  formasPagamento: string[];
  /** Prazo para pagar o consumo do balcao, em dias (valor de teste). */
  prazoPagamentoConsumoDias: number;
  /** Preco por hora da locacao avulsa (valores de teste). */
  precoLocacaoHora: number;
  precoParedaoHora: number;
  /** H9: modulos que cada perfil enxerga. */
  permissoes: Record<Perfil, ModuloSistema[]>;
}

export type ModuloSistema =
  | "painel"
  | "agenda"
  | "alunos"
  | "professores"
  | "financeiro"
  | "financeiro_pagar"
  | "estoque"
  | "ranking"
  | "configuracoes"
  | "historico";

/** Registro automatico de toda criacao, alteracao e exclusao. Ninguem edita. */
export interface RegistroAuditoria {
  id: string;
  em: string;
  usuarioId: string;
  usuarioNome: string;
  tabela: TabelaDoBanco;
  registroId: string;
  acao: "criar" | "alterar" | "apagar";
  antes?: unknown;
  depois?: unknown;
  /** Nome da operacao que gerou a mudanca ("Cancelar aula", "Lançar consumo"...). */
  operacao: string;
}

/** A que tipo de registro um comentario pertence. */
export type EntidadeComentavel =
  | "aluno"
  | "professor"
  | "ocupacao"
  | "lancamento"
  | "produto"
  | "torneio"
  | "partida";

export interface Comentario {
  id: string;
  entidade: EntidadeComentavel;
  entidadeId: string;
  texto: string;
  autorId: string;
  autorNome: string;
  criadoEm: string;
  editadoEm?: string;
}

// ---------------------------------------------------------------------------
// Cadastros
// ---------------------------------------------------------------------------

export interface Quadra {
  id: QuadraId;
  nome: string;
  piso: PisoQuadra;
  ordem: number;
}

/** Como o repasse do professor e calculado (Hipotese H6). */
export interface RegraRepasse {
  modo: "por_hora" | "percentual";
  /** Reais por hora-aula (modo "por_hora") ou percentual 0-100 (modo "percentual"). */
  valor: number;
}

export interface Professor {
  id: string;
  nome: string;
  /** Cor de apoio usada nos filtros da agenda. */
  cor: string;
  especialidade: string;
  telefone?: string;
  email?: string;
  repasse: RegraRepasse;
  ativo: boolean;
}

export interface Aluno {
  id: string;
  nome: string;
  /** Caminho da foto em /public/avatars; sem foto, a tela usa as iniciais. */
  fotoUrl?: string;
  telefone: string;
  email: string;
  dataNascimento?: string;
  professorPrincipalId?: string;
  /** false = saiu da arena. "Congelado" vem da tabela de congelamentos. */
  ativo: boolean;
  inscritoRanking: boolean;
  categoriaRanking?: CategoriaRanking;
  criadoEm: string;
}

/** Catalogo de planos (Hipotese H3: tabela nova e tabela antiga). */
export interface Plano {
  id: string;
  nome: string;
  tipo: TipoPlano;
  valorMensal: number;
  aulasPorSemana: number;
  duracaoMinutos: number;
  tabela: "nova" | "antiga";
  ativo: boolean;
}

/** Qual plano cada aluno tem. Uma troca de plano encerra uma matricula e abre outra. */
export interface Matricula {
  id: string;
  alunoId: string;
  planoId: string;
  /** Valor combinado — pode ser diferente do preco atual do plano. */
  valorMensal: number;
  /** Dia do mes em que a mensalidade vence (1 a 28). */
  diaVencimento: number;
  inicio: string;
  fim?: string;
}

/** Periodo em que a matricula ficou parada (Hipotese H4). */
export interface Congelamento {
  id: string;
  matriculaId: string;
  inicio: string;
  fimPrevisto?: string;
  /** Preenchido quando o aluno volta. */
  fimReal?: string;
  motivo: string;
}

// ---------------------------------------------------------------------------
// Agenda e reposicao
// ---------------------------------------------------------------------------

/** Molde de uma aula que se repete toda semana. */
export interface HorarioFixo {
  id: string;
  quadraId: QuadraId;
  /** 0 = domingo ... 6 = sabado. */
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  tipo: TipoOcupacao;
  professorId?: string;
  /** Primeira data em que vale. */
  inicio: string;
  /** Ultima data em que vale (vazio = sem fim). */
  fim?: string;
}

/** Alunos de cada horario fixo — sem limite de pessoas. */
export interface HorarioAluno {
  id: string;
  horarioFixoId: string;
  alunoId: string;
}

export type SituacaoOcupacao =
  | "agendada"
  | "aguardando_pagamento"
  | "realizada"
  | "cancelada";

/**
 * Cada uso de uma quadra numa data: aula, locacao, ranking ou bloqueio.
 * Regra do banco: duas ocupacoes que nao estejam canceladas nao podem
 * dividir a mesma quadra no mesmo horario (ver `regras/agenda.ts`).
 */
export interface Ocupacao {
  id: string;
  quadraId: QuadraId;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: TipoOcupacao;
  professorId?: string;
  /** Horario fixo que gerou esta ocupacao (vazio = avulsa). */
  horarioFixoId?: string;
  situacao: SituacaoOcupacao;
  /** Sigla (CH, FP, IAC...) ou texto livre, obrigatorio ao cancelar. */
  motivoCancelamento?: string;
  canceladaEm?: string;
  /** Reservas avulsas: limite para o pagamento (Hipotese H5). */
  prazoPagamento?: string;
  /** Texto curto — usado sobretudo nos bloqueios ("Manutenção do saibro"). */
  descricao?: string;
  criadoEm: string;
}

export type Presenca = "a_marcar" | "presente" | "falta" | "falta_avisada";

/** Quem participa de cada ocupacao e o que aconteceu com cada um. */
export interface OcupacaoAluno {
  id: string;
  ocupacaoId: string;
  alunoId: string;
  presenca: Presenca;
  /** Sigla da falta, quando houver. */
  sigla?: string;
}

/**
 * Extrato de minutos de reposicao.
 * Credito: `minutos` positivo, com `validade`. Uso: `minutos` negativo.
 * O saldo e sempre calculado (ver `regras/reposicao.ts`).
 */
export interface LancamentoReposicao {
  id: string;
  alunoId: string;
  minutos: number;
  sigla?: string;
  /** Aula que gerou o credito. */
  ocupacaoOrigemId?: string;
  /** Aula onde o credito foi usado. */
  ocupacaoUsoId?: string;
  /** So para creditos: ultimo dia em que o credito pode ser usado. */
  validade?: string;
  observacao?: string;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export type TipoLancamento = "receber" | "pagar";

export type CategoriaLancamento =
  | "Mensalidade"
  | "Aula avulsa"
  | "Locação"
  | "Consumo"
  | "Torneio"
  | "Despesa"
  | "Fornecedor"
  | "Repasse"
  | "Outros";

/**
 * Tudo o que entra ou sai. A situacao (pago, pendente, em atraso) e calculada
 * pelo vencimento e pela data de pagamento (ver `regras/financeiro.ts`).
 */
export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  categoria: CategoriaLancamento;
  /** Aluno ou professor ligado ao lancamento (quem consumiu, quem recebe o repasse...). */
  pessoaId?: string;
  pessoaTipo?: "aluno" | "professor";
  /** Quem pagou (pode ser outra pessoa: pai, empresa...) ou, em contas a pagar, o favorecido. */
  nomePagante?: string;
  item: string;
  valor: number;
  vencimento: string;
  /** Vazio = ainda nao pago. */
  pagoEm?: string;
  formaPagamento?: string;
  /** Parte coberta por convenio, quando houver (a confirmar se fica na v1). */
  valorConvenio?: number;
  /** Nome do arquivo de comprovante anexado. */
  comprovante?: string;
  /** Mes de referencia "YYYY-MM" (mensalidades e repasses). */
  competencia?: string;
  matriculaId?: string;
  ocupacaoId?: string;
  consumoId?: string;
  torneioId?: string;
  repasseId?: string;
  /** Entrada de mercadoria que gerou a conta a pagar ao fornecedor. */
  movimentoEstoqueId?: string;
  /** Lancamento anulado (nunca se apaga: anula-se, com motivo). */
  canceladoEm?: string;
  motivoCancelamento?: string;
  criadoEm: string;
}

/** Fechamento mensal do repasse de um professor. */
export interface Repasse {
  id: string;
  professorId: string;
  /** Mes "YYYY-MM". */
  competencia: string;
  aulasDadas: number;
  minutosDados: number;
  valorPrevisto: number;
  fechadoEm: string;
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

/** O saldo NAO fica aqui: e a soma dos movimentos (ver `regras/estoque.ts`). */
export interface Produto {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  /** Como o item e vendido: "lata 350ml", "unidade", "tubo"... */
  unidade: string;
  precoCusto: number;
  precoVenda: number;
  estoqueMinimo: number;
  ativo: boolean;
}

export type TipoMovimento = "entrada" | "venda" | "perda" | "ajuste";

export interface MovimentoEstoque {
  id: string;
  produtoId: string;
  data: string;
  tipo: TipoMovimento;
  /**
   * Entrada, venda e perda: sempre positiva (o tipo diz se soma ou subtrai).
   * Ajuste: pode ser positiva ou negativa.
   */
  quantidade: number;
  responsavel: string;
  observacao?: string;
  consumoId?: string;
}

/** Consumo no balcao. Gera a baixa no estoque e o lancamento a receber juntos. */
export interface Consumo {
  id: string;
  pessoaId: string;
  pessoaTipo: "aluno" | "professor";
  data: string;
  produtoId: string;
  /** Nome e preco no momento da venda: mudar o cadastro nao reescreve o historico. */
  produtoNome: string;
  quantidade: number;
  valorUnitario: number;
}

// ---------------------------------------------------------------------------
// Ranking e torneios
// ---------------------------------------------------------------------------

export type FormatoTorneio =
  | "eliminatoria"
  | "grupos_eliminatoria"
  | "todos_contra_todos";

export type SituacaoTorneio = "inscricoes" | "em_andamento" | "encerrado";

export interface Torneio {
  id: string;
  nome: string;
  data: string;
  formato: FormatoTorneio;
  /** Categoria do ranking, ou vazio para torneio livre. */
  categoria?: CategoriaRanking;
  /** Torneio de duplas: cada inscricao tem dois alunos. */
  duplas: boolean;
  situacao: SituacaoTorneio;
  criadoEm: string;
}

/** Uma inscricao: um aluno (simples) ou dois (duplas). */
export interface TorneioInscrito {
  id: string;
  torneioId: string;
  alunosIds: string[];
  /** 1 = primeiro cabeca de chave. */
  cabecaDeChave?: number;
  /** Letra do grupo, no formato grupos + eliminatoria. */
  grupo?: string;
}

/**
 * Uma partida: de ranking (sem torneio) ou de torneio.
 * Lado A e lado B guardam os alunos (um em simples, dois em duplas).
 */
export interface Partida {
  id: string;
  data?: string;
  ladoA: string[];
  ladoB: string[];
  /** Ex.: "6/4 3/6 10/8". */
  placar?: string;
  vencedor?: "A" | "B";
  /** Vitoria por nao comparecimento do adversario. */
  wo?: boolean;
  /** Reserva de quadra ligada a partida (tipo "Ranking" na agenda). */
  ocupacaoId?: string;
  // --- Campos de torneio ---
  torneioId?: string;
  inscricaoAId?: string;
  inscricaoBId?: string;
  /** "Grupo A", "Quartas de final", "Semifinal", "Final", "Rodada 1"... */
  fase?: string;
  rodada?: number;
  grupo?: string;
  /** Ordem dentro da rodada (para desenhar a chave). */
  ordem?: number;
  /** Para onde vai o vencedor. */
  proximaPartidaId?: string;
  ladoNaProxima?: "A" | "B";
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// O banco inteiro
// ---------------------------------------------------------------------------

export interface Banco {
  colaboradores: Colaborador[];
  configuracoes: Configuracoes;
  auditoria: RegistroAuditoria[];
  comentarios: Comentario[];
  quadras: Quadra[];
  professores: Professor[];
  alunos: Aluno[];
  planos: Plano[];
  matriculas: Matricula[];
  congelamentos: Congelamento[];
  horariosFixos: HorarioFixo[];
  horarioAlunos: HorarioAluno[];
  ocupacoes: Ocupacao[];
  ocupacaoAlunos: OcupacaoAluno[];
  reposicoes: LancamentoReposicao[];
  lancamentos: Lancamento[];
  repasses: Repasse[];
  produtos: Produto[];
  movimentosEstoque: MovimentoEstoque[];
  consumos: Consumo[];
  torneios: Torneio[];
  torneioInscritos: TorneioInscrito[];
  partidas: Partida[];
}

/** Nome de cada tabela do banco (exceto a configuracao, que e um registro unico). */
export type TabelaDoBanco = keyof Banco;

/** Tabelas que sao listas de registros com `id`. */
export type TabelaDeRegistros = Exclude<TabelaDoBanco, "configuracoes">;
