"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconeInfo } from "@/components/base/Icones";
import { ESTILO_DO_PERFIL } from "@/components/base/perfis";
import { areaInicial } from "@/components/layout/abas";
import { Logo } from "@/components/layout/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { IconeCadeado, IconeSeta } from "@/components/ui/Icons";
import { NOMES_DOS_PERFIS, resumoDoAcesso } from "@/lib/consultas/configuracoes";
import { HORARIO_DE_FUNCIONAMENTO, descricaoDaArena } from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";

/**
 * Tela de login — demonstracao.
 *
 * Ainda nao ha autenticacao: escolhe-se quem entra (equipe de
 * `banco.colaboradores`) e qualquer senha serve. O perfil escolhido define o
 * que aparece no sistema (Hipotese H9). O login com e-mail e senha
 * individuais chega com o Supabase.
 *
 * Visual deliberadamente limpo: fundo branco e marca centralizada, sem
 * elementos decorativos competindo com o formulario.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const { banco, entrar } = useApp();
  const equipe = banco.colaboradores.filter((c) => c.ativo);
  const [escolhidoId, setEscolhidoId] = useState(equipe[0]?.id ?? "");
  const [senha, setSenha] = useState("");
  const escolhido = equipe.find((c) => c.id === escolhidoId) ?? equipe[0];

  function acessar(evento: FormEvent) {
    evento.preventDefault();
    if (!escolhido) return;
    entrar(escolhido.id);
    router.push(areaInicial(banco, escolhido)?.href ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <Logo className="mx-auto h-24 w-auto sm:h-28" />

        <h1 className="mt-8 text-center text-xl font-semibold text-areia-900">
          Acesse sua conta
        </h1>
        <p className="mt-1.5 text-center text-sm text-areia-500">
          Cada colaborador entra com o próprio acesso e vê as áreas do seu perfil.
        </p>

        <form onSubmit={acessar} className="mt-7 space-y-5">
          <fieldset>
            <legend className="mb-2 block text-xs font-semibold uppercase tracking-wide text-areia-500">
              Quem está entrando
            </legend>
            <div className="grid gap-2">
              {equipe.map((c) => {
                const ativo = c.id === escolhido?.id;
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-saibro-600 ${
                      ativo
                        ? "border-saibro-500 bg-saibro-50 ring-2 ring-saibro-500/20"
                        : "border-areia-200 bg-white hover:border-saibro-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="colaborador"
                      value={c.id}
                      checked={ativo}
                      onChange={() => setEscolhidoId(c.id)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">
                      <Avatar id={c.id} nome={c.nome} tamanho="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-areia-900">{c.nome}</span>
                        <span
                          className={`chip border px-2 py-0.5 text-[10px] ${ESTILO_DO_PERFIL[c.perfil]}`}
                        >
                          {NOMES_DOS_PERFIS[c.perfil]}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-areia-500">
                        {c.cargo} · {resumoDoAcesso(banco.configuracoes, c.perfil)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

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
                aria-describedby="aviso-demonstracao"
                className="campo pl-9"
              />
            </div>
          </div>

          <button type="submit" className="btn-primario w-full" disabled={!escolhido}>
            {escolhido ? `Entrar como ${escolhido.nome.split(" ")[0]}` : "Entrar no sistema"}
            <IconeSeta className="h-4 w-4" />
          </button>

          <p
            id="aviso-demonstracao"
            className="flex items-start gap-2 rounded-xl border border-areia-200 bg-areia-50 px-3.5 py-3 text-xs leading-relaxed text-areia-600"
          >
            <IconeInfo className="mt-0.5 h-4 w-4 shrink-0 text-saibro-700" />
            <span>
              <strong className="font-semibold text-areia-800">Demonstração:</strong> qualquer
              senha serve. O acesso com e-mail e senha individuais chega quando o sistema for
              ligado ao banco de dados (Supabase).
            </span>
          </p>
        </form>

        <p className="mt-8 text-center text-xs text-areia-400">
          {descricaoDaArena(banco)} · {HORARIO_DE_FUNCIONAMENTO}
        </p>
      </div>
    </div>
  );
}
