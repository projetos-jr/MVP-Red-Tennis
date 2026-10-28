/**
 * ============================================================================
 *  DADOS MOCKADOS — MVP Red Tennis
 * ============================================================================
 *  Dados ficticios de demonstracao. O sistema le do Supabase; este arquivo so
 *  e usado por `scripts/gerar-seed.ts` para gerar `supabase/seed.sql`.
 *
 *  As datas historicas sao ancoradas em `HOJE`: a carga reflete o dia em que
 *  o script rodou.
 * ============================================================================
 */

import {
  HOJE,
  QUADRAS,
  SEM_PROFESSOR,
} from "./arena";
import {
  diferencaEmDias,
  inicioDaSemana,
  somarDias,
  somarMeses,
} from "./date";
export * from "./arena";

import type {
  Aluno,
  CategoriaProduto,
  CategoriaRanking,
  Consumo,
  MovimentoEstoque,
  FormaPagamento,
  Horario,
  HistoricoAula,
  MotivoFalta,
  Pagamento,
  PisoQuadra,
  PlanoAluno,
  Produto,
  Professor,
  Quadra,
  StatusAula,
  TipoAlocacao,
  Torneio,
} from "./types";


// ---------------------------------------------------------------------------
// Gerador pseudoaleatorio deterministico (mulberry32).
// Garante que a demo tenha sempre exatamente os mesmos dados.
// ---------------------------------------------------------------------------
function criarRng(semente: number) {
  let estado = semente >>> 0;
  return function proximo(): number {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escolher<T>(rng: () => number, lista: readonly T[]): T {
  return lista[Math.floor(rng() * lista.length)];
}

function inteiro(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function embaralhar<T>(rng: () => number, lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ---------------------------------------------------------------------------
// Professores
// ---------------------------------------------------------------------------
export const PROFESSORES: Professor[] = [
  {
    id: "prof-1",
    nome: "Alexandre Pires",
    cor: "#0E7490",
    especialidade: "Alto rendimento e competição",
    valorHoraAula: 78,
  },
  {
    id: "prof-2",
    nome: "Renata Coelho",
    cor: "#A16207",
    especialidade: "Iniciação e turmas infantis",
    valorHoraAula: 68,
  },
  {
    id: "prof-3",
    nome: "Márcio Bueno",
    cor: "#4D7C0F",
    especialidade: "Adulto, LAP e recreativo",
    valorHoraAula: 72,
  },
];

export const NOMES_PROFESSORES = PROFESSORES.map((p) => p.nome);


// ---------------------------------------------------------------------------
// Alunos (base)
//
// O cadastro tem duas camadas:
//  1. ALUNOS_PRINCIPAIS — os 23 membros reais cadastrados pelo cliente, com
//     foto em /public/avatars. Sao os alunos usados nas demonstracoes de ficha
//     e os 23 inscritos na etapa atual do ranking.
//  2. ALUNOS_EXTRAS — demais matriculados da arena, gerados a partir de listas
//     de nomes. Existem para que a grade semanal (cerca de 200 horarios) tenha
//     um numero plausivel de pessoas: com apenas 20 alunos, cada um apareceria
//     mais de 20 vezes por semana.
// Ambas as camadas tem ficha completa e navegavel.
// Os avatares reais devem ser colocados em /public/avatars/[id].jpg; enquanto
// o arquivo nao existir, o componente <Avatar> cai no placeholder de iniciais.
// ---------------------------------------------------------------------------
interface AlunoBase {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  plano: PlanoAluno;
  /** Meses de casa — usado para calcular `dataInicio`. */
  mesesDeCasa: number;
  professorPrincipal: string;
  saldoMinutosReposicao: number;
  planoCongelado: boolean;
  motivoCongelamento?: string;
  rankingPontuacao: number;
  categoriaRanking: CategoriaRanking;
  variacaoRanking: number;
  /** Dia do mes em que a mensalidade costuma ser paga. */
  diaVencimento: number;
  /** Valor da mensalidade do plano contratado. */
  mensalidade: number;
}

const ALUNOS_PRINCIPAIS: AlunoBase[] = [
  { id: "a01", nome: "Guilherme Lima", telefone: "(11) 98812-4471", email: "guilherme.lima@email.com", plano: "Individual", mesesDeCasa: 31, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 120, planoCongelado: false, rankingPontuacao: 1480, categoriaRanking: "A", variacaoRanking: 1, diaVencimento: 5, mensalidade: 720 },
  { id: "a02", nome: "Anna Beatriz", telefone: "(11) 99640-2210", email: "anna.beatriz@email.com", plano: "Individual", mesesDeCasa: 27, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 60, planoCongelado: false, rankingPontuacao: 1442, categoriaRanking: "A", variacaoRanking: 2, diaVencimento: 10, mensalidade: 720 },
  { id: "a03", nome: "Larissa Preto", telefone: "(11) 97733-1908", email: "larissa.preto@email.com", plano: "Dupla", mesesDeCasa: 34, professorPrincipal: "Márcio Bueno", saldoMinutosReposicao: 0, planoCongelado: false, rankingPontuacao: 1398, categoriaRanking: "A", variacaoRanking: -1, diaVencimento: 5, mensalidade: 520 },
  { id: "a04", nome: "Felipe Ikeda", telefone: "(11) 98120-6654", email: "felipe.ikeda@email.com", plano: "Individual", mesesDeCasa: 19, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 90, planoCongelado: false, rankingPontuacao: 1355, categoriaRanking: "B", variacaoRanking: 3, diaVencimento: 15, mensalidade: 720 },
  { id: "a05", nome: "Igor", telefone: "(11) 99012-7745", email: "igor@email.com", plano: "Locação Mensal", mesesDeCasa: 14, professorPrincipal: "Sem professor", saldoMinutosReposicao: 0, planoCongelado: false, rankingPontuacao: 1327, categoriaRanking: "B", variacaoRanking: 0, diaVencimento: 15, mensalidade: 640 },
  { id: "a06", nome: "Leonardo Aguilar", telefone: "(11) 98455-3321", email: "leonardo.aguilar@email.com", plano: "Individual", mesesDeCasa: 22, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 180, planoCongelado: false, rankingPontuacao: 1298, categoriaRanking: "B", variacaoRanking: 4, diaVencimento: 20, mensalidade: 720 },
  { id: "a07", nome: "Eduardo Piton", telefone: "(11) 97188-9902", email: "eduardo.piton@email.com", plano: "LAP", mesesDeCasa: 11, professorPrincipal: "Márcio Bueno", saldoMinutosReposicao: 60, planoCongelado: false, rankingPontuacao: 1274, categoriaRanking: "B", variacaoRanking: -2, diaVencimento: 10, mensalidade: 380 },
  { id: "a08", nome: "Isadora", telefone: "(11) 99807-5512", email: "isadora@email.com", plano: "Dupla", mesesDeCasa: 25, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 90, planoCongelado: false, rankingPontuacao: 1251, categoriaRanking: "B", variacaoRanking: 2, diaVencimento: 5, mensalidade: 520 },
  { id: "a09", nome: "Lucas", telefone: "(11) 98344-1180", email: "lucas@email.com", plano: "Individual", mesesDeCasa: 37, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 0, planoCongelado: true, motivoCongelamento: "Viagem a trabalho — retorno previsto em 45 dias", rankingPontuacao: 1228, categoriaRanking: "B", variacaoRanking: -5, diaVencimento: 15, mensalidade: 720 },
  { id: "a10", nome: "Gustavo", telefone: "(11) 99551-4408", email: "gustavo@email.com", plano: "Individual", mesesDeCasa: 8, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 240, planoCongelado: false, rankingPontuacao: 1205, categoriaRanking: "B", variacaoRanking: 6, diaVencimento: 25, mensalidade: 720 },
  { id: "a11", nome: "Henrique", telefone: "(11) 97622-3096", email: "henrique@email.com", plano: "LAP", mesesDeCasa: 6, professorPrincipal: "Márcio Bueno", saldoMinutosReposicao: 60, planoCongelado: false, rankingPontuacao: 1180, categoriaRanking: "C", variacaoRanking: 1, diaVencimento: 20, mensalidade: 380 },
  { id: "a12", nome: "Rafael", telefone: "(11) 98979-6631", email: "rafael@email.com", plano: "Individual", mesesDeCasa: 16, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 30, planoCongelado: false, rankingPontuacao: 1158, categoriaRanking: "C", variacaoRanking: -1, diaVencimento: 10, mensalidade: 720 },
  { id: "a13", nome: "Samuel", telefone: "(11) 99236-7714", email: "samuel@email.com", plano: "Dupla", mesesDeCasa: 12, professorPrincipal: "Márcio Bueno", saldoMinutosReposicao: 60, planoCongelado: false, rankingPontuacao: 1136, categoriaRanking: "C", variacaoRanking: 2, diaVencimento: 20, mensalidade: 520 },
  { id: "a14", nome: "Froner", telefone: "(11) 98701-2245", email: "froner@email.com", plano: "Individual", mesesDeCasa: 29, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 120, planoCongelado: false, rankingPontuacao: 1112, categoriaRanking: "C", variacaoRanking: 0, diaVencimento: 5, mensalidade: 720 },
  { id: "a15", nome: "Thiago", telefone: "(11) 97455-8820", email: "thiago@email.com", plano: "Locação Mensal", mesesDeCasa: 41, professorPrincipal: "Sem professor", saldoMinutosReposicao: 0, planoCongelado: false, rankingPontuacao: 1089, categoriaRanking: "C", variacaoRanking: -3, diaVencimento: 15, mensalidade: 640 },
  { id: "a16", nome: "Liu", telefone: "(11) 99118-3374", email: "liu@email.com", plano: "Individual", mesesDeCasa: 7, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 90, planoCongelado: false, rankingPontuacao: 1066, categoriaRanking: "C", variacaoRanking: 5, diaVencimento: 25, mensalidade: 720 },
  { id: "a17", nome: "Alice", telefone: "(11) 98266-9951", email: "alice@email.com", plano: "Dupla", mesesDeCasa: 13, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 45, planoCongelado: false, rankingPontuacao: 1042, categoriaRanking: "D", variacaoRanking: -2, diaVencimento: 10, mensalidade: 520 },
  { id: "a18", nome: "Caio", telefone: "(11) 99884-1127", email: "caio@email.com", plano: "LAP", mesesDeCasa: 4, professorPrincipal: "Márcio Bueno", saldoMinutosReposicao: 120, planoCongelado: false, rankingPontuacao: 1020, categoriaRanking: "D", variacaoRanking: 3, diaVencimento: 20, mensalidade: 380 },
  { id: "a19", nome: "Maria Luiza", telefone: "(11) 97390-6608", email: "maria.luiza@email.com", plano: "Individual", mesesDeCasa: 9, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 150, planoCongelado: true, motivoCongelamento: "Lesão no ombro — congelado a pedido, com atestado", rankingPontuacao: 998, categoriaRanking: "D", variacaoRanking: -4, diaVencimento: 5, mensalidade: 720 },
  { id: "a20", nome: "Lucas Freitas", telefone: "(11) 98533-7742", email: "lucas.freitas@email.com", plano: "Locação Avulsa", mesesDeCasa: 3, professorPrincipal: "Sem professor", saldoMinutosReposicao: 0, planoCongelado: false, rankingPontuacao: 975, categoriaRanking: "D", variacaoRanking: 1, diaVencimento: 1, mensalidade: 0 },
  { id: "a21", nome: "Pedro Linhares", telefone: "(11) 99427-1165", email: "pedro.linhares@email.com", plano: "Individual", mesesDeCasa: 10, professorPrincipal: "Alexandre Pires", saldoMinutosReposicao: 60, planoCongelado: false, rankingPontuacao: 953, categoriaRanking: "D", variacaoRanking: 0, diaVencimento: 15, mensalidade: 720 },
  { id: "a22", nome: "Larissa Farraresi", telefone: "(11) 97806-4432", email: "larissa.farraresi@email.com", plano: "Dupla", mesesDeCasa: 18, professorPrincipal: "Renata Coelho", saldoMinutosReposicao: 30, planoCongelado: false, rankingPontuacao: 931, categoriaRanking: "D", variacaoRanking: 2, diaVencimento: 5, mensalidade: 520 },
  { id: "a23", nome: "João Xuxa", telefone: "(11) 98159-2287", email: "joao.xuxa@email.com", plano: "Locação Avulsa", mesesDeCasa: 2, professorPrincipal: "Sem professor", saldoMinutosReposicao: 0, planoCongelado: false, rankingPontuacao: 916, categoriaRanking: "D", variacaoRanking: -1, diaVencimento: 1, mensalidade: 0 },
];

// --- Demais matriculados -----------------------------------------------------
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

const PLANOS_EXTRAS: PlanoAluno[] = [
  "Individual", "Individual", "Individual",
  "Dupla", "Dupla",
  "LAP", "LAP",
  "Locação Mensal",
  "Locação Avulsa",
];

const MENSALIDADE_POR_PLANO: Record<PlanoAluno, number> = {
  Individual: 720,
  Dupla: 520,
  "Locação Mensal": 640,
  "Locação Avulsa": 0,
  LAP: 380,
};

/**
 * Demais matriculados da arena.
 * Geracao deterministica: mesma lista em todo carregamento da aplicacao.
 */
function gerarAlunosExtras(quantidade: number): AlunoBase[] {
  const rng = criarRng(20260911);
  const usados = new Set(ALUNOS_PRINCIPAIS.map((a) => a.nome));
  const extras: AlunoBase[] = [];

  let tentativa = 0;
  while (extras.length < quantidade && tentativa < quantidade * 12) {
    tentativa += 1;

    const nome = `${escolher(rng, PRIMEIROS_NOMES)} ${escolher(rng, SOBRENOMES)}`;
    if (usados.has(nome)) continue;
    usados.add(nome);

    const indice = extras.length;
    const plano = escolher(rng, PLANOS_EXTRAS);
    const [primeiro, ultimo] = nome.toLowerCase().split(" ");
    const semAcento = (texto: string) =>
      texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    extras.push({
      id: `b${String(indice + 1).padStart(2, "0")}`,
      nome,
      telefone: `(11) 9${inteiro(rng, 6000, 9999)}-${inteiro(rng, 1000, 9999)}`,
      email: `${semAcento(primeiro)}.${semAcento(ultimo)}@email.com`,
      plano,
      mesesDeCasa: inteiro(rng, 1, 44),
      professorPrincipal:
        plano === "Locação Mensal" || plano === "Locação Avulsa"
          ? SEM_PROFESSOR
          : escolher(rng, NOMES_PROFESSORES),
      saldoMinutosReposicao: escolher(rng, [0, 0, 30, 60, 60, 90, 120]),
      planoCongelado: rng() > 0.94,
      motivoCongelamento: undefined,
      // Pontuacao abaixo da faixa dos 20 principais: a piramide da etapa atual
      // e disputada pelos inscritos, e os demais aparecem no ranking geral.
      rankingPontuacao: inteiro(rng, 580, 915),
      categoriaRanking: "D",
      variacaoRanking: inteiro(rng, -4, 4),
      // Vencimentos espalhados pelo mes: a arena escalona a cobranca para nao
      // concentrar todo o caixa em poucos dias.
      diaVencimento: inteiro(rng, 1, 28),
      mensalidade: MENSALIDADE_POR_PLANO[plano],
    });
  }

  return extras;
}

const ALUNOS_EXTRAS = gerarAlunosExtras(70);

const ALUNOS_BASE: AlunoBase[] = [...ALUNOS_PRINCIPAIS, ...ALUNOS_EXTRAS];

/** Ids dos 23 alunos inscritos na etapa atual do ranking (piramide do torneio). */
export const IDS_INSCRITOS_RANKING = ALUNOS_PRINCIPAIS.map((a) => a.id);

export const IDS_ALUNOS = ALUNOS_BASE.map((a) => a.id);

/**
 * Ids que possuem foto em `/public/avatars/[id].jpg`.
 *
 * Hoje sao os 23 membros cadastrados pelo cliente. Para adicionar a foto de
 * mais alguem: salve o arquivo com o id da pessoa nessa pasta e inclua o id
 * aqui — o restante da interface passa a usar a foto automaticamente. Quem nao
 * esta na lista continua com o placeholder de iniciais, sem requisicao perdida.
 */
export const IDS_COM_FOTO = new Set<string>(ALUNOS_PRINCIPAIS.map((a) => a.id));

export function caminhoAvatar(id: string): string | undefined {
  return IDS_COM_FOTO.has(id) ? `/avatars/${id}.jpg` : undefined;
}

// ---------------------------------------------------------------------------
// Grade semanal de horarios (agenda)
// ---------------------------------------------------------------------------
/**
 * Meta de ocupacao por quadra em cada dia da semana (0 = domingo ... 6 = sabado).
 * E a partir daqui que o Dashboard calcula o quanto cada quadra escurece:
 * quadras 1 e 3 sao as mais disputadas, a 4 tem demanda media e o paredao,
 * por ser treino curto/avulso, gira bem menos.
 */
const OCUPACAO_ALVO: Record<string, number[]> = {
  "1": [3, 9, 7, 9, 8, 9, 6],
  "2": [2, 6, 8, 6, 7, 6, 5],
  "3": [4, 10, 8, 8, 9, 8, 7],
  "4": [2, 5, 6, 4, 5, 6, 4],
  paredao: [1, 3, 3, 3, 3, 3, 2],
};

/**
 * Maximo de quadras ocupadas ao mesmo tempo numa mesma faixa horaria.
 * Alem de ser realista (a arena raramente lota as 5 areas simultaneamente),
 * mantem a grade da agenda legivel: nenhuma celula acumula mais de 3 eventos.
 */
const MAXIMO_SIMULTANEO = 3;

/** Horarios ordenados por procura — os primeiros sao preenchidos antes. */
const HORAS_PICO = [18, 19, 7, 20, 8, 21, 9, 17];
const HORAS_VALE = [10, 16, 11, 15, 12, 14, 13];

const TIPOS_COM_PROFESSOR: TipoAlocacao[] = ["Individual", "Dupla", "LAP"];

/** Distribuicao de tipos de alocacao nas quadras de saibro. */
const SORTEIO_TIPO_QUADRA: TipoAlocacao[] = [
  "Individual", "Individual", "Individual", "Individual", "Individual", "Individual",
  "Dupla", "Dupla", "Dupla", "Dupla",
  "Locação Mensal", "Locação Mensal", "Locação Mensal",
  "LAP", "LAP",
  "Plano de locação", "Plano de locação",
  "Locação Avulsa", "Locação Avulsa",
  "Ranking",
];

/** No paredao predominam treino curto individual, LAP e locacao avulsa. */
const SORTEIO_TIPO_PAREDAO: TipoAlocacao[] = [
  "Individual", "Individual", "Individual",
  "LAP", "LAP",
  "Locação Avulsa", "Locação Avulsa",
  "Plano de locação",
];

const TAMANHO_TURMA: Record<TipoAlocacao, [number, number]> = {
  Individual: [1, 1],
  Dupla: [2, 2],
  LAP: [4, 6],
  "Locação Mensal": [2, 4],
  "Locação Avulsa": [2, 4],
  Ranking: [2, 4],
  "Plano de locação": [1, 3],
};

/** Alunos com plano congelado nao aparecem na grade da semana corrente. */
const ALUNOS_ATIVOS = ALUNOS_BASE.filter((a) => !a.planoCongelado);

/**
 * Quantas vezes cada aluno ja foi alocado na grade da semana.
 * Serve para distribuir os horarios de forma equilibrada: sem isso, o sorteio
 * concentraria dezenas de horarios em poucos alunos e a ficha individual
 * mostraria uma rotina impossivel.
 */
const usoNaSemana = new Map<string, number>();

function menosAlocados(rng: () => number, candidatos: AlunoBase[]): AlunoBase[] {
  return embaralhar(rng, candidatos).sort(
    (a, b) => (usoNaSemana.get(a.id) ?? 0) - (usoNaSemana.get(b.id) ?? 0),
  );
}

function registrarUso(ids: string[]): string[] {
  ids.forEach((id) => usoNaSemana.set(id, (usoNaSemana.get(id) ?? 0) + 1));
  return ids;
}

function sortearAlunos(
  rng: () => number,
  tipo: TipoAlocacao,
  professor: string,
): string[] {
  const [min, max] = TAMANHO_TURMA[tipo];
  const quantidade = inteiro(rng, min, max);

  if (professor !== SEM_PROFESSOR) {
    // Aulas: prioriza os alunos do proprio professor, começando pelos que
    // ainda tem poucos horarios na semana.
    const doProfessor = ALUNOS_ATIVOS.filter(
      (a) => a.professorPrincipal === professor,
    );
    const demais = ALUNOS_ATIVOS.filter((a) => !doProfessor.includes(a));
    const pool = [...menosAlocados(rng, doProfessor), ...menosAlocados(rng, demais)];
    return registrarUso(pool.slice(0, quantidade).map((a) => a.id));
  }

  // Locacoes e reservas: quem contratou a locacao costuma ser quem reserva,
  // mas leva convidados — por isso so o titular vem do grupo de locacao.
  const locatarios = ALUNOS_ATIVOS.filter(
    (a) => a.plano === "Locação Mensal" || a.plano === "Locação Avulsa",
  );
  const titular = menosAlocados(rng, locatarios)[0];
  const convidados = menosAlocados(
    rng,
    ALUNOS_ATIVOS.filter((a) => a.id !== titular?.id),
  );
  const pool = titular ? [titular, ...convidados] : convidados;

  return registrarUso(pool.slice(0, quantidade).map((a) => a.id));
}

function gerarHorarios(): Horario[] {
  const horarios: Horario[] = [];

  for (let dia = 0; dia <= 6; dia += 1) {
    // Quantas quadras ja estao ocupadas em cada faixa horaria deste dia.
    const ocupacaoPorHora = new Map<number, number>();

    QUADRAS.forEach((quadra, indiceQuadra) => {
      const chave = String(quadra);
      const meta = OCUPACAO_ALVO[chave][dia];
      const rng = criarRng(9173 + indiceQuadra * 101 + dia * 17);

      // Pico primeiro (levemente embaralhado para cada quadra nao ficar igual),
      // depois os horarios de vale. Faixas que ja bateram o limite de quadras
      // simultaneas sao puladas.
      const preferencia = [
        ...embaralhar(rng, HORAS_PICO),
        ...embaralhar(rng, HORAS_VALE),
      ];

      const ordem: number[] = [];
      for (const hora of preferencia) {
        if (ordem.length >= meta) break;
        if ((ocupacaoPorHora.get(hora) ?? 0) >= MAXIMO_SIMULTANEO) continue;
        ocupacaoPorHora.set(hora, (ocupacaoPorHora.get(hora) ?? 0) + 1);
        ordem.push(hora);
      }

      ordem
        .sort((a, b) => a - b)
        .forEach((hora) => {
          const tipo =
            quadra === "paredao"
              ? escolher(rng, SORTEIO_TIPO_PAREDAO)
              : escolher(rng, SORTEIO_TIPO_QUADRA);

          const professor = TIPOS_COM_PROFESSOR.includes(tipo)
            ? escolher(rng, NOMES_PROFESSORES)
            : SEM_PROFESSOR;

          horarios.push({
            id: `h-${chave}-${dia}-${hora}`,
            quadra,
            diaSemana: dia,
            horaInicio: `${String(hora).padStart(2, "0")}:00`,
            horaFim: `${String(hora + 1).padStart(2, "0")}:00`,
            tipo,
            alunosIds: sortearAlunos(rng, tipo, professor),
            professor,
          });
        });
    });
  }

  return horarios;
}

/**
 * Conflitos plantados de proposito para demonstrar o alerta visual da Agenda:
 * sao horarios que colidem com uma alocacao ja existente na mesma quadra.
 */
const CONFLITOS_PLANTADOS: Horario[] = [
  {
    id: "h-conflito-1",
    quadra: 1,
    diaSemana: 2,
    horaInicio: "19:00",
    horaFim: "20:00",
    tipo: "Locação Avulsa",
    alunosIds: ["a10", "a19"],
    professor: SEM_PROFESSOR,
  },
  {
    id: "h-conflito-2",
    quadra: 3,
    diaSemana: 4,
    horaInicio: "18:00",
    horaFim: "19:00",
    tipo: "Ranking",
    alunosIds: ["a01", "a02", "a03"],
    professor: SEM_PROFESSOR,
  },
  {
    id: "h-conflito-3",
    quadra: 2,
    diaSemana: 6,
    horaInicio: "09:00",
    horaFim: "10:00",
    tipo: "Dupla",
    alunosIds: ["a07", "a16"],
    professor: "Renata Coelho",
  },
];

function marcarConflitos(lista: Horario[]): Horario[] {
  return lista.map((h) => {
    const colide = lista.some(
      (outro) =>
        outro.id !== h.id &&
        outro.quadra === h.quadra &&
        outro.diaSemana === h.diaSemana &&
        outro.horaInicio < h.horaFim &&
        h.horaInicio < outro.horaFim,
    );
    return colide ? { ...h, temConflito: true } : h;
  });
}

/**
 * Datas em que a arena nao operou por chuva.
 *
 * A grade semanal da Red Tennis e fixa (mesmos horarios toda semana), entao
 * sao as excecoes pontuais que dao realismo ao calendario. Como todas as areas
 * sao descobertas, um dia de chuva cancela a operacao inteira — e por isso que
 * a sigla CH aparece tanto no historico de faltas dos alunos.
 */
export const DIAS_COM_CHUVA: string[] = [
  somarDias(HOJE, -4),
  somarDias(HOJE, -12),
  somarDias(HOJE, -19),
  somarDias(HOJE, -27),
  somarDias(HOJE, -33),
].sort();

export const HORARIOS: Horario[] = marcarConflitos([
  ...gerarHorarios(),
  ...CONFLITOS_PLANTADOS,
]);

// ---------------------------------------------------------------------------
// Historico de aulas por aluno
// ---------------------------------------------------------------------------
const MOTIVOS_FALTA: MotivoFalta[] = [
  "CH",
  "CH",
  "aviso_24h",
  "aviso_24h",
  "falta_professor",
  "IAC",
  "TIP",
];

/** Motivos que geram credito de reposicao para o aluno. */
const MOTIVOS_COM_CREDITO: MotivoFalta[] = [
  "CH",
  "aviso_24h",
  "falta_professor",
  "TIP",
];

/** Data real correspondente a `diaSemana` em `semanasAtras` semanas. */
function dataDoDiaSemana(diaSemana: number, semanasAtras: number): string {
  const segunda = inicioDaSemana(HOJE);
  const offset = diaSemana === 0 ? 6 : diaSemana - 1;
  return somarDias(segunda, offset - semanasAtras * 7);
}

function gerarHistoricoAulas(
  aluno: AlunoBase,
  indice: number,
): HistoricoAula[] {
  const rng = criarRng(4400 + indice * 37);
  const slots = HORARIOS.filter((h) => h.alunosIds.includes(aluno.id)).slice(
    0,
    2,
  );

  // Alunos congelados saem da grade corrente: o historico usa o slot que eles
  // tinham antes do congelamento.
  const referencias: Array<Pick<Horario, "diaSemana" | "horaInicio" | "quadra" | "professor">> =
    slots.length > 0
      ? slots
      : [
          {
            diaSemana: inteiro(rng, 1, 5),
            horaInicio: `${String(inteiro(rng, 17, 20)).padStart(2, "0")}:00`,
            quadra: escolher(rng, [1, 2, 3, 4] as Quadra[]),
            professor: aluno.professorPrincipal,
          },
        ];

  const aulas: HistoricoAula[] = [];

  for (let semana = 1; semana <= 9; semana += 1) {
    referencias.forEach((ref) => {
      const data = dataDoDiaSemana(ref.diaSemana, semana);
      if (data > HOJE) return;

      const sorteio = rng();
      let status: StatusAula = "realizada";
      let motivoFalta: MotivoFalta | undefined;

      if (sorteio > 0.88) {
        status = "reagendada";
        motivoFalta = escolher(rng, MOTIVOS_FALTA);
      } else if (sorteio > 0.76) {
        status = "falta";
        motivoFalta = escolher(rng, MOTIVOS_FALTA);
      }

      aulas.push({
        data,
        quadra: ref.quadra,
        professor:
          ref.professor === SEM_PROFESSOR
            ? aluno.professorPrincipal
            : ref.professor,
        horario: ref.horaInicio,
        status,
        motivoFalta,
        minutosRepostos:
          motivoFalta && MOTIVOS_COM_CREDITO.includes(motivoFalta)
            ? 60
            : undefined,
      });
    });
  }

  return aulas.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 14);
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------
const FORMAS: FormaPagamento[] = [
  "Stone",
  "Stone",
  "Bradesco",
  "Bradesco",
  "Total Pass",
  "Dinheiro",
];

const ITENS_AVULSOS: Array<{ item: string; valor: number }> = [
  { item: "Locação avulsa · 1h de quadra", valor: 120 },
  { item: "Locação avulsa · 1h30 de quadra", valor: 170 },
  { item: "Aula experimental", valor: 90 },
  { item: "Aula avulsa com professor", valor: 150 },
  { item: "LAP · sessão avulsa", valor: 75 },
  { item: "Paredão · 1h", valor: 60 },
  { item: "Inscrição etapa do ranking", valor: 110 },
  { item: "Reposição extra (fora do saldo)", valor: 100 },
];

/** Prazo, em dias, ate o dinheiro efetivamente entrar no caixa. */
function prazoCompensacao(forma: FormaPagamento, rng: () => number): number {
  switch (forma) {
    case "Stone":
      return inteiro(rng, 1, 3); // boleto / link
    case "Bradesco":
      return rng() > 0.5 ? 30 : 1; // credito x debito
    case "Total Pass":
      return inteiro(rng, 20, 30); // repasse mensal do convenio
    default:
      return 0; // dinheiro / pix no balcao
  }
}

function montarPagamento(
  rng: () => number,
  dados: {
    id: string;
    alunoId: string;
    nomeAluno: string;
    data: string;
    item: string;
    valor: number;
    forcarPendente?: boolean;
  },
): Pagamento {
  const forma = escolher(rng, FORMAS);
  const prazo = prazoCompensacao(forma, rng);
  const vencido = diferencaEmDias(dados.data, HOJE) > prazo + 2;

  const pendente = dados.forcarPendente ?? rng() > 0.86;
  const status = pendente ? "pendente" : "confirmado";

  // Pagante pode ser diferente do aluno (responsavel, conjuge, empresa).
  const sobrenome = dados.nomeAluno.split(" ").slice(-1)[0];
  const nomePagante =
    rng() > 0.78
      ? escolher(rng, [
          `Marcos ${sobrenome}`,
          `Helena ${sobrenome}`,
          `${sobrenome} Participações LTDA`,
        ])
      : dados.nomeAluno;

  const valorTotalPass =
    forma === "Total Pass"
      ? Math.round(dados.valor * (rng() > 0.5 ? 0.7 : 0.6))
      : undefined;

  return {
    id: dados.id,
    alunoId: dados.alunoId,
    data: dados.data,
    dataCompensacao: somarDias(dados.data, pendente ? prazo + 7 : prazo),
    nomePagante,
    item: dados.item,
    valor: dados.valor,
    formaPagamento: forma,
    status,
    valorTotalPass,
    participantesConfirmados: !pendente && rng() > 0.12,
    diasEmAtraso: pendente && vencido ? diferencaEmDias(dados.data, HOJE) - prazo : 0,
  };
}

function gerarPagamentos(): Pagamento[] {
  const pagamentos: Pagamento[] = [];

  // 1) Mensalidades dos ultimos 5 meses.
  ALUNOS_BASE.forEach((aluno, indice) => {
    if (aluno.mensalidade === 0) return;
    const rng = criarRng(7700 + indice * 53);

    for (let mesesAtras = 4; mesesAtras >= 0; mesesAtras -= 1) {
      const base = somarMeses(HOJE, -mesesAtras);
      const data = `${base.slice(0, 8)}${String(aluno.diaVencimento).padStart(2, "0")}`;
      if (data > HOJE) continue;

      pagamentos.push(
        montarPagamento(rng, {
          id: `pg-${aluno.id}-m${mesesAtras}`,
          alunoId: aluno.id,
          nomeAluno: aluno.nome,
          data,
          item: `Mensalidade · plano ${aluno.plano}`,
          valor: aluno.mensalidade,
          // Deixa as mensalidades antigas sempre quitadas; so o mes corrente
          // pode aparecer em aberto.
          forcarPendente: mesesAtras === 0 ? undefined : false,
        }),
      );
    }
  });

  // 2) Consumo avulso espalhado pelos ultimos 35 dias (da movimento diario ao caixa).
  const rngAvulso = criarRng(31337);
  for (let diasAtras = 34; diasAtras >= 0; diasAtras -= 1) {
    const data = somarDias(HOJE, -diasAtras);
    const quantidade = inteiro(rngAvulso, 0, 3);

    for (let i = 0; i < quantidade; i += 1) {
      const aluno = escolher(rngAvulso, ALUNOS_BASE);
      const produto = escolher(rngAvulso, ITENS_AVULSOS);
      pagamentos.push(
        montarPagamento(rngAvulso, {
          id: `pg-av-${diasAtras}-${i}`,
          alunoId: aluno.id,
          nomeAluno: aluno.nome,
          data,
          item: produto.item,
          valor: produto.valor,
        }),
      );
    }
  }

  return pagamentos.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export const PAGAMENTOS: Pagamento[] = gerarPagamentos();

// ---------------------------------------------------------------------------
// Comentarios do gestor (bloco de notas da ficha do aluno)
// ---------------------------------------------------------------------------
const AUTORES_COMENTARIO = [
  "Francisco Menezes",
  "Lucas Ferreira",
  "Alexandre Pires",
  "Renata Coelho",
  "Márcio Bueno",
];

const TEXTOS_COMENTARIO = [
  "Pediu para manter o horário fixo até o fim do semestre. Confirmado com o professor.",
  "Prefere ser avisado por WhatsApp quando houver risco de chuva.",
  "Evoluiu bem no saque; professor sugeriu subir de categoria na próxima apuração.",
  "Responsável financeiro é o pai — enviar cobranças para o contato secundário.",
  "Reclamou da iluminação da quadra 4 no horário das 21h. Repassado para manutenção.",
  "Tem interesse em entrar na turma de LAP das quintas.",
  "Solicitou reposição das aulas perdidas por chuva em setembro.",
  "Indicou dois amigos para aula experimental. Verificar bonificação de indicação.",
  "Costuma chegar 10 minutos atrasado; professor já ajustou o aquecimento.",
  "Cliente Total Pass — conferir mensalmente o valor do complemento.",
  "Pediu para congelar o plano durante as férias de julho. Alinhado com a diretoria.",
  "Ótimo perfil para o torneio de duplas — convidar na próxima etapa.",
];

function gerarComentarios(aluno: AlunoBase, indice: number) {
  const rng = criarRng(1200 + indice * 61);
  const quantidade = inteiro(rng, 1, 3);
  const textos = embaralhar(rng, TEXTOS_COMENTARIO).slice(0, quantidade);

  return textos.map((texto, i) => {
    const data = somarDias(HOJE, -inteiro(rng, 2 + i * 12, 14 + i * 12));
    return {
      id: `c-${aluno.id}-${i}`,
      data: `${data}T${String(inteiro(rng, 8, 20)).padStart(2, "0")}:${escolher(rng, ["05", "17", "24", "38", "46", "52"])}`,
      autor: escolher(rng, AUTORES_COMENTARIO),
      texto,
    };
  });
}

// ---------------------------------------------------------------------------
// Alunos completos
// ---------------------------------------------------------------------------
export const ALUNOS: Aluno[] = ALUNOS_BASE.map((base, indice) => {
  const rng = criarRng(500 + indice * 29);
  const historicoAulas = gerarHistoricoAulas(base, indice);

  return {
    id: base.id,
    nome: base.nome,
    avatarUrl: caminhoAvatar(base.id),
    telefone: base.telefone,
    email: base.email,
    plano: base.plano,
    dataInicio: somarMeses(HOJE, -base.mesesDeCasa),
    professorPrincipal: base.professorPrincipal,
    saldoMinutosReposicao: base.saldoMinutosReposicao,
    validadeReposicao: somarDias(HOJE, inteiro(rng, 12, 88)),
    planoCongelado: base.planoCongelado,
    motivoCongelamento: base.motivoCongelamento,
    rankingPontuacao: base.rankingPontuacao,
    categoriaRanking: base.categoriaRanking,
    variacaoRanking: base.variacaoRanking,
    historicoAulas,
    historicoPagamentos: PAGAMENTOS.filter((p) => p.alunoId === base.id),
    comentarios: gerarComentarios(base, indice),
  };
});

/** Valor de mensalidade por aluno — usado nos totais do Financeiro. */
export const MENSALIDADE_POR_ALUNO: Record<string, number> = Object.fromEntries(
  ALUNOS_BASE.map((a) => [a.id, a.mensalidade]),
);

// ---------------------------------------------------------------------------
// Ranking e torneios
// ---------------------------------------------------------------------------

export const TORNEIOS: Torneio[] = [
  {
    id: "t-1",
    nome: "Etapa 4 · Ranking Interno Red Tennis",
    data: somarDias(HOJE, 12),
    formato: "Pirâmide · 4 categorias · desafios semanais",
    inscritos: 23,
    status: "inscrições abertas",
  },
  {
    id: "t-2",
    nome: "Torneio de Duplas do Saibro",
    data: somarDias(HOJE, -3),
    formato: "Duplas · chave única · melhor de 3 sets curtos",
    inscritos: 16,
    status: "em andamento",
  },
  {
    id: "t-3",
    nome: "Copa Red Tennis · Etapa 3",
    data: somarDias(HOJE, -38),
    formato: "Pirâmide · 4 categorias",
    inscritos: 18,
    status: "encerrado",
  },
];

// ---------------------------------------------------------------------------
// Estoque do balcao
// ---------------------------------------------------------------------------
interface ProdutoBase {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  unidade: string;
  precoCusto: number;
  precoVenda: number;
  quantidade: number;
  estoqueMinimo: number;
}

/**
 * Catalogo vendido no balcao da arena.
 * As quantidades sao propositalmente variadas: alguns itens aparecem zerados
 * ou abaixo do minimo para demonstrar o alerta de reposicao.
 */
const PRODUTOS_BASE: ProdutoBase[] = [
  { id: "p01", nome: "Água mineral sem gás", categoria: "Bebidas", unidade: "garrafa 500ml", precoCusto: 1.9, precoVenda: 5, quantidade: 96, estoqueMinimo: 40 },
  { id: "p02", nome: "Água mineral com gás", categoria: "Bebidas", unidade: "garrafa 500ml", precoCusto: 2.2, precoVenda: 6, quantidade: 34, estoqueMinimo: 24 },
  { id: "p03", nome: "Isotônico", categoria: "Bebidas", unidade: "garrafa 500ml", precoCusto: 4.5, precoVenda: 10, quantidade: 18, estoqueMinimo: 24 },
  { id: "p04", nome: "Água de coco", categoria: "Bebidas", unidade: "caixa 200ml", precoCusto: 3.2, precoVenda: 8, quantidade: 41, estoqueMinimo: 20 },
  { id: "p05", nome: "Refrigerante", categoria: "Bebidas", unidade: "lata 350ml", precoCusto: 2.8, precoVenda: 7, quantidade: 62, estoqueMinimo: 36 },
  { id: "p06", nome: "Suco natural de laranja", categoria: "Bebidas", unidade: "copo 300ml", precoCusto: 3.5, precoVenda: 9, quantidade: 12, estoqueMinimo: 15 },
  { id: "p07", nome: "Energético", categoria: "Bebidas", unidade: "lata 250ml", precoCusto: 5.4, precoVenda: 12, quantidade: 27, estoqueMinimo: 12 },
  { id: "p08", nome: "Café expresso", categoria: "Bebidas", unidade: "dose", precoCusto: 1.2, precoVenda: 5, quantidade: 120, estoqueMinimo: 50 },

  { id: "p09", nome: "Cerveja pilsen long neck", categoria: "Cervejas", unidade: "garrafa 330ml", precoCusto: 4.2, precoVenda: 11, quantidade: 78, estoqueMinimo: 48 },
  { id: "p10", nome: "Cerveja puro malte", categoria: "Cervejas", unidade: "lata 350ml", precoCusto: 3.6, precoVenda: 9, quantidade: 54, estoqueMinimo: 48 },
  { id: "p11", nome: "Cerveja IPA artesanal", categoria: "Cervejas", unidade: "garrafa 600ml", precoCusto: 9.5, precoVenda: 22, quantidade: 9, estoqueMinimo: 12 },
  { id: "p12", nome: "Cerveja sem álcool", categoria: "Cervejas", unidade: "lata 350ml", precoCusto: 3.9, precoVenda: 10, quantidade: 0, estoqueMinimo: 12 },

  { id: "p13", nome: "Salgadinho de pacote", categoria: "Lanches", unidade: "pacote 45g", precoCusto: 2.4, precoVenda: 7, quantidade: 44, estoqueMinimo: 20 },
  { id: "p14", nome: "Amendoim torrado", categoria: "Lanches", unidade: "pacote 50g", precoCusto: 1.8, precoVenda: 6, quantidade: 31, estoqueMinimo: 15 },
  { id: "p15", nome: "Barra de cereal", categoria: "Lanches", unidade: "unidade", precoCusto: 1.6, precoVenda: 5, quantidade: 7, estoqueMinimo: 20 },
  { id: "p16", nome: "Biscoito de polvilho", categoria: "Lanches", unidade: "pacote 100g", precoCusto: 3.1, precoVenda: 8, quantidade: 22, estoqueMinimo: 12 },
  { id: "p17", nome: "Sanduíche natural", categoria: "Lanches", unidade: "unidade", precoCusto: 6.5, precoVenda: 15, quantidade: 6, estoqueMinimo: 8 },
  { id: "p18", nome: "Chocolate", categoria: "Lanches", unidade: "barra 90g", precoCusto: 4.2, precoVenda: 10, quantidade: 25, estoqueMinimo: 12 },

  { id: "p19", nome: "Tubo de bolas", categoria: "Acessórios", unidade: "tubo com 3", precoCusto: 34, precoVenda: 65, quantidade: 23, estoqueMinimo: 15 },
  { id: "p20", nome: "Overgrip", categoria: "Acessórios", unidade: "unidade", precoCusto: 9, precoVenda: 20, quantidade: 48, estoqueMinimo: 20 },
  { id: "p21", nome: "Corda para raquete", categoria: "Acessórios", unidade: "jogo", precoCusto: 45, precoVenda: 95, quantidade: 11, estoqueMinimo: 8 },
  { id: "p22", nome: "Munhequeira", categoria: "Acessórios", unidade: "par", precoCusto: 12, precoVenda: 28, quantidade: 4, estoqueMinimo: 10 },
  { id: "p23", nome: "Antivibrador", categoria: "Acessórios", unidade: "unidade", precoCusto: 6, precoVenda: 15, quantidade: 30, estoqueMinimo: 10 },
  { id: "p24", nome: "Viseira Red Tennis", categoria: "Acessórios", unidade: "unidade", precoCusto: 22, precoVenda: 55, quantidade: 14, estoqueMinimo: 6 },
];


export const PRODUTOS: Produto[] = PRODUTOS_BASE.map((produto, indice) => {
  const rng = criarRng(8800 + indice * 13);
  return {
    ...produto,
    ultimaEntrada: somarDias(HOJE, -inteiro(rng, 1, 26)),
  };
});

// ---------------------------------------------------------------------------
// Consumo lancado na conta de alunos e professores
// ---------------------------------------------------------------------------
/** Itens que realmente giram no balcao — acessorios saem bem menos. */
const PRODUTOS_DE_BALCAO = PRODUTOS.filter(
  (p) => p.categoria !== "Acessórios",
);

function gerarConsumos(): Consumo[] {
  const rng = criarRng(55501);
  const consumos: Consumo[] = [];

  for (let diasAtras = 29; diasAtras >= 0; diasAtras -= 1) {
    const data = somarDias(HOJE, -diasAtras);
    if (DIAS_COM_CHUVA.includes(data)) continue; // arena fechada

    // Com ~200 horarios por semana passando pela arena, o balcao gira algumas
    // dezenas de itens por dia.
    const lancamentos = inteiro(rng, 8, 18);

    for (let i = 0; i < lancamentos; i += 1) {
      // A maior parte do consumo e de alunos; professores tambem lancam.
      const ehProfessor = rng() > 0.82;
      const pessoa = ehProfessor
        ? escolher(rng, PROFESSORES)
        : escolher(rng, ALUNOS_BASE);
      const produto = escolher(rng, PRODUTOS_DE_BALCAO);

      consumos.push({
        id: `cs-${diasAtras}-${i}`,
        pessoaId: pessoa.id,
        tipoPessoa: ehProfessor ? "professor" : "aluno",
        data: `${data}T${String(inteiro(rng, 8, 21)).padStart(2, "0")}:${escolher(
          rng,
          ["04", "13", "27", "35", "48", "56"],
        )}`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        quantidade: rng() > 0.78 ? 2 : 1,
        valorUnitario: produto.precoVenda,
        // Consumo dos ultimos dias costuma ficar em aberto ate o fechamento.
        status: diasAtras <= 6 && rng() > 0.45 ? "em aberto" : "pago",
      });
    }
  }

  return consumos.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export const CONSUMOS: Consumo[] = gerarConsumos();

// ---------------------------------------------------------------------------
// Movimentacao de estoque
// ---------------------------------------------------------------------------
const RESPONSAVEIS_ESTOQUE = ["Lucas Ferreira", "Francisco Menezes"];

function gerarMovimentos(): MovimentoEstoque[] {
  const rng = criarRng(6420);
  const movimentos: MovimentoEstoque[] = [];

  // Entradas de reposicao
  PRODUTOS.forEach((produto, indice) => {
    if (rng() > 0.55) return;
    movimentos.push({
      id: `mv-ent-${produto.id}`,
      produtoId: produto.id,
      data: `${produto.ultimaEntrada}T${String(inteiro(rng, 8, 17)).padStart(2, "0")}:${escolher(rng, ["10", "25", "40"])}`,
      tipo: "entrada",
      quantidade: inteiro(rng, 12, 60),
      responsavel: RESPONSAVEIS_ESTOQUE[indice % 2],
      observacao: "Reposição do fornecedor",
    });
  });

  // Vendas derivadas do consumo lancado nas fichas
  CONSUMOS.slice(0, 60).forEach((consumo) => {
    movimentos.push({
      id: `mv-vd-${consumo.id}`,
      produtoId: consumo.produtoId,
      data: consumo.data,
      tipo: "venda",
      quantidade: consumo.quantidade,
      responsavel: "Balcão",
      observacao: `Consumo lançado na ficha`,
    });
  });

  // Algumas perdas pontuais
  ["p11", "p17", "p06"].forEach((produtoId, i) => {
    movimentos.push({
      id: `mv-pd-${produtoId}`,
      produtoId,
      data: `${somarDias(HOJE, -(3 + i * 5))}T16:${20 + i}`,
      tipo: "perda",
      quantidade: inteiro(rng, 1, 3),
      responsavel: RESPONSAVEIS_ESTOQUE[i % 2],
      observacao: i === 0 ? "Garrafa quebrada" : "Vencimento",
    });
  });

  return movimentos.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export const MOVIMENTOS_ESTOQUE: MovimentoEstoque[] = gerarMovimentos();
