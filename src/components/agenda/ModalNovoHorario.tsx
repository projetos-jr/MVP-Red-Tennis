"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { IconeAlerta, IconeBusca, IconeCheck, IconeFechar } from "@/components/ui/Icons";
import { DIAS_SEMANA_LONGO, ORDEM_SEMANA, horaParaMinutos, minutosParaHora } from "@/lib/date";
import { FAIXAS_HORARIAS, QUADRAS } from "@/lib/arena";
import { listarProfessores } from "@/lib/selectors";
import { ESTILO_TIPO, ORDEM_TIPOS, rotuloQuadra } from "@/lib/theme";
import type { Horario, Quadra, TipoAlocacao } from "@/lib/types";
import { useApp, type NovoHorario } from "@/store/AppStore";

interface ModalNovoHorarioProps {
  aberto: boolean;
  aoFechar: () => void;
  /** Grade atual, usada para avisar sobre conflito antes de salvar. */
  horarios: Horario[];
  /** Preenchimento inicial — vem do clique numa célula vazia da grade. */
  inicial?: { quadra?: Quadra; diaSemana?: number; horaInicio?: string };
  aoSalvar?: (horario: Horario) => void;
}

/** Tipos de alocação que não têm professor vinculado. */
const SEM_PROFESSOR_TIPOS: TipoAlocacao[] = [
  "Locação Mensal",
  "Locação Avulsa",
  "Ranking",
  "Plano de locação",
];

const DURACOES = [
  { minutos: 60, rotulo: "1h" },
  { minutos: 90, rotulo: "1h30" },
  { minutos: 120, rotulo: "2h" },
];

export function ModalNovoHorario({
  aberto,
  aoFechar,
  horarios,
  inicial,
  aoSalvar,
}: ModalNovoHorarioProps) {
  const { alunos, adicionarHorario } = useApp();
  const professores = listarProfessores();

  const [quadra, setQuadra] = useState<Quadra>(inicial?.quadra ?? 1);
  const [diaSemana, setDiaSemana] = useState(inicial?.diaSemana ?? 1);
  const [horaInicio, setHoraInicio] = useState(inicial?.horaInicio ?? "19:00");
  const [duracao, setDuracao] = useState(60);
  const [tipo, setTipo] = useState<TipoAlocacao>("Individual");
  const [professor, setProfessor] = useState(professores[0].nome);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");

  const semProfessor = SEM_PROFESSOR_TIPOS.includes(tipo);
  const horaFim = minutosParaHora(horaParaMinutos(horaInicio) + duracao);

  // Conflito calculado em tempo real: a mesma quadra já ocupada na faixa.
  const conflito = useMemo(
    () =>
      horarios.find(
        (h) =>
          h.quadra === quadra &&
          h.diaSemana === diaSemana &&
          h.horaInicio < horaFim &&
          horaInicio < h.horaFim,
      ),
    [horarios, quadra, diaSemana, horaInicio, horaFim],
  );

  const encontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? alunos.filter((a) => a.nome.toLowerCase().includes(termo))
      : alunos;
    return base.slice(0, 40);
  }, [alunos, busca]);

  function alternarAluno(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((a) => a !== id) : [...atual, id],
    );
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (selecionados.length === 0) return;

    const dados: NovoHorario = {
      quadra,
      diaSemana,
      horaInicio,
      horaFim,
      tipo,
      professor: semProfessor ? "Sem professor" : professor,
      alunosIds: selecionados,
    };

    const criado = adicionarHorario(dados);
    aoSalvar?.(criado);
    aoFechar();
    setSelecionados([]);
    setBusca("");
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo horário"
      descricao="Aloca uma aula, locação ou reserva na grade da semana."
      largura="lg"
    >
      <form onSubmit={salvar}>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          {/* Quadra */}
          <Campo rotulo="Quadra">
            <div className="flex flex-wrap gap-1.5">
              {QUADRAS.map((q) => (
                <button
                  key={String(q)}
                  type="button"
                  onClick={() => setQuadra(q)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    quadra === q
                      ? "bg-saibro-600 text-white"
                      : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                  }`}
                >
                  {rotuloQuadra(q)}
                </button>
              ))}
            </div>
          </Campo>

          {/* Dia da semana */}
          <Campo rotulo="Dia da semana">
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(Number(e.target.value))}
              className="campo"
            >
              {ORDEM_SEMANA.map((dia) => (
                <option key={dia} value={dia}>
                  {DIAS_SEMANA_LONGO[dia]}
                </option>
              ))}
            </select>
          </Campo>

          {/* Horário */}
          <Campo rotulo="Início">
            <select
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="campo"
            >
              {FAIXAS_HORARIAS.map((faixa) => (
                <option key={faixa} value={faixa}>
                  {faixa}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo={`Duração — termina às ${horaFim}`}>
            <div className="flex gap-1.5">
              {DURACOES.map((opcao) => (
                <button
                  key={opcao.minutos}
                  type="button"
                  onClick={() => setDuracao(opcao.minutos)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    duracao === opcao.minutos
                      ? "bg-saibro-600 text-white"
                      : "bg-areia-100 text-areia-700 hover:bg-areia-200"
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </Campo>

          {/* Tipo */}
          <Campo rotulo="Tipo de alocação">
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_TIPOS.map((t) => {
                const estilo = ESTILO_TIPO[t];
                const ativo = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      color: ativo ? "#fff" : estilo.texto,
                      backgroundColor: ativo ? estilo.cor : estilo.fundo,
                      borderColor: estilo.borda,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Campo>

          {/* Professor */}
          <Campo rotulo="Professor">
            {semProfessor ? (
              <p className="rounded-xl border border-dashed border-areia-300 px-3.5 py-2.5 text-sm text-areia-500">
                {tipo} não tem professor alocado.
              </p>
            ) : (
              <select
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                className="campo"
              >
                {professores.map((p) => (
                  <option key={p.id} value={p.nome}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>

          {/* Alunos */}
          <div className="sm:col-span-2">
            <Campo
              rotulo={`Alunos${
                selecionados.length > 0 ? ` · ${selecionados.length} na turma` : ""
              }`}
            >
              {selecionados.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selecionados.map((id) => {
                    const aluno = alunos.find((a) => a.id === id);
                    if (!aluno) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => alternarAluno(id)}
                        className="flex items-center gap-1.5 rounded-full bg-saibro-100 py-1 pl-1 pr-2 text-xs font-medium text-saibro-800 hover:bg-saibro-200"
                      >
                        <Avatar
                          id={aluno.id}
                          nome={aluno.nome}
                          src={aluno.avatarUrl}
                          tamanho="xs"
                        />
                        {aluno.nome}
                        <IconeFechar className="h-3 w-3" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar aluno pelo nome…"
                  className="campo pl-9"
                />
              </div>

              <ul className="mt-2 max-h-44 divide-y divide-areia-100 overflow-y-auto rolagem-suave rounded-xl border border-areia-200">
                {encontrados.map((aluno) => {
                  const marcado = selecionados.includes(aluno.id);
                  return (
                    <li key={aluno.id}>
                      <button
                        type="button"
                        onClick={() => alternarAluno(aluno.id)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          marcado ? "bg-saibro-50" : "hover:bg-areia-50"
                        }`}
                      >
                        <Avatar
                          id={aluno.id}
                          nome={aluno.nome}
                          src={aluno.avatarUrl}
                          tamanho="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-areia-900">
                            {aluno.nome}
                          </span>
                          <span className="block truncate text-xs text-areia-500">
                            {aluno.plano} · {aluno.professorPrincipal}
                          </span>
                        </span>
                        {marcado && (
                          <IconeCheck className="h-4 w-4 shrink-0 text-saibro-600" />
                        )}
                      </button>
                    </li>
                  );
                })}

                {encontrados.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-areia-500">
                    Nenhum aluno encontrado.
                  </li>
                )}
              </ul>
            </Campo>
          </div>
        </div>

        {/* Aviso de conflito */}
        {conflito && (
          <div className="mx-5 mb-4 flex items-start gap-3 rounded-xl border border-tijolo-200 bg-tijolo-50/70 px-4 py-3">
            <IconeAlerta className="mt-0.5 h-5 w-5 shrink-0 text-tijolo-600" />
            <div>
              <p className="text-sm font-semibold text-tijolo-800">
                Esta quadra já está ocupada nesse horário
              </p>
              <p className="text-xs text-tijolo-700/80">
                {conflito.tipo} das {conflito.horaInicio} às {conflito.horaFim} —{" "}
                {rotuloQuadra(conflito.quadra)}. É possível salvar mesmo assim; os
                dois eventos ficarão marcados como conflito na grade.
              </p>
            </div>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-areia-200 px-5 py-4">
          <p className="text-xs text-areia-500">
            {rotuloQuadra(quadra)} · {DIAS_SEMANA_LONGO[diaSemana]} · {horaInicio}
            –{horaFim}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={aoFechar} className="btn-secundario py-2">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={selecionados.length === 0}
              className="btn-primario py-2"
            >
              Salvar horário
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-areia-500">
        {rotulo}
      </label>
      {children}
    </div>
  );
}
