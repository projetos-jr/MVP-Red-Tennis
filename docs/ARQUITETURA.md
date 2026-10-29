# Arquitetura

Como o código está organizado, por quê, e como ele vai para o banco real.
O plano das telas e o modelo de dados estão em `docs/MODELO-E-TELAS.md`;
cada módulo tem a sua documentação em `docs/modulos/`.

## As quatro peças

O front ainda não tem banco real: usa um **banco de exemplo em memória** com
as mesmas tabelas que o Supabase terá. Tudo gira em torno de quatro peças:

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
gravar(cancelarOcupacao, { id, motivo: "CH" }, "Aula cancelada.");
```

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
`Avatar` e os ícones. `components/registro/`: comentários e histórico de
qualquer registro.

### Estado da aplicação

`src/store/AppStore.tsx` guarda o banco da sessão, quem está logado e
`executar`. Recarregar a página volta tudo ao início. A demonstração abre já
logada como o dono (para links diretos funcionarem); "Sair" deixa ninguém
logado e as telas internas mandam para o login.

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
banco real, quem garante isso são as políticas de acesso (RLS) do Supabase.

## Testes

`npm test` (vitest) roda os testes das regras e das operações de cada
módulo, das consultas, dos dados de exemplo (que precisam respeitar todas as
regras) e dos fluxos entre módulos. O CI (`.github/workflows/ci.yml`) roda
lint, testes e build em todo pull request.

## Quando o Supabase entrar

| Hoje (banco de exemplo) | No banco real |
| --- | --- |
| Cada interface de `tipos.ts` | Uma tabela, com o nome em snake_case, criada por migração em `supabase/migrations/` |
| Regras de `regras/` | Constraints (ex.: conflito de quadra com `btree_gist`), CHECKs, gatilhos e funções do Postgres |
| Operações de `operacoes/` | `insert`/`update` diretos ou funções chamadas por `rpc` (as que gravam em mais de uma tabela) |
| Auditoria automática | Gatilho único de auditoria em todas as tabelas |
| Permissões por perfil | Políticas de RLS testadas por perfil (pgTAP) |
| Consultas de `consultas/` | Consultas ao banco; as telas não mudam |
| Dados de exemplo | `supabase/seed.sql`, gerado a partir da semente |

Cada documento de módulo tem uma seção "Notas para a migração ao Supabase"
com o mapeamento detalhado. O PR #2 (primeira ligação com o Supabase, feita
sobre o modelo antigo) precisa ser refeito sobre este modelo.

## Estilo e acessibilidade

- Tokens em `tailwind.config.ts` (`saibro`, `tijolo`, `areia`) e
  `src/lib/theme.ts` (cores por tipo de ocupação, siglas, formatadores).
- A cor nunca é o único indicador: todo estado tem rótulo ou ícone com texto.
- Campos com rótulo, botões só com ícone com `aria-label`, ações destrutivas
  com confirmação.
- Nenhuma fonte externa é carregada: o projeto roda offline.

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
