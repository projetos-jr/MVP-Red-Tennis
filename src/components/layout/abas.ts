import type { ComponentType, SVGProps } from "react";
import { IconeEngrenagem, IconeHistorico } from "@/components/base/Icones";
import {
  IconeAgenda,
  IconeEstoque,
  IconeFinanceiro,
  IconeQuadras,
  IconeTrofeu,
  IconeUsuarios,
} from "@/components/ui/Icons";
import type { Banco, Colaborador, ModuloSistema } from "@/lib/banco/tipos";
import { podeAcessar } from "@/lib/consultas/base";

export interface Area {
  href: string;
  rotulo: string;
  /** Rótulo curto, usado na barra do celular. */
  curto: string;
  Icone: ComponentType<SVGProps<SVGSVGElement>>;
  /** Permissão exigida (Hipótese H9, editável nas Configurações). */
  modulo: ModuloSistema;
  /** Outras telas que ficam "dentro" desta aba (a aba aparece marcada nelas). */
  inclui?: string[];
}

/** Seções principais do sistema, compartilhadas pela topbar e pela barra do celular. */
export const ABAS: Area[] = [
  { href: "/dashboard", rotulo: "Painel", curto: "Painel", Icone: IconeQuadras, modulo: "painel" },
  { href: "/agenda", rotulo: "Agenda", curto: "Agenda", Icone: IconeAgenda, modulo: "agenda" },
  {
    href: "/alunos",
    rotulo: "Alunos",
    curto: "Alunos",
    Icone: IconeUsuarios,
    modulo: "alunos",
    inclui: ["/professores"],
  },
  { href: "/financeiro", rotulo: "Financeiro", curto: "Caixa", Icone: IconeFinanceiro, modulo: "financeiro" },
  { href: "/estoque", rotulo: "Estoque", curto: "Estoque", Icone: IconeEstoque, modulo: "estoque" },
  { href: "/ranking", rotulo: "Ranking / Torneio", curto: "Ranking", Icone: IconeTrofeu, modulo: "ranking" },
];

/** Áreas do dono, no menu do usuário: assim não ocupam espaço na barra de abas. */
export const AREAS_DO_MENU: Area[] = [
  {
    href: "/configuracoes",
    rotulo: "Configurações",
    curto: "Configurações",
    Icone: IconeEngrenagem,
    modulo: "configuracoes",
  },
  {
    href: "/historico",
    rotulo: "Histórico de alterações",
    curto: "Histórico",
    Icone: IconeHistorico,
    modulo: "historico",
  },
];

/**
 * Módulo de cada rota, pelo começo do caminho. Usado pela proteção de rota:
 * uma rota nova que fique fora desta lista abre para todos os perfis.
 */
const MODULO_DA_ROTA: Array<[string, ModuloSistema]> = [
  ["/dashboard", "painel"],
  ["/agenda", "agenda"],
  ["/alunos", "alunos"],
  ["/professores", "professores"],
  ["/financeiro", "financeiro"],
  ["/estoque", "estoque"],
  ["/ranking", "ranking"],
  ["/configuracoes", "configuracoes"],
  ["/historico", "historico"],
];

/** A página atual pertence à área? ("/alunos/a01" pertence a "/alunos".) */
export function estaNaArea(caminho: string, href: string): boolean {
  return caminho === href || caminho.startsWith(`${href}/`);
}

/** A aba fica marcada na própria área e nas telas que ela inclui (Professores fica em Alunos). */
export function abaAtiva(caminho: string, area: Area): boolean {
  return [area.href, ...(area.inclui ?? [])].some((href) => estaNaArea(caminho, href));
}

export function moduloDaRota(caminho: string): ModuloSistema | undefined {
  return MODULO_DA_ROTA.find(([inicio]) => estaNaArea(caminho, inicio))?.[1];
}

export function abasPermitidas(banco: Banco, colaborador: Colaborador): Area[] {
  return ABAS.filter((aba) => podeAcessar(banco, colaborador, aba.modulo));
}

export function areasDoMenuPermitidas(banco: Banco, colaborador: Colaborador): Area[] {
  return AREAS_DO_MENU.filter((area) => podeAcessar(banco, colaborador, area.modulo));
}

/** Primeira área que o perfil pode abrir: destino do login e da marca no topo. */
export function areaInicial(banco: Banco, colaborador: Colaborador): Area | undefined {
  return abasPermitidas(banco, colaborador)[0] ?? areasDoMenuPermitidas(banco, colaborador)[0];
}
