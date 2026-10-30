# Módulo Estoque e Consumo

Versão de 29/10/2026. Segue a seção 2 ("Estoque") de `docs/MODELO-E-TELAS.md`.

## O que o módulo faz

O módulo cuida do balcão da arena: o que existe na prateleira, o que entra, o
que se perde e o que cada pessoa consome. Ninguém digita o saldo: **o saldo de
cada produto é sempre a soma dos movimentos** (entradas somam; vendas e perdas
subtraem; ajustes trazem o próprio sinal).

São três lugares na tela:

1. **Estoque** (`/estoque`), a tela principal:
   - indicadores: unidades em estoque, itens que precisam de reposição, vendas
     do mês (com o que ainda está em aberto nas contas) e valor do estoque;
   - cartões dos produtos com o nível do saldo em **cor + rótulo + barra**
     (esgotado, repor já, atenção, em dia), com o traço do estoque mínimo;
   - busca (ignora acentos: "agua" acha "Água"), filtro por categoria, "Só o
     que precisa repor" e "Mostrar inativos";
   - em cada cartão: **Entrada**, **Perda** e **Contagem** (ajuste de
     inventário); o nome do produto abre o detalhe;
   - botões **Novo produto** e **Lançar consumo** (escolhe a pessoa, o produto
     e a quantidade);
   - lista de compras (do mais urgente ao menos, com a quantidade sugerida e um
     botão para registrar a chegada), mais vendidos dos últimos 30 dias e
     movimentações recentes com quem registrou.
2. **Detalhe do produto** (`/estoque/produto?id=p12`): cadastro, saldo,
   indicadores do produto, todos os movimentos com o saldo depois de cada um
   (e a conta a pagar ligada a cada entrada), comentários, histórico de
   alterações e os botões Entrada, Perda, Contagem, Editar e Inativar/Reativar.
3. **Conta de consumo nas fichas** de aluno e de professor (componente
   `FichaConsumo`): o consumo da pessoa com a situação de cada item (em aberto,
   em atraso, pago, anulado), o total em aberto, o aviso do que está em atraso,
   **Lançar consumo** e **Fechar conta**.

## Regras

| Regra | Onde fica |
| --- | --- |
| Saldo = soma dos movimentos. | `regras/estoque.ts` (`saldosDeEstoque`) |
| O estoque nunca fica negativo: venda e perda acima do saldo são recusadas ("Só há 4 unidade(s) de Munhequeira em estoque."). | `garantirSaldoDeEstoque` |
| Quantidade de um movimento: número inteiro maior que zero. | `garantirQuantidadeValida` |
| **Lançar consumo** grava, numa operação só, o consumo, o movimento de venda e o lançamento a receber (categoria "Consumo", ligado pelo `consumoId`). Se algo falha, nada é gravado. | `lancarConsumo` |
| Produto **esgotado** ou **inativo** não pode ser vendido. | `garantirProdutoVendavel` |
| O consumo guarda o nome e o preço do momento da venda: editar o produto não reescreve a conta de ninguém. | `lancarConsumo` |
| **Vencimento do consumo** = dia do lançamento + prazo das Configurações (**H13**: 7 dias, valor de teste). | `lancarConsumo` |
| A situação de cada consumo vem do lançamento: **em aberto** (dentro do prazo), **em atraso** (passou do vencimento), **pago**, **anulado** (o financeiro anulou). | `consultas/estoque.ts` |
| **Fechar conta** paga de uma vez todos os consumos em aberto e em atraso da pessoa, com a data e a forma de pagamento. Não mexe nos já pagos, nos anulados, nos de outras pessoas nem em mensalidades. A data não pode ser no futuro nem antes do último consumo em aberto; a forma precisa ser uma das Configurações. | `fecharContaDeConsumo` |
| **Entrada** de mercadoria; com "Lançar conta a pagar", grava junto o lançamento a pagar (categoria "Fornecedor", favorecido, valor e vencimento), ligado ao movimento pelo campo novo `movimentoEstoqueId`. O valor sugerido é custo × quantidade e pode ser alterado. | `registrarEntrada` |
| **Perda** pede quantidade e motivo. | `registrarPerda` |
| **Ajuste de inventário**: a pessoa informa quanto contou; o sistema grava um ajuste com a diferença (positiva ou negativa) e o saldo fica igual ao contado. Contagem igual ao sistema é recusada ("não há o que ajustar"). | `ajustarInventario` |
| **Produto**: nome obrigatório e **único** (sem diferença de acentos, maiúsculas e espaços, contando também os inativos), categoria da lista, unidade obrigatória, **preços zero ou maiores**, estoque mínimo inteiro zero ou maior. | `cadastrarProduto`, `editarProduto` |
| **Venda abaixo do custo** só gera aviso no formulário; não impede de salvar (promoção, cortesia). | `vendaAbaixoDoCusto` |
| **Inativar** tira o produto do catálogo e das listas de venda, mas ele continua no histórico (consumos, movimentos, financeiro). Produto inativo não recebe entrada; perda e ajuste continuam possíveis (para zerar o que sobrou). | `inativarProduto`, `reativarProduto` |
| **Perfis (H9)**: só quem tem o módulo "estoque" nas Configurações grava (dono e recepção). O professor não vê a tela de estoque e vê a conta de consumo da ficha só para leitura. | `garantirAcessoAoEstoque` |

Apresentação (não são regras de negócio, ficam nas consultas):

- **Nível do saldo**: esgotado (0), repor já (abaixo do mínimo), atenção (até
  35% acima do mínimo), em dia. Mesmos limites do MVP.
- **Lista de compras**: produtos ativos esgotados ou abaixo do mínimo; a
  quantidade sugerida leva o saldo ao dobro do mínimo (regra do MVP).
- **Mais vendidos**: unidades vendidas nos últimos 30 dias.

### Hipóteses usadas

- **H9 (perfis)**: dono e recepção mexem no estoque; professor não. Vem de
  `configuracoes.permissoes`, então muda nas Configurações sem programar.
- **H13 (prazo do consumo)**: `configuracoes.prazoPagamentoConsumoDias` (7
  dias, valor de teste).

Nenhum parâmetro novo foi criado.

### Decisões tomadas aqui (a confirmar com a arena)

1. Venda abaixo do custo só avisa (o pedido diz "gera aviso, não bloqueia").
2. Nome de produto inativo bloqueia outro cadastro com o mesmo nome; a
   mensagem sugere reativar.
3. Produto inativo não recebe entrada (reativa-se antes).
4. Fechar conta paga tudo o que está em aberto, sem pagamento parcial.
5. O formulário de entrada não sugere vencimento para a conta a pagar: a
   pessoa digita a data do boleto.

## O que ficou de fora, e por quê

- **Comandas** (vários itens numa conta aberta): fora da v1 pelo plano.
- **Pagamento parcial ou escolher quais consumos pagar**: o "Fechar conta"
  paga tudo. Para um caso especial, registra-se o pagamento de um lançamento
  no Financeiro.
- **Desfazer um consumo lançado por engano**: lançamentos nunca se apagam; o
  Financeiro anula o lançamento (a ficha mostra "Anulado") e a recepção corrige
  o saldo com uma Contagem. Uma operação "estornar consumo" pode vir depois.
- **Cadastro de fornecedores**: o favorecido é texto livre, com sugestões dos
  fornecedores já usados.
- **Saldo inicial no cadastro**: o produto nasce com zero; o saldo vem da
  primeira entrada ou de uma contagem.
- **Imprimir ou exportar a lista de compras**: não foi pedido para a v1.

## Roteiro de teste (para quem não é programador)

Os dados são de exemplo e voltam ao início quando a página é recarregada
(F5). Navegue sempre pelos menus e botões, sem recarregar, para ver o efeito
de uma ação em outra tela.

1. Na tela de entrada, escolha **Francisco Menezes** e clique em **Entrar no
   sistema**. Clique em **Estoque** no menu.
2. Confira os cartões: **Cerveja sem álcool** mostra **0** e o rótulo
   **Esgotado**; **Munhequeira** mostra **4** e **Repor já**. A barra tem um
   traço no estoque mínimo.
3. Digite **agua** na busca: aparecem as três águas, mesmo sem acento. Apague
   a busca, clique em **Cervejas** e marque **Só o que precisa repor**: ficam
   só as cervejas abaixo do mínimo. Clique em **Todas** e desmarque a caixa.
4. Clique em **Novo produto**. Preencha: nome **Picolé de fruta**, categoria
   **Lanches**, unidade **unidade**, custo **2,50**, venda **2,00**, estoque
   mínimo **10**. Deve aparecer o aviso amarelo "A venda está abaixo do
   custo". Troque a venda para **6,00** (o aviso vira "Margem de R$ 3,50") e
   clique em **Cadastrar produto**. Deve aparecer o aviso verde e o cartão do
   picolé, com 0 e **Esgotado**.
5. **Erro de regra**: clique de novo em **Novo produto** e use o nome **agua
   mineral SEM GAS** (preencha o resto). Ao salvar, deve aparecer o aviso
   vermelho **Já existe um produto chamado "Água mineral sem gás"** e nada é
   gravado. Clique em **Cancelar**.
6. No cartão **Munhequeira**, clique em **Entrada**. Quantidade **10**, marque
   **Lançar conta a pagar ao fornecedor**, confira o fornecedor sugerido, o
   valor (custo × quantidade = R$ 120,00) e escolha um vencimento. Clique em
   **Registrar entrada**: o cartão passa a mostrar **14** e **Em dia**.
7. No cartão **Água de coco**, clique em **Perda**, escolha **Vencido** e
   clique em **Registrar perda**: o saldo cai 1.
8. No cartão **Chocolate**, clique em **Contagem** e digite **25** (o mesmo
   número do sistema). Ao salvar, deve aparecer o aviso vermelho "O saldo
   contado é igual ao do sistema (25): não há o que ajustar". Troque para
   **23** (aparece "−2 (faltou)") e salve: o cartão mostra **23**.
9. Clique em **Lançar consumo** (topo da tela). Digite **guilh** e escolha
   **Guilherme Lima**. Repare que **Cerveja sem álcool** está apagada
   (esgotada). Escolha **Água mineral sem gás**, clique em **+** (quantidade
   2) e confira "vence em" (hoje + 7 dias). Clique em **Lançar R$ 10,00 na
   conta**.
10. Em **Movimentações recentes**, as ações dos passos 6 a 9 aparecem no topo,
    com o seu nome. Na **Lista de compras**, clique no botão ao lado de
    **Cerveja sem álcool**: a quantidade já vem com a sugestão (24). Registre.
11. Clique no nome **Munhequeira**. No detalhe aparecem os movimentos com o
    saldo depois de cada um e, na entrada de hoje, a conta a pagar. Escreva um
    comentário e clique em **Adicionar comentário**.
12. Clique em **Editar cadastro**, troque o preço de venda para **30,00** e
    salve. Em **Histórico** aparece "Preço de venda: 28 → 30".
13. Clique em **Inativar** e confirme. Volte ao estoque: a munhequeira sumiu
    do catálogo, e em **Lançar consumo** ela não aparece na busca. Marque
    **Mostrar inativos**: o cartão aparece tracejado, com **Inativo** e o
    botão **Reativar**. Clique em **Reativar**.
14. No menu **Alunos**, abra **Guilherme Lima**. No quadro **Consumo no
    balcão** está a água do passo 9, **Em aberto**, com o vencimento. Clique em
    **Lançar consumo** e lance um **Chocolate**.
15. Clique em **Fechar conta**. Tente confirmar sem escolher a forma de
    pagamento (aparece "Escolha a forma de pagamento."). Escolha **Dinheiro** e
    clique em **Receber R$ …**: os consumos passam a **Pago** e o "Em aberto"
    fica em **R$ 0,00**.
16. Clique no ícone de sair (canto superior direito), entre como **Renata
    Coelho** (professora) e clique em **Estoque**: deve aparecer "O estoque não
    está liberado para o seu perfil".

## Notas para a migração ao Supabase

Tabelas (`tipos.ts` → snake_case):

- `produtos`: `check (preco_custo >= 0 and preco_venda >= 0 and
  estoque_minimo >= 0)` e índice único em `lower(unaccent(nome))` (com espaços
  normalizados), contando ativos e inativos.
- `movimentos_estoque`: `check (quantidade <> 0)` e
  `check (tipo = 'ajuste' or quantidade > 0)`. O `responsavel` hoje é o nome
  de quem gravou; no banco, guardar o id do colaborador (`auth.uid()`) e
  mostrar o nome por junção.
- `lancamentos`: coluna nova `movimento_estoque_id` (FK para
  `movimentos_estoque`), além da `consumo_id` que já existia.
- View `saldo_estoque`: soma por produto de `case tipo when 'entrada' then q
  when 'ajuste' then q else -q end`. É o que `saldosDeEstoque` faz.

Operações → funções do Postgres (cada uma numa transação, com a auditoria
pelo gatilho único):

| Operação (`operacoes/estoque.ts`) | No banco |
| --- | --- |
| `lancarConsumo` | `rpc lancar_consumo(pessoa_id, pessoa_tipo, produto_id, quantidade)`: trava o produto (`select … for update`) para duas vendas ao mesmo tempo não passarem do saldo, confere ativo e saldo, insere consumo, movimento e lançamento; vencimento = `current_date + prazo_pagamento_consumo_dias`. |
| `fecharContaDeConsumo` | `rpc fechar_conta_consumo(pessoa_id, pago_em, forma)`: `update lancamentos set pago_em, forma_pagamento where categoria = 'Consumo' and pessoa_id = … and pago_em is null and cancelado_em is null`. |
| `registrarEntrada` | `rpc registrar_entrada(produto_id, quantidade, observacao, conta jsonb)`: insere o movimento e, se houver conta, o lançamento a pagar com `movimento_estoque_id`. |
| `registrarPerda` | `rpc registrar_perda(produto_id, quantidade, motivo)`, com a mesma checagem de saldo. |
| `ajustarInventario` | `rpc ajustar_inventario(produto_id, saldo_contado, observacao)`: calcula a diferença dentro da transação. |
| `cadastrarProduto`, `editarProduto`, `inativarProduto`, `reativarProduto` | `insert`/`update` simples; as constraints acima fazem as checagens. |

Permissão (H9): política de RLS que só deixa gravar em `produtos`,
`movimentos_estoque`, `consumos` e nos lançamentos de consumo e de fornecedor
quem tem "estoque" em `configuracoes.permissoes`.

Testes: `src/lib/banco/operacoes/estoque.test.ts` tem os casos que devem virar
testes do banco (pgTAP).

## No banco (funções)

As operações do estoque já existem como funções do Postgres
(`supabase/migrations/20261030120300_funcoes_financeiro_estoque.sql`). A tela
vai chamá-las com `supabase.rpc("nome", { p_...: ... })`. Cada função é "tudo
ou nada" e devolve a mesma mensagem que a tela mostra hoje. Elas rodam com a
permissão de quem está logado (a RLS continua valendo) e gravam o nome da
operação na auditoria. Os nomes desta seção valem no lugar dos nomes
provisórios da seção "Notas para a migração".

| Operação da tela | Função no banco (parâmetros) | Devolve |
| --- | --- | --- |
| Cadastrar produto | `cadastrar_produto(p_nome, p_categoria, p_unidade, p_preco_custo, p_preco_venda, p_estoque_minimo)` | id do produto |
| Editar produto | `editar_produto(p_id, p_nome, p_categoria, p_unidade, p_preco_custo, p_preco_venda, p_estoque_minimo)` | id do produto |
| Inativar / reativar produto | `inativar_produto(p_id)` / `reativar_produto(p_id)` | id do produto |
| Registrar entrada de mercadoria | `registrar_entrada(p_produto_id, p_quantidade, p_observacao, p_conta_a_pagar)` — `p_conta_a_pagar` é opcional: `{ "favorecido", "valor", "vencimento" }` | `{ movimento_id, lancamento_id }` |
| Registrar perda | `registrar_perda(p_produto_id, p_quantidade, p_motivo)` | id do movimento |
| Ajustar inventário | `ajustar_inventario(p_produto_id, p_saldo_contado, p_observacao)` | `{ movimento_id, diferenca }` |
| Lançar consumo | `lancar_consumo(p_pessoa_id, p_pessoa_tipo, p_produto_id, p_quantidade)` — grava consumo, baixa no estoque e conta a receber juntos; trava o produto para duas vendas ao mesmo tempo não passarem do saldo | id do consumo |
| Fechar conta de consumo | `fechar_conta_de_consumo(p_pessoa_id, p_pago_em, p_forma_pagamento)` | `{ lancamentos_pagos, total }` |

Quem pode: o módulo **estoque**. Lançar consumo e fechar a conta mexem também
nas contas a receber, então exigem **financeiro**; a entrada com conta a pagar
ao fornecedor exige **financeiro_pagar** (a recepção registra a entrada, mas a
conta a pagar fica com o dono). Sem permissão, a mensagem é "Seu perfil não
tem permissão para esta operação.".

Diferenças em relação ao front de exemplo:

- Produto com preço de venda zero (cortesia) gera o consumo e a baixa no
  estoque, mas não gera conta a receber (o banco não aceita lançamento de
  valor zero).
- O nome repetido é comparado sem acentos e sem diferença de maiúsculas
  dentro da função (o índice do banco só ignora maiúsculas).

Como testar: `supabase test db` (arquivo
`supabase/tests/60_financeiro_estoque.test.sql`).
