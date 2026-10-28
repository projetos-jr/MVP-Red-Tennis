"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Legenda } from "@/components/agenda/Legenda";
import { ModalNovoHorario } from "@/components/agenda/ModalNovoHorario";
import { VisaoDiaria } from "@/components/agenda/VisaoDiaria";
import { VisaoMensal } from "@/components/agenda/VisaoMensal";
import { VisaoSemanal } from "@/components/agenda/VisaoSemanal";
import { Card } from "@/components/ui/Card";
import { Segmentado } from "@/components/ui/Segmentado";
import {
  IconeAgenda,
  IconeAlerta,
  IconeAnterior,
  IconeFiltro,
  IconeMais,
  IconeProximo,
} from "@/components/ui/Icons";
import {
  DIAS_SEMANA_LONGO,
  datasDaSemana,
  formatarDiaMes,
  formatarMesAno,
  somarDias,
  somarMeses,
} from "@/lib/date";
import { HOJE, QUADRAS } from "@/lib/arena";
import {
  contarConflitos,
  listarHorarios,
  listarProfessores,
  type FiltroAgenda,
} from "@/lib/selectors";
import { ORDEM_TIPOS, rotuloQuadra } from "@/lib/theme";
import type { Quadra, TipoAlocacao } from "@/lib/types";
import { useApp } from "@/store/AppStore";

export default function PaginaAgenda() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <Agenda />
    </Suspense>
  );
}

function Agenda() {
  const parametros = useSearchParams();
  const quadraDaUrl = parametros.get("quadra");
  const professorDaUrl = parametros.get("professor");
  const { horarios } = useApp();

  const [visao, setVisao] = useState<"semana" | "mes">("semana");
  const [referencia, setReferencia] = useState(HOJE);
  const [quadra, setQuadra] = useState<Quadra | "todas">(() =>
    normalizarQuadra(quadraDaUrl),
  );
  const [professor, setProfessor] = useState<string>(professorDaUrl ?? "todos");
  const [tipo, setTipo] = useState<TipoAlocacao | "todos">("todos");

  // Formulário de novo horário: `preenchimento` guarda o que veio do clique
  // numa célula livre da grade.
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [preenchimento, setPreenchimento] = useState<{
    quadra?: Quadra;
    diaSemana?: number;
    horaInicio?: string;
  }>({});
  const [ultimoCriado, setUltimoCriado] = useState<string | null>(null);
  /** Dia em foco na visão do celular. */
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);

  const filtro: FiltroAgenda = useMemo(
    () => ({ quadra, professor, tipo }),
    [quadra, professor, tipo],
  );

  const datas = useMemo(() => datasDaSemana(referencia), [referencia]);

  // O dia em foco precisa pertencer à semana exibida; ao trocar de semana,
  // cai no primeiro dia dela.
  const diaEmFoco = datas.includes(diaSelecionado) ? diaSelecionado : datas[0];
  const total = listarHorarios(filtro, horarios).length;
  const conflitos = contarConflitos(filtro, horarios);
  const professores = listarProfessores();

  function abrirFormulario(inicial: {
    quadra?: Quadra;
    diaSemana?: number;
    horaInicio?: string;
  }) {
    setPreenchimento(inicial);
    setFormularioAberto(true);
  }

  function navegar(direcao: -1 | 1) {
    setReferencia((atual) =>
      visao === "semana"
        ? somarDias(atual, direcao * 7)
        : somarMeses(atual, direcao),
    );
  }

  const titulo =
    visao === "semana"
      ? `${formatarDiaMes(datas[0])} — ${formatarDiaMes(datas[6])}`
      : formatarMesAno(referencia);

  return (
    <div className="space-y-5">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-areia-900 sm:text-3xl">Agenda</h1>
          <p className="mt-1 text-sm text-areia-600">
            {total} horários na grade · funcionamento das 07h às 22h
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-areia-200 bg-white p-1">
            <button
              type="button"
              onClick={() => navegar(-1)}
              className="btn-fantasma px-2 py-1.5"
              aria-label={visao === "semana" ? "Semana anterior" : "Mês anterior"}
            >
              <IconeAnterior className="h-4 w-4" />
            </button>
            <span className="min-w-[124px] text-center text-sm font-semibold text-areia-800 first-letter:uppercase">
              {titulo}
            </span>
            <button
              type="button"
              onClick={() => navegar(1)}
              className="btn-fantasma px-2 py-1.5"
              aria-label={visao === "semana" ? "Próxima semana" : "Próximo mês"}
            >
              <IconeProximo className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReferencia(HOJE)}
            className="btn-secundario py-2"
          >
            Hoje
          </button>

          <Segmentado
            aria="Modo de visualização"
            valor={visao}
            aoMudar={setVisao}
            opcoes={[
              {
                valor: "semana",
                rotulo: (
                  <>
                    <span className="md:hidden">Dia</span>
                    <span className="hidden md:inline">Semana</span>
                  </>
                ),
              },
              { valor: "mes", rotulo: "Mês" },
            ]}
          />

          <button
            type="button"
            onClick={() =>
              abrirFormulario({
                quadra: quadra === "todas" ? undefined : quadra,
              })
            }
            className="btn-primario py-2"
          >
            <IconeMais className="h-4 w-4" />
            Novo horário
          </button>
        </div>
      </div>

      {/* Confirmação do último horário criado na sessão */}
      {ultimoCriado && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <p className="text-sm text-emerald-800">{ultimoCriado}</p>
          <button
            type="button"
            onClick={() => setUltimoCriado(null)}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alerta de conflitos */}
      {conflitos > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-tijolo-200 bg-tijolo-50/70 px-4 py-3">
          <IconeAlerta className="mt-0.5 h-5 w-5 shrink-0 text-tijolo-600" />
          <div>
            <p className="text-sm font-semibold text-tijolo-800">
              {conflitos} horários em conflito nesta grade
            </p>
            <p className="hidden text-xs text-tijolo-700/80 md:block">
              Há mais de um agendamento ocupando a mesma quadra no mesmo horário —
              os eventos afetados estão destacados com borda vermelha.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <Card>
        {/* Os mesmos controles: recolhidos no celular, sempre abertos no desktop */}
        <details className="border-b border-areia-200 md:hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-areia-700">
            <IconeFiltro className="h-4 w-4" />
            Filtros e legenda
          </summary>
          <div className="flex flex-col gap-3 px-4 pb-4">
          <GrupoFiltro rotulo="Quadra">
            <BotaoFiltro
              ativo={quadra === "todas"}
              aoClicar={() => setQuadra("todas")}
            >
              Todas
            </BotaoFiltro>
            {QUADRAS.map((q) => (
              <BotaoFiltro
                key={String(q)}
                ativo={quadra === q}
                aoClicar={() => setQuadra(q)}
              >
                {rotuloQuadra(q)}
              </BotaoFiltro>
            ))}
          </GrupoFiltro>

          <GrupoFiltro rotulo="Professor">
            <BotaoFiltro
              ativo={professor === "todos"}
              aoClicar={() => setProfessor("todos")}
            >
              Todos
            </BotaoFiltro>
            {professores.map((p) => (
              <BotaoFiltro
                key={p.id}
                ativo={professor === p.nome}
                aoClicar={() => setProfessor(p.nome)}
                cor={p.cor}
              >
                {p.nome}
              </BotaoFiltro>
            ))}
          </GrupoFiltro>

          <GrupoFiltro rotulo="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAlocacao | "todos")}
              className="rounded-lg border border-areia-200 bg-white px-2.5 py-1.5 text-xs font-medium text-areia-700 focus:border-saibro-500 focus:outline-none"
            >
              <option value="todos">Todos os tipos</option>
              {ORDEM_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </GrupoFiltro>
            <Legenda className="pt-1" />
          </div>
        </details>

        <div className="hidden flex-wrap items-center gap-x-6 gap-y-3 border-b border-areia-200 px-4 py-3 md:flex">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-areia-500">
            <IconeFiltro className="h-4 w-4" />
            Filtros
          </span>

          <GrupoFiltro rotulo="Quadra">
            <BotaoFiltro
              ativo={quadra === "todas"}
              aoClicar={() => setQuadra("todas")}
            >
              Todas
            </BotaoFiltro>
            {QUADRAS.map((q) => (
              <BotaoFiltro
                key={String(q)}
                ativo={quadra === q}
                aoClicar={() => setQuadra(q)}
              >
                {rotuloQuadra(q)}
              </BotaoFiltro>
            ))}
          </GrupoFiltro>

          <GrupoFiltro rotulo="Professor">
            <BotaoFiltro
              ativo={professor === "todos"}
              aoClicar={() => setProfessor("todos")}
            >
              Todos
            </BotaoFiltro>
            {professores.map((p) => (
              <BotaoFiltro
                key={p.id}
                ativo={professor === p.nome}
                aoClicar={() => setProfessor(p.nome)}
                cor={p.cor}
              >
                {p.nome}
              </BotaoFiltro>
            ))}
          </GrupoFiltro>

          <GrupoFiltro rotulo="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAlocacao | "todos")}
              className="rounded-lg border border-areia-200 bg-white px-2.5 py-1.5 text-xs font-medium text-areia-700 focus:border-saibro-500 focus:outline-none"
            >
              <option value="todos">Todos os tipos</option>
              {ORDEM_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </GrupoFiltro>
        </div>

        <div className="hidden border-b border-areia-200 px-4 py-2.5 md:block">
          <Legenda />
        </div>

        {visao === "semana" ? (
          <>
            {/* Celular: um dia por vez. Desktop: a grade semanal completa. */}
            <div className="md:hidden">
              <VisaoDiaria
                datas={datas}
                dia={diaEmFoco}
                aoTrocarDia={setDiaSelecionado}
                filtro={filtro}
                horarios={horarios}
                aoAdicionar={(diaSemana, horaInicio) =>
                  abrirFormulario({
                    quadra: quadra === "todas" ? undefined : quadra,
                    diaSemana,
                    horaInicio,
                  })
                }
              />
            </div>
            <div className="hidden md:block">
              <VisaoSemanal
                datas={datas}
                filtro={filtro}
                horarios={horarios}
                aoAdicionar={(diaSemana, horaInicio) =>
                  abrirFormulario({
                    quadra: quadra === "todas" ? undefined : quadra,
                    diaSemana,
                    horaInicio,
                  })
                }
              />
            </div>
          </>
        ) : (
          <VisaoMensal
            referencia={referencia}
            filtro={filtro}
            horarios={horarios}
            aoSelecionarDia={(data) => {
              setReferencia(data);
              setDiaSelecionado(data);
              setVisao("semana");
            }}
          />
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-areia-500">
        <IconeAgenda className="h-4 w-4" />
        Clique no nome de um aluno para abrir a ficha completa, ou em um espaço
        livre da grade para marcar um novo horário.
      </p>

      <ModalNovoHorario
        key={`${preenchimento.quadra}-${preenchimento.diaSemana}-${preenchimento.horaInicio}-${formularioAberto}`}
        aberto={formularioAberto}
        aoFechar={() => setFormularioAberto(false)}
        horarios={horarios}
        inicial={preenchimento}
        aoSalvar={(criado) => {
          setUltimoCriado(
            `Horário criado: ${rotuloQuadra(criado.quadra)} · ${DIAS_SEMANA_LONGO[criado.diaSemana]} · ${criado.horaInicio}–${criado.horaFim} · ${criado.tipo}.`,
          );
          setVisao("semana");
        }}
      />
    </div>
  );
}

function normalizarQuadra(valor: string | null): Quadra | "todas" {
  if (!valor) return "todas";
  if (valor === "paredao") return "paredao";
  const numero = Number(valor);
  return numero >= 1 && numero <= 4 ? (numero as Quadra) : "todas";
}

function GrupoFiltro({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-areia-500">{rotulo}:</span>
      {children}
    </div>
  );
}

function BotaoFiltro({
  ativo,
  aoClicar,
  children,
  cor,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
  cor?: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        ativo
          ? "bg-saibro-600 text-white"
          : "bg-areia-100 text-areia-700 hover:bg-areia-200"
      }`}
    >
      {cor && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: ativo ? "#fff" : cor }}
        />
      )}
      {children}
    </button>
  );
}
