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
import { HOJE } from "@/lib/banco/constantes";
import { executarOperacao, type Operacao } from "@/lib/banco/executar";
import { BANCO_INICIAL } from "@/lib/banco/semente";
import { CONFIGURACOES_INICIAIS } from "@/lib/banco/semente/cadastros";
import type { Banco, Colaborador } from "@/lib/banco/tipos";
import { agoraArena } from "@/lib/date";
import { carregarTabelas } from "@/lib/supabase/carregar";
import { USA_SUPABASE, clienteSupabase } from "@/lib/supabase/cliente";
import { bancoVazio } from "@/lib/supabase/conversao";
import { mensagemDoErro } from "@/lib/supabase/erros";
import { executarNoSupabase } from "@/lib/supabase/executar";
import "@/lib/supabase/operacoes";

/**
 * Estado da aplicacao: o banco que as telas leem, quem esta logado e
 * `executar`, a unica forma de gravar.
 *
 * Dois modos (escolhidos pelas variaveis de ambiente, ver `.env.example`):
 *
 *  - SUPABASE: login com e-mail e senha; o banco vem do Supabase (so o que a
 *    RLS deixa cada perfil ver) e cada gravacao vai para o banco real. A
 *    operacao roda antes no banco da tela, com as mesmas regras e mensagens:
 *    o que ela recusar nem e enviado. Depois de gravar, as tabelas afetadas
 *    sao lidas de novo.
 *  - DEMONSTRACAO: dados de exemplo em memoria; o login escolhe a pessoa e
 *    tudo volta ao inicio a cada recarga da pagina.
 */
export type FonteDosDados = "supabase" | "demonstracao";

export type ResultadoGravacao =
  | { ok: true; banco: Banco; /** Id do registro principal criado, quando houver. */ id?: string }
  | { ok: false; erro: string };

interface AppStore {
  fonte: FonteDosDados;
  banco: Banco;
  /**
   * Colaborador logado (perfil, cargo, professor vinculado). Depois de
   * "Sair", `logado` fica falso e as telas internas mandam para o login.
   */
  colaborador: Colaborador;
  logado: boolean;
  /** Supabase: lendo o banco (depois do login ou ao reabrir o sistema). */
  carregando: boolean;
  /** Supabase: aviso para a tela de login (usuario nao liberado, falha ao ler). */
  aviso: string | null;
  /** Uma gravacao esta indo para o banco. */
  gravando: boolean;
  /** Demonstracao: entra como a pessoa escolhida. */
  entrar: (colaboradorId: string) => void;
  /** Supabase: login com e-mail e senha. Devolve a mensagem de erro, ou null. */
  entrarComEmail: (email: string, senha: string) => Promise<string | null>;
  sair: () => void;
  /**
   * Executa uma operacao de `src/lib/banco/operacoes/`. Devolve
   * `{ ok: false, erro }` com a mensagem pronta para a tela quando uma regra
   * recusa a gravacao. SEMPRE use com `await`.
   */
  executar: <Dados>(operacao: Operacao<Dados>, dados: Dados) => Promise<ResultadoGravacao>;
  /** Supabase: le o banco de novo (dados gravados por outras pessoas). */
  recarregar: () => Promise<void>;
}

const Contexto = createContext<AppStore | null>(null);

/** Quem aparece como "logado" antes do login no modo Supabase. */
const NINGUEM: Colaborador = { id: "", nome: "", cargo: "", perfil: "professor", ativo: false };

/** Depois de quanto tempo fora da aba o sistema le o banco de novo. */
const RECARREGAR_DEPOIS_DE_MS = 2 * 60 * 1000;

const AVISO_NAO_LIBERADO =
  "Seu login funcionou, mas seu usuário ainda não foi liberado no sistema. Peça ao dono para liberar seu e-mail.";

export function AppProvider({ children }: { children: ReactNode }) {
  return USA_SUPABASE ? (
    <ProviderSupabase>{children}</ProviderSupabase>
  ) : (
    <ProviderDemonstracao>{children}</ProviderDemonstracao>
  );
}

// ---------------------------------------------------------------------------
// Modo demonstracao
// ---------------------------------------------------------------------------

function ProviderDemonstracao({ children }: { children: ReactNode }) {
  // A demonstracao abre ja logada como o dono, para os links diretos
  // funcionarem.
  const [colaboradorId, setColaboradorId] = useState<string | null>(
    BANCO_INICIAL.colaboradores[0].id,
  );
  const [banco, setBanco] = useState<Banco>(BANCO_INICIAL);
  // Referencia sempre atualizada: duas operacoes seguidas no mesmo clique
  // enxergam o resultado uma da outra, como num banco de verdade.
  const bancoAtual = useRef(banco);

  const entrar = useCallback((id: string) => setColaboradorId(id), []);
  const sair = useCallback(() => setColaboradorId(null), []);
  const entrarComEmail = useCallback(async () => "No modo demonstração, escolha a pessoa.", []);
  const recarregar = useCallback(async () => {}, []);

  const logado = colaboradorId !== null;
  const colaborador = useMemo(
    () =>
      banco.colaboradores.find((c) => c.id === colaboradorId) ??
      banco.colaboradores[0],
    [banco.colaboradores, colaboradorId],
  );

  const executar = useCallback(
    async <Dados,>(operacao: Operacao<Dados>, dados: Dados): Promise<ResultadoGravacao> => {
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
    () => ({
      fonte: "demonstracao",
      banco,
      colaborador,
      logado,
      carregando: false,
      aviso: null,
      gravando: false,
      entrar,
      entrarComEmail,
      sair,
      executar,
      recarregar,
    }),
    [banco, colaborador, logado, entrar, entrarComEmail, sair, executar, recarregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

// ---------------------------------------------------------------------------
// Modo Supabase
// ---------------------------------------------------------------------------

function ProviderSupabase({ children }: { children: ReactNode }) {
  const [banco, setBanco] = useState<Banco>(() => bancoVazio(CONFIGURACOES_INICIAIS));
  const bancoAtual = useRef(banco);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  // Comeca "carregando": ate saber se ha uma sessao guardada no navegador.
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const gravandoAgora = useRef(false);
  const ultimaLeitura = useRef(0);

  const trocarBanco = useCallback((novo: Banco) => {
    bancoAtual.current = novo;
    setBanco(novo);
  }, []);

  /** Le o banco inteiro (login, reabertura, volta para a aba). */
  const lerTudo = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        const lidas = await carregarTabelas(clienteSupabase());
        trocarBanco({ ...bancoVazio(CONFIGURACOES_INICIAIS), ...lidas });
        ultimaLeitura.current = Date.now();
        setAviso(null);
      } catch (erro) {
        setAviso(`Não foi possível ler o banco: ${erro instanceof Error ? erro.message : mensagemDoErro(erro)}`);
      } finally {
        if (!silencioso) setCarregando(false);
      }
    },
    [trocarBanco],
  );

  // Sessao guardada no navegador e mudancas de login (outra aba, expiracao).
  useEffect(() => {
    const cliente = clienteSupabase();
    let ativo = true;
    cliente.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      const id = data.session?.user.id ?? null;
      setUsuarioId(id);
      if (id) await lerTudo();
      else setCarregando(false);
    });
    const { data } = cliente.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_OUT") {
        setUsuarioId(null);
        trocarBanco(bancoVazio(CONFIGURACOES_INICIAIS));
      } else if (sessao) {
        setUsuarioId(sessao.user.id);
      }
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, [lerTudo, trocarBanco]);

  // Ao voltar para a aba depois de um tempo, le de novo (outras pessoas
  // podem ter gravado).
  useEffect(() => {
    function aoVoltar() {
      if (
        document.visibilityState === "visible" &&
        usuarioId &&
        !gravandoAgora.current &&
        Date.now() - ultimaLeitura.current > RECARREGAR_DEPOIS_DE_MS
      ) {
        void lerTudo(true);
      }
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [usuarioId, lerTudo]);

  const colaboradorDoLogin = useMemo(
    () => banco.colaboradores.find((c) => c.id === usuarioId && c.ativo),
    [banco.colaboradores, usuarioId],
  );
  const logado = Boolean(usuarioId && colaboradorDoLogin);
  const colaborador = colaboradorDoLogin ?? NINGUEM;

  // Login feito, banco lido, mas a pessoa nao esta liberada em `colaboradores`.
  const avisoDaTela =
    aviso ?? (usuarioId && !carregando && !colaboradorDoLogin ? AVISO_NAO_LIBERADO : null);

  const entrarComEmail = useCallback(
    async (email: string, senha: string): Promise<string | null> => {
      setAviso(null);
      const { data, error } = await clienteSupabase().auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        return error.message.includes("Invalid login credentials")
          ? "E-mail ou senha incorretos."
          : mensagemDoErro(error);
      }
      setUsuarioId(data.user.id);
      await lerTudo();
      return null;
    },
    [lerTudo],
  );

  const sair = useCallback(() => {
    setUsuarioId(null);
    setAviso(null);
    trocarBanco(bancoVazio(CONFIGURACOES_INICIAIS));
    void clienteSupabase().auth.signOut();
  }, [trocarBanco]);

  const entrar = useCallback(() => {}, []);
  const recarregar = useCallback(() => lerTudo(true), [lerTudo]);

  const executar = useCallback(
    async <Dados,>(operacao: Operacao<Dados>, dados: Dados): Promise<ResultadoGravacao> => {
      // Um clique de cada vez: o segundo clique enquanto grava e ignorado.
      if (gravandoAgora.current) return { ok: false, erro: "" };
      gravandoAgora.current = true;
      setGravando(true);
      try {
        const resultado = await executarNoSupabase({
          cliente: clienteSupabase(),
          banco: bancoAtual.current,
          colaborador,
          operacao,
          dados,
        });
        if (resultado.ok) {
          trocarBanco(resultado.banco);
          // Gravou, mas a releitura falhou (internet): tenta ler tudo de novo.
          if (resultado.releituraFalhou) void lerTudo(true);
          return { ok: true, banco: resultado.banco, id: resultado.id };
        }
        // O banco recusou (regra, permissao, outra pessoa gravou antes):
        // le de novo para a tela mostrar o que esta valendo.
        if (resultado.recarregar) {
          void carregarTabelas(clienteSupabase(), [...resultado.recarregar, "auditoria"])
            .then((lidas) => trocarBanco({ ...bancoAtual.current, ...lidas }))
            .catch(() => {});
        }
        return { ok: false, erro: resultado.erro };
      } finally {
        gravandoAgora.current = false;
        setGravando(false);
      }
    },
    [colaborador, lerTudo, trocarBanco],
  );

  const valor = useMemo<AppStore>(
    () => ({
      fonte: "supabase",
      banco,
      colaborador,
      logado,
      carregando,
      aviso: avisoDaTela,
      gravando,
      entrar,
      entrarComEmail,
      sair,
      executar,
      recarregar,
    }),
    [banco, colaborador, logado, carregando, avisoDaTela, gravando, entrar, entrarComEmail, sair, executar, recarregar],
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
