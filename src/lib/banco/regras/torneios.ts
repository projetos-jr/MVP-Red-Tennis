/**
 * Regras dos torneios: geracao das chaves, avanco do vencedor e classificacao.
 *
 * Os tres formatos da v1 (docs/MODELO-E-TELAS.md, "Ranking e torneios"):
 *  - eliminatoria simples: quem perde sai. Quando o numero de inscritos nao
 *    fecha uma chave (2, 4, 8, 16...), as vagas que sobram viram folgas (bye)
 *    e ficam com os cabecas de chave, que passam direto para a 2a rodada;
 *  - grupos + eliminatoria: grupos de 3 ou 4, todos contra todos dentro do
 *    grupo; passam `classificadosPorGrupo` de cada grupo (Hipotese H8) e a
 *    fase eliminatoria e montada quando o ultimo jogo dos grupos termina;
 *  - todos contra todos: cada inscricao enfrenta todas as outras uma vez.
 *
 * Na eliminatoria, cada partida aponta para a seguinte (`proximaPartidaId` e
 * `ladoNaProxima`): gravar o resultado leva o vencedor para la sozinho. Uma
 * folga nao vira partida: quem a recebe ja nasce na partida da 2a rodada.
 *
 * Tudo aqui e funcao pura: recebe listas e devolve listas novas, sem alterar
 * nada no lugar. No banco real, `gerarChave` e `aplicarResultado` viram
 * funcoes do Postgres chamadas por rpc.
 */

import { criarRng, embaralhar } from "../semente/aleatorio";
import type { Aluno, FormatoTorneio, Partida, Torneio, TorneioInscrito } from "../tipos";
import { ErroDeRegra } from "./comum";
import { totaisDaPartida } from "./ranking";

/** Limite de inscricoes por torneio (mantem a chave legivel na tela). */
export const MAXIMO_DE_INSCRICOES = 64;

export type Lado = "A" | "B";

// ---------------------------------------------------------------------------
// Pecas comuns
// ---------------------------------------------------------------------------

/** Menor chave (2, 4, 8, 16...) em que cabem os inscritos. */
export function tamanhoDaChave(quantidade: number): number {
  let tamanho = 1;
  while (tamanho < quantidade) tamanho *= 2;
  return tamanho;
}

/**
 * Numero de cabeca de chave de cada vaga, de cima para baixo.
 * Ex.: 8 -> [1, 8, 5, 4, 3, 6, 7, 2]. O 1 fica no topo e o 2 na base (so se
 * encontram na final); na estreia cada um enfrenta o numero "espelhado"
 * (1 x 8, 4 x 5...). As vagas de numero maior que o de inscritos sao as
 * folgas, e por isso caem sempre contra os primeiros cabecas de chave.
 */
export function ordemDosCabecas(tamanho: number): number[] {
  let ordem = [1];
  while (ordem.length < tamanho) {
    const soma = ordem.length * 2 + 1;
    ordem = ordem.flatMap((numero, i) =>
      i % 2 === 0 ? [numero, soma - numero] : [soma - numero, numero],
    );
  }
  return ordem;
}

/** Em que rodada duas vagas da chave se encontrariam (1 = estreia). */
export function rodadaDoEncontro(vagaA: number, vagaB: number): number {
  let diferenca = vagaA ^ vagaB;
  let rodada = 0;
  while (diferenca > 0) {
    rodada += 1;
    diferenca >>= 1;
  }
  return rodada;
}

/** "Final", "Semifinal", "Quartas de final"... pela distancia ate a final. */
export function nomeDaFase(rodada: number, totalDeRodadas: number): string {
  switch (totalDeRodadas - rodada) {
    case 0:
      return "Final";
    case 1:
      return "Semifinal";
    case 2:
      return "Quartas de final";
    case 3:
      return "Oitavas de final";
    default:
      return `${rodada}ª rodada`;
  }
}

/** Cabecas de chave primeiro (pelo numero), depois os demais na ordem recebida. */
export function ordenarPorCabeca(inscritos: TorneioInscrito[]): TorneioInscrito[] {
  const cabecas = inscritos
    .filter((i) => i.cabecaDeChave)
    .sort((a, b) => (a.cabecaDeChave ?? 0) - (b.cabecaDeChave ?? 0));
  return [...cabecas, ...inscritos.filter((i) => !i.cabecaDeChave)];
}

/** Transforma um texto num numero (FNV-1a), para alimentar o sorteio. */
function numeroDoTexto(texto: string): number {
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Sorteio dos inscritos que nao sao cabeca de chave (os cabecas ficam nas
 * suas vagas). A `semente` deixa o sorteio repetivel: a mesma semente da
 * sempre a mesma chave, o que permite testar.
 */
export function sortearInscritos(
  inscritos: TorneioInscrito[],
  semente: string,
): TorneioInscrito[] {
  const ordenados = ordenarPorCabeca(inscritos);
  const cabecas = ordenados.filter((i) => i.cabecaDeChave);
  const demais = ordenados.filter((i) => !i.cabecaDeChave);
  return [...cabecas, ...embaralhar(criarRng(numeroDoTexto(semente)), demais)];
}

function partidaVazia(torneio: Torneio, id: string, criadoEm: string): Partida {
  return { id, torneioId: torneio.id, data: torneio.data, ladoA: [], ladoB: [], criadoEm };
}

/** Copia da partida com a inscricao num dos lados (sem inscricao = lado vazio). */
function comLado(
  partida: Partida,
  lado: Lado,
  inscricaoId?: string,
  alunosIds: string[] = [],
): Partida {
  return lado === "A"
    ? { ...partida, inscricaoAId: inscricaoId, ladoA: [...alunosIds] }
    : { ...partida, inscricaoBId: inscricaoId, ladoB: [...alunosIds] };
}

// ---------------------------------------------------------------------------
// Eliminatoria simples
// ---------------------------------------------------------------------------

/** Vagas da eliminatoria: cada inscrito na vaga do seu numero; vaga vazia = folga. */
export function vagasDaEliminatoria(
  inscritos: TorneioInscrito[],
): Array<TorneioInscrito | undefined> {
  const ordenados = ordenarPorCabeca(inscritos);
  return ordemDosCabecas(tamanhoDaChave(ordenados.length)).map(
    (numero) => ordenados[numero - 1],
  );
}

/**
 * Partidas de uma eliminatoria a partir das vagas (de cima para baixo).
 * Ids: `<prefixo>-r<rodada>-<ordem>`. A folga da 1a rodada nao vira partida:
 * quem a recebe entra direto na partida da 2a rodada.
 */
export function montarEliminatoria(
  torneio: Torneio,
  vagas: Array<TorneioInscrito | undefined>,
  prefixoId: string,
  criadoEm: string,
): Partida[] {
  const totalDeRodadas = Math.log2(vagas.length);
  const id = (rodada: number, indice: number) => `${prefixoId}-r${rodada}-${indice + 1}`;
  const partidas = new Map<string, Partida>();

  for (let rodada = 1; rodada <= totalDeRodadas; rodada += 1) {
    const quantas = vagas.length / 2 ** rodada;
    for (let indice = 0; indice < quantas; indice += 1) {
      if (rodada === 1 && (!vagas[2 * indice] || !vagas[2 * indice + 1])) continue;
      const final = rodada === totalDeRodadas;
      partidas.set(id(rodada, indice), {
        ...partidaVazia(torneio, id(rodada, indice), criadoEm),
        fase: nomeDaFase(rodada, totalDeRodadas),
        rodada,
        ordem: indice + 1,
        proximaPartidaId: final ? undefined : id(rodada + 1, Math.floor(indice / 2)),
        ladoNaProxima: final ? undefined : indice % 2 === 0 ? "A" : "B",
      });
    }
  }

  vagas.forEach((inscricao, vaga) => {
    if (!inscricao) return;
    const indice = Math.floor(vaga / 2);
    const estreia = partidas.get(id(1, indice));
    if (estreia) {
      const lado = vaga % 2 === 0 ? "A" : "B";
      partidas.set(estreia.id, comLado(estreia, lado, inscricao.id, inscricao.alunosIds));
      return;
    }
    // Folga: entra direto na partida da 2a rodada.
    const segunda = partidas.get(id(2, Math.floor(indice / 2)));
    if (segunda) {
      const lado = indice % 2 === 0 ? "A" : "B";
      partidas.set(segunda.id, comLado(segunda, lado, inscricao.id, inscricao.alunosIds));
    }
  });

  return [...partidas.values()];
}

// ---------------------------------------------------------------------------
// Todos contra todos e grupos
// ---------------------------------------------------------------------------

/**
 * Rodadas do todos contra todos pelo "metodo do circulo": cada um joga no
 * maximo uma vez por rodada; com numero impar, a cada rodada um fica de folga.
 * 4 inscritos: 3 rodadas de 2 jogos. 5 inscritos: 5 rodadas de 2 jogos.
 */
export function rodadasTodosContraTodos<T>(itens: T[]): Array<Array<[T, T]>> {
  const roda: Array<T | undefined> = itens.length % 2 === 0 ? [...itens] : [...itens, undefined];
  const rodadas: Array<Array<[T, T]>> = [];
  for (let r = 0; r < roda.length - 1; r += 1) {
    const jogos: Array<[T, T]> = [];
    for (let i = 0; i < roda.length / 2; i += 1) {
      const a = roda[i];
      const b = roda[roda.length - 1 - i];
      if (a !== undefined && b !== undefined) jogos.push([a, b]);
    }
    rodadas.push(jogos);
    // O primeiro fica parado; os demais giram uma casa.
    roda.splice(1, 0, roda.pop());
  }
  return rodadas;
}

function partidasTodosContraTodos(
  torneio: Torneio,
  membros: TorneioInscrito[],
  prefixoId: string,
  criadoEm: string,
  grupo?: string,
): Partida[] {
  return rodadasTodosContraTodos(membros).flatMap((jogos, r) =>
    jogos.map(([a, b], j) => ({
      ...partidaVazia(torneio, `${prefixoId}-${grupo ? `g${grupo}-` : ""}r${r + 1}-${j + 1}`, criadoEm),
      ladoA: [...a.alunosIds],
      inscricaoAId: a.id,
      ladoB: [...b.alunosIds],
      inscricaoBId: b.id,
      fase: grupo ? `Grupo ${grupo}` : `Rodada ${r + 1}`,
      grupo,
      rodada: r + 1,
      ordem: j + 1,
    })),
  );
}

/** Tamanho de cada grupo (de 3 ou 4) para a quantidade de inscritos: 7 -> [4, 3]. */
export function tamanhosDosGrupos(quantidade: number): number[] {
  const grupos = Math.ceil(quantidade / 4);
  const base = Math.floor(quantidade / grupos);
  const sobra = quantidade % grupos;
  return Array.from({ length: grupos }, (_, i) => base + (i < sobra ? 1 : 0));
}

export function letraDoGrupo(indice: number): string {
  return String.fromCharCode(65 + indice);
}

/**
 * Distribui os inscritos nos grupos em "serpentina" (A B | B A | A B...): os
 * cabecas de chave caem em grupos diferentes e os grupos ficam parelhos.
 * Devolve copias das inscricoes com o `grupo` preenchido.
 */
export function distribuirEmGrupos(inscritos: TorneioInscrito[]): TorneioInscrito[] {
  const tamanhos = tamanhosDosGrupos(inscritos.length);
  const grupos: TorneioInscrito[][] = tamanhos.map(() => []);
  let atual = 0;
  let sentido = 1;
  const avancar = () => {
    const proximo = atual + sentido;
    // Na ponta, inverte o sentido e repete o mesmo grupo.
    if (proximo < 0 || proximo >= grupos.length) sentido = -sentido;
    else atual = proximo;
  };
  ordenarPorCabeca(inscritos).forEach((inscricao) => {
    while (grupos[atual].length >= tamanhos[atual]) avancar();
    grupos[atual].push(inscricao);
    avancar();
  });
  return grupos.flatMap((membros, g) =>
    membros.map((membro) => ({ ...membro, grupo: letraDoGrupo(g) })),
  );
}

// ---------------------------------------------------------------------------
// Previa e geracao da chave
// ---------------------------------------------------------------------------

export interface PreviaDaChave {
  valida: boolean;
  /** Frase pronta para a tela ("Chave de 8 com 2 folgas..."). */
  mensagem: string;
  partidas: number;
  folgas: number;
  /** Tamanho de cada grupo (so em grupos + eliminatoria). */
  grupos: number[];
}

function previaInvalida(mensagem: string): PreviaDaChave {
  return { valida: false, mensagem, partidas: 0, folgas: 0, grupos: [] };
}

/** "4 e 3", "4, 4 e 3". */
function listarNumeros(numeros: number[]): string {
  if (numeros.length <= 1) return numeros.join("");
  return `${numeros.slice(0, -1).join(", ")} e ${numeros[numeros.length - 1]}`;
}

/** O que a chave vai ter com essa quantidade de inscricoes (ou por que nao da). */
export function previaDaChave(
  formato: FormatoTorneio,
  quantidade: number,
  classificadosPorGrupo: number,
): PreviaDaChave {
  if (quantidade > MAXIMO_DE_INSCRICOES) {
    return previaInvalida(`O limite é de ${MAXIMO_DE_INSCRICOES} inscrições por torneio.`);
  }

  if (formato === "eliminatoria") {
    if (quantidade < 2) return previaInvalida("A eliminatória precisa de pelo menos 2 inscrições.");
    const tamanho = tamanhoDaChave(quantidade);
    const folgas = tamanho - quantidade;
    const partidas = quantidade - 1;
    const quemPassa =
      folgas === 1
        ? "1 folga: o 1º cabeça de chave passa"
        : `${folgas} folgas: os ${folgas} primeiros cabeças de chave passam`;
    return {
      valida: true,
      partidas,
      folgas,
      grupos: [],
      mensagem:
        folgas === 0
          ? `Chave de ${tamanho}, com ${partidas} partidas.`
          : `Chave de ${tamanho} com ${quemPassa} direto para a 2ª rodada. ${partidas} partidas.`,
    };
  }

  if (formato === "todos_contra_todos") {
    if (quantidade < 3) return previaInvalida("Todos contra todos precisa de pelo menos 3 inscrições.");
    const partidas = (quantidade * (quantidade - 1)) / 2;
    const impar = quantidade % 2 === 1;
    return {
      valida: true,
      partidas,
      folgas: 0,
      grupos: [],
      mensagem: `${partidas} partidas em ${impar ? quantidade : quantidade - 1} rodadas${
        impar ? " (a cada rodada, um fica de folga)" : ""
      }.`,
    };
  }

  if (quantidade < 6) {
    return previaInvalida("Grupos + eliminatória precisa de pelo menos 6 inscrições (dois grupos de 3).");
  }
  const grupos = tamanhosDosGrupos(quantidade);
  const menor = Math.min(...grupos);
  if (classificadosPorGrupo < 1 || classificadosPorGrupo >= menor) {
    return previaInvalida(
      `Passam ${classificadosPorGrupo} por grupo (Configurações), mas o menor grupo teria ${menor} inscrições. Ajuste as inscrições ou as Configurações.`,
    );
  }
  const classificados = grupos.length * classificadosPorGrupo;
  const jogosDeGrupo = grupos.reduce((soma, n) => soma + (n * (n - 1)) / 2, 0);
  const partidas = jogosDeGrupo + classificados - 1;
  return {
    valida: true,
    partidas,
    folgas: tamanhoDaChave(classificados) - classificados,
    grupos,
    mensagem: `${grupos.length} grupos (de ${listarNumeros(grupos)}); passam ${classificadosPorGrupo} de cada para uma eliminatória de ${classificados}. ${partidas} partidas.`,
  };
}

export interface OpcoesDaChave {
  /** Comeco dos ids das partidas criadas ("pt-t-2" gera "pt-t-2-r1-1"...). */
  prefixoId: string;
  criadoEm: string;
  /** H8: quantos passam de cada grupo. */
  classificadosPorGrupo: number;
}

export interface ChaveGerada {
  partidas: Partida[];
  /** As inscricoes, com o grupo preenchido no formato de grupos. */
  inscritos: TorneioInscrito[];
}

/**
 * Gera as partidas da chave. A ordem de `inscritos` vale como sorteio de
 * quem nao e cabeca de chave (veja `sortearInscritos`). No formato de grupos,
 * gera so os jogos dos grupos: a eliminatoria vem depois.
 */
export function gerarChave(
  torneio: Torneio,
  inscritos: TorneioInscrito[],
  opcoes: OpcoesDaChave,
): ChaveGerada {
  const previa = previaDaChave(torneio.formato, inscritos.length, opcoes.classificadosPorGrupo);
  if (!previa.valida) throw new ErroDeRegra(previa.mensagem);

  if (torneio.formato === "eliminatoria") {
    return {
      partidas: montarEliminatoria(
        torneio,
        vagasDaEliminatoria(inscritos),
        opcoes.prefixoId,
        opcoes.criadoEm,
      ),
      inscritos,
    };
  }
  if (torneio.formato === "todos_contra_todos") {
    return {
      partidas: partidasTodosContraTodos(
        torneio,
        ordenarPorCabeca(inscritos),
        opcoes.prefixoId,
        opcoes.criadoEm,
      ),
      inscritos,
    };
  }

  const comGrupo = distribuirEmGrupos(inscritos);
  const letras = [...new Set(comGrupo.map((i) => i.grupo ?? ""))];
  return {
    partidas: letras.flatMap((letra) =>
      partidasTodosContraTodos(
        torneio,
        comGrupo.filter((i) => i.grupo === letra),
        opcoes.prefixoId,
        opcoes.criadoEm,
        letra,
      ),
    ),
    inscritos: comGrupo,
  };
}

// ---------------------------------------------------------------------------
// Classificacao (grupos e todos contra todos)
// ---------------------------------------------------------------------------

export interface LinhaDaClassificacao {
  inscricaoId: string;
  posicao: number;
  jogos: number;
  vitorias: number;
  derrotas: number;
  setsPro: number;
  setsContra: number;
  gamesPro: number;
  gamesContra: number;
  /** Criterio que desfez o empate (vazio quando nao houve empate). */
  desempate?: string;
}

/** Ultimo recurso, depois dos criterios das Configuracoes. */
export const DESEMPATE_FINAL = "Cabeça de chave e ordem de inscrição";

type Estatisticas = Omit<LinhaDaClassificacao, "posicao" | "desempate">;

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Valor de cada inscricao num criterio (maior e melhor). Os criterios vem
 * das Configuracoes (H8) como texto: "Vitórias", "Confronto direto",
 * "Saldo de sets", "Saldo de games". Texto desconhecido e ignorado.
 */
function valorNoCriterio(
  criterio: string,
  ids: string[],
  estatisticas: Map<string, Estatisticas>,
  partidas: Partida[],
): Map<string, number> | undefined {
  const nome = semAcento(criterio);
  const de = (id: string) => estatisticas.get(id) as Estatisticas;
  if (nome.includes("vitoria")) return new Map(ids.map((id) => [id, de(id).vitorias]));
  if (nome.includes("set")) return new Map(ids.map((id) => [id, de(id).setsPro - de(id).setsContra]));
  if (nome.includes("game")) {
    return new Map(ids.map((id) => [id, de(id).gamesPro - de(id).gamesContra]));
  }
  if (nome.includes("confronto")) {
    // Vitorias so nos jogos entre os que estao empatados.
    const empatados = new Set(ids);
    const vitorias = new Map(ids.map((id) => [id, 0]));
    partidas.forEach((p) => {
      if (!empatados.has(p.inscricaoAId ?? "") || !empatados.has(p.inscricaoBId ?? "")) return;
      const vencedor = (p.vencedor === "A" ? p.inscricaoAId : p.inscricaoBId) ?? "";
      vitorias.set(vencedor, (vitorias.get(vencedor) ?? 0) + 1);
    });
    return vitorias;
  }
  return undefined;
}

/**
 * Ordena aplicando os criterios na ordem das Configuracoes. Quando um criterio
 * separa os empatados em blocos, cada bloco que continua empatado recomeca
 * da lista — assim o confronto direto e refeito so entre quem ainda empata.
 */
function desempatar(
  ids: string[],
  criterios: string[],
  estatisticas: Map<string, Estatisticas>,
  partidas: Partida[],
  emEmpate: boolean,
  motivo: Map<string, string>,
): string[] {
  if (ids.length <= 1) return ids;
  for (let c = 0; c < criterios.length; c += 1) {
    const valor = valorNoCriterio(criterios[c], ids, estatisticas, partidas);
    if (!valor) continue;
    const distintos = [...new Set(ids.map((id) => valor.get(id) ?? 0))].sort((a, b) => b - a);
    if (distintos.length === 1) continue;
    if (emEmpate || c > 0) ids.forEach((id) => motivo.set(id, criterios[c]));
    return distintos.flatMap((v) =>
      desempatar(
        ids.filter((id) => (valor.get(id) ?? 0) === v),
        criterios,
        estatisticas,
        partidas,
        true,
        motivo,
      ),
    );
  }
  // Nada separou: ficam na ordem recebida (cabeca de chave, depois inscricao).
  ids.forEach((id) => motivo.set(id, DESEMPATE_FINAL));
  return ids;
}

/**
 * Classificacao de um grupo (ou do todos contra todos) pelas partidas com
 * resultado entre os inscritos, com os criterios de desempate das
 * Configuracoes (H8). O saldo de sets e de games sai do placar.
 */
export function classificar(
  inscritos: TorneioInscrito[],
  partidas: Partida[],
  criterios: string[],
): LinhaDaClassificacao[] {
  const ids = ordenarPorCabeca(inscritos).map((i) => i.id);
  const participantes = new Set(ids);
  const estatisticas = new Map<string, Estatisticas>(
    ids.map((id) => [
      id,
      { inscricaoId: id, jogos: 0, vitorias: 0, derrotas: 0, setsPro: 0, setsContra: 0, gamesPro: 0, gamesContra: 0 },
    ]),
  );

  const jogadas = partidas.filter(
    (p) =>
      p.vencedor &&
      participantes.has(p.inscricaoAId ?? "") &&
      participantes.has(p.inscricaoBId ?? ""),
  );
  jogadas.forEach((p) => {
    const totais = totaisDaPartida(p);
    const a = estatisticas.get(p.inscricaoAId ?? "") as Estatisticas;
    const b = estatisticas.get(p.inscricaoBId ?? "") as Estatisticas;
    a.jogos += 1;
    b.jogos += 1;
    if (p.vencedor === "A") {
      a.vitorias += 1;
      b.derrotas += 1;
    } else {
      b.vitorias += 1;
      a.derrotas += 1;
    }
    a.setsPro += totais.setsA;
    a.setsContra += totais.setsB;
    a.gamesPro += totais.gamesA;
    a.gamesContra += totais.gamesB;
    b.setsPro += totais.setsB;
    b.setsContra += totais.setsA;
    b.gamesPro += totais.gamesB;
    b.gamesContra += totais.gamesA;
  });

  const motivo = new Map<string, string>();
  return desempatar(ids, criterios, estatisticas, jogadas, false, motivo).map((id, i) => {
    const linha = estatisticas.get(id) as Estatisticas;
    return { ...linha, posicao: i + 1, desempate: linha.jogos > 0 ? motivo.get(id) : undefined };
  });
}

// ---------------------------------------------------------------------------
// Fase eliminatoria do formato de grupos
// ---------------------------------------------------------------------------

/** Partidas da eliminatoria do torneio (no formato de grupos, as que nao tem grupo). */
export function partidasDaEliminatoria(torneio: Torneio, partidas: Partida[]): Partida[] {
  if (torneio.formato === "todos_contra_todos") return [];
  return partidas.filter((p) => p.torneioId === torneio.id && !p.grupo);
}

/**
 * Monta a eliminatoria de um torneio de grupos. Passam `classificadosPorGrupo`
 * de cada grupo (H8). Os 1os colocados ficam nas vagas dos cabecas de chave
 * (1A = 1, 1B = 2...); cada um dos demais vai para a vaga livre mais longe
 * de quem e do mesmo grupo, para que os dois so se reencontrem o mais tarde
 * possivel. Com 2 grupos: semifinais 1A x 2B e 2A x 1B.
 */
export function montarFaseEliminatoria(
  torneio: Torneio,
  inscritos: TorneioInscrito[],
  partidas: Partida[],
  classificadosPorGrupo: number,
  criterios: string[],
  prefixoId: string,
  criadoEm: string,
): Partida[] {
  const doTorneio = inscritos.filter((i) => i.torneioId === torneio.id && i.grupo);
  const letras = [...new Set(doTorneio.map((i) => i.grupo ?? ""))].sort();
  const classificados = letras.map((letra) => {
    const membros = doTorneio.filter((i) => i.grupo === letra);
    const tabela = classificar(
      membros,
      partidas.filter((p) => p.torneioId === torneio.id && p.grupo === letra),
      criterios,
    );
    const quantos = Math.min(Math.max(classificadosPorGrupo, 1), membros.length);
    return tabela
      .slice(0, quantos)
      .map((linha) => membros.find((m) => m.id === linha.inscricaoId) as TorneioInscrito);
  });

  const total = classificados.reduce((soma, lista) => soma + lista.length, 0);
  const ordem = ordemDosCabecas(tamanhoDaChave(total));
  const vagaDoNumero = new Map(ordem.map((numero, vaga) => [numero, vaga]));
  const vagas: Array<TorneioInscrito | undefined> = ordem.map(() => undefined);
  const vagasDoGrupo: number[][] = letras.map(() => []);

  let proximoNumero = 1;
  const colocacoes = Math.max(...classificados.map((lista) => lista.length));
  for (let colocacao = 0; colocacao < colocacoes; colocacao += 1) {
    const grupos = letras.map((_, g) => g).filter((g) => classificados[g].length > colocacao);
    const candidatas = grupos.map((_, i) => vagaDoNumero.get(proximoNumero + i) ?? 0);
    proximoNumero += grupos.length;
    grupos.forEach((g) => {
      let escolhida = -1;
      let encontroMaisTarde = -1;
      candidatas.forEach((vaga) => {
        if (vagas[vaga]) return;
        const encontro = Math.min(
          Infinity,
          ...vagasDoGrupo[g].map((outra) => rodadaDoEncontro(vaga, outra)),
        );
        if (encontro > encontroMaisTarde) {
          escolhida = vaga;
          encontroMaisTarde = encontro;
        }
      });
      vagas[escolhida] = classificados[g][colocacao];
      vagasDoGrupo[g].push(escolhida);
    });
  }

  return montarEliminatoria(torneio, vagas, prefixoId, criadoEm);
}

/** Mesma chave? (Mesmas partidas, nas mesmas posicoes, com os mesmos lados.) */
function mesmaChave(antes: Partida[], depois: Partida[]): boolean {
  const assinatura = (lista: Partida[]) =>
    lista
      .map((p) => `${p.rodada}|${p.ordem}|${p.inscricaoAId ?? ""}|${p.inscricaoBId ?? ""}`)
      .sort()
      .join(";");
  return assinatura(antes) === assinatura(depois);
}

/**
 * Depois de mudar um resultado de grupo: se os grupos terminaram, monta (ou
 * remonta) a fase eliminatoria; se nao terminaram, tira a que existir. Se a
 * chave remontada for igual a atual, a atual fica (nada muda a toa).
 */
export function atualizarFaseEliminatoria(
  torneio: Torneio,
  inscritos: TorneioInscrito[],
  partidas: Partida[],
  classificadosPorGrupo: number,
  criterios: string[],
  prefixoId: string,
  criadoEm: string,
): Partida[] {
  if (torneio.formato !== "grupos_eliminatoria") return partidas;
  const eliminatoria = partidasDaEliminatoria(torneio, partidas);
  if (eliminatoria.some((p) => p.vencedor)) {
    throw new ErroDeRegra(
      "A fase eliminatória já começou: os resultados dos grupos não podem mais ser mudados.",
    );
  }
  const semEliminatoria = partidas.filter((p) => !eliminatoria.includes(p));
  const deGrupo = semEliminatoria.filter((p) => p.torneioId === torneio.id && p.grupo);
  if (deGrupo.length === 0 || deGrupo.some((p) => !p.vencedor)) return semEliminatoria;

  const nova = montarFaseEliminatoria(
    torneio,
    inscritos,
    semEliminatoria,
    classificadosPorGrupo,
    criterios,
    prefixoId,
    criadoEm,
  );
  if (eliminatoria.length > 0 && mesmaChave(eliminatoria, nova)) return partidas;
  return [...semEliminatoria, ...nova];
}

// ---------------------------------------------------------------------------
// Resultado, avanco do vencedor e situacao do torneio
// ---------------------------------------------------------------------------

export interface ResultadoDaPartida {
  placar: string;
  vencedor: Lado;
  wo: boolean;
  data?: string;
}

/**
 * Por que o resultado desta partida nao pode mais ser mudado (vazio = pode).
 * Eliminatoria: a partida seguinte ja foi jogada. Grupos: a eliminatoria ja
 * comecou.
 */
export function bloqueioDeCorrecao(
  torneio: Torneio,
  partidas: Partida[],
  partida: Partida,
): string | undefined {
  if (partida.grupo) {
    return partidasDaEliminatoria(torneio, partidas).some((p) => p.vencedor)
      ? "A fase eliminatória já começou: os resultados dos grupos não podem mais ser mudados."
      : undefined;
  }
  return seguinteJaJogada(partidas, partida);
}

function seguinteJaJogada(partidas: Partida[], partida: Partida): string | undefined {
  if (!partida.vencedor || !partida.proximaPartidaId) return undefined;
  const seguinte = partidas.find((p) => p.id === partida.proximaPartidaId);
  return seguinte?.vencedor
    ? `A partida seguinte (${seguinte.fase ?? "próxima rodada"}) já foi jogada: este resultado não pode mais ser mudado.`
    : undefined;
}

/** Coloca a inscricao (ou ninguem) num lado da partida seguinte, sem copiar a toa. */
function levarParaSeguinte(
  seguinte: Partida,
  lado: Lado,
  inscricaoId?: string,
  alunosIds: string[] = [],
): Partida {
  const atual = lado === "A" ? seguinte.inscricaoAId : seguinte.inscricaoBId;
  if (atual === inscricaoId) return seguinte;
  return comLado(seguinte, lado, inscricaoId, alunosIds);
}

/**
 * Grava o resultado e leva o vencedor para a partida seguinte (no lado
 * `ladoNaProxima`). Serve tambem para corrigir, enquanto a seguinte nao foi
 * jogada: se o vencedor muda, o novo vencedor toma o lugar do antigo.
 */
export function aplicarResultado(
  partidas: Partida[],
  partidaId: string,
  resultado: ResultadoDaPartida,
): Partida[] {
  const partida = partidas.find((p) => p.id === partidaId);
  if (!partida) throw new ErroDeRegra("Partida não encontrada.");
  if (!partida.inscricaoAId || !partida.inscricaoBId) {
    throw new ErroDeRegra("Esta partida ainda espera o vencedor da rodada anterior.");
  }
  const bloqueio = seguinteJaJogada(partidas, partida);
  if (bloqueio) throw new ErroDeRegra(bloqueio);

  const vencedorId = resultado.vencedor === "A" ? partida.inscricaoAId : partida.inscricaoBId;
  const vencedorAlunos = resultado.vencedor === "A" ? partida.ladoA : partida.ladoB;
  return partidas.map((p) => {
    if (p.id === partida.id) {
      return {
        ...p,
        placar: resultado.placar,
        vencedor: resultado.vencedor,
        wo: resultado.wo || undefined,
        data: resultado.data ?? p.data,
      };
    }
    if (p.id === partida.proximaPartidaId && partida.ladoNaProxima) {
      return levarParaSeguinte(p, partida.ladoNaProxima, vencedorId, vencedorAlunos);
    }
    return p;
  });
}

/** Apaga o resultado (e tira o vencedor da partida seguinte), nas mesmas condicoes da correcao. */
export function desfazerResultado(partidas: Partida[], partidaId: string): Partida[] {
  const partida = partidas.find((p) => p.id === partidaId);
  if (!partida) throw new ErroDeRegra("Partida não encontrada.");
  if (!partida.vencedor) throw new ErroDeRegra("Esta partida ainda não tem resultado.");
  const bloqueio = seguinteJaJogada(partidas, partida);
  if (bloqueio) throw new ErroDeRegra(bloqueio);

  return partidas.map((p) => {
    if (p.id === partida.id) return { ...p, placar: undefined, vencedor: undefined, wo: undefined };
    if (p.id === partida.proximaPartidaId && partida.ladoNaProxima) {
      return levarParaSeguinte(p, partida.ladoNaProxima, undefined);
    }
    return p;
  });
}

export function finalDoTorneio(torneio: Torneio, partidas: Partida[]): Partida | undefined {
  return partidasDaEliminatoria(torneio, partidas).find((p) => !p.proximaPartidaId);
}

/**
 * O torneio terminou? Com eliminatoria: a final foi decidida. Todos contra
 * todos: todas as partidas foram jogadas.
 */
export function torneioTerminou(torneio: Torneio, partidas: Partida[]): boolean {
  if (torneio.formato === "todos_contra_todos") {
    const doTorneio = partidas.filter((p) => p.torneioId === torneio.id);
    return doTorneio.length > 0 && doTorneio.every((p) => p.vencedor);
  }
  return Boolean(finalDoTorneio(torneio, partidas)?.vencedor);
}

/** Inscricao campea (vazio enquanto o torneio nao termina). */
export function campeaoDoTorneio(
  torneio: Torneio,
  inscritos: TorneioInscrito[],
  partidas: Partida[],
  criterios: string[],
): string | undefined {
  if (!torneioTerminou(torneio, partidas)) return undefined;
  if (torneio.formato === "todos_contra_todos") {
    return classificar(
      inscritos.filter((i) => i.torneioId === torneio.id),
      partidas.filter((p) => p.torneioId === torneio.id),
      criterios,
    )[0]?.inscricaoId;
  }
  const final = finalDoTorneio(torneio, partidas);
  return final?.vencedor === "A" ? final.inscricaoAId : final?.inscricaoBId;
}

// ---------------------------------------------------------------------------
// Inscricoes
// ---------------------------------------------------------------------------

/** Inscricao como vem do formulario (sem `id` quando e nova). */
export interface InscricaoDigitada {
  id?: string;
  alunosIds: string[];
  cabecaDeChave?: number;
}

/**
 * Confere as inscricoes: um aluno (simples) ou dois diferentes (duplas),
 * alunos ativos, ninguem em duas inscricoes e cabecas de chave numerados
 * 1, 2, 3... sem repetir nem pular.
 */
export function validarInscricoes(
  alunos: Aluno[],
  duplas: boolean,
  inscricoes: InscricaoDigitada[],
): void {
  if (inscricoes.length > MAXIMO_DE_INSCRICOES) {
    throw new ErroDeRegra(`O limite é de ${MAXIMO_DE_INSCRICOES} inscrições por torneio.`);
  }
  const porId = new Map(alunos.map((a) => [a.id, a]));
  const jaInscritos = new Set<string>();
  inscricoes.forEach((inscricao) => {
    if (inscricao.alunosIds.length !== (duplas ? 2 : 1)) {
      throw new ErroDeRegra(
        duplas
          ? "Cada inscrição de duplas precisa de dois jogadores."
          : "Cada inscrição de simples tem um jogador só.",
      );
    }
    if (duplas && inscricao.alunosIds[0] === inscricao.alunosIds[1]) {
      throw new ErroDeRegra("Uma dupla precisa de dois jogadores diferentes.");
    }
    inscricao.alunosIds.forEach((alunoId) => {
      const aluno = porId.get(alunoId);
      if (!aluno) throw new ErroDeRegra("Aluno não encontrado.");
      if (!aluno.ativo) {
        throw new ErroDeRegra(`${aluno.nome} não está ativo na arena e não pode se inscrever.`);
      }
      if (jaInscritos.has(alunoId)) {
        throw new ErroDeRegra(`${aluno.nome} aparece em duas inscrições.`);
      }
      jaInscritos.add(alunoId);
    });
  });

  const cabecas = inscricoes
    .map((i) => i.cabecaDeChave)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);
  if (cabecas.some((numero, i) => numero !== i + 1)) {
    throw new ErroDeRegra(
      "Numere os cabeças de chave em sequência (1, 2, 3…), sem repetir nem pular.",
    );
  }
}
