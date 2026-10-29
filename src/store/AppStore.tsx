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

/**
 * Estado da aplicacao — vive apenas em memoria (React state).
 *
 * `banco` e o banco de exemplo completo (`src/lib/banco/`) e
 * `executar(operacao, dados)` e a unica forma de gravar nele: cada operacao
 * e tudo ou nada e grava a auditoria sozinha. O que for gravado vale enquanto
 * a aba estiver aberta e volta ao estado inicial a cada recarga da pagina.
 *
 * Quando o Supabase entrar, este provider e o ponto de troca: `banco` passa a
 * vir das consultas ao banco real e `executar` passa a chamar as funcoes dele.
 */
interface AppStore {
  /** Banco de exemplo com tudo o que foi gravado na sessao. */
  banco: Banco;
  /**
   * Colaborador logado (perfil, cargo, professor vinculado). Depois de
   * "Sair", `logado` fica falso e as telas internas mandam para o login.
   */
  colaborador: Colaborador;
  logado: boolean;
  entrar: (colaboradorId: string) => void;
  sair: () => void;
  /**
   * Executa uma operacao de `src/lib/banco/operacoes/`. Devolve
   * `{ ok: false, erro }` com a mensagem pronta para a tela quando uma regra
   * recusa a gravacao.
   */
  executar: <Dados>(
    operacao: Operacao<Dados>,
    dados: Dados,
  ) => ResultadoOperacao;
}

const Contexto = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // A demonstracao abre ja logada como o dono, para os links diretos
  // funcionarem; o login real (Supabase Auth) muda isso.
  const [colaboradorId, setColaboradorId] = useState<string | null>(
    BANCO_INICIAL.colaboradores[0].id,
  );
  const [banco, setBanco] = useState<Banco>(BANCO_INICIAL);
  // Referencia sempre atualizada: duas operacoes seguidas no mesmo clique
  // enxergam o resultado uma da outra, como num banco de verdade.
  const bancoAtual = useRef(banco);

  const entrar = useCallback((id: string) => setColaboradorId(id), []);
  const sair = useCallback(() => setColaboradorId(null), []);

  const logado = colaboradorId !== null;
  const colaborador = useMemo(
    () =>
      banco.colaboradores.find((c) => c.id === colaboradorId) ??
      banco.colaboradores[0],
    [banco.colaboradores, colaboradorId],
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

  const valor = useMemo<AppStore>(
    () => ({ banco, colaborador, logado, entrar, sair, executar }),
    [banco, colaborador, logado, entrar, sair, executar],
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
