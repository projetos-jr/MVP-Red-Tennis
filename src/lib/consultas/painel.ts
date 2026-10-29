/**
 * ============================================================================
 *  CONSULTAS — Painel (dashboard) e pecas que aparecem em todas as telas
 * ============================================================================
 *  - Painel: ocupacao das quadras no dia, indicadores, proximos horarios e o
 *    quadro "Precisa de atencao".
 *  - Barra do topo: busca rapida de aluno e descricao da arena.
 *
 *  Tudo sai do banco e das regras de cada modulo (situacao do lancamento,
 *  saldo de estoque, extrato de reposicao). O numero de cada cartao e o
 *  tamanho da lista que a tela mostra: o MVP dizia 12 reservas atrasadas no
 *  cartao e mostrava 6 na lista.
 *
 *  `agora` e a hora da arena no formato "HH:mm". Vale null enquanto a tela
 *  ainda nao sabe a hora (primeira montagem no servidor): conta-se o dia todo.
 * ============================================================================
 */

import { HORA_ABERTURA, HORA_FECHAMENTO, FAIXAS_HORARIAS } from "../banco/constantes";
import { ocupacaoAtiva, rotuloDaQuadra } from "../banco/regras/agenda";
import { planoVigente, situacaoDoAluno, type SituacaoAluno } from "../banco/regras/alunos";
import { sobrepoe } from "../banco/regras/comum";
import { saldosDeEstoque } from "../banco/regras/estoque";
import { diasEmAtraso, precoDaLocacao, situacaoLancamento } from "../banco/regras/financeiro";
import { extratoReposicao } from "../banco/regras/reposicao";
import type {
  Aluno,
  Banco,
  Colaborador,
  Lancamento,
  ModuloSistema,
  Ocupacao,
  OcupacaoAluno,
  Plano,
  Produto,
  Quadra,
  TipoOcupacao,
} from "../banco/tipos";
import { diferencaEmDias, horaParaMinutos, minutosParaHora, somarDias } from "../date";
import { nomeDaPessoa, podeAcessar } from "./base";

const MINUTOS_DE_FUNCIONAMENTO = (HORA_FECHAMENTO - HORA_ABERTURA) * 60;
const FECHAMENTO = minutosParaHora(HORA_FECHAMENTO * 60);

/** Creditos que vencem em ate 30 dias entram no "Precisa de atencao" (plano aprovado). */
export const DIAS_DE_AVISO_DA_REPOSICAO = 30;

export const TIPOS_DE_AULA: TipoOcupacao[] = ["Individual", "Dupla", "LAP"];
export const TIPOS_DE_LOCACAO: TipoOcupacao[] = [
  "Locação Mensal",
  "Locação Avulsa",
  "Plano de locação",
];

/** O que as listas do painel mostram de cada aluno. */
export type AlunoResumido = Pick<Aluno, "id" | "nome" | "fotoUrl">;

function resumir(aluno: Aluno): AlunoResumido {
  return { id: aluno.id, nome: aluno.nome, fotoUrl: aluno.fotoUrl };
}

/** Participantes agrupados por ocupacao (so das ocupacoes informadas). */
function participantesPorOcupacao(
  banco: Banco,
  ocupacoes: Ocupacao[],
): Map<string, OcupacaoAluno[]> {
  const ids = new Set(ocupacoes.map((o) => o.id));
  const mapa = new Map<string, OcupacaoAluno[]>();
  banco.ocupacaoAlunos.forEach((p) => {
    if (!ids.has(p.ocupacaoId)) return;
    const lista = mapa.get(p.ocupacaoId);
    if (lista) lista.push(p);
    else mapa.set(p.ocupacaoId, [p]);
  });
  return mapa;
}

// ---------------------------------------------------------------------------
// Ocupacao das quadras
// ---------------------------------------------------------------------------

/** Ocupacoes ativas (nao canceladas) da data, por horario e pela ordem das quadras. */
export function ocupacoesAtivasDoDia(banco: Banco, data: string): Ocupacao[] {
  const ordem = new Map(banco.quadras.map((q) => [q.id, q.ordem]));
  return banco.ocupacoes
    .filter((o) => o.data === data && ocupacaoAtiva(o))
    .sort(
      (a, b) =>
        a.horaInicio.localeCompare(b.horaInicio) ||
        (ordem.get(a.quadraId) ?? 0) - (ordem.get(b.quadraId) ?? 0),
    );
}

/** Minutos cobertos pelas ocupacoes, sem contar duas vezes um trecho repetido. */
function minutosCobertos(ocupacoes: Ocupacao[]): number {
  const intervalos = ocupacoes
    .map((o) => [horaParaMinutos(o.horaInicio), horaParaMinutos(o.horaFim)])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let fimAtual = 0;
  intervalos.forEach(([inicio, fim]) => {
    const comeco = Math.max(inicio, fimAtual);
    if (fim > comeco) total += fim - comeco;
    fimAtual = Math.max(fimAtual, fim);
  });
  return total;
}

/** "14:00" -> "15:00" (as faixas da grade tem 1 hora). */
function fimDaFaixa(inicio: string): string {
  return minutosParaHora(horaParaMinutos(inicio) + 60);
}

export interface QuadraNoPainel {
  quadra: Quadra;
  rotulo: string;
  /** Ocupacoes ativas do dia nesta quadra, em ordem. */
  ocupacoes: Ocupacao[];
  minutosOcupados: number;
  /** 0 a 1: parte do horario de funcionamento tomada por aulas, locacoes e bloqueios. */
  taxa: number;
  /** O que esta acontecendo agora na quadra. */
  emAndamento?: Ocupacao;
  /** A proxima ocupacao a comecar. */
  proxima?: Ocupacao;
  /** Inicio da proxima faixa de 1 hora livre (null = cheia ate o fechamento). */
  proximaFaixaLivre: string | null;
  /** A faixa livre e a de agora. */
  livreAgora: boolean;
  /** A arena ja fechou por hoje. */
  encerrado: boolean;
}

export function ocupacaoDasQuadras(
  banco: Banco,
  data: string,
  agora: string | null,
): QuadraNoPainel[] {
  const doDia = ocupacoesAtivasDoDia(banco, data);
  const referencia = agora ?? "00:00";

  return [...banco.quadras]
    .sort((a, b) => a.ordem - b.ordem)
    .map((quadra) => {
      const ocupacoes = doDia.filter((o) => o.quadraId === quadra.id);
      const minutosOcupados = minutosCobertos(ocupacoes);
      const faixaLivre = FAIXAS_HORARIAS.find((inicio) => {
        const fim = fimDaFaixa(inicio);
        return (
          fim > referencia &&
          !ocupacoes.some((o) => sobrepoe(o.horaInicio, o.horaFim, inicio, fim))
        );
      });

      return {
        quadra,
        rotulo: rotuloDaQuadra(quadra.id),
        ocupacoes,
        minutosOcupados,
        taxa: Math.min(1, minutosOcupados / MINUTOS_DE_FUNCIONAMENTO),
        emAndamento: agora
          ? ocupacoes.find((o) => o.horaInicio <= agora && agora < o.horaFim)
          : undefined,
        proxima: ocupacoes.find((o) => o.horaInicio > referencia),
        proximaFaixaLivre: faixaLivre ?? null,
        livreAgora: faixaLivre !== undefined && faixaLivre <= referencia,
        encerrado: agora !== null && agora >= FECHAMENTO,
      };
    });
}

// ---------------------------------------------------------------------------
// Indicadores do dia
// ---------------------------------------------------------------------------

export interface ResumoDoDia {
  /** Aulas, locacoes e partidas de ranking (bloqueios ficam de fora). */
  total: number;
  aulas: number;
  locacoes: number;
  partidas: number;
  /** Alunos diferentes com horario hoje (sem quem ja avisou a falta). */
  alunosEmQuadra: number;
  /** Media da ocupacao das quadras, de 0 a 1. */
  ocupacaoMedia: number;
  quadraMaisCheia?: string;
}

/** Recebe a ocupacao ja calculada para nao refazer a conta. */
export function resumoDoDia(banco: Banco, quadras: QuadraNoPainel[]): ResumoDoDia {
  const ocupacoes = quadras.flatMap((q) => q.ocupacoes).filter((o) => o.tipo !== "Bloqueio");
  const participantes = participantesPorOcupacao(banco, ocupacoes);
  const alunos = new Set<string>();
  participantes.forEach((lista) =>
    lista.forEach((p) => {
      if (p.presenca !== "falta" && p.presenca !== "falta_avisada") alunos.add(p.alunoId);
    }),
  );
  const maisCheia = quadras.reduce<QuadraNoPainel | undefined>(
    (maior, q) => (!maior || q.taxa > maior.taxa ? q : maior),
    undefined,
  );

  return {
    total: ocupacoes.length,
    aulas: ocupacoes.filter((o) => TIPOS_DE_AULA.includes(o.tipo)).length,
    locacoes: ocupacoes.filter((o) => TIPOS_DE_LOCACAO.includes(o.tipo)).length,
    partidas: ocupacoes.filter((o) => o.tipo === "Ranking").length,
    alunosEmQuadra: alunos.size,
    ocupacaoMedia:
      quadras.length === 0 ? 0 : quadras.reduce((soma, q) => soma + q.taxa, 0) / quadras.length,
    quadraMaisCheia: maisCheia && maisCheia.taxa > 0 ? maisCheia.rotulo : undefined,
  };
}

// ---------------------------------------------------------------------------
// Proximos horarios
// ---------------------------------------------------------------------------

export interface HorarioDoPainel {
  ocupacao: Ocupacao;
  rotuloQuadra: string;
  alunos: AlunoResumido[];
  professor?: string;
  emAndamento: boolean;
}

export interface HorariosDoPainel {
  /** "proximos": de agora em diante. "ultimos": o dia ja terminou; mostra o fim dele. */
  modo: "proximos" | "ultimos";
  itens: HorarioDoPainel[];
}

export function proximosHorarios(
  banco: Banco,
  quadras: QuadraNoPainel[],
  agora: string | null,
  limite = 6,
): HorariosDoPainel {
  // As quadras vem em ordem; a ordenacao estavel por horario mantem essa ordem nos empates.
  const doDia = quadras
    .flatMap((q) => q.ocupacoes)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const referencia = agora ?? "00:00";
  const seguintes = doDia.filter((o) => o.horaFim > referencia);
  const modo = seguintes.length > 0 || doDia.length === 0 ? "proximos" : "ultimos";
  const escolhidas = modo === "proximos" ? seguintes.slice(0, limite) : doDia.slice(-limite);

  const participantes = participantesPorOcupacao(banco, escolhidas);
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));

  return {
    modo,
    itens: escolhidas.map((ocupacao) => ({
      ocupacao,
      rotuloQuadra: rotuloDaQuadra(ocupacao.quadraId),
      alunos: (participantes.get(ocupacao.id) ?? []).flatMap((p) => {
        const aluno = alunoPorId.get(p.alunoId);
        return aluno ? [resumir(aluno)] : [];
      }),
      professor: ocupacao.professorId ? nomeDaPessoa(banco, ocupacao.professorId) : undefined,
      emAndamento: agora !== null && ocupacao.horaInicio <= agora && agora < ocupacao.horaFim,
    })),
  };
}

// ---------------------------------------------------------------------------
// Precisa de atencao
// ---------------------------------------------------------------------------

export interface ReservaSemPagamento {
  ocupacao: Ocupacao;
  rotuloQuadra: string;
  titular?: AlunoResumido;
  valor: number;
  /** Fim do prazo para pagar ("YYYY-MM-DDTHH:mm:ss"), quando houver. */
  prazo?: string;
  vencida: boolean;
}

/**
 * Reservas avulsas aguardando pagamento (Hipotese H5), as de prazo vencido
 * primeiro. Com o prazo das Configuracoes (24 h), toda reserva em aberto
 * esta a menos de um dia de vencer; por isso aparecem todas.
 * `momento` = "YYYY-MM-DDTHH:mm".
 */
export function reservasSemPagamento(banco: Banco, momento: string): ReservaSemPagamento[] {
  const aguardando = banco.ocupacoes.filter((o) => o.situacao === "aguardando_pagamento");
  const participantes = participantesPorOcupacao(banco, aguardando);
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));
  const cobrancaPorOcupacao = new Map<string, Lancamento>();
  banco.lancamentos.forEach((l) => {
    if (l.ocupacaoId && !l.canceladoEm) cobrancaPorOcupacao.set(l.ocupacaoId, l);
  });

  return aguardando
    .map((ocupacao) => {
      const cobranca = cobrancaPorOcupacao.get(ocupacao.id);
      const titularId = participantes.get(ocupacao.id)?.[0]?.alunoId ?? cobranca?.pessoaId;
      const titular = titularId ? alunoPorId.get(titularId) : undefined;
      return {
        ocupacao,
        rotuloQuadra: rotuloDaQuadra(ocupacao.quadraId),
        titular: titular ? resumir(titular) : undefined,
        valor: cobranca?.valor ?? precoDaLocacao(banco.configuracoes, ocupacao),
        prazo: ocupacao.prazoPagamento,
        vencida: ocupacao.prazoPagamento !== undefined && ocupacao.prazoPagamento < momento,
      };
    })
    .sort(
      (a, b) =>
        (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") ||
        `${a.ocupacao.data}${a.ocupacao.horaInicio}`.localeCompare(
          `${b.ocupacao.data}${b.ocupacao.horaInicio}`,
        ),
    );
}

export interface MensalidadeEmAtraso {
  lancamento: Lancamento;
  aluno?: AlunoResumido;
  diasEmAtraso: number;
}

/** Mensalidades a receber vencidas e sem pagamento (as mais antigas primeiro). */
export function mensalidadesEmAtraso(banco: Banco, hoje: string): MensalidadeEmAtraso[] {
  const alunoPorId = new Map(banco.alunos.map((a) => [a.id, a]));
  return banco.lancamentos
    .filter(
      (l) =>
        l.tipo === "receber" &&
        l.categoria === "Mensalidade" &&
        situacaoLancamento(l, hoje) === "em_atraso",
    )
    .map((lancamento) => {
      const aluno = lancamento.pessoaId ? alunoPorId.get(lancamento.pessoaId) : undefined;
      return {
        lancamento,
        aluno: aluno ? resumir(aluno) : undefined,
        diasEmAtraso: diasEmAtraso(lancamento, hoje),
      };
    })
    .sort(
      (a, b) =>
        b.diasEmAtraso - a.diasEmAtraso ||
        (a.aluno?.nome ?? "").localeCompare(b.aluno?.nome ?? "", "pt-BR"),
    );
}

export interface ProdutoAbaixoDoMinimo {
  produto: Produto;
  saldo: number;
}

/** Produtos ativos com saldo menor que o estoque minimo (os mais criticos primeiro). */
export function produtosAbaixoDoMinimo(banco: Banco): ProdutoAbaixoDoMinimo[] {
  const saldos = saldosDeEstoque(banco.movimentosEstoque);
  return banco.produtos
    .filter((p) => p.ativo)
    .map((produto) => ({ produto, saldo: saldos.get(produto.id) ?? 0 }))
    .filter(({ produto, saldo }) => saldo < produto.estoqueMinimo)
    .sort(
      (a, b) =>
        a.saldo / a.produto.estoqueMinimo - b.saldo / b.produto.estoqueMinimo ||
        a.produto.nome.localeCompare(b.produto.nome, "pt-BR"),
    );
}

export interface ReposicaoAVencer {
  aluno: AlunoResumido;
  /** Minutos ainda nao usados que vencem nos proximos 30 dias. */
  minutos: number;
  /** Validade do credito que vence primeiro. */
  validade: string;
  diasParaVencer: number;
}

/** Alunos ativos com credito de reposicao que vence em ate 30 dias (um item por aluno). */
export function reposicoesAVencer(banco: Banco, hoje: string): ReposicaoAVencer[] {
  const limite = somarDias(hoje, DIAS_DE_AVISO_DA_REPOSICAO);
  // So monta o extrato de quem tem credito com validade dentro do periodo.
  const candidatos = new Set(
    banco.reposicoes
      .filter((r) => r.minutos > 0 && r.validade && r.validade >= hoje && r.validade <= limite)
      .map((r) => r.alunoId),
  );

  return banco.alunos
    .filter((aluno) => aluno.ativo && candidatos.has(aluno.id))
    .flatMap((aluno) => {
      const aVencer = extratoReposicao(banco.reposicoes, aluno.id, hoje).creditos.filter(
        (c) => !c.vencido && c.restante > 0 && (c.credito.validade ?? "") <= limite,
      );
      if (aVencer.length === 0) return [];
      const validade = aVencer.map((c) => c.credito.validade ?? hoje).sort()[0];
      return [
        {
          aluno: resumir(aluno),
          minutos: aVencer.reduce((soma, c) => soma + c.restante, 0),
          validade,
          diasParaVencer: diferencaEmDias(hoje, validade),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.validade.localeCompare(b.validade) || a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"),
    );
}

export type GrupoDeAtencao =
  | { tipo: "reservas"; itens: ReservaSemPagamento[] }
  | { tipo: "mensalidades"; itens: MensalidadeEmAtraso[]; valorTotal: number }
  | { tipo: "produtos"; itens: ProdutoAbaixoDoMinimo[] }
  | { tipo: "reposicoes"; itens: ReposicaoAVencer[] };

export interface PrecisaDeAtencao {
  /** So os grupos das areas que o colaborador pode abrir (cada item leva a uma delas). */
  grupos: GrupoDeAtencao[];
  /** Soma dos itens dos grupos: e o numero do cartao "Pendências". */
  total: number;
}

export function precisaDeAtencao(
  banco: Banco,
  colaborador: Colaborador,
  hoje: string,
  agora: string | null,
): PrecisaDeAtencao {
  const pode = (modulo: ModuloSistema) => podeAcessar(banco, colaborador, modulo);
  const grupos: GrupoDeAtencao[] = [];

  if (pode("agenda")) {
    grupos.push({
      tipo: "reservas",
      itens: reservasSemPagamento(banco, `${hoje}T${agora ?? "00:00"}`),
    });
  }
  if (pode("financeiro")) {
    const itens = mensalidadesEmAtraso(banco, hoje);
    grupos.push({
      tipo: "mensalidades",
      itens,
      valorTotal: itens.reduce((soma, m) => soma + m.lancamento.valor, 0),
    });
  }
  if (pode("estoque")) grupos.push({ tipo: "produtos", itens: produtosAbaixoDoMinimo(banco) });
  if (pode("alunos")) grupos.push({ tipo: "reposicoes", itens: reposicoesAVencer(banco, hoje) });

  return { grupos, total: grupos.reduce((soma, g) => soma + g.itens.length, 0) };
}

// ---------------------------------------------------------------------------
// Barra do topo: busca rapida de aluno e descricao da arena
// ---------------------------------------------------------------------------

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Alunos de um professor (Hipotese H9: o professor ve so os proprios alunos):
 * quem o tem como professor principal ou esta num horario fixo dele.
 */
export function alunosDoProfessor(banco: Banco, professorId: string, hoje: string): Set<string> {
  const fixos = new Set(
    banco.horariosFixos
      .filter((h) => h.professorId === professorId && (!h.fim || h.fim >= hoje))
      .map((h) => h.id),
  );
  const ids = new Set(
    banco.alunos.filter((a) => a.professorPrincipalId === professorId).map((a) => a.id),
  );
  banco.horarioAlunos.forEach((ha) => {
    if (fixos.has(ha.horarioFixoId)) ids.add(ha.alunoId);
  });
  return ids;
}

export interface AlunoEncontrado {
  aluno: Aluno;
  plano?: Plano;
  situacao: SituacaoAluno;
}

export interface ResultadoDaBusca {
  /** Os primeiros resultados, do mais parecido para o menos. */
  itens: AlunoEncontrado[];
  /** Quantos alunos combinam com o termo ao todo. */
  total: number;
}

/**
 * Busca de aluno enquanto a pessoa digita (por exemplo, durante uma ligacao).
 * Ignora acentos e maiusculas; aceita pedacos do nome ("gui lim"), e-mail ou
 * os numeros do telefone. Nomes que comecam com o termo vem primeiro.
 */
export function buscarAlunosRapido(
  banco: Banco,
  termo: string,
  opcoes: { hoje: string; professorId?: string; limite?: number },
): ResultadoDaBusca {
  const texto = normalizar(termo);
  if (!texto) return { itens: [], total: 0 };

  const digitos = termo.replace(/\D/g, "");
  const porTelefone = digitos.length >= 3 && !/[a-z]/.test(texto);
  const pedacos = texto.split(/\s+/);
  const permitidos = opcoes.professorId
    ? alunosDoProfessor(banco, opcoes.professorId, opcoes.hoje)
    : null;

  const encontrados = banco.alunos.flatMap((aluno) => {
    if (permitidos && !permitidos.has(aluno.id)) return [];
    const nome = normalizar(aluno.nome);
    const palavras = nome.split(/\s+/);
    let nota: number | undefined;
    if (porTelefone) {
      if (aluno.telefone.replace(/\D/g, "").includes(digitos)) nota = 4;
    } else if (nome.startsWith(texto)) nota = 0;
    else if (pedacos.every((p) => palavras.some((palavra) => palavra.startsWith(p)))) nota = 1;
    else if (nome.includes(texto)) nota = 2;
    else if (normalizar(aluno.email).includes(texto)) nota = 3;
    return nota === undefined ? [] : [{ aluno, nota }];
  });

  const itens = encontrados
    .sort((a, b) => a.nota - b.nota || a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"))
    .slice(0, opcoes.limite ?? 8)
    .map(({ aluno }) => ({
      aluno,
      plano: planoVigente(banco, aluno.id, opcoes.hoje),
      situacao: situacaoDoAluno(banco, aluno, opcoes.hoje),
    }));

  return { itens, total: encontrados.length };
}

/** "3 quadras de saibro · 1 de cimento · paredão" */
export function descricaoDaArena(banco: Banco): string {
  const porPiso = new Map<string, number>();
  banco.quadras
    .filter((q) => q.id !== "paredao")
    .forEach((q) => porPiso.set(q.piso, (porPiso.get(q.piso) ?? 0) + 1));
  const partes = [...porPiso.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([piso, quantidade], i) =>
      i === 0
        ? `${quantidade} quadra${quantidade > 1 ? "s" : ""} de ${piso}`
        : `${quantidade} de ${piso}`,
    );
  if (banco.quadras.some((q) => q.id === "paredao")) partes.push("paredão");
  return partes.join(" · ");
}

/** "07h às 22h" */
export const HORARIO_DE_FUNCIONAMENTO = `${String(HORA_ABERTURA).padStart(2, "0")}h às ${HORA_FECHAMENTO}h`;

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora da arena ("Olá" sem a hora). */
export function saudacao(agora: string | null): string {
  if (!agora) return "Olá";
  const hora = Number(agora.slice(0, 2));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
