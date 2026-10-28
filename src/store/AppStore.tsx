"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { carregarBase, paraDataHoraLocal } from "@/lib/carregar";
import { definirBase, type BaseDeDados } from "@/lib/dados";
import { marcarConflitos } from "@/lib/selectors";
import { supabase } from "@/lib/supabase";
import type {
  Aluno,
  Comentario,
  Consumo,
  Horario,
  MovimentoEstoque,
  Produto,
  TipoPessoa,
} from "@/lib/types";

/**
 * Estado da aplicacao.
 *
 * Depois do login, carrega a base inteira do Supabase (a arena tem algumas
 * centenas de registros, cabe tranquilo na memoria) e a deixa disponivel para
 * as telas. As alteracoes aparecem na hora (otimistas) e sao gravadas no
 * banco em seguida; se a gravacao falhar, o usuario e avisado e a base e
 * recarregada para voltar ao que esta salvo.
 */

/** Dados que o formulario de novo horario entrega. */
export type NovoHorario = Omit<Horario, "id" | "temConflito">;

export interface Usuario {
  id: string;
  nome: string;
  cargo: string;
}

/**
 * - `verificando`: ainda lendo a sessao salva no navegador
 * - `deslogado`: sem sessao — tela de login
 * - `carregando`: logado, buscando os dados
 * - `pronto`: dados carregados
 * - `erro`: falha ao carregar (ou usuario sem acesso liberado)
 */
export type Situacao = "verificando" | "deslogado" | "carregando" | "pronto" | "erro";

interface AppStore {
  situacao: Situacao;
  erro: string | null;
  usuario: Usuario;
  /** Devolve a mensagem de erro, ou null se entrou. */
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;

  /** Aluno com as alteracoes feitas na sessao ja aplicadas. */
  obterAluno: (id: string) => Aluno | undefined;
  alunos: Aluno[];
  adicionarComentario: (alunoId: string, texto: string) => void;
  alternarCongelamento: (alunoId: string) => void;

  /** Grade semanal incluindo os horarios criados durante a sessao. */
  horarios: Horario[];
  adicionarHorario: (dados: NovoHorario) => Horario;
  removerHorario: (id: string) => void;

  /** Estoque com os ajustes feitos na sessao ja aplicados. */
  produtos: Produto[];
  consumos: Consumo[];
  movimentos: MovimentoEstoque[];
  registrarConsumo: (
    pessoaId: string,
    tipoPessoa: TipoPessoa,
    produtoId: string,
    quantidade: number,
  ) => void;
  registrarEntrada: (
    produtoId: string,
    quantidade: number,
    observacao?: string,
  ) => void;
  registrarPerda: (
    produtoId: string,
    quantidade: number,
    observacao?: string,
  ) => void;
}

const Contexto = createContext<AppStore | null>(null);

const USUARIO_VAZIO: Usuario = { id: "", nome: "", cargo: "" };

/** Carimbo de data/hora no fuso da arena, no formato usado pelas telas. */
function agoraISO(): string {
  return paraDataHoraLocal(new Date().toISOString());
}

function novoId(): string {
  return crypto.randomUUID();
}

/** Converte a `Quadra` das telas para o id da tabela `quadras`. */
function idQuadra(quadra: Horario["quadra"]): string {
  return String(quadra);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [situacao, setSituacao] = useState<Situacao>("verificando");
  const [erro, setErro] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario>(USUARIO_VAZIO);
  const [base, setBase] = useState<BaseDeDados | null>(null);

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [horariosBrutos, setHorariosBrutos] = useState<Horario[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);

  // --- Sessao e carga --------------------------------------------------------
  const carregar = useCallback(async (idUsuario: string) => {
    setSituacao((atual) => (atual === "pronto" ? atual : "carregando"));
    setErro(null);
    try {
      const { data: colaborador, error } = await supabase
        .from("colaboradores")
        .select("id, nome, cargo, ativo")
        .eq("id", idUsuario)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!colaborador || !colaborador.ativo) {
        throw new Error(
          "Seu acesso ainda não foi liberado. Peça ao diretor para cadastrar você como colaborador.",
        );
      }

      const nova = await carregarBase(supabase);
      definirBase(nova);
      setBase(nova);
      setAlunos(nova.alunos);
      setHorariosBrutos(nova.horarios);
      setProdutos(nova.produtos);
      setConsumos(nova.consumos);
      setMovimentos(nova.movimentos);
      setUsuario({
        id: colaborador.id,
        nome: colaborador.nome,
        cargo: colaborador.cargo,
      });
      setSituacao("pronto");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSituacao("erro");
    }
  }, []);

  /** Usuario cuja base esta carregada (ou carregando). */
  const idCarregado = useRef<string | null>(null);

  useEffect(() => {
    // Renovacoes de token tambem disparam o evento: so recarrega quando o
    // usuario muda.
    const acompanhar = (sessao: Session | null) => {
      const id = sessao?.user.id ?? null;
      if (id === idCarregado.current) {
        if (!id) setSituacao("deslogado");
        return;
      }
      idCarregado.current = id;
      if (id) void carregar(id);
      else setSituacao("deslogado");
    };

    supabase.auth.getSession().then(({ data }) => acompanhar(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) =>
      acompanhar(sessao),
    );
    return () => data.subscription.unsubscribe();
  }, [carregar]);

  const recarregar = useCallback(async () => {
    if (idCarregado.current) await carregar(idCarregado.current);
  }, [carregar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (!error) return null;
    return error.message === "Invalid login credentials"
      ? "E-mail ou senha incorretos."
      : error.message;
  }, []);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuario(USUARIO_VAZIO);
    setBase(null);
  }, []);

  /**
   * Grava no banco depois da atualizacao otimista. Em caso de falha avisa e
   * recarrega a base, desfazendo a alteracao na tela.
   */
  const gravar = useCallback(
    (descricao: string, operacao: () => PromiseLike<{ error: unknown }>) => {
      void (async () => {
        let falha: unknown = null;
        try {
          falha = (await operacao()).error;
        } catch (e) {
          falha = e;
        }
        if (!falha) return;
        console.error(descricao, falha);
        window.alert(
          `Não foi possível salvar (${descricao}). A tela foi atualizada com o que está gravado.`,
        );
        void recarregar();
      })();
    },
    [recarregar],
  );

  // --- Agenda ---------------------------------------------------------------
  const horarios = useMemo(() => marcarConflitos(horariosBrutos), [horariosBrutos]);

  const adicionarHorario = useCallback(
    (dados: NovoHorario) => {
      const novo: Horario = { ...dados, id: novoId() };
      setHorariosBrutos((atual) => [...atual, novo]);

      const professorId =
        base?.professores.find((p) => p.nome === dados.professor)?.id ?? null;

      gravar("novo horário", async () => {
        const { error } = await supabase.from("horarios").insert({
          id: novo.id,
          quadra_id: idQuadra(novo.quadra),
          dia_semana: novo.diaSemana,
          hora_inicio: novo.horaInicio,
          hora_fim: novo.horaFim,
          tipo: novo.tipo,
          professor_id: professorId,
        });
        if (error || novo.alunosIds.length === 0) return { error };
        return supabase.from("horario_alunos").insert(
          novo.alunosIds.map((alunoId, ordem) => ({
            horario_id: novo.id,
            aluno_id: alunoId,
            ordem,
          })),
        );
      });

      return novo;
    },
    [base, gravar],
  );

  const removerHorario = useCallback(
    (id: string) => {
      setHorariosBrutos((atual) => atual.filter((h) => h.id !== id));
      gravar("remover horário", () =>
        supabase.from("horarios").delete().eq("id", id),
      );
    },
    [gravar],
  );

  // --- Alunos ---------------------------------------------------------------
  const obterAluno = useCallback(
    (id: string) => alunos.find((a) => a.id === id),
    [alunos],
  );

  const adicionarComentario = useCallback(
    (alunoId: string, texto: string) => {
      const limpo = texto.trim();
      if (!limpo) return;

      const novo: Comentario = {
        id: novoId(),
        data: agoraISO(),
        autor: usuario.nome,
        texto: limpo,
      };

      setAlunos((atual) =>
        atual.map((a) =>
          a.id === alunoId ? { ...a, comentarios: [novo, ...a.comentarios] } : a,
        ),
      );
      gravar("comentário", () =>
        supabase.from("comentarios").insert({
          id: novo.id,
          aluno_id: alunoId,
          autor: novo.autor,
          texto: novo.texto,
        }),
      );
    },
    [usuario.nome, gravar],
  );

  const alternarCongelamento = useCallback(
    (alunoId: string) => {
      const aluno = alunos.find((a) => a.id === alunoId);
      if (!aluno) return;

      const congelado = !aluno.planoCongelado;
      const motivo = congelado
        ? (aluno.motivoCongelamento ?? `Congelado por ${usuario.nome}`)
        : undefined;

      setAlunos((atual) =>
        atual.map((a) =>
          a.id === alunoId
            ? { ...a, planoCongelado: congelado, motivoCongelamento: motivo }
            : a,
        ),
      );
      gravar("congelamento do plano", () =>
        supabase
          .from("alunos")
          .update({ plano_congelado: congelado, motivo_congelamento: motivo ?? null })
          .eq("id", alunoId),
      );
    },
    [alunos, usuario.nome, gravar],
  );

  // --- Estoque e consumo ----------------------------------------------------
  /** Reflete na tela o que o gatilho do banco faz com o saldo do produto. */
  const aplicarMovimentoLocal = useCallback(
    (movimento: Omit<MovimentoEstoque, "id" | "data" | "responsavel">) => {
      const delta =
        movimento.tipo === "entrada"
          ? movimento.quantidade
          : movimento.tipo === "ajuste"
            ? 0
            : -movimento.quantidade;
      const agora = agoraISO();
      setProdutos((atual) =>
        atual.map((p) =>
          p.id === movimento.produtoId
            ? {
                ...p,
                quantidade: Math.max(0, p.quantidade + delta),
                ultimaEntrada:
                  movimento.tipo === "entrada" ? agora.slice(0, 10) : p.ultimaEntrada,
              }
            : p,
        ),
      );
      setMovimentos((atual) => [
        { ...movimento, id: novoId(), data: agora, responsavel: usuario.nome },
        ...atual,
      ]);
    },
    [usuario.nome],
  );

  /**
   * Lanca consumo na conta da pessoa e da baixa no estoque na mesma acao —
   * e esse encadeamento que o cliente pediu: quem pega uma água no balcão
   * some do estoque e aparece na ficha. No banco, a funcao `lancar_consumo`
   * faz os dois passos numa transacao so.
   */
  const registrarConsumo = useCallback(
    (
      pessoaId: string,
      tipoPessoa: TipoPessoa,
      produtoId: string,
      quantidade: number,
    ) => {
      const produto = produtos.find((p) => p.id === produtoId);
      if (!produto || quantidade <= 0) return;

      setConsumos((atual) => [
        {
          id: novoId(),
          pessoaId,
          tipoPessoa,
          data: agoraISO(),
          produtoId,
          produtoNome: produto.nome,
          quantidade,
          valorUnitario: produto.precoVenda,
          status: "em aberto",
        },
        ...atual,
      ]);
      aplicarMovimentoLocal({
        produtoId,
        tipo: "venda",
        quantidade,
        observacao: "Consumo lançado na ficha",
      });
      gravar("consumo", () =>
        supabase.rpc("lancar_consumo", {
          p_aluno_id: tipoPessoa === "aluno" ? pessoaId : null,
          p_professor_id: tipoPessoa === "professor" ? pessoaId : null,
          p_produto_id: produtoId,
          p_quantidade: quantidade,
        }),
      );
    },
    [produtos, aplicarMovimentoLocal, gravar],
  );

  const lancarMovimento = useCallback(
    (
      tipo: "entrada" | "perda",
      produtoId: string,
      quantidade: number,
      observacao: string,
    ) => {
      if (quantidade <= 0) return;
      aplicarMovimentoLocal({ produtoId, tipo, quantidade, observacao });
      gravar(tipo === "entrada" ? "entrada de estoque" : "baixa de estoque", () =>
        supabase.from("movimentos_estoque").insert({
          produto_id: produtoId,
          tipo,
          quantidade,
          responsavel: usuario.nome,
          observacao,
        }),
      );
    },
    [aplicarMovimentoLocal, gravar, usuario.nome],
  );

  const registrarEntrada = useCallback(
    (produtoId: string, quantidade: number, observacao?: string) =>
      lancarMovimento(
        "entrada",
        produtoId,
        quantidade,
        observacao ?? "Reposição registrada no balcão",
      ),
    [lancarMovimento],
  );

  const registrarPerda = useCallback(
    (produtoId: string, quantidade: number, observacao?: string) =>
      lancarMovimento("perda", produtoId, quantidade, observacao ?? "Baixa por perda"),
    [lancarMovimento],
  );

  const valor = useMemo<AppStore>(
    () => ({
      situacao,
      erro,
      usuario,
      entrar,
      sair,
      recarregar,
      alunos,
      obterAluno,
      adicionarComentario,
      alternarCongelamento,
      horarios,
      adicionarHorario,
      removerHorario,
      produtos,
      consumos,
      movimentos,
      registrarConsumo,
      registrarEntrada,
      registrarPerda,
    }),
    [
      situacao,
      erro,
      usuario,
      entrar,
      sair,
      recarregar,
      alunos,
      obterAluno,
      adicionarComentario,
      alternarCongelamento,
      horarios,
      adicionarHorario,
      removerHorario,
      produtos,
      consumos,
      movimentos,
      registrarConsumo,
      registrarEntrada,
      registrarPerda,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): AppStore {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useApp precisa estar dentro de <AppProvider>.");
  }
  return contexto;
}
