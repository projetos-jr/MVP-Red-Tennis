"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { Segmentado } from "@/components/ui/Segmentado";
import { HOJE } from "@/lib/banco/constantes";
import {
  criarHorarioAvulso,
  criarHorarioFixo,
  marcarAulaDeReposicao,
} from "@/lib/banco/operacoes/agenda";
import type { QuadraId, TipoOcupacao } from "@/lib/banco/tipos";
import {
  TIPOS_COM_DIREITO_A_REPOSICAO,
  TIPOS_COM_PROFESSOR,
  TIPOS_DE_HORARIO_FIXO,
  buscarAlunoDaAgenda,
  checarHorario,
  disponibilidadeDasQuadras,
  duracaoEmMinutos,
  previaDaRecorrencia,
  professoresAtivos,
  quadrasDaArena,
  rotuloDaQuadra,
  saldoDoAluno,
  valorDaLocacao,
} from "@/lib/consultas/agenda";
import {
  DIAS_SEMANA_CURTO,
  diaDaSemana,
  formatarData,
  formatarDiaMes,
  horaParaMinutos,
  minutosParaHora,
} from "@/lib/date";
import { ESTILO_OCUPACAO, formatarMinutos, formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import {
  Aviso,
  CamposDeHora,
  CorpoRolavel,
  GrupoDeCampo,
  SeletorDeQuadra,
} from "./CamposDeHorario";
import { ORDEM_TIPOS_AGENDA, repeticaoSemanal } from "./estilos";
import { SeletorDeAlunos } from "./SeletorDeAlunos";

export type ModoNovoHorario = "avulso" | "fixo" | "reposicao";

/** O que ja vem preenchido (clique numa celula da grade, painel do aluno...). */
export interface PreenchimentoNovoHorario {
  data?: string;
  horaInicio?: string;
  quadraId?: QuadraId;
  modo?: ModoNovoHorario;
}

const TIPOS_POR_MODO: Record<ModoNovoHorario, TipoOcupacao[]> = {
  fixo: TIPOS_DE_HORARIO_FIXO,
  avulso: ORDEM_TIPOS_AGENDA.filter((t) => t !== "Bloqueio"),
  reposicao: TIPOS_COM_DIREITO_A_REPOSICAO,
};

const TIPO_INICIAL: Record<ModoNovoHorario, TipoOcupacao> = {
  fixo: "Individual",
  avulso: "Locação Avulsa",
  reposicao: "Individual",
};

const EXPLICACAO: Record<ModoNovoHorario, string> = {
  fixo: "Repete toda semana: cria as aulas de cada data até o limite da agenda.",
  avulso: "Uma data só: aula avulsa, locação avulsa ou partida de ranking.",
  reposicao: "Aula nova paga com os minutos de reposição do aluno.",
};

/**
 * Novo horario: fixo (toda semana), avulso (uma data) ou de reposicao.
 * Antes de salvar, mostra o que a regra vai dizer: quadra ocupada (e por
 * quem), professor em outra aula (H10) e, no fixo, cada data em conflito para
 * a pessoa decidir se pula a data ou desiste.
 */
export function ModalNovoHorario({
  aberto,
  aoFechar,
  inicial,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  inicial: PreenchimentoNovoHorario;
  /** Chamado depois de gravar, com a data do (primeiro) horario. */
  aoSalvar: (data: string) => void;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const quadras = quadrasDaArena(banco);
  const professores = professoresAtivos(banco);

  const modoInicial = inicial.modo ?? "avulso";
  const [modo, setModo] = useState<ModoNovoHorario>(modoInicial);
  const [tipo, setTipo] = useState<TipoOcupacao>(TIPO_INICIAL[modoInicial]);
  const [quadraId, setQuadraId] = useState<QuadraId>(inicial.quadraId ?? "1");
  const [data, setData] = useState(inicial.data && inicial.data >= HOJE ? inicial.data : HOJE);
  const [inicio, setInicio] = useState(inicial.horaInicio ?? "19:00");
  const [fim, setFim] = useState(() =>
    minutosParaHora(Math.min(horaParaMinutos(inicial.horaInicio ?? "19:00") + 60, 22 * 60)),
  );
  const [ultimaAula, setUltimaAula] = useState("");
  const [professorId, setProfessorId] = useState(professores[0]?.id ?? "");
  const [alunosIds, setAlunosIds] = useState<string[]>([]);
  const [descricao, setDescricao] = useState("");
  const [datasPuladas, setDatasPuladas] = useState<string[]>([]);

  const comProfessor = TIPOS_COM_PROFESSOR.includes(tipo);
  const professorEfetivo = comProfessor ? professorId : undefined;
  const alvo = { quadraId, data, horaInicio: inicio, horaFim: fim };
  const minutos = duracaoEmMinutos(alvo);
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);

  const disponibilidade = useMemo(
    () =>
      dataValida
        ? disponibilidadeDasQuadras(banco, { data, horaInicio: inicio, horaFim: fim })
        : undefined,
    [banco, data, inicio, fim, dataValida],
  );
  const checagem = useMemo(
    () =>
      dataValida && modo !== "fixo"
        ? checarHorario(banco, {
            quadraId,
            data,
            horaInicio: inicio,
            horaFim: fim,
            professorId: professorEfetivo,
          })
        : undefined,
    [banco, quadraId, data, inicio, fim, professorEfetivo, dataValida, modo],
  );
  const previa = useMemo(
    () =>
      dataValida && modo === "fixo"
        ? previaDaRecorrencia(
            banco,
            {
              quadraId,
              dataInicio: data,
              fim: ultimaAula || undefined,
              horaInicio: inicio,
              horaFim: fim,
              professorId: professorEfetivo,
              diaSemana: diaDaSemana(data),
            },
            HOJE,
          )
        : undefined,
    [banco, quadraId, data, ultimaAula, inicio, fim, professorEfetivo, dataValida, modo],
  );

  const emConflito = previa?.datas.filter((d) => d.conflito) ?? [];
  const pendentes = emConflito.filter((d) => !datasPuladas.includes(d.data));
  const professorOcupadoNoFixo =
    previa?.datas.filter((d) => d.professorOcupado && !datasPuladas.includes(d.data)) ?? [];
  const aulasQueSeraoCriadas = previa
    ? previa.datas.filter((d) => !datasPuladas.includes(d.data)).length
    : 0;
  const saldo = modo === "reposicao" && alunosIds[0] ? saldoDoAluno(banco, alunosIds[0], HOJE) : 0;

  function mudarModo(novo: ModoNovoHorario) {
    setModo(novo);
    if (!TIPOS_POR_MODO[novo].includes(tipo)) setTipo(TIPO_INICIAL[novo]);
    if (novo === "reposicao") setAlunosIds((atual) => atual.slice(0, 1));
  }

  function mudarAlunos(ids: string[]) {
    setAlunosIds(ids);
    // Na reposicao, o professor sugerido e o do aluno.
    const professorDoAluno = buscarAlunoDaAgenda(banco, ids[0] ?? "")?.professorPrincipalId;
    if (modo === "reposicao" && professorDoAluno) setProfessorId(professorDoAluno);
  }

  function alternarPulo(dataDaAula: string) {
    setDatasPuladas((atual) =>
      atual.includes(dataDaAula) ? atual.filter((d) => d !== dataDaAula) : [...atual, dataDaAula],
    );
  }

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const quando = `${rotuloDaQuadra(quadraId)} · ${formatarDiaMes(data)} · ${inicio}–${fim}`;
    let gravou = false;
    if (modo === "avulso") {
      gravou = gravar(
        criarHorarioAvulso,
        { ...alvo, tipo, professorId: professorEfetivo, alunosIds, descricao },
        tipo === "Locação Avulsa"
          ? `Reserva marcada (${quando}). Ela aguarda pagamento por até ${banco.configuracoes.prazoPagamentoReservaHoras} h.`
          : `Horário marcado: ${quando}.`,
      );
    } else if (modo === "fixo") {
      gravou = gravar(
        criarHorarioFixo,
        {
          quadraId,
          dataInicio: data,
          fim: ultimaAula || undefined,
          horaInicio: inicio,
          horaFim: fim,
          tipo,
          professorId: professorEfetivo,
          alunosIds,
          datasPuladas,
        },
        `Horário fixo criado: ${repeticaoSemanal(diaDaSemana(data))}, ${inicio}–${fim}, ${rotuloDaQuadra(quadraId)} (${aulasQueSeraoCriadas} aulas).`,
      );
    } else {
      gravou = gravar(
        marcarAulaDeReposicao,
        { alunoId: alunosIds[0] ?? "", ...alvo, tipo, professorId: professorEfetivo },
        `Reposição marcada (${quando}). Saldo usado: ${formatarMinutos(minutos)}.`,
      );
    }
    if (gravou) {
      aoSalvar(data);
      aoFechar();
    }
  }

  const bloqueiaSalvar =
    alunosIds.length === 0 || !dataValida || (modo === "fixo" && pendentes.length > 0);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo horário"
      descricao="Aula, locação ou reserva de ranking na agenda."
      largura="lg"
    >
      <form onSubmit={salvar}>
        <CorpoRolavel>
          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <Segmentado
                aria="Tipo de agendamento"
                valor={modo}
                aoMudar={mudarModo}
                opcoes={[
                  {
                    valor: "fixo",
                    rotulo: <RotuloDoModo curto="Fixo" longo="Fixo (toda semana)" />,
                  },
                  {
                    valor: "avulso",
                    rotulo: <RotuloDoModo curto="Avulso" longo="Avulso (uma data)" />,
                  },
                  { valor: "reposicao", rotulo: "Reposição" },
                ]}
              />
              <p className="text-xs text-areia-600">{EXPLICACAO[modo]}</p>
            </div>

            <GrupoDeCampo rotulo="Tipo">
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_POR_MODO[modo].map((t) => {
                  const estilo = ESTILO_OCUPACAO[t];
                  const ativo = tipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setTipo(t)}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
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
            </GrupoDeCampo>

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo={modo === "fixo" ? "Primeira aula" : "Data"}
                obrigatorio
                ajuda={
                  modo === "fixo" && dataValida
                    ? `Repete ${repeticaoSemanal(diaDaSemana(data))}, a partir de ${formatarData(data)}.`
                    : undefined
                }
              >
                <input
                  type="date"
                  value={data}
                  min={HOJE}
                  onChange={(e) => {
                    setData(e.target.value);
                    setDatasPuladas([]);
                  }}
                  className="campo"
                  required
                />
              </Campo>
              <CamposDeHora
                inicio={inicio}
                fim={fim}
                aoMudar={(novoInicio, novoFim) => {
                  setInicio(novoInicio);
                  setFim(novoFim);
                  setDatasPuladas([]);
                }}
              />
            </div>

            <SeletorDeQuadra
              quadras={quadras}
              valor={quadraId}
              aoMudar={(id) => {
                setQuadraId(id);
                setDatasPuladas([]);
              }}
              disponibilidade={modo === "fixo" ? undefined : disponibilidade}
            />
            {/* O que a regra vai dizer, ao lado do campo que causa o problema */}
            {checagem?.conflitoNaQuadra && (
              <Aviso tom="erro" titulo="A quadra já está ocupada neste horário">
                {checagem.conflitoNaQuadra} Escolha outra quadra ou outro horário.
              </Aviso>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {comProfessor ? (
                <Campo rotulo="Professor" obrigatorio>
                  <select
                    value={professorId}
                    onChange={(e) => setProfessorId(e.target.value)}
                    className="campo"
                  >
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              ) : (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-areia-800">Professor</p>
                  <p className="rounded-xl border border-dashed border-areia-300 px-3.5 py-2.5 text-sm text-areia-500">
                    {tipo} não tem professor.
                  </p>
                </div>
              )}
              {modo === "fixo" && (
                <Campo
                  rotulo="Última aula (opcional)"
                  ajuda="Vazio: o horário não tem data para acabar."
                >
                  <input
                    type="date"
                    value={ultimaAula}
                    min={data}
                    onChange={(e) => setUltimaAula(e.target.value)}
                    className="campo"
                  />
                </Campo>
              )}
              {modo === "avulso" && (
                <Campo rotulo="Observação (opcional)">
                  <input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: aula experimental"
                    className="campo"
                    maxLength={80}
                  />
                </Campo>
              )}
            </div>
            {checagem?.professorOcupado && (
              <Aviso
                tom={checagem.professorBloqueia ? "erro" : "atencao"}
                titulo={
                  checagem.professorBloqueia
                    ? "Professor ocupado"
                    : "Atenção: professor em duas aulas"
                }
              >
                {checagem.professorOcupado}{" "}
                {checagem.professorBloqueia
                  ? "As Configurações não permitem salvar assim."
                  : "Dá para salvar mesmo assim (Hipótese H10)."}
              </Aviso>
            )}

            <SeletorDeAlunos
              selecionados={alunosIds}
              aoMudar={mudarAlunos}
              unico={modo === "reposicao"}
              mostrarSaldo={modo === "reposicao"}
              titularNoPrimeiro={tipo === "Locação Avulsa"}
              rotulo={modo === "reposicao" ? "Aluno da reposição" : "Alunos"}
            />

            <div className="space-y-2">
              {modo === "avulso" && tipo === "Locação Avulsa" && (
                <Aviso
                  tom="info"
                  titulo={`Valor da locação: ${formatarMoeda(valorDaLocacao(banco, alvo))}`}
                >
                  A reserva fica “aguardando pagamento” por até{" "}
                  {banco.configuracoes.prazoPagamentoReservaHoras} h (nunca depois do início) e a
                  cobrança vai para o Financeiro em nome do titular.
                </Aviso>
              )}
              {modo === "reposicao" && alunosIds[0] && (
                <Aviso
                  tom={saldo >= minutos ? "ok" : "erro"}
                  titulo={`Saldo de reposição: ${formatarMinutos(saldo)}`}
                >
                  {saldo >= minutos
                    ? `A aula usa ${formatarMinutos(minutos)}; sobram ${formatarMinutos(saldo - minutos)}.`
                    : `A aula precisa de ${formatarMinutos(minutos)}: o saldo não basta.`}
                </Aviso>
              )}
            </div>

            {modo === "fixo" && previa && (
              <PreviaDasDatas
                previa={previa}
                datasPuladas={datasPuladas}
                aoAlternar={alternarPulo}
                aoPularTodas={() => setDatasPuladas(emConflito.map((d) => d.data))}
                professorOcupado={professorOcupadoNoFixo.length}
                professorBloqueia={banco.configuracoes.bloquearProfessorEmDuasAulas}
              />
            )}
          </div>
        </CorpoRolavel>
        {modo === "fixo" && pendentes.length > 0 && (
          <p
            className="border-t border-areia-200 bg-tijolo-50 px-5 py-3 text-sm text-tijolo-800"
            role="status"
          >
            {pendentes.length === 1
              ? "Falta decidir 1 data em conflito"
              : `Faltam decidir ${pendentes.length} datas em conflito`}
            : marque “Pular esta data” ou clique em Cancelar para desistir de tudo.
          </p>
        )}
        <RodapeDoFormulario
          aoCancelar={aoFechar}
          rotuloConfirmar={
            modo === "fixo"
              ? `Criar horário fixo${aulasQueSeraoCriadas > 0 ? ` (${aulasQueSeraoCriadas} aulas)` : ""}`
              : modo === "reposicao"
                ? "Marcar reposição"
                : "Salvar horário"
          }
          desabilitado={bloqueiaSalvar}
        />
      </form>
    </Modal>
  );
}

/** Rotulo curto no celular ("Fixo") e completo nas telas maiores ("Fixo (toda semana)"). */
function RotuloDoModo({ curto, longo }: { curto: string; longo: string }) {
  return (
    <>
      <span className="sm:hidden">{curto}</span>
      <span className="hidden sm:inline">{longo}</span>
    </>
  );
}

function PreviaDasDatas({
  previa,
  datasPuladas,
  aoAlternar,
  aoPularTodas,
  professorOcupado,
  professorBloqueia,
}: {
  previa: NonNullable<ReturnType<typeof previaDaRecorrencia>>;
  datasPuladas: string[];
  aoAlternar: (data: string) => void;
  aoPularTodas: () => void;
  professorOcupado: number;
  professorBloqueia: boolean;
}) {
  const emConflito = previa.datas.filter((d) => d.conflito);
  return (
    <section className="rounded-2xl border border-areia-200" aria-label="Datas do horário fixo">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-areia-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-areia-900">
            {previa.datas.length} {previa.datas.length === 1 ? "data" : "datas"} até{" "}
            {formatarData(previa.ate)}
          </h3>
          <p className="text-xs text-areia-500">
            A agenda é criada até {formatarData(previa.ate)} e estendida depois (Hipótese H12).
          </p>
        </div>
        {emConflito.length > 0 ? (
          <span className="chip bg-tijolo-50 text-tijolo-800">{emConflito.length} em conflito</span>
        ) : (
          previa.datas.length > 0 && (
            <span className="chip bg-emerald-50 text-emerald-800">Todas livres</span>
          )
        )}
      </header>

      {previa.datas.length === 0 ? (
        <p className="px-4 py-3 text-sm text-tijolo-800">
          Nenhuma aula cai até {formatarData(previa.ate)}. Escolha uma data mais próxima.
        </p>
      ) : (
        <>
          {emConflito.length > 0 && (
            <ul className="divide-y divide-areia-100">
              {emConflito.map((d) => {
                const pulada = datasPuladas.includes(d.data);
                return (
                  <li key={d.data} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-areia-900">
                      {DIAS_SEMANA_CURTO[diaDaSemana(d.data)]} {formatarDiaMes(d.data)}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-tijolo-800">
                      Ocupada das {d.conflito?.horaInicio} às {d.conflito?.horaFim}: {d.quemOcupa}
                    </span>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-areia-800">
                      <input
                        type="checkbox"
                        checked={pulada}
                        onChange={() => aoAlternar(d.data)}
                        className="h-4 w-4 accent-saibro-600"
                      />
                      Pular esta data
                    </label>
                  </li>
                );
              })}
              {emConflito.length > 1 && (
                <li className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={aoPularTodas}
                    className="btn-secundario px-3 py-1.5 text-xs"
                  >
                    Pular todas as datas em conflito
                  </button>
                </li>
              )}
            </ul>
          )}
          {professorOcupado > 0 && (
            <p
              className={`border-t border-areia-200 px-4 py-2.5 text-xs ${professorBloqueia ? "text-tijolo-800" : "text-amber-800"}`}
            >
              O professor já tem outra aula no mesmo horário em {professorOcupado}{" "}
              {professorOcupado === 1 ? "data" : "datas"}.{" "}
              {professorBloqueia
                ? "As Configurações não permitem salvar assim."
                : "Dá para salvar mesmo assim (H10)."}
            </p>
          )}
          <ul
            className="flex flex-wrap gap-1 border-t border-areia-200 px-4 py-3"
            aria-label="Datas que serão criadas"
          >
            {previa.datas.map((d) => {
              const pulada = datasPuladas.includes(d.data);
              return (
                <li
                  key={d.data}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                    pulada
                      ? "bg-areia-100 text-areia-400 line-through"
                      : d.conflito
                        ? "bg-tijolo-100 text-tijolo-800"
                        : "bg-emerald-50 text-emerald-800"
                  }`}
                  title={pulada ? "Pulada" : d.conflito ? "Em conflito" : "Livre"}
                >
                  {formatarDiaMes(d.data)}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
