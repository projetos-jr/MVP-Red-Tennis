"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HOJE } from "@/lib/banco/constantes";
import {
  executarOperacao,
  type Operacao,
  type ResultadoOperacao,
} from "@/lib/banco/executar";
import { BANCO_INICIAL } from "@/lib/banco/semente";
import type { Banco, Colaborador } from "@/lib/banco/tipos";
import { agoraArena } from "@/lib/date";
import {
  ALUNOS,
  CONSUMOS,
  HORARIOS,
  MOVIMENTOS_ESTOQUE,
  PRODUTOS,
  USUARIOS,
} from "@/lib/mock-data";
import { marcarConflitos } from "@/lib/selectors";
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
 * Estado da aplicacao — vive apenas em memoria (React state).
 *
 * O MVP nao tem backend nem persistencia: o que o usuario altera durante a
 * demonstracao (novo horario na agenda, comentario na ficha, consumo lancado
 * no balcao, entrada de estoque, congelamento de plano) vale enquanto a aba
 * estiver aberta e volta ao estado inicial a cada reload.
 *
 * Quando houver API, este provider e o ponto natural para substituir os
 * `useState` por chamadas reais.
 *
 * MODELO NOVO: `banco` e o banco de exemplo completo (`src/lib/banco/`) e
 * `executar(operacao, dados)` e a unica forma de gravar nele — cada operacao
 * e tudo ou nada e grava a auditoria sozinha. As demais funcoes deste store
 * sao do formato antigo e saem quando as telas de cada modulo forem migradas.
 */

/** Dados que o formulario de novo horario entrega. */
export type NovoHorario = Omit<Horario, "id" | "temConflito">;

interface AppStore {
  // --- Modelo novo ---------------------------------------------------------
  /** Banco de exemplo com tudo o que foi gravado na sessao. */
  banco: Banco;
  /** Colaborador logado (perfil, cargo, professor vinculado). */
  colaborador: Colaborador;
  /**
   * Executa uma operacao de `src/lib/banco/operacoes/`. Devolve
   * `{ ok: false, erro }` com a mensagem pronta para a tela quando uma regra
   * recusa a gravacao.
   */
  executar: <Dados>(operacao: Operacao<Dados>, dados: Dados) => ResultadoOperacao;

  // --- Formato antigo (sai quando as telas forem migradas) -----------------
  usuario: (typeof USUARIOS)[number];
  entrar: (usuarioId: string) => void;
  sair: () => void;

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

/** Carimbo de data/hora local no formato usado pelos mocks. */
function agoraISO(): string {
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(
    agora.getDate(),
  )}T${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuarioId, setUsuarioId] = useState(USUARIOS[0].id);
  const [comentariosExtras, setComentariosExtras] = useState<
    Record<string, Comentario[]>
  >({});
  const [congelamentos, setCongelamentos] = useState<Record<string, boolean>>(
    {},
  );
  const [horariosExtras, setHorariosExtras] = useState<Horario[]>([]);
  const [horariosRemovidos, setHorariosRemovidos] = useState<string[]>([]);
  /** Delta aplicado ao saldo de cada produto durante a sessao. */
  const [ajustesEstoque, setAjustesEstoque] = useState<Record<string, number>>(
    {},
  );
  const [consumosExtras, setConsumosExtras] = useState<Consumo[]>([]);
  const [movimentosExtras, setMovimentosExtras] = useState<MovimentoEstoque[]>(
    [],
  );

  const usuario = useMemo(
    () => USUARIOS.find((u) => u.id === usuarioId) ?? USUARIOS[0],
    [usuarioId],
  );

  const entrar = useCallback((id: string) => setUsuarioId(id), []);
  const sair = useCallback(() => setUsuarioId(USUARIOS[0].id), []);

  // --- Modelo novo ----------------------------------------------------------
  const [banco, setBanco] = useState<Banco>(BANCO_INICIAL);
  // Referencia sempre atualizada: duas operacoes seguidas no mesmo clique
  // enxergam o resultado uma da outra, como num banco de verdade.
  const bancoAtual = useRef(banco);

  const colaborador = useMemo(
    () =>
      banco.colaboradores.find((c) => c.id === usuarioId) ?? banco.colaboradores[0],
    [banco.colaboradores, usuarioId],
  );

  const executar = useCallback(
    <Dados,>(operacao: Operacao<Dados>, dados: Dados): ResultadoOperacao => {
      const resultado = executarOperacao(bancoAtual.current, operacao, dados, {
        usuario: colaborador,
        agora: agoraArena(),
        hoje: HOJE,
      });
      if (resultado.ok) {
        bancoAtual.current = resultado.banco;
        setBanco(resultado.banco);
      }
      return resultado;
    },
    [colaborador],
  );

  // --- Agenda ---------------------------------------------------------------
  const horarios = useMemo(() => {
    const base = HORARIOS.filter((h) => !horariosRemovidos.includes(h.id));
    if (horariosExtras.length === 0 && horariosRemovidos.length === 0) {
      return HORARIOS;
    }
    return marcarConflitos([...base, ...horariosExtras]);
  }, [horariosExtras, horariosRemovidos]);

  const adicionarHorario = useCallback((dados: NovoHorario) => {
    const novo: Horario = {
      ...dados,
      id: `h-novo-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    };
    setHorariosExtras((atual) => [...atual, novo]);
    return novo;
  }, []);

  const removerHorario = useCallback((id: string) => {
    setHorariosExtras((atual) => atual.filter((h) => h.id !== id));
    setHorariosRemovidos((atual) =>
      atual.includes(id) ? atual : [...atual, id],
    );
  }, []);

  // --- Alunos ---------------------------------------------------------------
  const alunos = useMemo(
    () =>
      ALUNOS.map((aluno) => {
        const extras = comentariosExtras[aluno.id];
        const congelado = congelamentos[aluno.id];

        if (!extras && congelado === undefined) return aluno;

        return {
          ...aluno,
          planoCongelado: congelado ?? aluno.planoCongelado,
          motivoCongelamento:
            congelado === true && !aluno.motivoCongelamento
              ? "Congelado durante a sessão pelo gestor"
              : congelado === false
                ? undefined
                : aluno.motivoCongelamento,
          comentarios: extras
            ? [...extras, ...aluno.comentarios]
            : aluno.comentarios,
        };
      }),
    [comentariosExtras, congelamentos],
  );

  const obterAluno = useCallback(
    (id: string) => alunos.find((a) => a.id === id),
    [alunos],
  );

  const adicionarComentario = useCallback(
    (alunoId: string, texto: string) => {
      const limpo = texto.trim();
      if (!limpo) return;

      const novo: Comentario = {
        id: `c-novo-${alunoId}-${Date.now()}`,
        data: agoraISO(),
        autor: usuario.nome,
        texto: limpo,
      };

      setComentariosExtras((atual) => ({
        ...atual,
        [alunoId]: [novo, ...(atual[alunoId] ?? [])],
      }));
    },
    [usuario.nome],
  );

  const alternarCongelamento = useCallback((alunoId: string) => {
    setCongelamentos((atual) => {
      const base = ALUNOS.find((a) => a.id === alunoId)?.planoCongelado ?? false;
      const atualValor = atual[alunoId] ?? base;
      return { ...atual, [alunoId]: !atualValor };
    });
  }, []);

  // --- Estoque e consumo ----------------------------------------------------
  const produtos = useMemo(() => {
    if (Object.keys(ajustesEstoque).length === 0) return PRODUTOS;
    return PRODUTOS.map((produto) => {
      const delta = ajustesEstoque[produto.id];
      if (!delta) return produto;
      return {
        ...produto,
        quantidade: Math.max(0, produto.quantidade + delta),
      };
    });
  }, [ajustesEstoque]);

  const consumos = useMemo(
    () =>
      consumosExtras.length === 0 ? CONSUMOS : [...consumosExtras, ...CONSUMOS],
    [consumosExtras],
  );

  const movimentos = useMemo(
    () =>
      movimentosExtras.length === 0
        ? MOVIMENTOS_ESTOQUE
        : [...movimentosExtras, ...MOVIMENTOS_ESTOQUE],
    [movimentosExtras],
  );

  const lancarMovimento = useCallback(
    (movimento: Omit<MovimentoEstoque, "id" | "data" | "responsavel">) => {
      setMovimentosExtras((atual) => [
        {
          ...movimento,
          id: `mv-novo-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          data: agoraISO(),
          responsavel: usuario.nome,
        },
        ...atual,
      ]);
    },
    [usuario.nome],
  );

  const ajustar = useCallback((produtoId: string, delta: number) => {
    setAjustesEstoque((atual) => ({
      ...atual,
      [produtoId]: (atual[produtoId] ?? 0) + delta,
    }));
  }, []);

  /**
   * Lanca consumo na conta da pessoa e da baixa no estoque na mesma acao —
   * e esse encadeamento que o cliente pediu: quem pega uma água no balcão
   * some do estoque e aparece na ficha.
   */
  const registrarConsumo = useCallback(
    (
      pessoaId: string,
      tipoPessoa: TipoPessoa,
      produtoId: string,
      quantidade: number,
    ) => {
      const produto = PRODUTOS.find((p) => p.id === produtoId);
      if (!produto || quantidade <= 0) return;

      setConsumosExtras((atual) => [
        {
          id: `cs-novo-${Date.now()}-${Math.round(Math.random() * 1000)}`,
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

      ajustar(produtoId, -quantidade);
      lancarMovimento({
        produtoId,
        tipo: "venda",
        quantidade,
        observacao: "Consumo lançado na ficha",
      });
    },
    [ajustar, lancarMovimento],
  );

  const registrarEntrada = useCallback(
    (produtoId: string, quantidade: number, observacao?: string) => {
      if (quantidade <= 0) return;
      ajustar(produtoId, quantidade);
      lancarMovimento({
        produtoId,
        tipo: "entrada",
        quantidade,
        observacao: observacao ?? "Reposição registrada no balcão",
      });
    },
    [ajustar, lancarMovimento],
  );

  const registrarPerda = useCallback(
    (produtoId: string, quantidade: number, observacao?: string) => {
      if (quantidade <= 0) return;
      ajustar(produtoId, -quantidade);
      lancarMovimento({
        produtoId,
        tipo: "perda",
        quantidade,
        observacao: observacao ?? "Baixa por perda",
      });
    },
    [ajustar, lancarMovimento],
  );

  const valor = useMemo<AppStore>(
    () => ({
      banco,
      colaborador,
      executar,
      usuario,
      entrar,
      sair,
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
      banco,
      colaborador,
      executar,
      usuario,
      entrar,
      sair,
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
