# MVP Red Tennis — Sistema de Gestão

Protótipo navegável (front-end) do sistema de gestão da arena **Red Tennis**,
desenvolvido pela **UFABC Júnior** como peça visual da proposta comercial.

A arena tem 3 quadras de saibro, 1 de cimento e 1 paredão, e funciona das 7h às
22h. Hoje a operação depende de planilhas, papel e um sistema antigo. Este MVP
mostra como seria a operação em um sistema moderno.

> **Este projeto não tem backend.** Todos os dados são fictícios e vivem em
> memória. É um artefato de demonstração — não um produto em produção.

**Demonstração online:** <https://mvp-red-tennis.vercel.app>

---

## Como rodar

Requer **Node.js 20.9+**.

```bash
npm install
npm run dev
```

Acesse <http://localhost:3000>. Não há nenhuma configuração adicional, variável
de ambiente, banco de dados ou serviço externo.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o ambiente de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | Roda o ESLint |
| `npm run preview` | Gera o build para a Cloudflare e roda localmente, como em produção |
| `npm run deploy` | Gera o build para a Cloudflare e publica |

---

## Publicação na Cloudflare

O projeto roda na Cloudflare (Workers) por meio do adaptador
[OpenNext](https://opennext.js.org/cloudflare). A configuração fica em
`wrangler.jsonc` e `open-next.config.ts`.

**Pelo painel (recomendado):** em *Workers & Pages → Create → Import a
repository*, escolha este repositório e preencha:

| Campo | Valor |
| --- | --- |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |

A partir daí, cada push na `main` publica uma nova versão.

**Pela linha de comando:** `npx wrangler login` uma vez e depois
`npm run deploy`.

---

## As telas

| Tela | Rota | O que mostra |
| --- | --- | --- |
| **Login** | `/` | Tela branca e centralizada, com acesso individual por colaborador. Sem validação — qualquer entrada abre o sistema. |
| **Dashboard** | `/dashboard` | As 4 quadras + paredão em perspectiva 3D. O piso escurece conforme a ocupação do dia. Clicar em uma quadra abre a agenda dela. |
| **Agenda** | `/agenda` | Grade semanal (7h–22h) e panorama mensal, com filtro por quadra, professor e tipo, legenda de cores, alerta de conflito e **criação de novos horários**. |
| **Ficha do Aluno** | `/alunos/[id]` | Matrícula, histórico de aulas com motivos de falta, saldo de reposição em minutos, pagamentos, congelamento de plano, consumo no balcão e observações do gestor. |
| **Ficha do Professor** | `/professores/[id]` | Agenda da semana, alunos no plano, comissão estimada e consumo no balcão. |
| **Financeiro** | `/financeiro` | Aba **Operacional** (lançamentos, pendências, formas de pagamento) e aba **Planejamento** (fluxo de caixa, divisão por meio, comissão de professores). |
| **Estoque** | `/estoque` | Bebidas, cervejas, lanches e acessórios com saldo, estoque mínimo, lista de compras, mais vendidos e movimentações. |
| **Ranking / Torneio** | `/ranking` | Ranking geral e a chave da etapa em formato pirâmide, dividida em 4 categorias. |

A navegação principal fica na topbar. As fichas de Aluno e de Professor **não**
são abas: abrem ao clicar no nome da pessoa na Agenda, no Financeiro, no
Dashboard ou no Ranking.

### No celular

O sistema é usável de verdade no telefone — algo que nem o sistema antigo nem o
atual da arena oferecem. Abaixo de **768px** a interface se reorganiza:

| No computador | No celular |
| --- | --- |
| Abas na topbar | Barra fixa no rodapé, com alvos de toque de 56px |
| Agenda em grade semanal (7 colunas) | Agenda **dia a dia**, com régua de datas no topo |
| Tabelas de lançamentos, aulas e pagamentos | Os mesmos dados em cartões empilhados |
| Filtros e legenda sempre abertos | Recolhidos atrás de "Filtros e legenda" |
| Pirâmide do torneio em faixas fixas | Faixas largas quebram em várias linhas |

Nada disso altera a versão de computador: as mudanças vivem todas em
breakpoints `md:` para baixo, e as telas em 1024px, 1440px e 1920px continuam
pixel a pixel idênticas ao que eram antes.

### O que dá para fazer ao vivo na demonstração

O MVP não tem backend, mas as ações abaixo funcionam de verdade durante a
sessão (o estado volta ao inicial a cada recarregamento da página):

- **Marcar um horário** — botão "Novo horário" na Agenda, ou clicar direto num
  espaço livre da grade. O formulário avisa se a quadra já está ocupada naquele
  horário, e o evento criado entra na grade e no Dashboard.
- **Lançar consumo** — na ficha do aluno ou do professor. O item sai do estoque
  na mesma ação e aparece na conta da pessoa.
- **Movimentar estoque** — registrar entrada de reposição ou baixa por perda.
- **Congelar/reativar plano** e **adicionar observações** na ficha do aluno.

---

## Legenda de cores da agenda

Definida com o cliente na Reunião Diagnóstica e aplicada exatamente assim em
`src/lib/theme.ts`:

| Cor | Tipo de alocação |
| --- | --- |
| 🔴 Vermelho | Individual |
| 🔵 Azul escuro | Locação Mensal |
| 🟢 Verde | Dupla |
| 🟠 Laranja | LAP |
| 🩵 Azul claro | Locação Avulsa |
| 🟣 Roxo | Ranking (reserva de quadra) |
| 🟡 Amarelo | Plano de locação |

Siglas de falta usadas na Ficha do Aluno: **CH** (chuva), **24h** (aviso prévio),
**FP** (falta do professor), **IAC** (Interesse Academia) e **TIP**
(Transferência / Interesse Professor).

---

## Estrutura do projeto

```
src/
├── app/
│   ├── page.tsx              # Login (única tela sem topbar)
│   ├── layout.tsx            # Providers e estilos globais
│   ├── globals.css           # Base do design system
│   └── (app)/                # Telas internas, com topbar
│       ├── layout.tsx
│       ├── dashboard/
│       ├── agenda/
│       ├── alunos/[id]/
│       ├── professores/[id]/
│       ├── financeiro/
│       ├── estoque/
│       └── ranking/
├── components/
│   ├── layout/               # Topbar e logo
│   ├── ui/                   # Card, Badge, Avatar, StatCard, ícones…
│   ├── dashboard/            # Quadra em perspectiva 3D
│   ├── agenda/               # Grade semanal, mensal, chip de evento, legenda
│   ├── aluno/                # Blocos da ficha
│   ├── consumo/              # Consumo no balcão (aluno e professor)
│   ├── estoque/              # Cartão de produto e movimentações
│   ├── financeiro/           # Gráficos e tabelas
│   └── ranking/              # Pirâmide e lista
├── lib/
│   ├── types.ts              # Contrato de dados (base para o backend)
│   ├── mock-data.ts          # Todos os dados fictícios
│   ├── selectors.ts          # Camada de leitura (equivale aos endpoints)
│   ├── theme.ts              # Cores, siglas e formatadores
│   ├── date.ts               # Datas no fuso da arena
│   └── branding.ts           # Troca do logo
└── store/
    └── AppStore.tsx          # Estado em memória (horários, estoque, consumo, comentários)
```

Quem for construir o backend deve começar por
**[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)**.

---

## Identidade visual

Paleta derivada do logo da Red Tennis, definida em `tailwind.config.ts`:

- **`saibro`** — laranja/terracota da quadra de saibro (cor primária)
- **`tijolo`** — vermelho escuro do letreiro (ações e alertas)
- **`areia`** — neutros quentes (fundos e textos)

### Logo

O logo oficial da arena está em `public/`, recortado com fundo transparente,
em duas versões: `logo-red-tennis.webp` (quadra + letreiro, usado no login) e
`logo-red-tennis-marca.webp` (só a quadra, usado na topbar, onde o letreiro
ficaria ilegível). Para trocar, substitua os arquivos mantendo os nomes — ou
aponte as constantes em `src/lib/branding.ts` para os novos caminhos.

### Fotos dos alunos

As fotos dos 23 membros já estão em `public/avatars/`, nomeadas com o id de cada
pessoa. Para incluir mais alguém: salve `public/avatars/<id>.jpg` e adicione o id
em `IDS_COM_FOTO`, em `src/lib/mock-data.ts`. Quem não está nessa lista aparece
com as iniciais sobre uma cor estável derivada do id — veja
`public/avatars/README.md`.

---

## Dados fictícios

Gerados de forma **determinística** em `src/lib/mock-data.ts` — a demonstração
mostra sempre os mesmos dados, e as datas são ancoradas em "hoje" para que o
sistema pareça em uso em qualquer dia de apresentação.

- **23 membros reais** cadastrados pelo cliente, com foto em `public/avatars/`
  — são os inscritos na etapa atual do ranking, na ordem definida pela arena
  (`a01` é o primeiro colocado).
- **70 demais matriculados**, gerados a partir de listas de nomes, para que a
  grade semanal (≈ 200 horários) tenha um número plausível de pessoas.
  Todos têm ficha completa e navegável, com placeholder de iniciais no lugar
  da foto.
- **3 professores fixos**, conflitos de horário plantados de propósito e dias
  cancelados por chuva no calendário.
- **24 produtos** no estoque do balcão, com itens propositalmente abaixo do
  mínimo e um esgotado, além de ~30 dias de consumo lançado nas fichas.

---

## O que está fora do escopo

Itens levantados na Reunião Diagnóstica que **não** fazem parte deste MVP:

- Integração real com Stone, Bradesco ou Total Pass (aqui são apenas representadas)
- Backend, banco de dados ou persistência de qualquer tipo
- Autenticação real (senha, sessão, permissão por cargo)
- Chaveamento automático do ranking e atualização da pirâmide por resultados
- Área do Cliente, site público e matrícula online
- Comandas (consumo no local)
- Geração real de relatórios em PDF/Excel — o botão "Exportar" é apenas visual

---

MVP desenvolvido pela **UFABC Júnior**. Dados fictícios, para demonstração.
