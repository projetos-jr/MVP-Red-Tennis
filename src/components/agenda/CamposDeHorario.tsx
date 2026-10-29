"use client";

import { useId, type ReactNode } from "react";
import { Campo } from "@/components/ui/Formulario";
import type { Ocupacao, Quadra, QuadraId } from "@/lib/banco/tipos";
import { horaParaMinutos, minutosParaHora } from "@/lib/date";
import { DURACOES_RAPIDAS, HORARIOS_DE_FIM, HORARIOS_DE_INICIO } from "./estilos";

/**
 * Pecas dos formularios da agenda (novo horario, remarcar, reposicao,
 * bloqueio, chuva). Grupos de botoes usam `GrupoDeCampo` (e nao `Campo`,
 * que e um <label>: um rotulo em volta de varios botoes "clicaria" o
 * primeiro deles).
 */
export function GrupoDeCampo({
  rotulo,
  ajuda,
  children,
  className = "",
}: {
  rotulo: string;
  ajuda?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={className}>
      <span id={id} className="mb-1.5 block text-sm font-medium text-areia-800">
        {rotulo}
      </span>
      {children}
      {ajuda && <span className="mt-1 block text-xs text-areia-500">{ajuda}</span>}
    </div>
  );
}

/**
 * Corpo de janela que rola por dentro, com o titulo e os botoes sempre a
 * vista. Necessario porque o `Modal` compartilhado centraliza a janela: se
 * ela for mais alta que a tela, o comeco fica cortado e nao da para rolar ate ele.
 */
export function CorpoRolavel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-h-[calc(100dvh-16rem)] overflow-y-auto rolagem-suave sm:max-h-[calc(100dvh-12rem)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Uma quadra, com "livre"/"ocupada" no horario escolhido. */
export function SeletorDeQuadra({
  quadras,
  valor,
  aoMudar,
  disponibilidade,
}: {
  quadras: Quadra[];
  valor: QuadraId;
  aoMudar: (quadraId: QuadraId) => void;
  disponibilidade?: Map<QuadraId, Ocupacao | undefined>;
}) {
  return (
    <GrupoDeCampo rotulo="Quadra">
      <div className="flex flex-wrap gap-1.5">
        {quadras.map((q) => {
          const ativo = valor === q.id;
          const ocupada = disponibilidade?.get(q.id);
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoMudar(q.id)}
              title={
                ocupada ? `Ocupada das ${ocupada.horaInicio} às ${ocupada.horaFim}` : undefined
              }
              className={`flex flex-col items-start rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                ativo
                  ? "border-saibro-600 bg-saibro-600 text-white"
                  : "border-areia-200 bg-areia-100 text-areia-700 hover:bg-areia-200"
              }`}
            >
              {q.nome}
              {disponibilidade && (
                <span
                  className={`text-[10px] font-semibold ${
                    ativo ? "text-white/90" : ocupada ? "text-tijolo-700" : "text-emerald-700"
                  }`}
                >
                  {ocupada ? "● ocupada" : "○ livre"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </GrupoDeCampo>
  );
}

/** Varias quadras (bloqueio e chuva), com atalho para todas. */
export function SeletorDeQuadras({
  quadras,
  valor,
  aoMudar,
}: {
  quadras: Quadra[];
  valor: QuadraId[];
  aoMudar: (quadras: QuadraId[]) => void;
}) {
  const todas = quadras.every((q) => valor.includes(q.id));
  return (
    <GrupoDeCampo rotulo="Quadras">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={todas}
          onClick={() => aoMudar(todas ? [] : quadras.map((q) => q.id))}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            todas
              ? "border-saibro-600 bg-saibro-600 text-white"
              : "border-areia-200 bg-white text-areia-700 hover:bg-areia-100"
          }`}
        >
          Todas
        </button>
        {quadras.map((q) => {
          const ativo = valor.includes(q.id);
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoMudar(ativo ? valor.filter((id) => id !== q.id) : [...valor, q.id])}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                ativo
                  ? "border-saibro-300 bg-saibro-100 text-saibro-900"
                  : "border-areia-200 bg-areia-100 text-areia-700 hover:bg-areia-200"
              }`}
            >
              <span aria-hidden="true">{ativo ? "✓ " : ""}</span>
              {q.nome}
            </button>
          );
        })}
      </div>
    </GrupoDeCampo>
  );
}

/**
 * Inicio e termino (de meia em meia hora, dentro do funcionamento) e
 * atalhos de duracao. Trocar o inicio mantem a duracao, quando cabe.
 */
export function CamposDeHora({
  inicio,
  fim,
  aoMudar,
  semAtalhos,
}: {
  inicio: string;
  fim: string;
  aoMudar: (inicio: string, fim: string) => void;
  semAtalhos?: boolean;
}) {
  const duracao = horaParaMinutos(fim) - horaParaMinutos(inicio);

  function mudarInicio(novo: string) {
    const fimMantido = minutosParaHora(
      Math.min(horaParaMinutos(novo) + Math.max(duracao, 30), 22 * 60),
    );
    aoMudar(novo, fimMantido > novo ? fimMantido : minutosParaHora(horaParaMinutos(novo) + 30));
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Campo rotulo="Início">
        <select value={inicio} onChange={(e) => mudarInicio(e.target.value)} className="campo">
          {HORARIOS_DE_INICIO.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Término">
        <select value={fim} onChange={(e) => aoMudar(inicio, e.target.value)} className="campo">
          {HORARIOS_DE_FIM.filter((h) => h > inicio).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Campo>
      {!semAtalhos && (
        <div
          className="col-span-2 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Duração"
        >
          <span className="text-xs text-areia-500">Duração:</span>
          {DURACOES_RAPIDAS.map((opcao) => {
            const novoFim = minutosParaHora(horaParaMinutos(inicio) + opcao.minutos);
            const cabe = novoFim <= "22:00";
            return (
              <button
                key={opcao.minutos}
                type="button"
                disabled={!cabe}
                aria-pressed={duracao === opcao.minutos}
                onClick={() => aoMudar(inicio, novoFim)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                  duracao === opcao.minutos
                    ? "bg-saibro-600 text-white"
                    : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                }`}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Caixa de aviso (nao bloqueia): professor em duas aulas, valor da reserva, saldo... */
export function Aviso({
  tom = "info",
  titulo,
  children,
}: {
  tom?: "info" | "atencao" | "erro" | "ok";
  titulo?: string;
  children: ReactNode;
}) {
  const classes = {
    info: "border-areia-200 bg-areia-50 text-areia-800",
    atencao: "border-amber-300 bg-amber-50 text-amber-900",
    erro: "border-tijolo-200 bg-tijolo-50 text-tijolo-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tom];
  return (
    <div
      role={tom === "erro" ? "alert" : undefined}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${classes}`}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className="leading-snug">{children}</div>
    </div>
  );
}
