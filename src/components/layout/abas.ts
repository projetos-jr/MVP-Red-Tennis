import {
  IconeAgenda,
  IconeEstoque,
  IconeFinanceiro,
  IconeQuadras,
  IconeTrofeu,
  IconeUsuarios,
} from "@/components/ui/Icons";

/** Seções principais do sistema, compartilhadas pela topbar e pela barra do celular. */
export const ABAS = [
  { href: "/dashboard", rotulo: "Dashboard", curto: "Quadras", Icone: IconeQuadras },
  { href: "/agenda", rotulo: "Agenda", curto: "Agenda", Icone: IconeAgenda },
  { href: "/alunos", rotulo: "Alunos", curto: "Alunos", Icone: IconeUsuarios },
  { href: "/financeiro", rotulo: "Financeiro", curto: "Caixa", Icone: IconeFinanceiro },
  { href: "/estoque", rotulo: "Estoque", curto: "Estoque", Icone: IconeEstoque },
  { href: "/ranking", rotulo: "Ranking / Torneio", curto: "Ranking", Icone: IconeTrofeu },
];
