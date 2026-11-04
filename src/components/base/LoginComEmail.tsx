"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { IconeInfo } from "@/components/base/Icones";
import { areaInicial } from "@/components/layout/abas";
import { FaixaDeQuadra } from "@/components/layout/FaixaDeQuadra";
import { Logo } from "@/components/layout/Logo";
import { Carregando } from "@/components/ui/Carregando";
import { IconeCadeado, IconeSeta } from "@/components/ui/Icons";
import { HORARIO_DE_FUNCIONAMENTO } from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";

/**
 * Login de verdade (modo Supabase): e-mail e senha de cada pessoa da equipe.
 * Os usuarios sao criados pelo painel do Supabase e liberados em
 * `colaboradores` (docs/AMBIENTES.md). A senha nunca passa pelo nosso codigo
 * alem desta tela: vai direto para o Supabase Auth.
 */
export function LoginComEmail() {
  const router = useRouter();
  const { banco, colaborador, logado, carregando, aviso, entrarComEmail, sair } = useApp();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Ja logado (sessao guardada no navegador): vai direto para o sistema.
  useEffect(() => {
    if (logado) router.replace(areaInicial(banco, colaborador)?.href ?? "/dashboard");
  }, [logado, banco, colaborador, router]);

  async function acessar(evento: FormEvent) {
    evento.preventDefault();
    if (!email.trim() || !senha) {
      setErro("Informe o e-mail e a senha.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const problema = await entrarComEmail(email, senha);
    setEnviando(false);
    if (problema) setErro(problema);
    else setSenha("");
  }

  if (logado || (carregando && !enviando)) return <Carregando telaInteira />;

  const mensagem = erro ?? aviso;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <FaixaDeQuadra className="absolute inset-x-0 top-0" />
      <div className="w-full max-w-sm animate-fade-up">
        <Logo className="mx-auto h-24 w-auto sm:h-28" />
        <FaixaDeQuadra className="mx-auto mt-6 !w-14 rounded-full" />

        <h1 className="mt-6 text-center font-display text-2xl font-bold text-areia-900">
          Acesse sua conta
        </h1>
        <p className="mt-1.5 text-center text-sm text-areia-600">
          Entre com o e-mail e a senha do seu acesso.
        </p>

        <form onSubmit={acessar} className="mt-7 space-y-5" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-areia-500"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              className="campo"
              autoFocus
            />
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
              className="flex items-start gap-2 rounded-xl border border-tijolo-200 bg-tijolo-50 px-3.5 py-3 text-xs leading-relaxed text-tijolo-800"
            >
              <IconeInfo className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{mensagem}</span>
            </p>
          )}

          <button type="submit" className="btn-primario w-full" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar no sistema"}
            <IconeSeta className="h-4 w-4" />
          </button>

          {aviso && !erro && (
            <button type="button" onClick={sair} className="link-acao mx-auto block text-xs">
              Entrar com outro e-mail
            </button>
          )}

          <p className="text-center text-xs leading-relaxed text-areia-500">
            Esqueceu a senha ou ainda não tem acesso? Fale com o dono da arena.
          </p>
        </form>

        <p className="mt-8 text-center text-xs text-areia-500">Red Tennis · {HORARIO_DE_FUNCIONAMENTO}</p>
      </div>
    </div>
  );
}
