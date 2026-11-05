"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { IconeInfo } from "@/components/base/Icones";
import { BotaoBola } from "@/components/base/login/BotaoBola";
import { CenaDoLogin } from "@/components/base/login/CenaDoLogin";
import { areaInicial } from "@/components/layout/abas";
import { Carregando } from "@/components/ui/Carregando";
import { IconeCadeado, IconeEmail } from "@/components/ui/Icons";
import { HORARIO_DE_FUNCIONAMENTO } from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";

/**
 * Login de verdade (modo Supabase): e-mail e senha de cada pessoa da equipe.
 * Os usuarios sao criados pelo painel do Supabase e liberados em
 * `colaboradores` (docs/AMBIENTES.md). A senha nunca passa pelo nosso codigo
 * alem desta tela: vai direto para o Supabase Auth.
 *
 * Mesma aparencia do login de demonstracao (quadra de saibro de fundo e a
 * bola de tenis para entrar); a logica de autenticacao nao mudou.
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
    <CenaDoLogin rodape={`Red Tennis · ${HORARIO_DE_FUNCIONAMENTO}`}>
      <form onSubmit={acessar} className="mt-5 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="mb-2 block text-base font-semibold text-areia-800">
            E-mail
          </label>
          <div className="relative">
            <IconeEmail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-areia-500" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              aria-invalid={erro ? true : undefined}
              aria-describedby={mensagem ? "erro-do-login" : undefined}
              className="campo h-14 pl-11 text-lg sm:h-16"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label htmlFor="senha" className="mb-2 block text-base font-semibold text-areia-800">
            Senha
          </label>
          <div className="mb-9 flex items-center gap-3 sm:gap-4">
            <div className="relative min-w-0 flex-1">
              <IconeCadeado className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-areia-500" />
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={erro ? true : undefined}
                aria-describedby={mensagem ? "erro-do-login" : undefined}
                className="campo h-14 pl-11 text-lg sm:h-16"
              />
            </div>
            <BotaoBola entrando={enviando} rotuloAcessivel="Entrar no sistema" />
          </div>
        </div>

        {mensagem && (
          <p
            id="erro-do-login"
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border-2 border-tijolo-300 bg-tijolo-50 px-4 py-3 text-base font-medium leading-snug text-tijolo-800"
          >
            <IconeInfo className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{mensagem}</span>
          </p>
        )}

        {aviso && !erro && (
          <button type="button" onClick={sair} className="link-acao alvo-de-toque mx-auto block text-base">
            Entrar com outro e-mail
          </button>
        )}

        <p className="text-center text-sm leading-relaxed text-areia-600">
          Esqueceu a senha ou ainda não tem acesso? Fale com o dono da arena.
        </p>
      </form>
    </CenaDoLogin>
  );
}
