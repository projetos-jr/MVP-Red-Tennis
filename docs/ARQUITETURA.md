# Arquitetura

Como o código está organizado, por quê, e como ele vai para o banco real.
O plano das telas e o modelo de dados estão em `docs/MODELO-E-TELAS.md`;
cada módulo tem a sua documentação em `docs/modulos/`.

## Dois modos: Supabase e demonstração

O sistema funciona de dois jeitos, escolhidos pelas variáveis de ambiente
(modelo em `.env.example`):

- **Supabase** (variáveis preenchidas): login com e-mail e senha, os dados vêm
  do banco real (cada perfil recebe só o que a RLS deixa) e cada gravação vai
  para o banco. É o modo dos ambientes de teste e produção
  (`docs/AMBIENTES.md`).
- **Demonstração** (sem variáveis): os dados de exemplo ficam em memória, o
  login escolhe a pessoa e tudo volta ao início ao recarregar a página. Serve
  para desenvolver telas sem banco e para apresentações.

As telas são as mesmas nos dois modos: elas leem um objeto `Banco` (as mesmas
tabelas do Supabase, em camelCase) e gravam por operações. Só a origem dos
dados muda.

## As quatro peças

Tudo gira em torno de quatro peças:

| Peça | Onde | Para que serve |
| --- | --- | --- |
| Banco de exemplo | `src/lib/banco/tipos.ts`, `src/lib/banco/semente/` | As tabelas e os dados de exemplo (sempre os mesmos, ancorados em "hoje"). Um arquivo de semente por módulo. |
| Regras | `src/lib/banco/regras/` | O que o banco real vai impor: conflito de quadra, extrato de reposição, situação do lançamento, saldo de estoque, ranking, chaves de torneio, validações. |
| Operações (gravação) | `src/lib/banco/operacoes/` | Cada ação da tela é uma operação "tudo ou nada": se uma regra é violada, nada é gravado e a tela recebe a mensagem pronta. A auditoria (quem, quando, antes e depois) é gravada sozinha. |
| Consultas (leitura) | `src/lib/consultas/` | As telas leem o banco só por aqui, um arquivo por módulo. |

Na tela:

```tsx
const { banco, colaborador } = useApp();      // ler
const gravar = useGravar();                    // gravar, com aviso de sucesso ou erro
const detalhe = detalheDaOcupacao(banco, id, agora, HOJE); // de consultas/agenda.ts
if (await gravar(cancelarOcupacao, { id, motivo: "CH" }, "Aula cancelada.")) fechar();
```

Gravar é **assíncrono** (o banco responde depois): sempre `await`. O lint
(`@typescript-eslint/no-misused-promises`) acusa `if (gravar(...))` sem
`await`, que seria sempre verdadeiro. Enquanto grava, `useApp().gravando` fica
verdadeiro, aparece "Salvando…" e os botões de confirmar ficam travados.

### Como uma operação funciona

`src/lib/banco/executar.ts` define o contrato: uma operação recebe o banco
atual, os dados e o contexto (quem está fazendo, agora, hoje) e devolve o
banco novo **sem alterar nada no lugar** (sempre cópias). Uma regra violada
lança `ErroDeRegra` (`exigir(condição, "mensagem")`); `executarOperacao`
transforma isso em `{ ok: false, erro }`. Depois de cada operação bem
sucedida, `auditoria.ts` compara o banco de antes com o de depois e grava um
registro para cada criação, alteração e exclusão — o mesmo papel do gatilho
único de auditoria do banco real.

Operações que cruzam módulos seguem convenções combinadas:

- **Reserva avulsa:** a agenda cria a ocupação "aguardando pagamento" e a
  cobrança; pagar a cobrança no financeiro confirma a reserva; liberar a
  reserva vencida na agenda anula a cobrança.
- **Consumo no balcão:** consumo + baixa no estoque + cobrança, numa
  operação só.
- **Aula perdida:** os créditos de reposição saem de
  `creditosPorAulaPerdida`; o uso debita o extrato depois de
  `garantirSaldoSuficiente`.
- **Lançamentos nunca são apagados:** anula-se, com motivo.

`src/lib/banco/integracao.test.ts` testa esses fluxos de ponta a ponta.

### Peças de tela comuns

`components/ui/`: `Card`, `Modal` (abre fora da página, prende o foco, Esc
fecha só a janela de cima), `Campo`, `MensagemDeErro`, `RodapeDoFormulario`,
`Confirmacao`, avisos (`useAvisos`), `Badge`, `StatCard`, `Segmentado`,
`Avatar` e os ícones. Para a tela parecer do mesmo sistema que as outras:
`CabecalhoDaPagina` e `LinkDeVolta`, `EtiquetaDeSituacao` (cores e ícones de
pago, pendente, em atraso...), `MostrarMais` (listas longas, 20 por vez),
`EstadoVazio`, `Carregando` e `BotaoFiltro`. Como usar cada um está em
`docs/revisao-de-consistencia.md`. `components/registro/`: comentários e
histórico de qualquer registro.

### Estado da aplicação

`src/store/AppStore.tsx` guarda o banco que as telas leem, quem está logado e
`executar`. No modo demonstração, recarregar a página volta tudo ao início e
o sistema abre já logado como o dono (para links diretos funcionarem). No
modo Supabase, a sessão de login fica guardada no navegador; ao voltar para a
aba depois de 2 minutos, o banco é lido de novo (outras pessoas podem ter
gravado).

### Telas montadas no navegador

As telas internas (`src/app/(app)/`) passam por `CascaDoApp`, que só as monta
no navegador. Elas dependem da data e da hora da arena: montando no
navegador, "hoje" é sempre o dia em que a página foi aberta e não há
divergência entre servidor e navegador. Com isso quase todas as rotas são
publicadas como arquivos prontos, sem gastar processamento do servidor a cada
acesso. Uma aba aberta de um dia para o outro continua com a data do dia em
que foi aberta até ser recarregada.

## Perfis e permissões

`banco.configuracoes.permissoes` diz que módulos cada perfil vê (hipótese
H9, editável em Configurações). A navegação esconde o que o perfil não vê,
`ProtecaoDeRota` mostra "Sem acesso a esta área" para endereços digitados, e
as operações recusam gravações de quem não pode. Toda rota nova de primeiro
nível precisa entrar em `MODULO_DA_ROTA` (`components/layout/abas.ts`). No
modo Supabase, quem garante de verdade são as políticas de acesso (RLS),
com as mesmas permissões (`docs/BANCO.md`).

## Testes

| Comando | O que testa | No CI |
| --- | --- | --- |
| `npm test` | Regras, operações, consultas, dados de exemplo e fluxos entre módulos (sem banco) | job `verificar` |
| `npx supabase test db` | O banco: constraints, funções, permissões por perfil e auditoria (pgTAP, `supabase/tests/`) | job `banco` |
| `npm run test:integracao` | As operações das telas gravando num Supabase de verdade | job `integracao` |

O CI (`.github/workflows/ci.yml`) roda também o lint e o build em todo pull
request.

## Como as telas falam com o Supabase (`src/lib/supabase/`)

| Peça | Arquivo | O que faz |
| --- | --- | --- |
| Cliente | `cliente.ts` | Liga ao projeto pelas variáveis de ambiente (só a chave publicável) |
| Leitura | `carregar.ts` | Lê as tabelas (em páginas de 1.000 linhas, em paralelo) para o objeto `Banco`; o histórico traz os 5.000 registros mais recentes |
| Conversão | `conversao.ts` | snake_case ↔ camelCase, `null` ↔ campo ausente, horas `08:00:00` → `08:00`, data e hora em UTC ↔ fuso da arena |
| Gravação | `gravar.ts` + `operacoes/<módulo>.ts` | Cada operação da tela é **ligada** a uma função do banco (`porFuncao`, via `rpc`) ou a uma gravação direta nas tabelas (`espelhar`, para cadastros simples) |
| Execução | `executar.ts` | Roda a operação na tela primeiro (mesmas regras e mensagens; o que ela recusar nem é enviado), grava no banco e relê as tabelas que mudaram |
| Erros | `erros.ts` | Mensagens do banco em linguagem da tela |

O banco confere tudo de novo: as funções recusam com a mesma mensagem da tela,
e a RLS barra quem não tem permissão mesmo que alguém burle a tela. O nome da
operação ("Cancelar aula") vai para o histórico nas duas formas de gravar.

Testes: `src/lib/supabase/ligacoes.test.ts` falha se alguma operação ficar sem
ligação; os testes de integração (`*.integracao.test.ts`, `npm run
test:integracao`) gravam num Supabase local de verdade. Como rodar está no
cabeçalho de `src/lib/supabase/integracao/ambiente.ts`; o CI roda os mesmos
testes (job `integracao`).

Limite conhecido: o sistema lê as tabelas inteiras ao entrar (com os dados de
exemplo, cerca de 3 segundos). Com anos de dados reais, a agenda e o
financeiro vão precisar ler só o período em uso; isso está previsto para a
semana de desempenho (meta: agenda semanal em menos de 2 segundos).

## Estilo e acessibilidade

- Cores num arquivo só: `src/lib/paleta.ts` (`saibro`, `tijolo`, `areia`,
  `cimento`, `quadra`, `bola`), lido pelo `tailwind.config.ts` e pelos
  componentes. `src/lib/theme.ts` traz as cores por tipo de ocupação (`cheia` e
  `sobreCheia` para os blocos vivos da agenda; tons claros para etiquetas e
  impressão), siglas e formatadores. `src/lib/cores.ts` calcula contraste e o
  teste `cores.test.ts` confere todos os pares de cor no CI.
- O sistema visual (onde vai cor viva, peças comuns, o que não fazer) está na
  skill `.claude/skills/design-red-tennis/SKILL.md`.
- A cor nunca é o único indicador: todo estado tem rótulo ou ícone com texto.
- Campos com rótulo, botões só com ícone com `aria-label`, ações destrutivas
  com confirmação (botão `btn-perigo`).
- Texto pequeno com contraste de pelo menos 4,5:1: para texto de apoio use
  `text-areia-500` ou mais escuro; `text-areia-400` só em ícones, traços e
  placeholders.
- Em telas de toque (tablet e celular) botões, campos e filtros têm 44px de
  altura (`@media (pointer: coarse)` em `globals.css`; para outro elemento
  clicável, a classe `alvo-de-toque`). O computador com mouse não muda.
- Fontes empacotadas com o site (`@fontsource`: Inter e Barlow Semi Condensed):
  nada é baixado de fora e o projeto roda offline.
- Conferência visual: `scripts/visual/conferir-telas.cjs` fotografa as telas
  em 3 tamanhos e 3 perfis e conta erros no console, rolagem lateral, contraste
  e alvos de toque (instruções no arquivo).

## Versão para celular e tablet

A adaptação para telefone vive abaixo do breakpoint `md` (768px), para que a
versão de computador não mude. Padrões usados:

1. **Troca de componente por CSS.** Onde a diferença é estrutural (agenda
   semanal × diária, tabela × cartões), os dois componentes ficam no DOM e a
   visibilidade é decidida por `md:hidden` / `hidden md:block`.
2. **Densidade.** `StatCard` aceita `rotuloCurto`; `CardHeader` esconde a
   descrição; textos de apoio redundantes saem de cena.
3. **Navegação.** `NavegacaoMobile` substitui as abas da topbar, com 56px de
   altura por alvo. As seções são declaradas uma vez em
   `src/components/layout/abas.ts`.

O tablet de 10" na horizontal (hipótese H11) usa a versão de computador; o
**modo quadra** da agenda (`/agenda/quadra`) foi feito para ele.

### Armadilhas registradas

- Ao adicionar uma variante de tamanho de fonte (`sm:text-2xl`), o
  `line-height` que vem junto passa a vencer um `leading-none` sem variante.
  Declare também `sm:leading-none`.
- Elementos fixos (janelas, gavetas) renderizados dentro de um contêiner
  `space-y-*` herdam a margem e saem do lugar; e dentro da topbar ficam presos
  pelo `backdrop-blur`. Por isso `Modal` e a busca rápida abrem por portal no
  `body`.
- `next dev` cria um `AGENTS.md` na raiz; ele está no `.gitignore`.

### Como conferir que o desktop não mudou

Capture as telas em 1024, 1440 e 1920px antes da mudança, repita depois e
compare as imagens. Qualquer diferença aponta vazamento de uma regra de
celular para cima do breakpoint.
