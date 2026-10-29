# CLAUDE.md — Sistema de gestão RED Tennis (UFABC Jr.)

Instruções para o Claude Code neste repositório. Responda sempre em português do Brasil.

## Contexto completo (leia primeiro)

@docs/privado/CONTEXTO-COMPLETO-RED-TENNIS.md

O arquivo acima é confidencial (contrato, cliente, LGPD) e fica fora do Git. Se ele não foi carregado nesta sessão, avise a pessoa logo no início: peça para salvar `CONTEXTO-COMPLETO-RED-TENNIS.md` em `docs/privado/`. Sem ele, você não tem o escopo contratado, as regras de negócio, o plano de ação nem as pendências do cliente.

Em sessões na nuvem (claude.ai/code), o repositório é clonado do zero a cada sessão: o arquivo precisa ser anexado de novo e salvo em `docs/privado/`. Nessas sessões, Supabase, Cloudflare e GitHub chegam pelos conectores do claude.ai, sem `/mcp` nem `gh auth login`.

## O projeto em poucas linhas

Sistema de gestão para uma arena de tênis (4 quadras + 1 paredão, 07h–22h), feito pela UFABC Jr. a partir de um MVP só de front-end. Módulos contratados: agenda (fixos, avulsos, reposições, cancelamentos, bloqueios), ficha do aluno, financeiro (pagar, receber, status, repasse aos professores), estoque, ranking e chaveamento (eliminatória simples, grupos + eliminatória, todos contra todos). Requisitos centrais do cliente: centralização, rastreabilidade de todas as ações, e **autonomia**: o cliente não pode depender de quem fez o sistema, então documentação e portabilidade importam mais que sofisticação.

## Quem você está ajudando

Uma equipe de 1 coordenador e 3 consultores **sem formação em computação**. Por isso:

- Peça uma coisa de cada vez, explique em linguagem simples o que fez e diga como testar.
- Nunca entregue algo que a pessoa não consiga verificar. Diferencie o que foi proposto, feito, testado e validado.
- Quando faltar regra de negócio, não invente: aponte a lacuna e sugira a pergunta para o cliente. Se der para seguir, use um parâmetro configurável e registre a hipótese.
- Se o pedido estiver fora do escopo contratado, avise e indique o caminho formal (e-mail ou Termo Aditivo).
- Discorde quando houver erro ou alternativa melhor, e justifique.

Papéis: Consultor 1 = front e telas; Consultor 2 = banco, migrações, auth, RLS, agenda/reposição, chaves, importação, backup, CI; Consultor 3 = financeiro, estoque, ranking, auditoria, comentários, testes. Divisão por módulo, não por camada.

## Stack atual

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 3.
- Publicação na Cloudflare Workers via OpenNext (`wrangler.jsonc`, `open-next.config.ts`). Ainda não publicado: falta ligar o repositório no painel da Cloudflare.
- Supabase (Postgres 17, Auth, RLS), projeto "Red Tennis" (`xfludepkrcnwovnckpfc`), região sa-east-1 (São Paulo), plano Free. A ligação com o site está no PR #2 (branch `supabase`), ainda aberto.
- MVP de demonstração continua na Vercel: https://mvp-red-tennis.vercel.app

Comandos: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview` (build Cloudflare local), `npm run deploy`.

Arquivos-chave: `src/lib/types.ts` (contrato de dados), `src/lib/selectors.ts` (toda leitura passa por aqui), `src/store/AppStore.tsx` (escritas), `src/lib/theme.ts` (cores e siglas), `docs/ARQUITETURA.md`. Na branch `supabase`: `src/lib/supabase.ts`, `src/lib/carregar.ts`, `supabase/migrations/`, `supabase/seed.sql`.

## Regras técnicas (do Plano de Ação)

- **Regras críticas ficam no Postgres**: conflito de horário (exclusion constraint com btree_gist, ignorando canceladas, bloqueios na mesma regra), saldo de reposição (livro de minutos, validade de 3 meses, nunca saldo guardado à mão), repasses, avanço de chave, venda com baixa de estoque em uma transação. Validação na tela é só conforto.
- **RLS em toda tabela, sem exceção**, desde a criação, com teste por perfil (pgTAP). Nunca proponha desligar RLS.
- **Banco só muda por migração versionada** em `supabase/migrations/`. Nunca apague ou edite migração já aplicada; crie uma nova. Nada direto no banco de produção.
- Datas e horas em `timestamptz`, fuso `America/Sao_Paulo`. Aulas recorrentes viram uma linha por data.
- Auditoria genérica (trigger único, antes/depois/usuário, ninguém edita nem apaga) e tabela única de comentários ligada a qualquer registro.
- Portabilidade: o sistema precisa ser instalável em outro projeto Supabase ou no Supabase auto-hospedado com Docker, com guia testado.
- Componentes de terceiros e licenças precisam ser documentados (exigência contratual).

## Fluxo de trabalho

- Branch por tarefa (`<numero-issue>-<nome-curto>`), PR revisado por outro consultor, `main` protegida, CI verde antes do merge. Não faça push direto na `main`.
- Cada tarefa vem de uma issue do GitHub Projects com critério de aceite.
- Pronto = no ambiente de teste, revisado, respeita permissões do perfil, grava auditoria quando altera dados, documentado.

## Segurança e LGPD

- Só a chave pública (anon/publishable) do Supabase pode ir para o front. A chave `service_role`/secret, senhas e strings de conexão nunca entram no código, no Git ou no chat. Segredos de CI vão em GitHub Actions secrets.
- Não peça nem aceite senhas. Para liberar um usuário, basta o e-mail e o cargo.
- Dados reais de alunos nunca vão para o chat, arquivos locais soltos ou este repositório. Para exemplos, use dados inventados.
- Este repositório está público no momento: não grave aqui nenhum documento ou dado do cliente.

## Conectores (MCP)

`.mcp.json` configura o Supabase (projeto fixado) e a Cloudflare. Na primeira sessão, rode `/mcp` e faça login em cada um com a conta do projeto. Para o GitHub, use `gh auth login` com a conta `projetos-jr`. Antes de alterar o banco pelo MCP, liste as tabelas e as migrações para entender o estado atual.

## Divergências em aberto (não decida sozinho)

1. O plano previa SPA estática (React + Vite no Cloudflare Pages, sem SSR); o código está em Next.js com OpenNext em Workers. Avaliar `output: 'export'`.
2. O schema atual espelha o MVP (horários semanais, saldo de reposição guardado, sem auditoria, sem bloqueios, sem contas a pagar, sem chaves). Precisa evoluir para o modelo do plano.
3. Perfis: plano usa `dono`/`recepcao`/`professor`; o banco usa `diretor`/`operacao`/`professor`.
4. Ainda há um só projeto Supabase; o plano pede teste e produção separados.
