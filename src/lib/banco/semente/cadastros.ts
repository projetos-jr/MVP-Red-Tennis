/**
 * Dados de exemplo: cadastros (quadras, professores, alunos, planos,
 * matriculas, congelamentos, colaboradores) e configuracoes iniciais.
 *
 * O cadastro de alunos tem duas camadas, herdadas do MVP:
 *  1. ALUNOS_PRINCIPAIS — os 23 membros inscritos no ranking, com foto em
 *     /public/avatars. Telefones e e-mails sao inventados.
 *  2. Demais matriculados, gerados a partir de listas de nomes, para que a
 *     grade semanal tenha um numero plausivel de pessoas.
 */

import { somarDias, somarMeses } from "../../date";
import { HOJE } from "../constantes";
import type {
  Aluno,
  CategoriaRanking,
  Colaborador,
  Configuracoes,
  Congelamento,
  Matricula,
  Plano,
  Professor,
  Quadra,
  TipoPlano,
} from "../tipos";
import { criarRng, escolher, inteiro } from "./aleatorio";

/** Plano como estava no MVP — "Locação Avulsa" quer dizer: sem plano mensal. */
export type PlanoDoMvp = Exclude<TipoPlano, "Plano de locação"> | "Locação Avulsa";

/**
 * Informacoes usadas so para gerar os outros dados de exemplo (grade,
 * pagamentos, partidas). Nao fazem parte do banco.
 */
export interface PerfilDeSemente {
  alunoId: string;
  nome: string;
  planoDoMvp: PlanoDoMvp;
  mesesDeCasa: number;
  professorPrincipalId?: string;
  congelado: boolean;
  motivoCongelamento?: string;
  /** Nivel de jogo (pontuacao do MVP) — decide quem tende a vencer as partidas. */
  forca: number;
  categoriaRanking: CategoriaRanking;
  diaVencimento: number;
  /** true para os 23 membros do ranking. */
  principal: boolean;
  /** Sobrenome, quando o nome tem um (usado para gerar pagantes diferentes). */
  sobrenome?: string;
}

// ---------------------------------------------------------------------------
// Professores, quadras e colaboradores
// ---------------------------------------------------------------------------

export const PROFESSORES: Professor[] = [
  {
    id: "prof-1",
    nome: "Alexandre Pires",
    cor: "#0E7490",
    especialidade: "Alto rendimento e competição",
    telefone: "(11) 98100-2201",
    email: "alexandre.pires@email.com",
    repasse: { modo: "por_hora", valor: 78 },
    ativo: true,
  },
  {
    id: "prof-2",
    nome: "Renata Coelho",
    cor: "#A16207",
    especialidade: "Iniciação e turmas infantis",
    telefone: "(11) 98100-2202",
    email: "renata.coelho@email.com",
    repasse: { modo: "por_hora", valor: 68 },
    ativo: true,
  },
  {
    id: "prof-3",
    nome: "Márcio Bueno",
    cor: "#4D7C0F",
    especialidade: "Adulto, LAP e recreativo",
    telefone: "(11) 98100-2203",
    email: "marcio.bueno@email.com",
    repasse: { modo: "por_hora", valor: 72 },
    ativo: true,
  },
];

const ID_PROFESSOR_POR_NOME: Record<string, string> = Object.fromEntries(
  PROFESSORES.map((p) => [p.nome, p.id]),
);

export const QUADRAS: Quadra[] = [
  { id: "1", nome: "Quadra 1", piso: "cimento", ordem: 1 },
  { id: "2", nome: "Quadra 2", piso: "saibro", ordem: 2 },
  { id: "3", nome: "Quadra 3", piso: "saibro", ordem: 3 },
  { id: "4", nome: "Quadra 4", piso: "saibro", ordem: 4 },
  { id: "paredao", nome: "Paredão", piso: "saibro", ordem: 5 },
];

export const COLABORADORES: Colaborador[] = [
  {
    id: "u-francisco",
    nome: "Francisco Menezes",
    cargo: "Diretor",
    perfil: "dono",
    ativo: true,
  },
  {
    id: "u-lucas",
    nome: "Lucas Ferreira",
    cargo: "Recepção",
    perfil: "recepcao",
    ativo: true,
  },
  {
    id: "u-renata",
    nome: "Renata Coelho",
    cargo: "Professora",
    perfil: "professor",
    professorId: "prof-2",
    ativo: true,
  },
];

// ---------------------------------------------------------------------------
// Configuracoes iniciais (hipoteses da secao 4 de docs/MODELO-E-TELAS.md)
// ---------------------------------------------------------------------------

export const CONFIGURACOES_INICIAIS: Configuracoes = {
  siglas: [
    {
      codigo: "CH",
      nome: "Chuva",
      descricao: "Aula cancelada por chuva.",
      geraCredito: true,
      aplicaA: "ocupacao",
    },
    {
      codigo: "24h",
      nome: "Aviso prévio de 24h",
      descricao: "Aluno avisou com no mínimo 24 horas de antecedência.",
      geraCredito: true,
      aplicaA: "aluno",
    },
    {
      codigo: "FP",
      nome: "Falta do professor",
      descricao: "Ausência do professor.",
      geraCredito: true,
      aplicaA: "ocupacao",
    },
    {
      codigo: "IAC",
      nome: "Interesse da academia",
      descricao: "Remanejamento por evento, manutenção ou torneio.",
      geraCredito: true,
      aplicaA: "ocupacao",
    },
    {
      codigo: "TIP",
      nome: "Transferência por interesse do professor",
      descricao: "Troca de horário pedida pelo professor.",
      geraCredito: true,
      aplicaA: "ambos",
    },
  ],
  validadeReposicaoMeses: 3,
  prazoPagamentoReservaHoras: 24,
  liberarReservaAutomaticamente: false,
  semanasGeradasAFrente: 12,
  bloquearProfessorEmDuasAulas: false,
  pontosVitoria: 10,
  pontosDerrota: 2,
  torneioContaParaRanking: false,
  classificadosPorGrupo: 2,
  criteriosDesempate: ["Vitórias", "Confronto direto", "Saldo de sets", "Saldo de games"],
  formasPagamento: ["Stone", "Bradesco", "Total Pass", "Dinheiro"],
  prazoPagamentoConsumoDias: 7,
  precoLocacaoHora: 120,
  precoParedaoHora: 60,
  permissoes: {
    dono: [
      "painel",
      "agenda",
      "alunos",
      "professores",
      "financeiro",
      "financeiro_pagar",
      "estoque",
      "ranking",
      "configuracoes",
      "historico",
    ],
    recepcao: ["painel", "agenda", "alunos", "professores", "financeiro", "estoque", "ranking"],
    professor: ["agenda", "alunos"],
  },
};

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export const PLANOS: Plano[] = [
  { id: "pl-ind", nome: "Individual · 1x por semana", tipo: "Individual", valorMensal: 720, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "nova", ativo: true },
  { id: "pl-ind-ant", nome: "Individual · 1x por semana (tabela antiga)", tipo: "Individual", valorMensal: 640, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "antiga", ativo: true },
  { id: "pl-dup", nome: "Dupla · 1x por semana", tipo: "Dupla", valorMensal: 520, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "nova", ativo: true },
  { id: "pl-dup-ant", nome: "Dupla · 1x por semana (tabela antiga)", tipo: "Dupla", valorMensal: 460, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "antiga", ativo: true },
  { id: "pl-lap", nome: "LAP · 1x por semana", tipo: "LAP", valorMensal: 380, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "nova", ativo: true },
  { id: "pl-loc", nome: "Locação mensal · 1h por semana", tipo: "Locação Mensal", valorMensal: 640, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "nova", ativo: true },
  // Hipotese H2: significado do plano amarelo ainda a confirmar com a arena.
  { id: "pl-pdl", nome: "Plano de locação (a confirmar)", tipo: "Plano de locação", valorMensal: 560, aulasPorSemana: 1, duracaoMinutos: 60, tabela: "nova", ativo: true },
];

/** Plano de cada tipo, conforme a tabela (antiga para quem tem 2 anos ou mais de casa). */
function planoPara(tipo: PlanoDoMvp, mesesDeCasa: number): Plano | undefined {
  const antiga = mesesDeCasa >= 24;
  switch (tipo) {
    case "Individual":
      return PLANOS.find((p) => p.id === (antiga ? "pl-ind-ant" : "pl-ind"));
    case "Dupla":
      return PLANOS.find((p) => p.id === (antiga ? "pl-dup-ant" : "pl-dup"));
    case "LAP":
      return PLANOS.find((p) => p.id === "pl-lap");
    case "Locação Mensal":
      return PLANOS.find((p) => p.id === "pl-loc");
    case "Locação Avulsa":
      return undefined;
  }
}

/** Plano anterior plausivel, para quem trocou de plano. */
const PLANO_ANTERIOR: Partial<Record<PlanoDoMvp, PlanoDoMvp>> = {
  Individual: "LAP",
  Dupla: "Individual",
  LAP: "Dupla",
};

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------

interface AlunoDoMvp {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  plano: PlanoDoMvp;
  mesesDeCasa: number;
  professorPrincipal: string;
  planoCongelado: boolean;
  motivoCongelamento?: string;
  rankingPontuacao: number;
  categoriaRanking: CategoriaRanking;
  diaVencimento: number;
}

const SEM_PROFESSOR = "Sem professor";

const ALUNOS_PRINCIPAIS: AlunoDoMvp[] = [
  { id: "a01", nome: "Guilherme Lima", telefone: "(11) 98812-4471", email: "guilherme.lima@email.com", plano: "Individual", mesesDeCasa: 31, professorPrincipal: "Alexandre Pires", planoCongelado: false, rankingPontuacao: 1480, categoriaRanking: "A", diaVencimento: 5 },
  { id: "a02", nome: "Anna Beatriz", telefone: "(11) 99640-2210", email: "anna.beatriz@email.com", plano: "Individual", mesesDeCasa: 27, professorPrincipal: "Alexandre Pires", planoCongelado: false, rankingPontuacao: 1442, categoriaRanking: "A", diaVencimento: 10 },
  { id: "a03", nome: "Larissa Preto", telefone: "(11) 97733-1908", email: "larissa.preto@email.com", plano: "Dupla", mesesDeCasa: 34, professorPrincipal: "Márcio Bueno", planoCongelado: false, rankingPontuacao: 1398, categoriaRanking: "A", diaVencimento: 5 },
  { id: "a04", nome: "Felipe Ikeda", telefone: "(11) 98120-6654", email: "felipe.ikeda@email.com", plano: "Individual", mesesDeCasa: 19, professorPrincipal: "Alexandre Pires", planoCongelado: false, rankingPontuacao: 1355, categoriaRanking: "B", diaVencimento: 15 },
  { id: "a05", nome: "Igor", telefone: "(11) 99012-7745", email: "igor@email.com", plano: "Locação Mensal", mesesDeCasa: 14, professorPrincipal: SEM_PROFESSOR, planoCongelado: false, rankingPontuacao: 1327, categoriaRanking: "B", diaVencimento: 15 },
  { id: "a06", nome: "Leonardo Aguilar", telefone: "(11) 98455-3321", email: "leonardo.aguilar@email.com", plano: "Individual", mesesDeCasa: 22, professorPrincipal: "Renata Coelho", planoCongelado: false, rankingPontuacao: 1298, categoriaRanking: "B", diaVencimento: 20 },
  { id: "a07", nome: "Eduardo Piton", telefone: "(11) 97188-9902", email: "eduardo.piton@email.com", plano: "LAP", mesesDeCasa: 11, professorPrincipal: "Márcio Bueno", planoCongelado: false, rankingPontuacao: 1274, categoriaRanking: "B", diaVencimento: 10 },
  { id: "a08", nome: "Isadora", telefone: "(11) 99807-5512", email: "isadora@email.com", plano: "Dupla", mesesDeCasa: 25, professorPrincipal: "Renata Coelho", planoCongelado: false, rankingPontuacao: 1251, categoriaRanking: "B", diaVencimento: 5 },
  { id: "a09", nome: "Lucas", telefone: "(11) 98344-1180", email: "lucas@email.com", plano: "Individual", mesesDeCasa: 37, professorPrincipal: "Alexandre Pires", planoCongelado: true, motivoCongelamento: "Viagem a trabalho — retorno previsto em 45 dias", rankingPontuacao: 1228, categoriaRanking: "B", diaVencimento: 15 },
  { id: "a10", nome: "Gustavo", telefone: "(11) 99551-4408", email: "gustavo@email.com", plano: "Individual", mesesDeCasa: 8, professorPrincipal: "Renata Coelho", planoCongelado: false, rankingPontuacao: 1205, categoriaRanking: "B", diaVencimento: 25 },
  { id: "a11", nome: "Henrique", telefone: "(11) 97622-3096", email: "henrique@email.com", plano: "LAP", mesesDeCasa: 6, professorPrincipal: "Márcio Bueno", planoCongelado: false, rankingPontuacao: 1180, categoriaRanking: "C", diaVencimento: 20 },
  { id: "a12", nome: "Rafael", telefone: "(11) 98979-6631", email: "rafael@email.com", plano: "Individual", mesesDeCasa: 16, professorPrincipal: "Alexandre Pires", planoCongelado: false, rankingPontuacao: 1158, categoriaRanking: "C", diaVencimento: 10 },
  { id: "a13", nome: "Samuel", telefone: "(11) 99236-7714", email: "samuel@email.com", plano: "Dupla", mesesDeCasa: 12, professorPrincipal: "Márcio Bueno", planoCongelado: false, rankingPontuacao: 1136, categoriaRanking: "C", diaVencimento: 20 },
  { id: "a14", nome: "Froner", telefone: "(11) 98701-2245", email: "froner@email.com", plano: "Individual", mesesDeCasa: 29, professorPrincipal: "Alexandre Pires", planoCongelado: false, rankingPontuacao: 1112, categoriaRanking: "C", diaVencimento: 5 },
  { id: "a15", nome: "Thiago", telefone: "(11) 97455-8820", email: "thiago@email.com", plano: "Locação Mensal", mesesDeCasa: 41, professorPrincipal: SEM_PROFESSOR, planoCongelado: false, rankingPontuacao: 1089, categoriaRanking: "C", diaVencimento: 15 },
  { id: "a16", nome: "Liu", telefone: "(11) 99118-3374", email: "liu@email.com", plano: "Individual", mesesDeCasa: 7, professorPrincipal: "Renata Coelho", planoCongelado: false, rankingPontuacao: 1066, categoriaRanking: "C", diaVencimento: 25 },
  { id: "a17", nome: "Alice", telefone: "(11) 98266-9951", email: "alice@email.com", plano: "Dupla", mesesDeCasa: 13, professorPrincipal: "Renata Coelho", planoCongelado: false, rankingPontuacao: 1042, categoriaRanking: "D", diaVencimento: 10 },
  { id: "a18", nome: "Caio", telefone: "(11) 99884-1127", email: "caio@email.com", plano: "LAP", mesesDeCasa: 4, professorPrincipal: "Márcio Bueno", planoCongelado: false, rankingPontuacao: 1020, categoriaRanking: "D", diaVencimento: 20 },
  // Motivo neutro: os dados de exemplo nao inventam informacao de saude sobre membros reais.
  { id: "a19", nome: "Maria Luiza", telefone: "(11) 97390-6608", email: "maria.luiza@email.com", plano: "Individual", mesesDeCasa: 9, professorPrincipal: "Renata Coelho", planoCongelado: true, motivoCongelamento: "Pausa a pedido do aluno", rankingPontuacao: 998, categoriaRanking: "D", diaVencimento: 5 },
  { id: "a20", nome: "Lucas Freitas", telefone: "(11) 98533-7742", email: "lucas.freitas@email.com", plano: "Locação Avulsa", mesesDeCasa: 3, professorPrincipal: SEM_PROFESSOR, planoCongelado: false, rankingPontuacao: 975, categoriaRanking: "D", diaVencimento: 1 },
  { id: "a21", nome: "Pedro Linhares", telefone: "(11) 99427-1165", email: "pedro.linhares@email.com", plano: "Individual", mesesDeCasa: 10, professorPrincipal: "Alexandre Pires", planoCongelado: false, rankingPontuacao: 953, categoriaRanking: "D", diaVencimento: 15 },
  { id: "a22", nome: "Larissa Farraresi", telefone: "(11) 97806-4432", email: "larissa.farraresi@email.com", plano: "Dupla", mesesDeCasa: 18, professorPrincipal: "Renata Coelho", planoCongelado: false, rankingPontuacao: 931, categoriaRanking: "D", diaVencimento: 5 },
  { id: "a23", nome: "João Xuxa", telefone: "(11) 98159-2287", email: "joao.xuxa@email.com", plano: "Locação Avulsa", mesesDeCasa: 2, professorPrincipal: SEM_PROFESSOR, planoCongelado: false, rankingPontuacao: 916, categoriaRanking: "D", diaVencimento: 1 },
];

const PRIMEIROS_NOMES = [
  "Adriana", "Alice", "André", "Beatriz", "Caio", "Camila", "Cecília", "César",
  "Clara", "Diego", "Elisa", "Enzo", "Fábio", "Fernanda", "Gustavo", "Helena",
  "Igor", "Ingrid", "Júlia", "Leandro", "Letícia", "Manuela", "Matheus",
  "Natália", "Paulo", "Priscila", "Renan", "Rodrigo", "Samira", "Sérgio",
  "Tatiana", "Vinícius", "Yasmin", "Alexandre", "Bianca", "Douglas", "Estela",
  "Fabiana", "Guilherme", "Heloísa",
];

const SOBRENOMES = [
  "Albuquerque", "Barreto", "Carvalho", "Dias", "Esteves", "Fontoura",
  "Guimarães", "Hernandes", "Iglesias", "Junqueira", "Klein", "Lacerda",
  "Machado", "Nogueira", "Oliveira", "Pacheco", "Queiroz", "Ribeiro",
  "Salgado", "Teixeira", "Uchôa", "Valadares", "Wagner", "Xavier", "Yamada",
  "Zanetti", "Assunção", "Bittencourt", "Cordeiro", "Drummond", "Espósito",
  "Falcão", "Gouveia", "Holanda", "Ivo", "Jordão", "Krueger", "Lombardi",
  "Monteiro", "Novaes",
];

const PLANOS_EXTRAS: PlanoDoMvp[] = [
  "Individual", "Individual", "Individual",
  "Dupla", "Dupla",
  "LAP", "LAP",
  "Locação Mensal",
  "Locação Avulsa",
];

const NOMES_PROFESSORES = PROFESSORES.map((p) => p.nome);

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Demais matriculados (mesma geracao do MVP: mesma lista em todo carregamento). */
function gerarAlunosExtras(quantidade: number): AlunoDoMvp[] {
  const rng = criarRng(20260911);
  const usados = new Set(ALUNOS_PRINCIPAIS.map((a) => a.nome));
  const extras: AlunoDoMvp[] = [];

  let tentativa = 0;
  while (extras.length < quantidade && tentativa < quantidade * 12) {
    tentativa += 1;
    const nome = `${escolher(rng, PRIMEIROS_NOMES)} ${escolher(rng, SOBRENOMES)}`;
    if (usados.has(nome)) continue;
    usados.add(nome);

    const indice = extras.length;
    const plano = escolher(rng, PLANOS_EXTRAS);
    const [primeiro, ultimo] = nome.toLowerCase().split(" ");

    // A ordem dos sorteios repete a do MVP, para os nomes gerados continuarem
    // os mesmos. Os sorteios descartados eram campos que agora sao calculados.
    const telefone = `(11) 9${inteiro(rng, 6000, 9999)}-${inteiro(rng, 1000, 9999)}`;
    const mesesDeCasa = inteiro(rng, 1, 44);
    const professorPrincipal =
      plano === "Locação Mensal" || plano === "Locação Avulsa"
        ? SEM_PROFESSOR
        : escolher(rng, NOMES_PROFESSORES);
    escolher(rng, [0, 0, 30, 60, 60, 90, 120]); // saldo de reposicao do MVP
    const planoCongelado = rng() > 0.94;
    const rankingPontuacao = inteiro(rng, 580, 915);
    inteiro(rng, -4, 4); // variacao no ranking do MVP
    const diaVencimento = inteiro(rng, 1, 28);

    extras.push({
      id: `b${String(indice + 1).padStart(2, "0")}`,
      nome,
      telefone,
      email: `${semAcento(primeiro)}.${semAcento(ultimo)}@email.com`,
      plano,
      mesesDeCasa,
      professorPrincipal,
      planoCongelado,
      rankingPontuacao,
      categoriaRanking: "D",
      diaVencimento,
    });
  }

  return extras;
}

const ALUNOS_DO_MVP: AlunoDoMvp[] = [...ALUNOS_PRINCIPAIS, ...gerarAlunosExtras(70)];
const IDS_PRINCIPAIS = new Set(ALUNOS_PRINCIPAIS.map((a) => a.id));

export const PERFIS_DE_SEMENTE: PerfilDeSemente[] = ALUNOS_DO_MVP.map((a) => {
  const principal = IDS_PRINCIPAIS.has(a.id);
  const partes = a.nome.split(" ");
  return {
    alunoId: a.id,
    nome: a.nome,
    planoDoMvp: a.plano,
    mesesDeCasa: a.mesesDeCasa,
    professorPrincipalId: ID_PROFESSOR_POR_NOME[a.professorPrincipal],
    congelado: a.planoCongelado,
    motivoCongelamento: a.motivoCongelamento,
    forca: a.rankingPontuacao,
    categoriaRanking: a.categoriaRanking,
    diaVencimento: a.diaVencimento,
    principal,
    // So os nomes gerados (nome + sobrenome) tem sobrenome de verdade.
    sobrenome: !principal && partes.length > 1 ? partes[partes.length - 1] : undefined,
  };
});

export const PERFIL_POR_ALUNO = new Map(PERFIS_DE_SEMENTE.map((p) => [p.alunoId, p]));

// ---------------------------------------------------------------------------
// Geracao
// ---------------------------------------------------------------------------

export interface CadastrosGerados {
  alunos: Aluno[];
  matriculas: Matricula[];
  congelamentos: Congelamento[];
}

const MOTIVOS_CONGELAMENTO_PASSADO = [
  "Férias de julho",
  "Viagem a trabalho",
  "Pausa a pedido do aluno",
];

export function gerarCadastros(): CadastrosGerados {
  const alunos: Aluno[] = [];
  const matriculas: Matricula[] = [];
  const congelamentos: Congelamento[] = [];

  ALUNOS_DO_MVP.forEach((base, indice) => {
    const rng = criarRng(500 + indice * 29);
    const dataInicio = somarMeses(HOJE, -base.mesesDeCasa);

    alunos.push({
      id: base.id,
      nome: base.nome,
      fotoUrl: IDS_PRINCIPAIS.has(base.id) ? `/avatars/${base.id}.jpg` : undefined,
      telefone: base.telefone,
      email: base.email,
      professorPrincipalId: ID_PROFESSOR_POR_NOME[base.professorPrincipal],
      ativo: true,
      inscritoRanking: IDS_PRINCIPAIS.has(base.id),
      categoriaRanking: IDS_PRINCIPAIS.has(base.id) ? base.categoriaRanking : undefined,
      criadoEm: `${dataInicio}T10:00:00`,
    });

    const plano = planoPara(base.plano, base.mesesDeCasa);
    if (!plano) return;

    // Parte dos alunos antigos trocou de plano: a matricula anterior fica no historico.
    let inicioAtual = dataInicio;
    const anterior = PLANO_ANTERIOR[base.plano];
    if (anterior && base.mesesDeCasa >= 10 && rng() < 0.25) {
      const planoAnterior = planoPara(anterior, base.mesesDeCasa);
      inicioAtual = somarMeses(HOJE, -inteiro(rng, 2, base.mesesDeCasa - 2));
      if (planoAnterior) {
        matriculas.push({
          id: `mt-${base.id}-1`,
          alunoId: base.id,
          planoId: planoAnterior.id,
          valorMensal: planoAnterior.valorMensal,
          diaVencimento: base.diaVencimento,
          inicio: dataInicio,
          fim: somarDias(inicioAtual, -1),
        });
      }
    }

    const matricula: Matricula = {
      id: `mt-${base.id}`,
      alunoId: base.id,
      planoId: plano.id,
      valorMensal: plano.valorMensal,
      diaVencimento: base.diaVencimento,
      inicio: inicioAtual,
    };
    matriculas.push(matricula);

    if (base.planoCongelado) {
      const inicio = somarDias(HOJE, -inteiro(rng, 6, 25));
      congelamentos.push({
        id: `cg-${base.id}`,
        matriculaId: matricula.id,
        inicio,
        fimPrevisto: somarDias(inicio, 45),
        motivo: base.motivoCongelamento ?? "Viagem",
      });
    } else if (base.mesesDeCasa >= 8 && rng() < 0.08) {
      // Congelamento que ja terminou, para o historico da ficha.
      const inicio = somarMeses(HOJE, -inteiro(rng, 3, 7));
      if (inicio >= matricula.inicio) {
        congelamentos.push({
          id: `cg-${base.id}-1`,
          matriculaId: matricula.id,
          inicio,
          fimPrevisto: somarDias(inicio, 30),
          fimReal: somarDias(inicio, inteiro(rng, 20, 40)),
          motivo: escolher(rng, MOTIVOS_CONGELAMENTO_PASSADO),
        });
      }
    }
  });

  return { alunos, matriculas, congelamentos };
}
