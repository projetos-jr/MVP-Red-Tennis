"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconeInfo } from "@/components/base/Icones";
import { BotaoBola } from "@/components/base/login/BotaoBola";
import { CenaDoLogin } from "@/components/base/login/CenaDoLogin";
import { ESTILO_DO_PERFIL } from "@/components/base/perfis";
import { areaInicial } from "@/components/layout/abas";
import { LoginComEmail } from "@/components/base/LoginComEmail";
import { Avatar } from "@/components/ui/Avatar";
import { IconeCadeado } from "@/components/ui/Icons";
import { NOMES_DOS_PERFIS, resumoDoAcesso } from "@/lib/consultas/configuracoes";
import {
  HORARIO_DE_FUNCIONAMENTO,
  descricaoDaArena,
  equipeAtiva,
} from "@/lib/consultas/painel";
import { useApp } from "@/store/AppStore";

/**
 * Tela de login. Com o Supabase configurado, e-mail e senha
 * (`LoginComEmail`); sem ele, a escolha de pessoa da demonstracao.
 */
export default function PaginaLogin() {
  const { fonte } = useApp();
  return fonte === "supabase" ? <LoginComEmail /> : <LoginDemonstracao />;
}

/**
 * Login da demonstracao.
 *
 * Sem banco configurado (modo demonstracao): escolhe-se quem entra (equipe de
 * `banco.colaboradores`) e qualquer senha serve. O perfil escolhido define o
 * que aparece no sistema (Hipotese H9).
 *
 * Visual: a quadra de saibro de fundo e o cartao branco com a logo; entra-se
 * clicando na bola de tenis ao lado da senha (ou com Enter), como no sistema
 * antigo da arena. Cada pessoa e um botao com a foto, o nome e o selo do
 * perfil; o que o perfil ve aparece embaixo, so da pessoa escolhida.
 */
function LoginDemonstracao() {
  const router = useRouter();
  const { banco, entrar } = useApp();
  const equipe = equipeAtiva(banco);
  const [escolhidoId, setEscolhidoId] = useState(equipe[0]?.id ?? "");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const escolhido = equipe.find((c) => c.id === escolhidoId) ?? equipe[0];
  const primeiroNome = escolhido?.nome.split(" ")[0];

  function acessar(evento: FormEvent) {
    evento.preventDefault();
    if (!escolhido || entrando) return;
    setEntrando(true);
    entrar(escolhido.id);
    router.push(areaInicial(banco, escolhido)?.href ?? "/dashboard");
  }

  return (
    <CenaDoLogin rodape={`${descricaoDaArena(banco)} · ${HORARIO_DE_FUNCIONAMENTO}`}>
      <form onSubmit={acessar} className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-2.5 block text-base font-semibold text-areia-800">
            Quem está entrando?
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {equipe.map((c) => {
              const ativo = c.id === escolhido?.id;
              return (
                <label
                  key={c.id}
                  className={`relative flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 pb-2.5 pt-3 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-saibro-600 ${
                    ativo
                      ? "border-saibro-600 bg-saibro-50"
                      : "border-areia-200 bg-white hover:border-saibro-300 hover:bg-saibro-50"
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
                  <span aria-hidden="true" className="relative">
                    <Avatar id={c.id} nome={c.nome} tamanho="md" />
                    {ativo && (
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-saibro-600 ring-2 ring-white">
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
                          <path d="M2.5 6.2l2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-base font-semibold leading-tight text-areia-900">
                    {c.nome.split(" ")[0]}
                  </span>
                  <span className={`chip border px-2 py-0.5 text-xs ${ESTILO_DO_PERFIL[c.perfil]}`}>
                    {NOMES_DOS_PERFIS[c.perfil]}
                  </span>
                </label>
              );
            })}
          </div>
          {escolhido && (
            <p aria-live="polite" className="mt-2.5 text-sm leading-snug text-areia-600">
              <strong className="font-semibold text-areia-800">{escolhido.nome}</strong> ·{" "}
              {escolhido.cargo} · {resumoDoAcesso(banco.configuracoes, escolhido.perfil)}
            </p>
          )}
        </fieldset>

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
                aria-describedby="aviso-demonstracao"
                className="campo h-14 pl-11 text-lg sm:h-16"
              />
            </div>
            <BotaoBola
              entrando={entrando}
              desabilitado={!escolhido}
              rotuloAcessivel={primeiroNome ? `Entrar como ${primeiroNome}` : "Entrar no sistema"}
            />
          </div>
        </div>

        <p
          id="aviso-demonstracao"
          className="flex items-start gap-2 rounded-xl bg-areia-100 px-3.5 py-3 text-sm leading-snug text-areia-700"
        >
          <IconeInfo className="mt-0.5 h-4 w-4 shrink-0 text-saibro-700" />
          <span>
            <strong className="font-semibold text-areia-900">Demonstração:</strong> qualquer senha
            serve e nada é gravado de verdade.
          </span>
        </p>
      </form>
    </CenaDoLogin>
  );
}
