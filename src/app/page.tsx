"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/layout/Logo";
import { IconeCadeado, IconeSeta, IconeUsuario } from "@/components/ui/Icons";
import { ARENA } from "@/lib/arena";
import { useApp } from "@/store/AppStore";

/**
 * Tela de login.
 *
 * Cada colaborador entra com o proprio e-mail e senha (Supabase Auth). Os
 * usuarios sao criados no painel do Supabase e liberados na tabela
 * `colaboradores`.
 *
 * Visual deliberadamente limpo: fundo branco e marca centralizada, sem
 * elementos decorativos competindo com o formulario.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const { situacao, erro: erroAcesso, entrar, sair } = useApp();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ja logado (ou acabou de entrar): segue para o Dashboard.
  useEffect(() => {
    if (situacao === "carregando" || situacao === "pronto") {
      router.replace("/dashboard");
    }
  }, [situacao, router]);

  async function acessar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    const falha = await entrar(email, senha);
    setEnviando(false);
    if (falha) setErro(falha);
  }

  const mensagem = erro ?? (situacao === "erro" ? erroAcesso : null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <Logo className="mx-auto h-28 w-auto" />

        <h1 className="mt-10 text-center text-xl font-semibold text-areia-900">
          Acesse sua conta
        </h1>
        <p className="mt-1.5 text-center text-sm text-areia-500">
          Cada colaborador entra com o próprio acesso.
        </p>

        <form onSubmit={acessar} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-areia-500"
            >
              E-mail
            </label>
            <div className="relative">
              <IconeUsuario className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@redtennis.com.br"
                autoComplete="username"
                className="campo pl-9"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="senha"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-areia-500"
            >
              Senha
            </label>
            <div className="relative">
              <IconeCadeado className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-areia-400" />
              <input
                id="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="campo pl-9"
              />
            </div>
          </div>

          {mensagem && (
            <p
              role="alert"
              className="rounded-xl border border-tijolo-200 bg-tijolo-50 px-3.5 py-2.5 text-sm text-tijolo-800"
            >
              {mensagem}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || situacao === "verificando"}
            className="btn-primario w-full disabled:opacity-60"
          >
            {enviando ? "Entrando…" : "Entrar no sistema"}
            <IconeSeta className="h-4 w-4" />
          </button>

          {situacao === "erro" && (
            <button
              type="button"
              onClick={() => void sair()}
              className="w-full text-center text-xs text-areia-500 underline"
            >
              Entrar com outra conta
            </button>
          )}
        </form>

        <p className="mt-10 text-center text-xs text-areia-400">
          {ARENA.endereco} · {ARENA.horarioFuncionamento}
        </p>
      </div>
    </div>
  );
}
