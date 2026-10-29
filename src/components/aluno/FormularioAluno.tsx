"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Campo, RodapeDoFormulario } from "@/components/ui/Formulario";
import { IconeAlerta } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { HOJE } from "@/lib/banco/constantes";
import { cadastrarAluno, editarAluno } from "@/lib/banco/operacoes/alunos";
import { novoId } from "@/lib/banco/regras/comum";
import type { Aluno, CategoriaRanking } from "@/lib/banco/tipos";
import {
  CATEGORIAS_RANKING,
  normalizarEmail,
  normalizarTelefone,
  possiveisDuplicados,
  professoresAtivos,
  type PossivelDuplicado,
} from "@/lib/consultas/alunos";
import { buscarProfessor } from "@/lib/consultas/base";
import { ESTILO_CATEGORIA } from "@/lib/theme";
import { useApp } from "@/store/AppStore";
import { useGravar } from "@/store/useGravar";
import { classeDoCampo } from "./estilos";

interface FormularioAlunoProps {
  aberto: boolean;
  aoFechar: () => void;
  /** Aluno a editar; sem ele, o formulario cadastra um novo. */
  aluno?: Aluno;
  /** Chamado depois de gravar, com o id do aluno (a lista abre a ficha nova). */
  aoSalvar?: (alunoId: string) => void;
}

/** Cadastro e edicao do aluno. O plano (matricula) e escolhido depois, na ficha. */
export function FormularioAluno(props: FormularioAlunoProps) {
  return (
    <Modal
      aberto={props.aberto}
      aoFechar={props.aoFechar}
      titulo={props.aluno ? "Editar cadastro" : "Novo aluno"}
      descricao={
        props.aluno
          ? props.aluno.nome
          : "Contato e ranking. O plano é escolhido depois, na ficha do aluno."
      }
    >
      <Conteudo {...props} />
    </Modal>
  );
}

function Conteudo({ aoFechar, aluno, aoSalvar }: FormularioAlunoProps) {
  const { banco } = useApp();
  const gravar = useGravar();
  const [nome, setNome] = useState(aluno?.nome ?? "");
  const [telefone, setTelefone] = useState(aluno?.telefone ?? "");
  const [email, setEmail] = useState(aluno?.email ?? "");
  const [dataNascimento, setDataNascimento] = useState(aluno?.dataNascimento ?? "");
  const [professorId, setProfessorId] = useState(aluno?.professorPrincipalId ?? "");
  const [inscrito, setInscrito] = useState(aluno?.inscritoRanking ?? false);
  const [categoria, setCategoria] = useState<CategoriaRanking | "">(aluno?.categoriaRanking ?? "");
  // Depois da primeira tentativa de salvar, os erros acompanham o que e digitado.
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const alunoId = aluno?.id;
  const professorAtualId = aluno?.professorPrincipalId;

  const professores = useMemo(() => {
    const ativos = professoresAtivos(banco);
    // Um professor que ja saiu continua aparecendo para quem ainda o tem como principal.
    const atual = professorAtualId ? buscarProfessor(banco, professorAtualId) : undefined;
    return atual && !atual.ativo ? [...ativos, atual] : ativos;
  }, [banco, professorAtualId]);

  const duplicados = useMemo(
    () => possiveisDuplicados(banco, { nome, email }, alunoId),
    [banco, nome, email, alunoId],
  );

  function validar(): Record<string, string> {
    const encontrados: Record<string, string> = {};
    if (nome.trim().length < 2) encontrados.nome = "Informe o nome do aluno.";
    if (telefone.trim() && !normalizarTelefone(telefone)) {
      encontrados.telefone = "Telefone inválido. Use o DDD e o número, ex.: (11) 98812-4471.";
    }
    if (email.trim() && !normalizarEmail(email)) {
      encontrados.email = "E-mail inválido. Use o formato nome@exemplo.com.";
    }
    if (dataNascimento && dataNascimento > HOJE) {
      encontrados.dataNascimento = "A data de nascimento não pode ser no futuro.";
    }
    if (inscrito && !categoria) encontrados.categoria = "Escolha a categoria do ranking.";
    return encontrados;
  }
  const erros = tentouSalvar ? validar() : {};

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentouSalvar(true);
    if (Object.keys(validar()).length > 0) return;

    const dados = {
      nome,
      telefone,
      email,
      dataNascimento: dataNascimento || undefined,
      professorPrincipalId: professorId || undefined,
      inscritoRanking: inscrito,
      categoriaRanking: inscrito && categoria ? categoria : undefined,
    };
    if (aluno) {
      if (gravar(editarAluno, { ...dados, id: aluno.id }, "Cadastro atualizado.")) {
        aoFechar();
        aoSalvar?.(aluno.id);
      }
      return;
    }
    // O id nasce aqui para a tela poder abrir a ficha nova logo depois.
    const id = novoId("al");
    if (gravar(cadastrarAluno, { ...dados, id }, "Aluno cadastrado. Agora escolha o plano na ficha.")) {
      aoFechar();
      aoSalvar?.(id);
    }
  }

  function arrumarTelefone() {
    const formatado = normalizarTelefone(telefone);
    if (formatado) setTelefone(formatado);
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

        {duplicados.length > 0 && <AvisoDeDuplicado duplicados={duplicados} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Telefone" erro={erros.telefone} ajuda="Com DDD. Ex.: (11) 98812-4471">
            <input
              type="tel"
              inputMode="tel"
              className={classeDoCampo(erros.telefone)}
              aria-invalid={Boolean(erros.telefone)}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              onBlur={arrumarTelefone}
              placeholder="(11) 98812-4471"
              autoComplete="off"
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
              autoComplete="off"
            />
          </Campo>
          <Campo rotulo="Data de nascimento" ajuda="Opcional." erro={erros.dataNascimento}>
            <input
              type="date"
              className={classeDoCampo(erros.dataNascimento)}
              aria-invalid={Boolean(erros.dataNascimento)}
              value={dataNascimento}
              max={HOJE}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Professor principal">
            <select
              className="campo"
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
            >
              <option value="">Sem professor principal</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.ativo ? "" : " (não está mais ativo)"}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <fieldset className="rounded-xl border border-areia-200 px-3.5 pb-3.5 pt-2">
          <legend className="px-1 text-sm font-medium text-areia-800">Ranking</legend>
          <label className="flex items-center gap-2.5 text-sm text-areia-800">
            <input
              type="checkbox"
              checked={inscrito}
              onChange={(e) => setInscrito(e.target.checked)}
              className="h-4 w-4 accent-tijolo-600"
            />
            Inscrito no ranking da arena
          </label>
          {inscrito && (
            <Campo rotulo="Categoria" obrigatorio erro={erros.categoria} className="mt-3">
              <select
                className={classeDoCampo(erros.categoria)}
                aria-invalid={Boolean(erros.categoria)}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaRanking | "")}
              >
                <option value="">Escolha a categoria…</option>
                {CATEGORIAS_RANKING.map((c) => (
                  <option key={c} value={c}>
                    {ESTILO_CATEGORIA[c].label} · {ESTILO_CATEGORIA[c].descricao}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </fieldset>
      </div>

      <RodapeDoFormulario
        aoCancelar={aoFechar}
        rotuloConfirmar={aluno ? "Salvar alterações" : "Cadastrar aluno"}
      />
    </form>
  );
}

function AvisoDeDuplicado({ duplicados }: { duplicados: PossivelDuplicado[] }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900"
    >
      <p className="flex items-center gap-2 font-semibold">
        <IconeAlerta className="h-4 w-4 shrink-0" />
        Possível cadastro repetido
      </p>
      <ul className="mt-1.5 space-y-1">
        {duplicados.slice(0, 4).map(({ aluno, mesmoNome, mesmoEmail }) => (
          <li key={aluno.id}>
            <Link href={`/alunos/${aluno.id}`} className="font-semibold underline">
              {aluno.nome}
            </Link>{" "}
            —{" "}
            {mesmoNome && mesmoEmail
              ? "mesmo nome e mesmo e-mail"
              : mesmoNome
                ? "mesmo nome"
                : "mesmo e-mail"}
            {!aluno.ativo && " · inativo"}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-amber-800">
        Confira antes de salvar. Se for outra pessoa, pode continuar.
      </p>
    </div>
  );
}
