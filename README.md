# Red Tennis — Sistema de Gestão

Sistema de gestão da arena **Red Tennis**, desenvolvido pela **UFABC Júnior**:
agenda, alunos e professores, financeiro, estoque, ranking e torneios.

A arena tem 3 quadras de saibro, 1 de cimento e 1 paredão, e funciona das 7h às
22h.

> **Estado atual:** telas, banco (Supabase) e a ligação entre eles prontos e
> testados. Com as variáveis do Supabase preenchidas, o sistema usa o banco
> real (login com e-mail e senha); sem elas, abre em **modo demonstração**,
> com dados fictícios em memória que voltam ao início a cada recarga.

---

## Como rodar

Requer **Node.js 20.9+**.

```bash
npm install
npm run dev
```

Acesse <http://localhost:3000>. Sem configuração, o sistema abre em modo
demonstração. Para usar um banco Supabase, copie `.env.example` para
`.env.local` e preencha a URL e a chave **publicável** do projeto (detalhes em
[`docs/AMBIENTES.md`](docs/AMBIENTES.md)).

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o ambiente de desenvolvimento |
| `npm test` | Roda os testes das regras, das operações e dos fluxos entre módulos |
| `npm run test:integracao` | Testa as telas gravando num Supabase local (ver `docs/ARQUITETURA.md`) |
| `npm run banco:seed` | Gera os dados de exemplo para o banco (`supabase/seed.sql`) |
| `npm run lint` | Confere o estilo do código (ESLint) |
| `npm run build` | Gera o build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run preview` | Gera o build para a Cloudflare e roda localmente, como em produção |
| `npm run deploy` | Gera o build para a Cloudflare e publica |

Todo pull request passa pelo CI (`.github/workflows/ci.yml`): lint, testes,
build, testes do banco e testes de integração com o Supabase.

---

## Os módulos

Cada módulo tem a sua documentação em `docs/modulos/`, com as regras, as
hipóteses usadas e um **roteiro de teste para quem não é programador**.

| Módulo | Telas | Documentação |
| --- | --- | --- |
| Base | Login, Início (`/dashboard`: quadras agora + mosaico de atalhos), busca rápida, Configurações, Histórico de alterações | [`base.md`](docs/modulos/base.md) |
| Agenda | `/agenda`: Diária (hoje e amanhã, por quadra, de 30 em 30 min), Quadra, Professor e Mês; modo quadra no tablet; impressão do dia | [`agenda.md`](docs/modulos/agenda.md) |
| Clientes e professores | `/alunos` (Clientes), ficha do aluno, `/professores`, ficha do professor | [`alunos.md`](docs/modulos/alunos.md) |
| Financeiro | `/financeiro`: a receber, a pagar, mensalidades, repasse dos professores | [`financeiro.md`](docs/modulos/financeiro.md) |
| Estoque | `/estoque`, detalhe do produto, consumo no balcão | [`estoque.md`](docs/modulos/estoque.md) |
| Ranking e torneios | `/ranking`, chaves dos torneios nos três formatos | [`ranking.md`](docs/modulos/ranking.md) |

O plano das telas e o modelo de dados estão em
[`docs/MODELO-E-TELAS.md`](docs/MODELO-E-TELAS.md), incluindo as **hipóteses
H1 a H14**: regras que a arena ainda não confirmou e que, por isso, ficam
ajustáveis na tela de Configurações.

**Perfis de acesso (hipótese H9):** o dono vê tudo; a recepção não vê
Configurações, Histórico nem contas a pagar; o professor vê a agenda e os
próprios alunos. No modo Supabase, cada pessoa entra com e-mail e senha e o
banco (RLS) garante as permissões; na demonstração, o login escolhe a pessoa e
aceita qualquer senha.

---

## Publicação na Cloudflare

O projeto roda na Cloudflare (Workers) por meio do adaptador
[OpenNext](https://opennext.js.org/cloudflare). A configuração fica em
`wrangler.jsonc` e `open-next.config.ts`. As telas internas são montadas no
navegador, então quase todas são publicadas como arquivos prontos, sem gastar
processamento do servidor a cada acesso.

**Pelo painel (recomendado):** em *Workers & Pages → Create → Import a
repository*, escolha este repositório e preencha:

| Campo | Valor |
| --- | --- |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |

A partir daí, cada push na `main` publica uma nova versão.

**Pela linha de comando:** `npx wrangler login` uma vez e depois
`npm run deploy`.

**Ambientes de teste e produção** (projetos do Supabase, publicação
automática das migrações, segredos e usuários da equipe): ver
[`docs/AMBIENTES.md`](docs/AMBIENTES.md).

---

## Legenda de cores da agenda

Definida com o cliente e aplicada em `src/lib/theme.ts`:

| Cor | Tipo |
| --- | --- |
| 🔴 Vermelho | Individual |
| 🔵 Azul escuro | Locação Mensal |
| 🟢 Verde | Dupla |
| 🟠 Laranja | LAP |
| 🩵 Azul claro | Locação Avulsa |
| 🟣 Roxo | Ranking (reserva de quadra) |
| 🟡 Amarelo | Plano de locação (significado a confirmar, H2) |
| ⚪ Cinza | Bloqueio de quadra |

Siglas de falta e cancelamento (editáveis em Configurações, H1): **CH**
(chuva), **24h** (aviso prévio), **FP** (falta do professor), **IAC**
(interesse da academia) e **TIP** (transferência por interesse do professor).

---

## Estrutura do projeto

```
src/
├── app/
│   ├── page.tsx              # Login
│   ├── layout.tsx            # Providers e estilos globais
│   └── (app)/                # Telas internas, com topbar e proteção por perfil
├── components/
│   ├── ui/                   # Peças comuns: Card, Modal, Formulário, Confirmação, Avisos…
│   ├── registro/             # Comentários e histórico de qualquer registro
│   ├── layout/               # Topbar, abas, atalhos do mosaico, busca rápida, casca das telas
│   ├── inicio/               # Início: faixa das quadras e mosaico
│   └── <módulo>/             # Componentes de cada módulo
├── lib/
│   ├── banco/
│   │   ├── tipos.ts          # As tabelas (mesmas do banco real)
│   │   ├── semente/          # Dados de exemplo, um arquivo por módulo
│   │   ├── regras/           # Regras do banco: conflito, reposição, situação do pagamento…
│   │   └── operacoes/        # Gravações "tudo ou nada", uma por ação da tela
│   ├── consultas/            # Leitura das telas, um arquivo por módulo
│   ├── paleta.ts             # As cores (fonte única) · cores.ts: contraste
│   ├── theme.ts              # Cores por tipo/situação e formatadores
│   └── date.ts               # Datas no fuso da arena
└── store/
    ├── AppStore.tsx          # Banco da sessão, usuário logado e `executar`
    └── useGravar.ts          # Gravar a partir de uma tela, com aviso de sucesso/erro
```

Detalhes técnicos em **[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)**; o banco (migrações, regras, permissões e testes) em **[`docs/BANCO.md`](docs/BANCO.md)**.

---

## Identidade visual

Cores **vivas** de quadra de tênis (pedido do cliente), definidas num arquivo só,
`src/lib/paleta.ts`, que o Tailwind lê:

- **`saibro`**: laranja do saibro, a cor principal (botões, mosaico, aba ativa);
- **`tijolo`**: vermelho do letreiro, só para perigo, alerta e a marca;
- **`areia`**: neutros (fundo cinza-claro, textos e bordas);
- **`cimento`**: azul/roxo da Quadra 1;
- **`quadra`**: verde de quadra (faixa das quadras, "livre", "sim");
- **`bola`**: amarelo da bola de tênis (detalhes pequenos).

O teste `src/lib/cores.test.ts` garante que todo texto continua legível
(contraste mínimo de 4,5:1). Títulos e números usam a fonte Barlow Semi
Condensed, com cara de placar, e o texto usa Inter. As duas vêm empacotadas
(`@fontsource`, licença OFL) e funcionam sem internet. As regras de uso (onde vai
cor viva e onde não vai, peças comuns, interruptor de bola de tênis...) estão na
skill `.claude/skills/design-red-tennis/SKILL.md`.

Para conferir as telas depois de uma mudança visual:
`node scripts/visual/conferir-telas.cjs` (instruções no próprio arquivo). Ele
fotografa as telas em 3 tamanhos e 3 perfis e conta erros, contraste e alvos
de toque.

O logo oficial está em `public/` em duas versões: `logo-red-tennis.webp`
(login) e `logo-red-tennis-marca.webp` (topbar). Para trocar, substitua os
arquivos mantendo os nomes, ou aponte as constantes de `src/lib/branding.ts`.

A interface funciona no computador (recepção), no tablet de 10" na horizontal
(quadra) e no celular (abaixo de 768px a navegação vai para o rodapé e as
tabelas viram cartões).

---

## Dados de exemplo

Gerados de forma **determinística** em `src/lib/banco/semente/` — sempre os
mesmos dados, com as datas ancoradas em "hoje" para o sistema parecer em uso
em qualquer dia de apresentação. Respeitam as mesmas regras do banco (há
teste para isso):

- 23 membros do ranking, com foto em `public/avatars/` (nomes reais cedidos
  pelo cliente; telefones e e-mails inventados) e 70 alunos gerados;
- 3 professores, ~170 horários fixos e as aulas de 14 semanas atrás até 12
  semanas à frente, com chuva, faltas, bloqueios, reservas aguardando
  pagamento e reposições;
- mensalidades, locações, consumo, contas a pagar e repasses;
- 24 produtos com o estoque calculado pelos movimentos;
- partidas de ranking e três torneios (um em cada formato).

Nenhum dado real de aluno deve entrar aqui (LGPD): os dados reais vão só para
o banco, com acesso restrito.

---

## Fora do escopo desta versão

- Pirâmide de ranking (os três formatos de torneio contratados estão prontos)
- Planejamento financeiro, fluxo de caixa e projeções
- Integração com banco, maquininha ou convênio (as formas de pagamento são
  só registradas)
- Matrícula online, área do cliente, site público, comandas

---

Desenvolvido pela **UFABC Júnior**.
