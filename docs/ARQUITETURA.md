# Arquitetura e handoff para o backend

## Arquitetura atual (modelo novo, desde 29/10/2026)

O front continua sem banco real, mas os dados de exemplo já seguem o modelo
de `docs/MODELO-E-TELAS.md`, com as mesmas tabelas que o Supabase terá. São
quatro peças:

| Peça | Onde | Para que serve |
| --- | --- | --- |
| Banco de exemplo | `src/lib/banco/tipos.ts`, `src/lib/banco/semente/` | Todas as tabelas, com dados gerados (sempre os mesmos) a partir do MVP. |
| Regras | `src/lib/banco/regras/` | O que o banco real vai impor: conflito de quadra, extrato de reposição, situação do lançamento, saldo de estoque, ranking. |
| Operações (gravação) | `src/lib/banco/operacoes/` | Cada gravação é uma função "tudo ou nada". Se uma regra é violada, nada é gravado e a tela recebe a mensagem pronta. A auditoria é gravada sozinha. |
| Consultas (leitura) | `src/lib/consultas/` | As telas leem o banco só por aqui, um arquivo por módulo. |

Na tela:

```tsx
const { banco } = useApp();                // ler
const gravar = useGravar();                // gravar com aviso de sucesso/erro
const aulas = ocupacoesDoDia(banco, data); // função de src/lib/consultas/agenda.ts
gravar(cancelarOcupacao, { id, motivo: "CH" }, "Aula cancelada.");
```

Peças de tela prontas para todos os módulos: `Campo`, `MensagemDeErro` e
`RodapeDoFormulario` (`components/ui/Formulario.tsx`), `Confirmacao`,
`useAvisos` (`components/ui/Avisos.tsx`), `ComentariosDoRegistro` e
`HistoricoDoRegistro` (`components/registro/`).

**Transição.** As telas do MVP ainda usam o formato antigo
(`types.ts`, `mock-data.ts`, `selectors.ts`), que agora é só uma tradução do
banco novo feita por `src/lib/legado.ts`. Cada módulo, ao migrar as suas
telas, deixa de usar essas peças; quando nenhuma tela usar mais, as quatro
são apagadas. O que for gravado pelas operações novas não aparece nas telas
ainda não migradas.

**Testes.** `npm test` roda os testes das regras e confere que os dados de
exemplo respeitam todas elas. O CI (`.github/workflows/ci.yml`) roda lint,
testes e build em todo pull request.

**Quando o Supabase entrar:** cada tabela de `tipos.ts` vira uma tabela (em
snake_case), cada regra vira constraint, trigger ou função do Postgres, cada
operação vira uma chamada (`insert`, `update` ou `rpc`) e as consultas passam
a buscar do banco. As telas não mudam.

---

O restante deste documento descreve o MVP original e vale para as telas que
ainda não foram migradas.

## Princípio

Nenhum componente lê dados diretamente do mock. Toda leitura passa por
`src/lib/selectors.ts`. Essa camada existe justamente para ser trocada:

```
Componentes  →  selectors.ts  →  mock-data.ts        (hoje)
Componentes  →  selectors.ts  →  fetch/API           (depois)
```

Trocar o mock por chamadas HTTP reais **não deve exigir mudança nos
componentes** — apenas na implementação das funções de `selectors.ts` (e na
transformação delas em funções assíncronas).

## Contrato de dados

`src/lib/types.ts` é a referência das entidades. Resumo:

| Tipo | Descrição | Observações |
| --- | --- | --- |
| `Aluno` | Cadastro completo | Inclui histórico de aulas, pagamentos e comentários |
| `Horario` | Alocação na grade semanal | Usa `diaSemana` (0 = domingo), não data absoluta |
| `Pagamento` | Lançamento financeiro | Tem `data` (lançamento) e `dataCompensacao` (entrada no caixa) |
| `HistoricoAula` | Ocorrência de aula | `status` + `motivoFalta` + `minutosRepostos` |
| `Comentario` | Nota do gestor na ficha | Data e autor |
| `Professor` | Professor da arena | Inclui `valorHoraAula` para o cálculo de comissão |
| `Torneio` | Etapa do ranking | |

### Decisões do modelo que valem discutir antes de implementar

1. **A grade é semanal e recorrente.** `Horario` guarda `diaSemana`, não uma
   data. É como a arena opera (horários fixos), mas o backend vai precisar de
   uma camada de **exceções por data** — cancelamento, reagendamento pontual,
   feriado. O MVP já demonstra o conceito com os dias cancelados por chuva
   (`DIAS_COM_CHUVA` + `horariosDaData`).

2. **Saldo de reposição em minutos.** Não em aulas. Validade de 3 meses
   (`validadeReposicao`). O crédito nasce de um `motivoFalta` que dá direito
   (CH, aviso 24h, falta do professor, TIP).

3. **Pagante pode ser diferente do aluno.** `Pagamento.nomePagante` é campo
   próprio — no futuro provavelmente vira uma referência a um "responsável
   financeiro".

4. **Total Pass tem duas parcelas.** `valor` é o total e `valorTotalPass` é a
   parte coberta pelo convênio; o complemento é a diferença.

5. **Conflito é derivado, não armazenado.** `temConflito` é calculado por
   sobreposição na mesma quadra (`marcarConflitos` em `mock-data.ts`). No
   backend, a regra deveria impedir o conflito na escrita — e a UI continua
   sinalizando os que existirem.

## Seletores e os endpoints correspondentes

| Seletor | Endpoint sugerido |
| --- | --- |
| `listarAlunos()` / `buscarAluno(id)` | `GET /alunos`, `GET /alunos/:id` |
| `listarHorarios(filtro)` | `GET /horarios?quadra&professor&tipo` |
| `horariosDaData(data, filtro)` | `GET /agenda?data=` |
| `ocupacaoDasQuadras(data)` | `GET /quadras/ocupacao?data=` |
| `resumoDoDia(data)` | `GET /dashboard/resumo?data=` |
| `filtrarPagamentos(filtro)` | `GET /pagamentos?status&forma&busca` |
| `resumoFinanceiro(data)` | `GET /financeiro/resumo?mes=` |
| `fluxoDeCaixa(dias)` | `GET /financeiro/fluxo-caixa?dias=` |
| `totaisPorForma(data)` | `GET /financeiro/formas-pagamento?mes=` |
| `resumoProfessores()` | `GET /professores/comissoes` |
| `rankingGeral()` / `piramideDaEtapa()` | `GET /ranking`, `GET /ranking/etapa-atual` |
| `resumoAluno(aluno)` | `GET /alunos/:id/resumo` |

Escritas que o protótipo simula em memória (`src/store/AppStore.tsx`) e que
viram endpoints:

| Ação na UI | Endpoint sugerido |
| --- | --- |
| Adicionar observação na ficha | `POST /alunos/:id/comentarios` |
| Congelar / reativar plano | `PATCH /alunos/:id/plano` |
| Login do colaborador | `POST /auth/login` |

## Estado da aplicação

`src/store/AppStore.tsx` guarda o que o usuário altera durante a demonstração:
usuário logado, novos comentários e o congelamento de planos. Tudo volta ao
estado inicial a cada reload. É o ponto natural para trocar `useState` por
chamadas reais (ou por um cliente de dados como React Query).

## Datas

`src/lib/date.ts` resolve todas as datas no fuso da arena
(`America/Sao_Paulo`), independentemente do fuso da máquina. Isso mantém o valor
de "hoje" idêntico no servidor e no cliente e evita divergência de hidratação.
As telas internas rodam sob demanda (`export const dynamic = "force-dynamic"` em
`src/app/(app)/layout.tsx`) para que um HTML gerado no build não congele a data.

## Estilo e acessibilidade

- Design tokens em `tailwind.config.ts` (`saibro`, `tijolo`, `areia`) e
  `src/lib/theme.ts` (cores por tipo de alocação, siglas, formatadores).
- As cores das séries dos gráficos do Financeiro foram validadas para daltonismo
  (separação CVD ≥ 8 entre todos os pares, sobre fundo claro) e cada barra tem
  rótulo direto, para que a leitura não dependa da cor.
- O fluxo de caixa distingue "recebido" de "previsto" por **cor e hachura**, e
  oferece os mesmos dados em tabela.
- Nenhuma fonte externa é carregada: o projeto roda offline.

## Estoque e consumo

Módulo acrescentado depois da primeira rodada de validação com o cliente.

| Tipo | Descrição | Observações |
| --- | --- | --- |
| `Produto` | Item vendido no balcão | `quantidade` é o saldo; `estoqueMinimo` dispara o alerta de reposição |
| `MovimentoEstoque` | Entrada, venda, perda ou ajuste | `quantidade` é sempre positiva — o `tipo` diz se soma ou subtrai |
| `Consumo` | Item lançado na conta de uma pessoa | Serve para aluno **e** professor (`tipoPessoa`) |

Pontos de atenção para a implementação real:

1. **Lançar consumo é uma operação composta.** No MVP, `registrarConsumo`
   (em `AppStore.tsx`) cria o consumo, gera o movimento de venda e abate o saldo
   do produto na mesma ação. No backend isso precisa ser uma transação — não
   pode existir consumo sem baixa, nem baixa sem consumo.

2. **`Consumo` guarda `produtoNome` e `valorUnitario`.** É uma cópia proposital
   do estado no momento da venda: mudar o preço ou o nome do produto no cadastro
   não pode reescrever o histórico de quem já consumiu.

3. **O saldo é derivado, mas guardado.** `Produto.quantidade` é o saldo materializado;
   `MovimentoEstoque` é o razão. Vale decidir cedo qual dos dois é a fonte da
   verdade — o ideal é o razão, com o saldo como cache recalculável.

4. **O consumo em aberto ainda não entra no Financeiro.** Hoje ele aparece só na
   ficha da pessoa. O caminho natural é virar um `Pagamento` no fechamento da conta.

### Novos seletores

| Seletor | Endpoint sugerido |
| --- | --- |
| `filtrarProdutos(filtro)` / `nivelDoEstoque(produto)` | `GET /produtos?categoria&busca&alerta` |
| `resumoEstoque()` | `GET /estoque/resumo` |
| `maisVendidos(n)` | `GET /estoque/mais-vendidos?dias=` |
| `listarMovimentos()` | `GET /estoque/movimentos` |
| `consumosDaPessoa(id)` / `resumoConsumo(id)` | `GET /pessoas/:id/consumos` |
| `agendaDoProfessor(nome)` | `GET /professores/:id/agenda` |
| `quadrasLivres(dia, inicio, fim)` | `GET /agenda/disponibilidade` |

### Novas escritas

| Ação na UI | Endpoint sugerido |
| --- | --- |
| Criar horário na agenda | `POST /horarios` |
| Lançar consumo | `POST /pessoas/:id/consumos` |
| Registrar entrada de estoque | `POST /estoque/movimentos` (tipo `entrada`) |
| Registrar perda | `POST /estoque/movimentos` (tipo `perda`) |

## Grade de horários com fonte injetável

As funções de agenda em `selectors.ts` recebem um último parâmetro opcional
`fonte: Horario[]`, que por padrão é a grade do mock. A UI passa a grade do
store (`useApp().horarios`), que inclui os horários criados durante a sessão.
Com API real, esse parâmetro deixa de ser necessário — a função passa a buscar
do servidor — mas a separação entre "dados" e "regra de leitura" continua valendo.

## Pisos das quadras

`PISO_DAS_QUADRAS` em `mock-data.ts` define qual área é de saibro e qual é de
cimento (hoje, a quadra 1). O componente `Quadra3D` usa esse dado para escolher
a escala de cor. No backend isso vira um atributo da entidade quadra, junto com
outras características que a arena já diferencia (cobertura, iluminação).

## Versão para celular

A adaptação para telefone vive inteiramente abaixo do breakpoint `md` (768px),
para que a versão de computador — já validada com o cliente — não mude. Três
padrões foram usados:

1. **Troca de componente por CSS.** Onde a diferença é estrutural (agenda
   semanal × diária, tabela × cartões), os dois componentes ficam no DOM e a
   visibilidade é decidida por `md:hidden` / `hidden md:block`. É simples e não
   corre risco de divergência de hidratação, ao custo de renderizar os dois.
   Medido no build de produção com CPU 4× mais lenta, a agenda pinta em ~350ms
   e fica interativa em ~1,4s — folga suficiente para não valer a complexidade
   de renderização condicional por largura.

2. **Densidade.** `StatCard` aceita `rotuloCurto`, usado só no celular para o
   rótulo não quebrar em duas linhas; `CardHeader` esconde a descrição; textos
   de apoio e controles redundantes com a barra inferior saem de cena.

3. **Navegação.** `NavegacaoMobile` substitui as abas da topbar, com 56px de
   altura por alvo. As seções são declaradas uma única vez em
   `src/components/layout/abas.ts`, consumido pelos dois componentes.

### Armadilha registrada

Ao adicionar uma variante de tamanho de fonte (`sm:text-2xl`), o `line-height`
que vem junto dela passa a vencer um `leading-none` declarado sem variante —
porque a regra dentro de media query aparece depois no CSS gerado. Isso mudou a
altura dos cartões de indicador em 8px no desktop. A correção é declarar também
`sm:leading-none`. Vale a mesma atenção para qualquer par
`text-*` + `leading-*` quando só um dos dois ganha variante.

### Como conferir que o desktop não mudou

O procedimento usado aqui, que vale repetir a cada rodada de ajuste mobile:
capturar as telas em 1024, 1440 e 1920px antes da mudança, repetir depois e
comparar os arquivos pixel a pixel. Qualquer diferença aponta vazamento de uma
regra mobile para cima do breakpoint.
