"use client";

import { useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { Modal } from "@/components/ui/Modal";
import { cadastrarProfessor, editarProfessor } from "@/lib/banco/operacoes/professores";
import { novoId } from "@/lib/banco/regras/comum";
import type { Professor, RegraRepasse } from "@/lib/banco/tipos";
import { normalizarEmail, normalizarTelefone, podeAlterarRepasse } from "@/lib/consultas/alunos";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { classeDoCampo, lerValorEmReais, valorParaCampo } from "@/components/aluno/estilos";

/** Sugestoes de cor na agenda (fora das cores dos tipos de aula, para nao confundir). */
const CORES_SUGERIDAS = [
  "#0E7490",
  "#A16207",
  "#4D7C0F",
  "#7C2D12",
  "#1D4ED8",
  "#BE185D",
  "#4338CA",
  "#0F766E",
];

interface FormularioProfessorProps {
  aberto: boolean;
  aoFechar: () => void;
  /** Professor a editar; sem ele, o formulario cadastra um novo. */
  professor?: Professor;
  aoSalvar?: (professorId: string) => void;
}

/** Cadastro e edicao do professor, com a regra de repasse (Hipotese H6). */
export function FormularioProfessor(props: FormularioProfessorProps) {
  return (
    <Modal
      aberto={props.aberto}
      aoFechar={props.aoFechar}
      titulo={props.professor ? "Editar professor" : "Novo professor"}
      descricao={props.professor?.nome ?? "Contato, cor na agenda e regra de repasse."}
    >
      <Conteudo {...props} />
    </Modal>
  );
}

function Conteudo({ aoFechar, professor, aoSalvar }: FormularioProfessorProps) {
  const { banco, colaborador } = useApp();
  const gravar = useGravar();
  const podeRepasse = podeAlterarRepasse(colaborador);
  const coresUsadas = new Set(banco.professores.map((p) => p.cor.toUpperCase()));

  const [nome, setNome] = useState(professor?.nome ?? "");
  const [cor, setCor] = useState(
    professor?.cor ?? CORES_SUGERIDAS.find((c) => !coresUsadas.has(c)) ?? CORES_SUGERIDAS[0],
  );
  const [especialidade, setEspecialidade] = useState(professor?.especialidade ?? "");
  const [telefone, setTelefone] = useState(professor?.telefone ?? "");
  const [email, setEmail] = useState(professor?.email ?? "");
  const [modo, setModo] = useState<RegraRepasse["modo"]>(professor?.repasse.modo ?? "por_hora");
  const [valor, setValor] = useState(
    professor
      ? professor.repasse.modo === "por_hora"
        ? valorParaCampo(professor.repasse.valor)
        : String(professor.repasse.valor).replace(".", ",")
      : "",
  );
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const valorNumerico = lerValorEmReais(valor);

  function validar(): Record<string, string> {
    const encontrados: Record<string, string> = {};
    if (nome.trim().length < 2) encontrados.nome = "Informe o nome do professor.";
    if (telefone.trim() && !normalizarTelefone(telefone)) {
      encontrados.telefone = "Telefone inválido. Use o DDD e o número, ex.: (11) 98100-2201.";
    }
    if (email.trim() && !normalizarEmail(email)) {
      encontrados.email = "E-mail inválido. Use o formato nome@exemplo.com.";
    }
    if (!Number.isFinite(valorNumerico)) {
      encontrados.valor = modo === "por_hora" ? "Informe o valor por hora-aula." : "Informe o percentual.";
    } else if (valorNumerico < 0) {
      encontrados.valor = "O valor do repasse não pode ser negativo.";
    } else if (modo === "percentual" && valorNumerico > 100) {
      encontrados.valor = "O percentual vai de 0 a 100.";
    }
    return encontrados;
  }
  const erros = tentouSalvar ? validar() : {};

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentouSalvar(true);
    if (Object.keys(validar()).length > 0) return;

    const dados = {
      nome,
      cor,
      especialidade,
      telefone,
      email,
      repasse: { modo, valor: valorNumerico },
    };
    if (professor) {
      if (gravar(editarProfessor, { ...dados, id: professor.id }, "Cadastro do professor atualizado.")) {
        aoFechar();
        aoSalvar?.(professor.id);
      }
      return;
    }
    const id = novoId("prof");
    if (gravar(cadastrarProfessor, { ...dados, id }, "Professor cadastrado.")) {
      aoFechar();
      aoSalvar?.(id);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="space-y-4 px-5 py-4">
        <Campo rotulo="Nome completo" obrigatorio erro={erros.nome}>
          <input
            className={classeDoCampo(erros.nome)}
            aria-invalid={Boolean(erros.nome)}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            autoComplete="off"
            autoFocus
          />
        </Campo>

        <Campo rotulo="Especialidade" ajuda="Ex.: iniciação e turmas infantis.">
          <input
            className="campo"
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value)}
            maxLength={80}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Telefone" erro={erros.telefone}>
            <input
              type="tel"
              inputMode="tel"
              className={classeDoCampo(erros.telefone)}
              aria-invalid={Boolean(erros.telefone)}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              onBlur={() => {
                const formatado = normalizarTelefone(telefone);
                if (formatado) setTelefone(formatado);
              }}
              placeholder="(11) 98100-2201"
            />
          </Campo>
          <Campo rotulo="E-mail" erro={erros.email}>
            <input
              type="email"
              inputMode="email"
              className={classeDoCampo(erros.email)}
              aria-invalid={Boolean(erros.email)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@exemplo.com"
            />
          </Campo>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-areia-800">Cor na agenda</legend>
          <div className="flex flex-wrap items-center gap-2">
            {CORES_SUGERIDAS.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                onClick={() => setCor(sugestao)}
                aria-label={`Usar a cor ${sugestao}`}
                aria-pressed={cor.toUpperCase() === sugestao}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  cor.toUpperCase() === sugestao ? "scale-110 border-areia-900" : "border-white shadow"
                }`}
                style={{ backgroundColor: sugestao }}
              />
            ))}
            <label className="flex items-center gap-2 text-xs text-areia-600">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-areia-300 bg-white"
              />
              Outra cor
            </label>
          </div>
          {coresUsadas.has(cor.toUpperCase()) && cor.toUpperCase() !== professor?.cor.toUpperCase() && (
            <p className="mt-1 text-xs text-amber-700">Outro professor já usa esta cor.</p>
          )}
        </fieldset>

        <fieldset className="rounded-xl border border-areia-200 px-3.5 pb-3.5 pt-2">
          <legend className="px-1 text-sm font-medium text-areia-800">Regra de repasse (Hipótese H6)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["por_hora", "Por hora-aula", "Valor × horas das aulas dadas no mês."],
                ["percentual", "Percentual", "Sobre as mensalidades pagas dos alunos dele no mês."],
              ] as const
            ).map(([valorModo, rotulo, ajuda]) => (
              <label
                key={valorModo}
                className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 text-sm ${
                  modo === valorModo ? "border-saibro-400 bg-saibro-50" : "border-areia-200"
                } ${podeRepasse ? "" : "cursor-not-allowed opacity-70"}`}
              >
                <input
                  type="radio"
                  name="modo-repasse"
                  value={valorModo}
                  checked={modo === valorModo}
                  disabled={!podeRepasse}
                  onChange={() => setModo(valorModo)}
                  className="mt-0.5 accent-tijolo-600"
                />
                <span>
                  <span className="block font-medium text-areia-900">{rotulo}</span>
                  <span className="block text-xs text-areia-500">{ajuda}</span>
                </span>
              </label>
            ))}
          </div>
          <Campo
            rotulo={modo === "por_hora" ? "Valor por hora-aula (R$)" : "Percentual (%)"}
            obrigatorio
            erro={erros.valor}
            ajuda={podeRepasse ? undefined : "Só o dono altera a regra de repasse (Hipótese H9)."}
            className="mt-3"
          >
            <input
              className={classeDoCampo(erros.valor)}
              aria-invalid={Boolean(erros.valor)}
              inputMode="decimal"
              value={valor}
              disabled={!podeRepasse}
              onChange={(e) => setValor(e.target.value)}
              placeholder={modo === "por_hora" ? "0,00" : "0 a 100"}
            />
          </Campo>
        </fieldset>
      </div>
      <RodapeDoFormulario
        aoCancelar={aoFechar}
        rotuloConfirmar={professor ? "Salvar alterações" : "Cadastrar professor"}
      />
    </form>
  );
}
