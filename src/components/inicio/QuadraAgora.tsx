"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Quadra3D } from "@/components/dashboard/Quadra3D";
import { HORA_ABERTURA } from "@/lib/banco/constantes";
import type { Ocupacao } from "@/lib/banco/tipos";
import { nomeCompacto } from "@/lib/consultas/base";
import type { QuadraNoPainel } from "@/lib/consultas/painel";
import { ESTILO_OCUPACAO } from "@/lib/theme";

const ABERTURA = `${String(HORA_ABERTURA).padStart(2, "0")}:00`;

/** Quantos nomes aparecem antes do "+n". */
const NOMES_VISIVEIS = 2;

type Estado = "em_jogo" | "bloqueada" | "livre" | "fechada";

/** Fechada: depois das 22h ou antes de abrir (07h). */
function estadoDa(quadra: QuadraNoPainel, agora: string | null): Estado {
  if (quadra.encerrado || (agora !== null && agora < ABERTURA)) return "fechada";
  if (quadra.emAndamento?.tipo === "Bloqueio") return "bloqueada";
  if (quadra.emAndamento) return "em_jogo";
  return "livre";
}

/** Selo no canto do cartao. Cores com contraste testado (bola com texto escuro). */
const SELO: Record<Estado, { texto: string; classe: string }> = {
  em_jogo: { texto: "Em jogo", classe: "bg-bola-300 text-areia-900" },
  livre: { texto: "Livre", classe: "bg-white text-quadra-800" },
  bloqueada: { texto: "Bloqueada", classe: "bg-areia-200 text-areia-800" },
  fechada: { texto: "Fechada", classe: "bg-quadra-900 text-white" },
};

/** "Individual", "Locação Mensal"... ou "bloqueio". */
function nomeDoTipo(ocupacao: Ocupacao): string {
  return ocupacao.tipo === "Bloqueio" ? "bloqueio" : ocupacao.tipo;
}

/** O que esta acontecendo na quadra, em texto (cartao e leitor de tela). */
function descricao(quadra: QuadraNoPainel, agora: string | null): {
  principal: ReactNode;
  detalhes: ReactNode[];
} {
  const { emAndamento, emQuadra, professorAgora, proxima } = quadra;

  switch (estadoDa(quadra, agora)) {
    case "fechada":
      if (quadra.encerrado) {
        return { principal: "Fechada por hoje", detalhes: [`Abre amanhã às ${ABERTURA}`] };
      }
      return {
        principal: `Abre às ${ABERTURA}`,
        detalhes: [proxima ? `Primeiro horário: ${proxima.horaInicio} · ${nomeDoTipo(proxima)}` : "Nenhum horário hoje"],
      };
    case "bloqueada":
      return {
        principal: emAndamento?.descricao ?? "Quadra bloqueada",
        detalhes: [`até ${emAndamento?.horaFim}`],
      };
    case "em_jogo": {
      if (!emAndamento) break;
      const estilo = ESTILO_OCUPACAO[emAndamento.tipo];
      const visiveis = emQuadra.slice(0, NOMES_VISIVEIS);
      const restantes = emQuadra.length - visiveis.length;
      const principal =
        visiveis.length === 0 ? (
          emAndamento.tipo
        ) : (
          <span className="block">
            {visiveis.map((aluno, i) => (
              <span key={aluno.id} className="block truncate" title={aluno.nome}>
                {nomeCompacto(aluno.nome)}
                {i === visiveis.length - 1 && restantes > 0 && (
                  <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs font-bold text-quadra-800">
                    +{restantes}
                  </span>
                )}
              </span>
            ))}
          </span>
        );
      return {
        principal,
        detalhes: [
          <span key="tipo" className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {visiveis.length > 0 && (
              <span
                className="rounded px-1.5 py-px text-[11px] font-semibold"
                style={{ backgroundColor: estilo.cheia, color: estilo.sobreCheia }}
              >
                {emAndamento.tipo}
              </span>
            )}
            <span>até {emAndamento.horaFim}</span>
          </span>,
          ...(professorAgora ? [<span key="prof">Prof. {nomeCompacto(professorAgora)}</span>] : []),
        ],
      };
    }
    case "livre":
      break;
  }

  return {
    principal: "Livre agora",
    detalhes: [proxima ? `Próxima: ${proxima.horaInicio} · ${nomeDoTipo(proxima)}` : "Sem mais horários hoje"],
  };
}

/**
 * Uma quadra na faixa do Início: o piso desenhado e quem esta jogando AGORA
 * (ate 2 nomes e "+n"), ate que horas e com qual professor; ou "Livre agora"
 * e a proxima aula; ou bloqueada/fechada. Com `href`, abre a agenda daquela
 * quadra.
 */
export function QuadraAgora({
  quadra,
  agora,
  href,
}: {
  quadra: QuadraNoPainel;
  agora: string | null;
  href?: string;
}) {
  const { quadra: dados, rotulo } = quadra;
  const paredao = dados.id === "paredao";
  const estado = estadoDa(quadra, agora);
  const selo = SELO[estado];
  const { principal, detalhes } = descricao(quadra, agora);

  const conteudo = (
    <>
      <div className="px-1 pb-2 pt-1 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-0.5">
        <Quadra3D
          rotulo={paredao ? "P" : dados.id}
          piso={dados.piso}
          paredao={paredao}
          emJogo={estado === "em_jogo"}
          apagada={estado === "bloqueada" || estado === "fechada"}
          classeDoNumero="text-[2.1rem]"
          className={`mx-auto w-[54%] lg:w-[62%] ${paredao ? "max-w-[7rem]" : "max-w-[8.75rem]"}`}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-display text-lg font-bold leading-tight text-white">
          {rotulo}
          <span className="sr-only">, piso de {dados.piso}</span>
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${selo.classe}`}
        >
          {selo.texto}
        </span>
      </div>

      <div className="mt-1.5 min-w-0 text-sm font-semibold leading-snug text-white">{principal}</div>
      <div className="mt-1 space-y-0.5 text-xs leading-snug text-quadra-100">
        {detalhes.map((detalhe, i) => (
          <div key={i} className="min-w-0 truncate">
            {detalhe}
          </div>
        ))}
      </div>
      {href && <span className="sr-only">. Abrir a agenda desta quadra.</span>}
    </>
  );

  const classes =
    "group flex h-full flex-col rounded-2xl bg-quadra-900/40 p-3 ring-1 ring-inset ring-white/10";

  if (!href) return <div className={classes}>{conteudo}</div>;

  return (
    <Link
      href={href}
      className={`${classes} transition-colors hover:bg-quadra-900/60 hover:ring-white/30 focus-visible:outline-bola-300`}
    >
      {conteudo}
    </Link>
  );
}
