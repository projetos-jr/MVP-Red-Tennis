/**
 * ============================================================================
 *  CONSULTAS — Configuracoes e Historico de alteracoes (telas do dono)
 * ============================================================================
 *  - Configuracoes: nomes dos perfis e modulos, uso de cada plano e sigla.
 *  - Historico: filtros da auditoria e a traducao de cada registro para
 *    linguagem simples (nome das tabelas e dos campos, valores formatados).
 * ============================================================================
 */

import { rotuloDaQuadra } from "../banco/regras/agenda";
import { MODULOS_DO_SISTEMA, type Permissoes } from "../banco/regras/configuracoes";
import type {
  Banco,
  Configuracoes,
  ModuloSistema,
  Perfil,
  Plano,
  Professor,
  QuadraId,
  RegistroAuditoria,
  SiglaReposicao,
  TabelaDoBanco,
} from "../banco/tipos";
import { DIAS_SEMANA_LONGO, formatarData, formatarDataHora, formatarDiaMes } from "../date";
import { nomeDaPessoa } from "./base";

// ---------------------------------------------------------------------------
// Perfis, modulos e permissoes (Hipotese H9)
// ---------------------------------------------------------------------------

export const NOMES_DOS_PERFIS: Record<Perfil, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  professor: "Professor",
};

/** `nome` aparece na matriz de permissoes; `curto`, nos resumos de acesso. */
export const NOMES_DOS_MODULOS: Record<
  ModuloSistema,
  { nome: string; curto: string; descricao: string }
> = {
  painel: { nome: "Painel", curto: "Painel", descricao: "Quadras do dia e o que precisa de atenção." },
  agenda: { nome: "Agenda", curto: "Agenda", descricao: "Aulas, reservas e bloqueios de quadra." },
  alunos: { nome: "Alunos", curto: "Alunos", descricao: "Lista e fichas dos alunos." },
  professores: {
    nome: "Professores",
    curto: "Professores",
    descricao: "Fichas e repasses dos professores.",
  },
  financeiro: {
    nome: "Financeiro: a receber",
    curto: "Financeiro a receber",
    descricao: "Mensalidades, reservas e consumo.",
  },
  financeiro_pagar: {
    nome: "Financeiro: a pagar",
    curto: "Contas a pagar",
    descricao: "Despesas, fornecedores e repasses.",
  },
  estoque: { nome: "Estoque", curto: "Estoque", descricao: "Produtos do balcão e consumo." },
  ranking: { nome: "Ranking e torneios", curto: "Ranking", descricao: "Partidas, ranking e chaves." },
  configuracoes: {
    nome: "Configurações",
    curto: "Configurações",
    descricao: "Regras, planos e permissões.",
  },
  historico: {
    nome: "Histórico de alterações",
    curto: "Histórico",
    descricao: "Quem mudou o quê, e quando.",
  },
};

/** ["a", "b", "c"] -> "a, b e c" */
function listaComE(itens: string[]): string {
  return itens.length <= 1
    ? (itens[0] ?? "")
    : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** "Acesso a todo o sistema" ou "Agenda e Alunos". */
export function resumoDoAcesso(configuracoes: Configuracoes, perfil: Perfil): string {
  const modulos = configuracoes.permissoes[perfil] ?? [];
  if (MODULOS_DO_SISTEMA.every((m) => modulos.includes(m))) return "Acesso a todo o sistema";
  if (modulos.length === 0) return "Sem acesso a nenhuma área";
  return listaComE(
    MODULOS_DO_SISTEMA.filter((m) => modulos.includes(m)).map((m) => NOMES_DOS_MODULOS[m].curto),
  );
}

// ---------------------------------------------------------------------------
// Siglas e planos
// ---------------------------------------------------------------------------

/** Siglas oferecidas nos formularios (as desativadas ficam so no historico). */
export function siglasAtivas(configuracoes: Configuracoes): SiglaReposicao[] {
  return configuracoes.siglas.filter((s) => !s.desativada);
}

/** Quantas vezes cada codigo de sigla ja foi gravado (aulas, faltas e creditos). */
export function usoDasSiglas(banco: Banco): Map<string, number> {
  const uso = new Map<string, number>();
  const contar = (codigo?: string) => {
    if (codigo) uso.set(codigo, (uso.get(codigo) ?? 0) + 1);
  };
  banco.ocupacoes.forEach((o) => contar(o.motivoCancelamento));
  banco.ocupacaoAlunos.forEach((p) => contar(p.sigla));
  banco.reposicoes.forEach((r) => contar(r.sigla));
  return uso;
}

export interface PlanoNoCatalogo {
  plano: Plano;
  /** Matriculas que valem hoje ou comecam depois. */
  vigentes: number;
  /** Todas as matriculas, inclusive as encerradas. */
  total: number;
}

/** Catalogo de planos com o uso de cada um (o que trava apagar e mudar o tipo). */
export function catalogoDePlanos(
  banco: Banco,
  hoje: string,
): { itens: PlanoNoCatalogo[]; ativos: number } {
  const uso = new Map<string, { vigentes: number; total: number }>();
  banco.matriculas.forEach((m) => {
    const atual = uso.get(m.planoId) ?? { vigentes: 0, total: 0 };
    uso.set(m.planoId, {
      vigentes: atual.vigentes + (!m.fim || m.fim >= hoje ? 1 : 0),
      total: atual.total + 1,
    });
  });
  return {
    itens: banco.planos.map((plano) => ({ plano, ...(uso.get(plano.id) ?? { vigentes: 0, total: 0 }) })),
    ativos: banco.planos.filter((p) => p.ativo).length,
  };
}

/** Professores com a regra de repasse de cada um (Hipotese H6), os ativos primeiro. */
export function regrasDeRepasse(banco: Banco): Professor[] {
  return [...banco.professores].sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

// ---------------------------------------------------------------------------
// Historico de alteracoes
// ---------------------------------------------------------------------------

export const NOMES_DAS_TABELAS: Record<TabelaDoBanco, string> = {
  colaboradores: "Colaboradores",
  configuracoes: "Configurações",
  auditoria: "Histórico",
  comentarios: "Comentários",
  quadras: "Quadras",
  professores: "Professores",
  alunos: "Alunos",
  planos: "Planos",
  matriculas: "Matrículas",
  congelamentos: "Congelamentos",
  horariosFixos: "Horários fixos",
  horarioAlunos: "Alunos dos horários fixos",
  ocupacoes: "Aulas e reservas",
  ocupacaoAlunos: "Presenças e faltas",
  reposicoes: "Créditos de reposição",
  lancamentos: "Lançamentos financeiros",
  repasses: "Repasses",
  produtos: "Produtos",
  movimentosEstoque: "Movimentos de estoque",
  consumos: "Consumos",
  torneios: "Torneios",
  torneioInscritos: "Inscrições em torneio",
  partidas: "Partidas",
};

export const NOMES_DAS_ACOES: Record<RegistroAuditoria["acao"], string> = {
  criar: "Criou",
  alterar: "Alterou",
  apagar: "Apagou",
};

export interface FiltroDoHistorico {
  /** Vazio = todas as pessoas. */
  usuarioId?: string;
  tabela?: TabelaDoBanco | "";
  acao?: RegistroAuditoria["acao"] | "";
  /** Datas "YYYY-MM-DD" (inclusive). */
  de?: string;
  ate?: string;
}

/** Registros da auditoria que passam no filtro, do mais recente para o mais antigo. */
export function filtrarHistorico(banco: Banco, filtro: FiltroDoHistorico): RegistroAuditoria[] {
  // A auditoria e gravada em ordem; invertida, os empates de horario
  // tambem ficam do mais recente para o mais antigo.
  return [...banco.auditoria]
    .reverse()
    .filter((r) => {
      const dia = r.em.slice(0, 10);
      if (filtro.usuarioId && r.usuarioId !== filtro.usuarioId) return false;
      if (filtro.tabela && r.tabela !== filtro.tabela) return false;
      if (filtro.acao && r.acao !== filtro.acao) return false;
      if (filtro.de && dia < filtro.de) return false;
      if (filtro.ate && dia > filtro.ate) return false;
      return true;
    })
    .sort((a, b) => b.em.localeCompare(a.em));
}

/** Quem pode aparecer no filtro de pessoas: a equipe e quem ja aparece na auditoria. */
export function pessoasDoHistorico(banco: Banco): Array<{ id: string; nome: string }> {
  const pessoas = new Map(banco.colaboradores.map((c) => [c.id, c.nome]));
  banco.auditoria.forEach((r) => {
    if (!pessoas.has(r.usuarioId)) pessoas.set(r.usuarioId, r.usuarioNome);
  });
  return [...pessoas.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Tipos de registro que ja aparecem na auditoria, pelo nome amigavel. */
export function tabelasDoHistorico(banco: Banco): TabelaDoBanco[] {
  return [...new Set(banco.auditoria.map((r) => r.tabela))].sort((a, b) =>
    NOMES_DAS_TABELAS[a].localeCompare(NOMES_DAS_TABELAS[b], "pt-BR"),
  );
}

type Registro = Record<string, unknown>;

function conteudo(registro: RegistroAuditoria): Registro {
  return ((registro.depois ?? registro.antes) ?? {}) as Registro;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : valor === undefined ? "" : String(valor);
}

function nomeDoPlano(banco: Banco, id: unknown): string {
  return banco.planos.find((p) => p.id === id)?.nome ?? "plano removido";
}

function nomeDoProduto(banco: Banco, id: unknown): string {
  return banco.produtos.find((p) => p.id === id)?.nome ?? "produto removido";
}

function nomeDoTorneio(banco: Banco, id: unknown): string {
  return banco.torneios.find((t) => t.id === id)?.nome ?? "torneio removido";
}

function alunoDaMatricula(banco: Banco, matriculaId: unknown): string | undefined {
  return banco.matriculas.find((m) => m.id === matriculaId)?.alunoId;
}

function nomes(banco: Banco, ids: unknown): string {
  return Array.isArray(ids) ? ids.map((id) => nomeDaPessoa(banco, texto(id))).join(" e ") : "";
}

function quandoNaQuadra(r: Registro): string {
  return `${rotuloDaQuadra(r.quadraId as QuadraId)} · ${formatarDiaMes(texto(r.data))} ${texto(r.horaInicio)}`;
}

/** Uma linha que diz qual registro mudou ("Plano Individual · 1x por semana"). */
export function descreverRegistro(banco: Banco, registro: RegistroAuditoria): string {
  const r = conteudo(registro);
  switch (registro.tabela) {
    case "configuracoes": {
      // O registro de configuracoes e um so: o que interessa e quais regras mudaram.
      const antes = (registro.antes ?? {}) as Registro;
      const mudaram = Object.keys(r).filter(
        (campo) => JSON.stringify(antes[campo]) !== JSON.stringify(r[campo]),
      );
      return mudaram.length > 0 ? listaComE(mudaram.map(rotuloDoCampo)) : "Regras da arena";
    }
    case "colaboradores":
    case "professores":
    case "alunos":
    case "planos":
    case "produtos":
    case "torneios":
    case "quadras":
      return texto(r.nome) || registro.registroId;
    case "comentarios": {
      const comentario = texto(r.texto);
      return `"${comentario.length > 60 ? `${comentario.slice(0, 60)}…` : comentario}"`;
    }
    case "matriculas":
      return `${nomeDaPessoa(banco, texto(r.alunoId))} · ${nomeDoPlano(banco, r.planoId)}`;
    case "congelamentos":
      return `${nomeDaPessoa(banco, alunoDaMatricula(banco, r.matriculaId))} · ${texto(r.motivo)}`;
    case "horariosFixos":
      return `${rotuloDaQuadra(r.quadraId as QuadraId)} · ${DIAS_SEMANA_LONGO[Number(r.diaSemana)] ?? ""} ${texto(r.horaInicio)}`;
    case "horarioAlunos":
      return nomeDaPessoa(banco, texto(r.alunoId));
    case "ocupacoes":
      return `${texto(r.tipo)} · ${quandoNaQuadra(r)}`;
    case "ocupacaoAlunos": {
      const ocupacao = banco.ocupacoes.find((o) => o.id === r.ocupacaoId);
      return `${nomeDaPessoa(banco, texto(r.alunoId))}${ocupacao ? ` · ${quandoNaQuadra(ocupacao as unknown as Registro)}` : ""}`;
    }
    case "reposicoes": {
      const minutos = Number(r.minutos);
      return `${minutos > 0 ? "Crédito" : "Uso"} de ${Math.abs(minutos)} min · ${nomeDaPessoa(banco, texto(r.alunoId))}`;
    }
    case "lancamentos":
      return `${texto(r.item)} · ${formatarReais(Number(r.valor))}`;
    case "repasses":
      return `${nomeDaPessoa(banco, texto(r.professorId))} · ${texto(r.competencia)}`;
    case "movimentosEstoque":
      return `${texto(r.tipo)} de ${texto(r.quantidade)} · ${nomeDoProduto(banco, r.produtoId)}`;
    case "consumos":
      return `${texto(r.quantidade)}× ${texto(r.produtoNome)} · ${nomeDaPessoa(banco, texto(r.pessoaId))}`;
    case "torneioInscritos":
      return `${nomes(banco, r.alunosIds)} · ${nomeDoTorneio(banco, r.torneioId)}`;
    case "partidas":
      return `${nomes(banco, r.ladoA)} x ${nomes(banco, r.ladoB)}`;
    default:
      return registro.registroId;
  }
}

/**
 * Tela onde o registro aparece, para o "Abrir" do historico (sem link quando
 * nao ha uma tela propria para ele).
 */
export function telaDoRegistro(banco: Banco, registro: RegistroAuditoria): string | undefined {
  const r = conteudo(registro);
  const ficha = (alunoId: unknown) =>
    banco.alunos.some((a) => a.id === alunoId) ? `/alunos/${texto(alunoId)}` : undefined;

  switch (registro.tabela) {
    case "configuracoes":
      return "/configuracoes";
    case "planos":
      return "/configuracoes#planos";
    case "alunos":
      return ficha(registro.registroId);
    case "matriculas":
    case "reposicoes":
    case "horarioAlunos":
    case "ocupacaoAlunos":
      return ficha(r.alunoId);
    case "congelamentos":
      return ficha(alunoDaMatricula(banco, r.matriculaId));
    case "professores":
      return banco.professores.some((p) => p.id === registro.registroId)
        ? `/professores/${registro.registroId}`
        : undefined;
    case "ocupacoes":
    case "horariosFixos":
      return "/agenda";
    case "lancamentos":
    case "repasses":
      return "/financeiro";
    case "produtos":
    case "movimentosEstoque":
    case "consumos":
      return "/estoque";
    case "torneios":
    case "torneioInscritos":
    case "partidas":
      return "/ranking";
    case "comentarios":
      return r.entidade === "aluno" ? ficha(r.entidadeId) : undefined;
    default:
      return undefined;
  }
}

// --- Campos e valores -------------------------------------------------------

const ROTULOS_DOS_CAMPOS: Record<string, string> = {
  // Configuracoes
  siglas: "Siglas de reposição",
  validadeReposicaoMeses: "Validade da reposição (meses)",
  prazoPagamentoReservaHoras: "Prazo para pagar a reserva (horas)",
  liberarReservaAutomaticamente: "Liberar reserva vencida sozinho",
  semanasGeradasAFrente: "Semanas da agenda geradas à frente",
  bloquearProfessorEmDuasAulas: "Impedir professor em duas aulas",
  pontosVitoria: "Pontos por vitória",
  pontosDerrota: "Pontos por derrota",
  torneioContaParaRanking: "Torneio conta para o ranking",
  classificadosPorGrupo: "Classificados por grupo",
  criteriosDesempate: "Critérios de desempate",
  formasPagamento: "Formas de pagamento",
  prazoPagamentoConsumoDias: "Prazo para pagar o consumo (dias)",
  precoLocacaoHora: "Preço da hora de locação (quadras)",
  precoParedaoHora: "Preço da hora de locação (paredão)",
  permissoes: "Permissões",
  // Pessoas e cadastros
  nome: "Nome",
  cargo: "Cargo",
  perfil: "Perfil",
  ativo: "Ativo",
  telefone: "Telefone",
  email: "E-mail",
  dataNascimento: "Nascimento",
  especialidade: "Especialidade",
  cor: "Cor",
  repasse: "Regra de repasse",
  professorId: "Professor",
  professorPrincipalId: "Professor principal",
  fotoUrl: "Foto",
  inscritoRanking: "Inscrito no ranking",
  categoriaRanking: "Categoria do ranking",
  criadoEm: "Criado em",
  piso: "Piso",
  ordem: "Ordem",
  // Planos e matriculas
  tipo: "Tipo",
  valorMensal: "Valor mensal",
  aulasPorSemana: "Aulas por semana",
  duracaoMinutos: "Duração (minutos)",
  tabela: "Tabela",
  alunoId: "Aluno",
  planoId: "Plano",
  diaVencimento: "Dia do vencimento",
  inicio: "Início",
  fim: "Fim",
  matriculaId: "Matrícula",
  fimPrevisto: "Fim previsto",
  fimReal: "Fim real",
  motivo: "Motivo",
  // Agenda e reposicao
  quadraId: "Quadra",
  data: "Data",
  diaSemana: "Dia da semana",
  horaInicio: "Início",
  horaFim: "Fim",
  horarioFixoId: "Horário fixo",
  situacao: "Situação",
  motivoCancelamento: "Motivo do cancelamento",
  canceladaEm: "Cancelada em",
  prazoPagamento: "Prazo para pagar",
  descricao: "Descrição",
  ocupacaoId: "Aula ou reserva",
  presenca: "Presença",
  sigla: "Sigla",
  minutos: "Minutos",
  ocupacaoOrigemId: "Aula que gerou",
  ocupacaoUsoId: "Aula onde foi usado",
  validade: "Validade",
  observacao: "Observação",
  // Financeiro
  categoria: "Categoria",
  pessoaId: "Pessoa",
  pessoaTipo: "Tipo de pessoa",
  nomePagante: "Quem pagou",
  item: "Item",
  valor: "Valor",
  vencimento: "Vencimento",
  pagoEm: "Pago em",
  formaPagamento: "Forma de pagamento",
  valorConvenio: "Parte do convênio",
  comprovante: "Comprovante",
  competencia: "Mês de referência",
  consumoId: "Consumo",
  torneioId: "Torneio",
  repasseId: "Repasse",
  canceladoEm: "Anulado em",
  aulasDadas: "Aulas dadas",
  minutosDados: "Minutos dados",
  valorPrevisto: "Valor previsto",
  fechadoEm: "Fechado em",
  // Estoque
  unidade: "Unidade",
  precoCusto: "Preço de custo",
  precoVenda: "Preço de venda",
  estoqueMinimo: "Estoque mínimo",
  produtoId: "Produto",
  quantidade: "Quantidade",
  responsavel: "Responsável",
  produtoNome: "Nome do produto na venda",
  valorUnitario: "Valor unitário",
  // Comentarios
  entidade: "Registro comentado",
  entidadeId: "Código do registro",
  texto: "Texto",
  autorId: "Autor",
  autorNome: "Autor",
  editadoEm: "Editado em",
  // Ranking e torneios
  formato: "Formato",
  duplas: "Duplas",
  alunosIds: "Inscritos",
  cabecaDeChave: "Cabeça de chave",
  grupo: "Grupo",
  ladoA: "Lado A",
  ladoB: "Lado B",
  placar: "Placar",
  vencedor: "Vencedor",
  wo: "W.O.",
  inscricaoAId: "Inscrição A",
  inscricaoBId: "Inscrição B",
  fase: "Fase",
  rodada: "Rodada",
  proximaPartidaId: "Próxima partida",
  ladoNaProxima: "Lado na próxima",
};

export function rotuloDoCampo(campo: string): string {
  return ROTULOS_DOS_CAMPOS[campo] ?? campo;
}

const CAMPOS_EM_REAIS = new Set([
  "valor",
  "valorMensal",
  "valorConvenio",
  "valorPrevisto",
  "valorUnitario",
  "precoCusto",
  "precoVenda",
  "precoLocacaoHora",
  "precoParedaoHora",
]);

const CAMPOS_DE_PESSOA = new Set([
  "alunoId",
  "professorId",
  "professorPrincipalId",
  "pessoaId",
  "autorId",
]);

/** Valores guardados como codigo, por campo ("aguardando_pagamento" -> "aguardando pagamento"). */
const VALORES_POR_CAMPO: Record<string, Record<string, string>> = {
  situacao: {
    agendada: "agendada",
    aguardando_pagamento: "aguardando pagamento",
    realizada: "realizada",
    cancelada: "cancelada",
    inscricoes: "inscrições abertas",
    em_andamento: "em andamento",
    encerrado: "encerrado",
  },
  presenca: {
    a_marcar: "a marcar",
    presente: "presente",
    falta: "falta",
    falta_avisada: "falta avisada",
  },
  perfil: NOMES_DOS_PERFIS,
  tipo: { receber: "a receber", pagar: "a pagar" },
  entidade: {
    aluno: "aluno",
    professor: "professor",
    ocupacao: "aula ou reserva",
    lancamento: "lançamento",
    produto: "produto",
    torneio: "torneio",
    partida: "partida",
  },
  tabela: { nova: "tabela nova", antiga: "tabela antiga" },
  aplicaA: { ocupacao: "aula inteira", aluno: "um aluno", ambos: "os dois" },
  formato: {
    eliminatoria: "eliminatória simples",
    grupos_eliminatoria: "grupos + eliminatória",
    todos_contra_todos: "todos contra todos",
  },
};

function formatarReais(valor: number): string {
  return Number.isFinite(valor)
    ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

function nomesDosModulos(modulos: ModuloSistema[]): string {
  return modulos.map((m) => NOMES_DOS_MODULOS[m]?.nome ?? m).join(", ");
}

/** Valor de um campo em linguagem simples, para o detalhe do historico. */
export function formatarValorDoCampo(banco: Banco, campo: string, valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "vazio";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "number") {
    if (CAMPOS_EM_REAIS.has(campo)) return formatarReais(valor);
    if (campo === "diaSemana") return DIAS_SEMANA_LONGO[valor] ?? String(valor);
    return valor.toLocaleString("pt-BR");
  }
  if (typeof valor === "string") {
    if (CAMPOS_DE_PESSOA.has(campo)) return nomeDaPessoa(banco, valor);
    if (campo === "planoId") return nomeDoPlano(banco, valor);
    if (campo === "produtoId") return nomeDoProduto(banco, valor);
    if (campo === "torneioId") return nomeDoTorneio(banco, valor);
    if (campo === "quadraId") return rotuloDaQuadra(valor as QuadraId);
    const traduzido = VALORES_POR_CAMPO[campo]?.[valor];
    if (traduzido) return traduzido;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarData(valor);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) return formatarDataHora(valor);
    return valor;
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "nenhum";
    if (campo === "siglas") {
      return (valor as SiglaReposicao[])
        .map((s) => `${s.codigo}${s.desativada ? " (desativada)" : ""}`)
        .join(", ");
    }
    if (campo === "alunosIds" || campo === "ladoA" || campo === "ladoB") return nomes(banco, valor);
    return valor.map((item) => texto(item)).join(", ");
  }
  if (campo === "permissoes") {
    const permissoes = valor as Permissoes;
    return (Object.keys(NOMES_DOS_PERFIS) as Perfil[])
      .map((perfil) => `${NOMES_DOS_PERFIS[perfil]}: ${nomesDosModulos(permissoes[perfil] ?? [])}`)
      .join(" · ");
  }
  if (campo === "repasse") {
    const repasse = valor as { modo?: string; valor?: number };
    return repasse.modo === "percentual"
      ? `${repasse.valor}% das mensalidades`
      : `${formatarReais(Number(repasse.valor))} por hora-aula`;
  }
  return JSON.stringify(valor);
}

/** Referencias que viram nome no detalhe (as outras sao codigos internos). */
const REFERENCIAS_COM_NOME = new Set([
  ...CAMPOS_DE_PESSOA,
  "planoId",
  "produtoId",
  "torneioId",
  "quadraId",
]);

/**
 * Campos de um registro criado ou apagado, para o detalhe do historico:
 * sem os vazios e sem os codigos internos ("id", "ocupacaoId"...), que nao
 * dizem nada a quem le.
 */
export function camposDoRegistro(
  registro: RegistroAuditoria,
): Array<{ campo: string; valor: unknown }> {
  return Object.entries(conteudo(registro))
    .filter(([campo, valor]) => {
      if (valor === undefined || valor === "") return false;
      const codigoInterno = campo === "id" || (campo.endsWith("Id") && !REFERENCIAS_COM_NOME.has(campo));
      // O nome do autor ja vem gravado no proprio comentario.
      return !codigoInterno && campo !== "autorId";
    })
    .map(([campo, valor]) => ({ campo, valor }));
}

/** O que mudou nas permissoes, perfil a perfil ("Recepção: passou a ver Histórico"). */
export function mudancasNasPermissoes(antes: unknown, depois: unknown): string[] {
  const a = (antes ?? {}) as Partial<Permissoes>;
  const d = (depois ?? {}) as Partial<Permissoes>;
  return (Object.keys(NOMES_DOS_PERFIS) as Perfil[]).flatMap((perfil) => {
    const tinha = a[perfil] ?? [];
    const tem = d[perfil] ?? [];
    const ganhou = tem.filter((m) => !tinha.includes(m));
    const perdeu = tinha.filter((m) => !tem.includes(m));
    const partes = [
      ganhou.length > 0 && `passou a ver ${nomesDosModulos(ganhou)}`,
      perdeu.length > 0 && `deixou de ver ${nomesDosModulos(perdeu)}`,
    ].filter(Boolean);
    return partes.length > 0 ? [`${NOMES_DOS_PERFIS[perfil]}: ${partes.join("; ")}`] : [];
  });
}

const CAMPOS_DA_SIGLA: Array<keyof SiglaReposicao> = ["nome", "descricao", "geraCredito", "aplicaA"];
const ROTULOS_DA_SIGLA: Record<string, string> = {
  nome: "nome",
  descricao: "descrição",
  geraCredito: "gera crédito",
  aplicaA: "vale para",
};

/**
 * O que mudou na lista de siglas. As operacoes nunca apagam nem mudam a
 * ordem das siglas, entao a posicao identifica cada uma.
 */
export function mudancasNasSiglas(banco: Banco, antes: unknown, depois: unknown): string[] {
  const a = (Array.isArray(antes) ? antes : []) as SiglaReposicao[];
  const d = (Array.isArray(depois) ? depois : []) as SiglaReposicao[];
  const linhas: string[] = [];

  d.forEach((nova, i) => {
    const velha = a[i];
    if (!velha) {
      linhas.push(`Incluída a sigla ${nova.codigo} (${nova.nome})`);
      return;
    }
    if (velha.codigo !== nova.codigo) {
      linhas.push(`Código da sigla ${velha.codigo} passou a ser ${nova.codigo}`);
    }
    if (!velha.desativada !== !nova.desativada) {
      linhas.push(`${nova.desativada ? "Desativada" : "Reativada"} a sigla ${nova.codigo}`);
    }
    CAMPOS_DA_SIGLA.forEach((campo) => {
      if (velha[campo] === nova[campo]) return;
      linhas.push(
        `Sigla ${nova.codigo}, ${ROTULOS_DA_SIGLA[campo]}: ${formatarValorDoCampo(banco, campo, velha[campo])} → ${formatarValorDoCampo(banco, campo, nova[campo])}`,
      );
    });
  });
  a.slice(d.length).forEach((velha) => linhas.push(`Removida a sigla ${velha.codigo}`));
  return linhas;
}
