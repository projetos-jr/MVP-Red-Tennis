"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Confirmacao } from "@/components/ui/Confirmacao";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import {
  cancelarMatriculaAgendada,
  corrigirMatricula,
  criarMatricula,
  encerrarMatricula,
  trocarPlano,
} from "@/lib/banco/operacoes/alunos";
import {
  matriculaQueVoltaAoCancelar,
  planosParaMatricula,
  type MatriculaDoAluno,
} from "@/lib/consultas/alunos";
import { formatarData, somarDias } from "@/lib/date";
import { formatarMoeda } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { classeDoCampo, lerValorEmReais, valorParaCampo } from "./estilos";

const DIAS_DE_VENCIMENTO = Array.from({ length: 28 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Nova matricula e troca de plano
// ---------------------------------------------------------------------------

interface ModalMatriculaProps {
  aberto: boolean;
  aoFechar: () => void;
  alunoId: string;
  /** Matricula atual: com ela o formulario troca de plano; sem ela cria uma nova. */
  atual?: MatriculaDoAluno;
}

export function ModalMatricula(props: ModalMatriculaProps) {
  return (
    <Modal
      aberto={props.aberto}
      aoFechar={props.aoFechar}
      titulo={props.atual ? "Trocar de plano" : "Nova matrícula"}
      descricao={
        props.atual
          ? "A matrícula atual termina na véspera e uma nova começa na data escolhida."
          : "Plano, valor combinado e dia de vencimento da mensalidade."
      }
    >
      <ConteudoMatricula {...props} />
    </Modal>
  );
}

function ConteudoMatricula({ aoFechar, alunoId, atual }: ModalMatriculaProps) {
  const { banco } = useApp();
  const gravar = useGravar();
  const planos = useMemo(() => planosParaMatricula(banco), [banco]);
  const inicioMinimo = atual ? somarDias(atual.matricula.inicio, 1) : undefined;

  const [planoId, setPlanoId] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState(String(atual?.matricula.diaVencimento ?? 10));
  const [inicio, setInicio] = useState(
    inicioMinimo && inicioMinimo > HOJE ? inicioMinimo : HOJE,
  );
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const plano = [...planos.nova, ...planos.antiga].find((p) => p.id === planoId);
  const valorDigitado = lerValorEmReais(valor);

  function validar(): Record<string, string> {
    const encontrados: Record<string, string> = {};
    if (!planoId) encontrados.plano = "Escolha o plano.";
    if (!(valorDigitado > 0)) encontrados.valor = "Informe o valor combinado (maior que zero).";
    if (!inicio) encontrados.inicio = "Informe a data de início.";
    else if (inicioMinimo && inicio < inicioMinimo) {
      encontrados.inicio = `O novo plano precisa começar a partir de ${formatarData(inicioMinimo)}.`;
    }
    return encontrados;
  }
  const erros = tentouSalvar ? validar() : {};

  function escolherPlano(id: string) {
    setPlanoId(id);
    const escolhido = [...planos.nova, ...planos.antiga].find((p) => p.id === id);
    if (escolhido) setValor(valorParaCampo(escolhido.valorMensal));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentouSalvar(true);
    if (Object.keys(validar()).length > 0) return;

    const dados = { planoId, valorMensal: valorDigitado, diaVencimento: Number(dia), inicio };
    const gravou = atual
      ? gravar(trocarPlano, { ...dados, matriculaId: atual.matricula.id }, "Plano trocado.")
      : gravar(criarMatricula, { ...dados, alunoId }, "Matrícula criada.");
    if (gravou) aoFechar();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="space-y-4 px-5 py-4">
        {atual && (
          <p className="rounded-xl bg-areia-100 px-3.5 py-2.5 text-sm text-areia-700">
            Plano atual: <strong className="font-semibold">{atual.plano?.nome ?? "—"}</strong> ·{" "}
            {formatarMoeda(atual.matricula.valorMensal)} por mês
          </p>
        )}

        <Campo rotulo={atual ? "Novo plano" : "Plano"} obrigatorio erro={erros.plano}>
          <select
            className={classeDoCampo(erros.plano)}
            aria-invalid={Boolean(erros.plano)}
            value={planoId}
            onChange={(e) => escolherPlano(e.target.value)}
          >
            <option value="">Escolha o plano…</option>
            <optgroup label="Tabela nova">
              {planos.nova.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} · {formatarMoeda(p.valorMensal)}
                </option>
              ))}
            </optgroup>
            {planos.antiga.length > 0 && (
              <optgroup label="Tabela antiga">
                {planos.antiga.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {formatarMoeda(p.valorMensal)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Valor combinado (por mês)"
            obrigatorio
            erro={erros.valor}
            ajuda={
              plano
                ? `Preço de tabela: ${formatarMoeda(plano.valorMensal)}. Pode ser diferente.`
                : "Preenchido com o preço do plano; pode ser mudado."
            }
          >
            <input
              className={classeDoCampo(erros.valor)}
              aria-invalid={Boolean(erros.valor)}
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          <Campo rotulo="Dia de vencimento" obrigatorio ajuda="De 1 a 28 (existe em todo mês).">
            <select className="campo" value={dia} onChange={(e) => setDia(e.target.value)}>
              {DIAS_DE_VENCIMENTO.map((d) => (
                <option key={d} value={d}>
                  Todo dia {d}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo
          rotulo={atual ? "O novo plano vale a partir de" : "Início"}
          obrigatorio
          erro={erros.inicio}
        >
          <input
            type="date"
            className={classeDoCampo(erros.inicio)}
            aria-invalid={Boolean(erros.inicio)}
            value={inicio}
            min={inicioMinimo}
            onChange={(e) => setInicio(e.target.value)}
          />
        </Campo>

        {atual && inicio && (!inicioMinimo || inicio >= inicioMinimo) && (
          <p className="text-sm leading-relaxed text-areia-700">
            O plano atual termina em{" "}
            <strong className="font-semibold">{formatarData(somarDias(inicio, -1))}</strong> e o novo
            começa em <strong className="font-semibold">{formatarData(inicio)}</strong>. Os horários
            fixos da agenda não mudam: se o novo plano tiver outro horário, ajuste na agenda.
          </p>
        )}
        <p className="text-xs leading-relaxed text-areia-500">
          As mensalidades são geradas pelo Financeiro a partir da matrícula. Hipótese H3: cada
          plano é da tabela nova ou da antiga, e o aluno mantém o valor combinado.
        </p>
      </div>
      <RodapeDoFormulario
        aoCancelar={aoFechar}
        rotuloConfirmar={atual ? "Trocar plano" : "Criar matrícula"}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Correcao de valor e vencimento
// ---------------------------------------------------------------------------

export function ModalCorrigirMatricula({
  aberto,
  aoFechar,
  atual,
}: {
  aberto: boolean;
  aoFechar: () => void;
  atual: MatriculaDoAluno;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Corrigir matrícula"
      descricao="Para erro de digitação ou desconto combinado. Para mudar de plano, use Trocar de plano."
    >
      <ConteudoCorrecao aoFechar={aoFechar} atual={atual} />
    </Modal>
  );
}

function ConteudoCorrecao({ aoFechar, atual }: { aoFechar: () => void; atual: MatriculaDoAluno }) {
  const gravar = useGravar();
  const [valor, setValor] = useState(valorParaCampo(atual.matricula.valorMensal));
  const [dia, setDia] = useState(String(atual.matricula.diaVencimento));
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const valorMensal = lerValorEmReais(valor);
  const erro =
    tentouSalvar && !(valorMensal > 0) ? "Informe o valor combinado (maior que zero)." : undefined;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentouSalvar(true);
    if (!(valorMensal > 0)) return;
    const gravou = gravar(
      corrigirMatricula,
      { matriculaId: atual.matricula.id, valorMensal, diaVencimento: Number(dia) },
      "Matrícula corrigida.",
    );
    if (gravou) aoFechar();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <Campo rotulo="Valor combinado (por mês)" obrigatorio erro={erro}>
          <input
            className={classeDoCampo(erro)}
            aria-invalid={Boolean(erro)}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Dia de vencimento" obrigatorio>
          <select className="campo" value={dia} onChange={(e) => setDia(e.target.value)}>
            {DIAS_DE_VENCIMENTO.map((d) => (
              <option key={d} value={d}>
                Todo dia {d}
              </option>
            ))}
          </select>
        </Campo>
        <p className="text-xs text-areia-500 sm:col-span-2">
          Vale para as próximas mensalidades; as já lançadas no Financeiro não mudam.
        </p>
      </div>
      <RodapeDoFormulario aoCancelar={aoFechar} rotuloConfirmar="Salvar correção" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Encerrar e cancelar
// ---------------------------------------------------------------------------

export function ConfirmarEncerramento({
  aberto,
  aoFechar,
  atual,
  congelado,
}: {
  aberto: boolean;
  aoFechar: () => void;
  atual: MatriculaDoAluno;
  /** Ha congelamento em curso (termina junto). */
  congelado: boolean;
}) {
  const gravar = useGravar();
  const [ultimoDia, setUltimoDia] = useState(HOJE);

  return (
    <Confirmacao
      aberto={aberto}
      titulo="Encerrar matrícula"
      perigoso
      rotuloConfirmar="Encerrar matrícula"
      desabilitado={!ultimoDia}
      mensagem={
        <>
          A matrícula do plano <strong>{atual.plano?.nome ?? "—"}</strong> termina no último dia
          informado e o aluno fica sem plano mensal.
          {congelado && " O congelamento em curso termina junto."} As aulas fixas continuam na
          agenda; para tirar o aluno da agenda, use <strong>Inativar aluno</strong>.
        </>
      }
      aoCancelar={aoFechar}
      aoConfirmar={() => {
        if (gravar(encerrarMatricula, { matriculaId: atual.matricula.id, ultimoDia }, "Matrícula encerrada.")) {
          aoFechar();
        }
      }}
    >
      <Campo rotulo="Último dia da matrícula" obrigatorio>
        <input
          type="date"
          className="campo"
          value={ultimoDia}
          min={atual.matricula.inicio}
          onChange={(e) => setUltimoDia(e.target.value)}
        />
      </Campo>
    </Confirmacao>
  );
}

export function ConfirmarCancelamentoDaAgendada({
  aberto,
  aoFechar,
  agendada,
}: {
  aberto: boolean;
  aoFechar: () => void;
  agendada: MatriculaDoAluno;
}) {
  const { banco } = useApp();
  const gravar = useGravar();
  const volta = matriculaQueVoltaAoCancelar(banco, agendada.matricula.id);

  return (
    <Confirmacao
      aberto={aberto}
      titulo="Desmarcar matrícula agendada"
      perigoso
      rotuloConfirmar="Desmarcar matrícula"
      mensagem={
        <>
          A matrícula do plano <strong>{agendada.plano?.nome ?? "—"}</strong>, marcada para{" "}
          {formatarData(agendada.matricula.inicio)}, sai da lista.
          {volta && (
            <>
              {" "}
              O plano anterior (<strong>{volta.plano?.nome ?? "—"}</strong>) continua valendo, sem
              data de fim.
            </>
          )}
        </>
      }
      aoCancelar={aoFechar}
      aoConfirmar={() => {
        if (
          gravar(
            cancelarMatriculaAgendada,
            { matriculaId: agendada.matricula.id },
            "Matrícula agendada desmarcada.",
          )
        ) {
          aoFechar();
        }
      }}
    />
  );
}
