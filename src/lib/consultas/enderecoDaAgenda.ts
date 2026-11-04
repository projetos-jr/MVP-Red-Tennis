/**
 * Endereco (URL) da agenda: o que a tela mostra vem do endereco, e cada
 * clique que muda a visao, a data ou um filtro reescreve o endereco. Assim um
 * link (do Inicio, da ficha do professor, do mosaico) abre exatamente a mesma
 * tela, e "voltar" e "recarregar" nao perdem o lugar.
 *
 * Visoes: Diaria (hoje e amanha lado a lado, uma coluna por quadra; padrao),
 * Quadra (a semana de uma quadra), Professor (a semana de um professor) e
 * Mes. Os links antigos continuam valendo (ver `estadoDaAgendaPelaUrl`).
 */

import { dataValida } from "../banco/regras/agenda";
import type { Banco, QuadraId, TipoOcupacao } from "../banco/tipos";
import { professorPelaUrl, professoresAtivos, quadraPelaUrl, quadrasDaArena } from "./agenda";

export type VisaoDaAgenda = "diaria" | "quadra" | "professor" | "mes";

export const VISOES_DA_AGENDA: VisaoDaAgenda[] = ["diaria", "quadra", "professor", "mes"];

export interface EstadoDaAgenda {
  visao: VisaoDaAgenda;
  /** Diaria: o primeiro dos dois dias. Quadra/Professor: um dia da semana. Mes: um dia do mes. */
  data: string;
  /** Quadra: a quadra da semana. Diaria: a coluna realcada (link do Inicio). */
  quadraId?: QuadraId;
  /** Professor: o professor da semana. Nas outras visoes: filtro por professor. */
  professorId?: string;
  tipo: TipoOcupacao | "todos";
  mostrarCanceladas: boolean;
  /** Horario com o painel aberto. */
  ocupacaoId?: string;
}

export interface ContextoDaAgenda {
  hoje: string;
  /** Perfil de professor (Hipotese H9): ve so as proprias aulas e abre na visao Professor. */
  professorTravado?: string;
}

/** O que a funcao le dos parametros (URLSearchParams ou o useSearchParams do Next). */
export interface ParametrosDoEndereco {
  get(nome: string): string | null;
}

const TIPOS: TipoOcupacao[] = [
  "Individual",
  "Locação Mensal",
  "Dupla",
  "LAP",
  "Locação Avulsa",
  "Ranking",
  "Plano de locação",
  "Bloqueio",
];

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function tipoPelaUrl(valor: string | null): TipoOcupacao | undefined {
  if (!valor) return undefined;
  const procurado = semAcento(valor);
  return TIPOS.find((t) => semAcento(t) === procurado);
}

/**
 * Le o estado da agenda do endereco. Links aceitos (inclusive os antigos):
 *
 * | Endereco                         | Abre                                  |
 * | -------------------------------- | ------------------------------------- |
 * | (nada)                           | Diaria de hoje                        |
 * | `?visao=dia&data=`               | Diaria a partir da data               |
 * | `?visao=semana&quadra=`          | Quadra (a semana daquela quadra)      |
 * | `?visao=semana`                  | Quadra 1                              |
 * | `?quadra=`                       | Quadra                                |
 * | `?data=&quadra=`                 | Diaria com a coluna da quadra realcada|
 * | `?professor=` (id ou nome)       | Professor                             |
 * | `?tipo=LAP`                      | Diaria filtrada por LAP               |
 * | `?ocupacao=`                     | Abre o painel do horario (na data dele)|
 *
 * O professor logado (perfil professor) fica travado nas proprias aulas e,
 * sem `?visao=`, abre na visao Professor.
 */
export function estadoDaAgendaPelaUrl(
  banco: Banco,
  parametros: ParametrosDoEndereco,
  ctx: ContextoDaAgenda,
): EstadoDaAgenda {
  const dataDaUrl = parametros.get("data");
  const dataDoLink = dataDaUrl && dataValida(dataDaUrl) ? dataDaUrl : undefined;
  const quadraId = quadraPelaUrl(banco, parametros.get("quadra"));
  const professorDaUrl = professorPelaUrl(banco, parametros.get("professor"));
  const ocupacaoId = parametros.get("ocupacao") || undefined;
  const ocupacao = ocupacaoId ? banco.ocupacoes.find((o) => o.id === ocupacaoId) : undefined;

  const visao = lerVisao(parametros.get("visao"), {
    data: Boolean(dataDoLink),
    quadra: Boolean(quadraId),
    professor: Boolean(professorDaUrl),
    travado: Boolean(ctx.professorTravado),
  });

  const professorId = ctx.professorTravado ?? professorDaUrl;
  return {
    visao,
    data: dataDoLink ?? ocupacao?.data ?? ctx.hoje,
    // Quadra: a quadra da semana (padrao, a primeira). Diaria: a coluna realcada.
    quadraId:
      visao === "quadra"
        ? (quadraId ?? quadrasDaArena(banco)[0]?.id)
        : visao === "diaria"
          ? quadraId
          : undefined,
    professorId:
      visao === "professor" ? (professorId ?? professoresAtivos(banco)[0]?.id) : professorId,
    tipo: tipoPelaUrl(parametros.get("tipo")) ?? "todos",
    mostrarCanceladas: !["0", "nao", "não", "false"].includes(
      (parametros.get("canceladas") ?? "").toLowerCase(),
    ),
    ocupacaoId,
  };
}

function lerVisao(
  valor: string | null,
  tem: { data: boolean; quadra: boolean; professor: boolean; travado: boolean },
): VisaoDaAgenda {
  switch ((valor ?? "").toLowerCase()) {
    case "dia":
    case "diaria":
      return "diaria";
    case "semana":
      // A semana com todas as quadras saiu: vira a semana de uma quadra (ou do professor).
      return tem.professor && !tem.quadra ? "professor" : "quadra";
    case "quadra":
      return "quadra";
    case "professor":
      return "professor";
    case "mes":
      return "mes";
  }
  if (tem.travado) return "professor";
  if (tem.quadra) return tem.data ? "diaria" : "quadra";
  if (tem.professor) return "professor";
  return "diaria";
}

/**
 * Endereco de um estado da agenda (o inverso de `estadoDaAgendaPelaUrl`).
 * A data so aparece quando nao e hoje, ou quando um painel esta aberto (o
 * painel nao muda a data da tela).
 */
export function enderecoDaAgenda(estado: EstadoDaAgenda, hoje: string): string {
  const p = new URLSearchParams();
  p.set("visao", estado.visao);
  if (estado.data !== hoje || estado.ocupacaoId) p.set("data", estado.data);
  if (estado.quadraId && (estado.visao === "quadra" || estado.visao === "diaria")) {
    p.set("quadra", estado.quadraId);
  }
  if (estado.professorId) p.set("professor", estado.professorId);
  if (estado.tipo !== "todos") p.set("tipo", estado.tipo);
  if (!estado.mostrarCanceladas) p.set("canceladas", "nao");
  if (estado.ocupacaoId) p.set("ocupacao", estado.ocupacaoId);
  return `/agenda?${p.toString()}`;
}

/**
 * Troca de visao: leva o que faz sentido e descarta o resto. Sair da visao
 * Professor tira o professor (senao a Diaria ficaria filtrada sem a pessoa
 * perceber); sair da visao Quadra tira a quadra. Entrar na Quadra usa a
 * quadra realcada (ou a Quadra 1); entrar na Professor, o professor do
 * filtro (ou o primeiro).
 */
export function trocarVisao(
  banco: Banco,
  estado: EstadoDaAgenda,
  visao: VisaoDaAgenda,
  ctx: ContextoDaAgenda,
): EstadoDaAgenda {
  if (visao === estado.visao) return estado;
  const professorId =
    ctx.professorTravado ??
    (visao === "professor"
      ? (estado.professorId ?? professoresAtivos(banco)[0]?.id)
      : estado.visao === "professor"
        ? undefined
        : estado.professorId);
  const quadraId =
    visao === "quadra" ? (estado.quadraId ?? quadrasDaArena(banco)[0]?.id) : undefined;
  return { ...estado, visao, professorId, quadraId, ocupacaoId: undefined };
}
