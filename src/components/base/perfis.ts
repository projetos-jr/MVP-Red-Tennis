import type { Perfil } from "@/lib/banco/tipos";

/** Cor do selo de cada perfil (o nome do perfil vai sempre escrito junto). */
export const ESTILO_DO_PERFIL: Record<Perfil, string> = {
  dono: "border-cimento-200 bg-cimento-50 text-cimento-800",
  recepcao: "border-saibro-200 bg-saibro-50 text-saibro-800",
  professor: "border-emerald-200 bg-emerald-50 text-emerald-800",
};
