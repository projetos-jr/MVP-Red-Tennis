# Módulo Ranking e Torneios

Versão de 29/10/2026. Segue a seção "Ranking e torneios" de
`docs/MODELO-E-TELAS.md` e a arquitetura descrita em `docs/ARQUITETURA.md`.

## 1. O que o módulo faz

**Ranking.** O ranking não é digitado: ele é calculado a partir das partidas
com resultado, com a pontuação das Configurações (H7). A tela mostra o pódio,
a posição, a foto, o nome (que abre a ficha), a categoria (A a D), os pontos,
as vitórias, as derrotas e quantas posições cada um ganhou ou perdeu nos
últimos 7 dias. Dá para filtrar por categoria: aí as posições passam a ser as
da categoria.

**Partidas de ranking.** A recepção pode:

- registrar o resultado de uma partida que já aconteceu (jogador A, jogador B,
  data, placar, vencedor ou W.O.);
- marcar uma partida para hoje ou depois, com reserva de quadra opcional. A
  reserva vira uma ocupação do tipo "Ranking" (roxa na agenda), com os dois
  jogadores, e fica ligada à partida;
- registrar depois o resultado da partida marcada, corrigir um resultado ou
  excluir a partida (a correção e a exclusão ficam no histórico de alterações);
- comentar qualquer partida e ver o histórico dela.

**Torneios.** A pirâmide do MVP saiu (fora da v1). No lugar:

- lista de torneios com situação, formato, data, inscritos, andamento e campeão;
- criar e editar torneio: nome, data, formato, categoria (ou livre), simples ou
  duplas, inscrições e cabeças de chave, com uma prévia do tamanho da chave;
- gerar a chave nos três formatos (eliminatória simples, grupos +
  eliminatória, todos contra todos) e desfazê-la enquanto não há resultado;
- registrar o resultado de cada jogo: o vencedor vai sozinho para o jogo
  seguinte; W.O.; correção e "apagar resultado" enquanto o jogo seguinte não foi
  jogado;
- classificação dos grupos e do todos contra todos com os critérios de
  desempate das Configurações (H8);
- situação do torneio: inscrições abertas → em andamento (ao gerar a chave) →
  encerrado (final decidida, ou todos os jogos do todos contra todos
  jogados), com o campeão em destaque;
- comentários e histórico do torneio e de cada jogo.

### Telas

| Endereço | O que tem |
| --- | --- |
| `/ranking` | Indicadores, abas, pódio, ranking geral com filtro por categoria, próximas partidas, resumo dos torneios. |
| `/ranking?aba=partidas` | Histórico de partidas (ranking e torneio) com busca, tipo, situação e período. |
| `/ranking?aba=torneios` | Todos os torneios em cartões. |
| `/ranking/torneio?id=t-2` | Um torneio: dados, chave, grupos ou matriz, inscrições, comentários e histórico. |

No celular, a chave da eliminatória mostra uma rodada por vez (botões com o
nome da rodada) e a matriz do todos contra todos dá lugar à lista de jogos por
rodada.

### Peças de código

| Peça | Arquivo |
| --- | --- |
| Regras do placar e do ranking | `src/lib/banco/regras/ranking.ts` |
| Geradores de chave, avanço, classificação | `src/lib/banco/regras/torneios.ts` |
| Gravações (operações) | `src/lib/banco/operacoes/ranking.ts` |
| Leituras das telas (consultas) | `src/lib/consultas/ranking.ts` |
| Dados de exemplo | `src/lib/banco/semente/ranking.ts` |
| Telas | `src/app/(app)/ranking/page.tsx`, `src/app/(app)/ranking/torneio/page.tsx` |
| Componentes | `src/components/ranking/` |
| Testes | `src/lib/banco/regras/torneios.test.ts`, `src/lib/banco/operacoes/ranking.test.ts` |

Operações: `registrarPartida`, `marcarPartida`, `registrarResultadoDePartida`,
`corrigirResultadoDePartida`, `excluirPartida`, `criarTorneio`,
`editarTorneio`, `gerarChaveDoTorneio`, `desfazerChaveDoTorneio`,
`registrarResultadoDeTorneio`, `corrigirResultadoDeTorneio`,
`apagarResultadoDeTorneio`.

## 2. Regras e hipóteses usadas

### Pontuação (H7)

- Vitória vale `pontosVitoria` e derrota vale `pontosDerrota` (hoje 10 e 2,
  valores de teste). Quem perde por W.O. não ganha os pontos da derrota.
- Partidas de torneio só contam se `torneioContaParaRanking` estiver ligado
  (hoje está desligado). Partidas de duplas nunca contam: o ranking é
  individual.
- Desempate no ranking geral: mais vitórias, depois ordem alfabética (regra que
  já existia em `calcularRanking`, que não mudou).

### Partida de ranking

- Os dois jogadores precisam ser diferentes, estar ativos e inscritos no
  ranking.
- Resultado só com data de hoje ou antes; partida marcada só para hoje ou
  depois.
- Placar: sets separados por espaço, sempre com os games do jogador A primeiro
  ("6/4 3/6 10/8"; aceita também "6x4" e "6-4" e tie-break como "7/6(5)"). O
  placar é recusado se: um set terminar empatado; os sets ficarem empatados
  (1 a 1); por ele quem venceu for o outro lado; o último set não for de quem
  venceu. Na vitória por W.O. o placar não é pedido (fica "W.O.").
- Reserva de quadra: só nas quadras 1 a 4 (o paredão não recebe partidas),
  das 07h às 22h, e a quadra precisa estar livre (`garantirQuadraLivre`, a mesma
  regra da agenda; a mensagem diz quem ocupa). A tela avisa o conflito antes de
  salvar.
- Partida com reserva: o resultado só entra a partir do dia da reserva, e a
  data da partida é a da reserva.
- Excluir uma partida com reserva futura cancela a reserva junto (motivo
  "Partida de ranking excluída").
- A reserva de partida de ranking **não gera cobrança**, como nos dados de
  exemplo do MVP. Se a arena cobrar, entra como lançamento "Locação" (a
  confirmar).

### Chave do torneio

- **Eliminatória simples:** a chave tem o tamanho da potência de 2 seguinte
  (6 inscrições → chave de 8). As vagas que sobram são folgas e ficam com os
  primeiros cabeças de chave, que entram direto na 2ª rodada. O cabeça 1 fica
  no topo e o 2 na base (só se encontram na final); na estreia cada um enfrenta
  o número "espelhado" (1 × 8, 4 × 5). Folga não vira partida: quem a recebe já
  nasce na partida da 2ª rodada. Com N inscrições há sempre N − 1 partidas.
- **Sorteio:** quem não é cabeça de chave é sorteado ao gerar a chave. Para
  sortear de novo, desfaça a chave e gere outra vez.
- **Grupos + eliminatória:** grupos de 3 ou 4 (mínimo de 6 inscrições), em
  "serpentina" (A B | B A | A B…), para os cabeças caírem em grupos diferentes.
  Dentro do grupo, todos contra todos. Passam `classificadosPorGrupo` de cada
  grupo (H8, hoje 2). A fase eliminatória é montada sozinha quando o último jogo
  dos grupos é registrado: os 1ºs colocados ficam nas vagas dos cabeças de
  chave e cada um dos outros vai para a vaga mais longe de quem é do mesmo
  grupo (com 2 grupos: 1A × 2B e 2A × 1B).
- **Todos contra todos:** cada inscrição joga uma vez com cada outra, em
  rodadas (método do círculo: ninguém joga duas vezes na mesma rodada; com
  número ímpar, um fica de folga por rodada). 5 inscrições = 10 partidas em
  5 rodadas.
- Cabeças de chave são numerados 1, 2, 3… sem repetir nem pular. Ninguém
  aparece em duas inscrições. Duplas têm dois jogadores diferentes.
- Máximo de 64 inscrições por torneio.

### Resultado de torneio

- Gravar o resultado leva o vencedor para o lado certo do jogo seguinte.
- Corrigir ou apagar um resultado só é possível enquanto o jogo seguinte não
  foi jogado; nos grupos, enquanto a fase eliminatória não começou. Se um
  resultado de grupo mudar com a eliminatória já montada (e sem jogos), ela é
  remontada.
- W.O. dá a vitória a quem compareceu (H8).
- Desfazer a chave só é possível sem nenhum resultado registrado.

### Classificação (H8) e hipóteses novas, a confirmar com a arena

Os critérios vêm de `criteriosDesempate`, na ordem das Configurações (hoje:
vitórias, confronto direto, saldo de sets, saldo de games). Para aplicá-los foi
preciso decidir alguns detalhes, que ficam registrados aqui como parte de H8:

1. **Confronto direto com três ou mais empatados:** conta só os jogos entre os
   empatados. Quando um critério separa parte deles, quem continua empatado
   recomeça a lista de critérios (o confronto direto é refeito só entre eles).
2. **W.O. no saldo:** conta como 6/0 6/0 para quem venceu.
3. **Super tie-break** (set decisivo até 10 pontos, como 10/8): conta como um
   set e como 1 game para quem venceu (regra da ITF).
4. **Empate em todos os critérios:** fica à frente o cabeça de chave e depois a
   ordem de inscrição, que é a ordem da lista de inscrições na tela do torneio
   (alternativa: sorteio).
5. O número de classificados por grupo é lido das Configurações no momento em
   que a fase eliminatória é montada.

Texto desconhecido na lista de critérios é ignorado. Os textos reconhecidos
são os que contêm "vitória", "confronto", "set" ou "game".

### Perfis (H9)

Só quem tem o módulo "ranking" nas permissões grava (hoje: dono e recepção).
O perfil de professor recebe "Seu perfil não tem acesso ao ranking e aos
torneios." (A barra de abas ainda mostra o Ranking para todos; esconder a aba
é do módulo de configurações/navegação.)

### H14 — pontuação herdada do sistema atual (não implementada)

A hipótese diz que, na importação, cada jogador recebe um lançamento de
"pontos iniciais" com a pontuação do sistema atual. Como eu faria:

1. Tabela nova `ranking_lancamentos` (no front, `Banco.rankingLancamentos`):
   `id`, `aluno_id`, `pontos` (pode ser negativo, para correção), `motivo`
   ("Pontuação herdada do sistema atual"), `data`, `criado_por`. Nunca se edita
   nem apaga: corrige-se com outro lançamento, como no financeiro.
2. `calcularRanking(banco, ate)` soma, para cada jogador, os lançamentos com
   `data <= ate` aos pontos das partidas, sem mudar a assinatura. Os
   lançamentos não contam como vitória nem derrota.
3. Importação: um lançamento por jogador, com a data da virada do sistema.
4. Tela: a linha do ranking mostra "inclui X pontos iniciais" e a ficha do
   aluno lista os lançamentos; a operação `lancarPontosDoRanking` (só o dono)
   cria correções.
5. Um parâmetro nas Configurações (`usarPontosIniciais`) liga ou desliga a soma,
   para a arena decidir se a pontuação antiga vale.

## 3. O que ficou de fora, e por quê

- **Pirâmide:** fora da v1 (decisão do plano).
- **Cobrança da inscrição do torneio:** os dados de exemplo têm lançamentos
  "Inscrição · <torneio>", mas a tela não gera cobrança, porque o valor da
  inscrição não está definido em lugar nenhum. Sugestão: campo "valor da
  inscrição" no torneio e um lançamento a receber por inscrito (categoria
  "Torneio", com `torneioId`), como o consumo faz.
- **Reservar quadras para os jogos do torneio:** o torneio usa o bloqueio de
  quadra da agenda (o t-1 já tem as quadras 2 e 3 bloqueadas no dia).
- **Disputa de 3º lugar, repescagem e ranking de duplas:** não pedidos na v1.
- **Inscrever o aluno no ranking e mudar a categoria:** é cadastro do aluno
  (módulo Alunos).
- **Comentários de exemplo em torneios:** a semente de comentários é
  compartilhada (`semente/comentarios.ts`); os comentários feitos na sessão
  funcionam normalmente.
- **Matchmaking** (sugerir adversário): fora do escopo do projeto.

## 4. Roteiro de teste

Use o sistema com o usuário padrão (Francisco, dono). Tudo volta ao estado
inicial ao recarregar a página.

1. Abra **Ranking / Torneio**. Deve aparecer o pódio com os 3 primeiros, a
   lista do ranking com pontos, vitórias (V), derrotas (D) e a coluna "7 dias",
   e à direita as próximas partidas e os torneios.
2. Clique em **Cat. B**. A lista e o pódio passam a mostrar só a categoria B,
   com as posições da categoria. Clique em **Todas** para voltar.
3. Clique em **Registrar partida**. Escolha "Guilherme Lima" como jogador A e
   "Anna Beatriz" como jogador B. Em **Placar**, escreva `6/4 3/6 10/8`.
   O vencedor "Guilherme Lima" é marcado sozinho e aparece o quadro "Confira o
   placar". Clique em **Registrar partida**. Deve aparecer o aviso "Partida
   registrada. O ranking foi atualizado." e Guilherme ganha 10 pontos.
4. **Erro de regra:** abra **Registrar partida** de novo e escolha "Guilherme
   Lima" nos dois lados, com placar `6/4 6/4`. Ao salvar deve aparecer "Escolha
   dois jogadores diferentes.". Troque o jogador B por "Anna Beatriz" e marque
   Anna como vencedora: deve aparecer "O placar não bate com o vencedor: por
   esse placar quem venceu foi Guilherme Lima.". Cancele.
5. Em **Próximas partidas**, clique em **Marcar**. Escolha dois jogadores,
   deixe "Reservar quadra" marcado e mude o **Início** até aparecer "Quadra
   livre nesse horário.". Clique em **Marcar partida**: aviso "Partida marcada e
   quadra reservada na agenda.". A partida aparece em Próximas partidas.
6. **Erro de regra:** marque outra partida, para outros jogadores, na mesma
   data, quadra e horário. A tela já avisa em vermelho que a quadra está
   ocupada; ao salvar aparece "Quadra 1 já está ocupada em … (Ranking · …)".
7. Abra a aba **Partidas**. Busque "Guilherme" e escolha a situação "Com
   resultado". Clique na partida de hoje, marque Anna Beatriz como vencedora,
   escreva o placar `4/6 6/3 8/10` e clique em **Salvar correção**. Aviso
   "Resultado corrigido. O ranking foi recalculado.".
8. Abra a mesma partida e clique em **Histórico**: aparece "Alterou · Corrigir
   resultado de partida de ranking", com o vencedor e o placar de antes e de
   depois. Em **Comentários**, escreva algo e clique em **Adicionar
   comentário**.
9. Ainda na partida, clique em **Excluir partida** e confirme. Aviso "Partida
   excluída.".
10. Clique em **Novo torneio**. Dê um nome, deixe "Eliminatória simples" e
    "Simples", e clique em **Inscrever** em seis alunos. Ponha "1º" como cabeça
    de chave de um deles e "2º" de outro. O quadro "Chave" diz "Chave de 8 com
    2 folgas…". Clique em **Criar torneio**: a tela do torneio abre.
11. Clique em **Gerar chave** e confirme. Aparece a chave com as quartas de
    final (2 jogos e 2 folgas), as semifinais, a final e o campeão "a definir".
    Os cabeças 1 e 2 aparecem nas folgas, um em cima e outro embaixo.
12. Clique no **Jogo 1**, escreva o placar `6/3 6/2` e clique em **Registrar
    resultado**. Aviso "o vencedor avançou na chave" e o vencedor aparece na
    semifinal.
13. Abra o **Jogo 1** de novo, troque o vencedor e o placar (`3/6 2/6`) e clique
    em **Salvar correção**: o novo vencedor toma o lugar na semifinal.
14. Abra o **Jogo 3** (semifinal), escolha um vencedor, marque **Vitória por
    W.O.** e registre. Agora abra o **Jogo 1**: aparece "A partida seguinte
    (Semifinal) já foi jogada: este resultado não pode mais ser mudado." e não
    há botão de salvar.
15. Registre o jogo 4 e a final. O torneio fica **Encerrado** e o campeão
    aparece em destaque no topo e na coluna "Campeão" da chave.
16. Volte a **Torneios** e abra **Torneio Interno · Categoria B** (inscrições
    abertas). Clique em **Editar e inscrever**, remova "Rafael", mude
    **Mostrar** para "Todo o ranking", inscreva "Caio" e ponha-o como cabeça
    "3º". Salve: aviso "Torneio atualizado.".
17. Clique em **Gerar chave** e confirme: aparecem os grupos A e B com a
    classificação e os jogos, e o aviso de que a eliminatória será montada
    quando os grupos terminarem. Clique em **Desfazer chave** e confirme: o
    torneio volta para inscrições abertas. Gere de novo.
18. Registre um jogo do grupo: a classificação muda na hora. Registre todos os
    jogos dos grupos: a fase eliminatória aparece sozinha (1A × 2B e 2A × 1B).
19. Abra **Copa Red Tennis · Etapa 3** (encerrado): classificação com
    "Desempate: confronto direto", matriz de confrontos (V e D com o placar) e
    os jogos por rodada; o jogo 7 foi por W.O.
20. **Erro de permissão (H9):** saia do sistema, entre como **Renata Coelho**
    (professora), abra Ranking / Torneio e tente registrar uma partida. Deve
    aparecer "Seu perfil não tem acesso ao ranking e aos torneios.".
21. Abra a **Agenda** na data e horário da partida marcada no passo 5: a
    reserva aparece em roxo, como "Ranking" com os dois jogadores (quando a
    agenda já estiver migrada para o modelo novo).

## 5. Notas para a migração ao Supabase

| Hoje (front) | No banco |
| --- | --- |
| `torneios`, `torneio_inscritos`, `partidas` em `tipos.ts` | Tabelas com os mesmos nomes. Sugestão: tabela filha `torneio_inscrito_alunos (inscrito_id, aluno_id)` com `unique (torneio_id, aluno_id)`, para o banco impedir o aluno em duas inscrições; e `partida_lados` (ou `uuid[]`) para os lados A e B. |
| `validarInscricoes` | Constraints: `unique (torneio_id, cabeca_de_chave)`, `check (cabeca_de_chave > 0)`; a sequência 1, 2, 3… numa função de validação chamada por `criar_torneio`/`editar_torneio`. |
| `validarResultado` (placar) | Função `validar_resultado(placar, vencedor, wo)` em PL/pgSQL, chamada pelas funções de resultado; `check (vencedor in ('A','B'))`, `check (not wo or vencedor is not null)`. |
| `calcularRanking` | View `ranking` (soma por aluno sobre `partidas` + `configuracoes`) e função `ranking_em(data)` para a variação de 7 dias. |
| `registrarPartida`, `marcarPartida` | RPC em transação: insere a ocupação "Ranking" e a partida. O conflito de quadra já é garantido pela exclusion constraint da tabela `ocupacoes`. |
| `corrigirResultadoDePartida`, `excluirPartida` | `update`/`delete` com RLS por perfil (H9) e o gatilho de auditoria. |
| `gerarChave` + `sortearInscritos` | RPC `gerar_chave(torneio_id)`: gera as partidas com `random()` e muda a situação. |
| `aplicarResultado`, `atualizarFaseEliminatoria`, `torneioTerminou` | RPC `registrar_resultado_torneio(partida_id, placar, vencedor, wo, data)`: valida, avança o vencedor (`proxima_partida_id`, `lado_na_proxima`), monta a eliminatória quando os grupos terminam e atualiza a situação. |
| `bloqueioDeCorrecao` | Checagem dentro das RPCs de correção e de apagar resultado. |
| `classificar` | Função `classificacao_do_grupo(torneio_id, grupo)` ou cálculo no cliente (é só leitura). |
| Permissão (H9) | RLS: só perfis com o módulo "ranking" gravam em `partidas`, `torneios` e `torneio_inscritos`. |

Os testes de `torneios.test.ts` e `ranking.test.ts` descrevem os casos que
viram testes do banco (pgTAP).

## No banco (funções)

Migração `supabase/migrations/20261030120400_funcoes_ranking.sql`, testes em
`supabase/tests/70_ranking.test.sql`. Cada operação da tela virou uma função do
Postgres, chamada com `supabase.rpc("nome", { p_...: ... })`. Todas rodam com as
permissões de quem chamou (a RLS continua valendo), começam conferindo o perfil
e gravam o nome da operação na auditoria. Se uma regra for violada, nada é
gravado e a tela recebe a mesma mensagem de hoje.

Nenhuma operação do módulo ficou como gravação direta na tabela: todas leem e
depois gravam (jogadores, placar, chave), ou gravam em mais de uma tabela.

| Operação da tela | Função no banco (parâmetros) | Devolve |
| --- | --- | --- |
| `registrarPartida` | `registrar_partida(p_jogador_a, p_jogador_b, p_data, p_placar, p_vencedor, p_wo)` | id da partida |
| `marcarPartida` | `marcar_partida(p_jogador_a, p_jogador_b, p_data, p_reserva)`; `p_reserva` é `{"quadraId", "horaInicio", "horaFim"}` ou vazio | id da partida |
| `registrarResultadoDePartida` | `registrar_resultado_de_partida(p_id, p_placar, p_vencedor, p_wo, p_data)` | id da partida |
| `corrigirResultadoDePartida` | `corrigir_resultado_de_partida(p_id, p_placar, p_vencedor, p_wo, p_data)` | id da partida |
| `excluirPartida` | `excluir_partida(p_id)` (cancela a reserva futura junto) | id da partida |
| `criarTorneio` | `criar_torneio(p_nome, p_data, p_formato, p_duplas, p_inscricoes, p_categoria)`; `p_inscricoes` é `[{"alunosIds": [...], "cabecaDeChave": 1}]` | id do torneio |
| `editarTorneio` | `editar_torneio(p_id, p_nome, p_data, p_formato, p_duplas, p_categoria, p_inscricoes)`; `p_inscricoes` vazio = não mexe; com `id` = inscrição mantida | id do torneio |
| `gerarChaveDoTorneio` | `gerar_chave_do_torneio(p_id, p_sorteio)`; `p_sorteio` (opcional) = ids das inscrições na ordem sorteada | id do torneio |
| `desfazerChaveDoTorneio` | `desfazer_chave_do_torneio(p_id)` | id do torneio |
| `registrarResultadoDeTorneio` | `registrar_resultado_de_torneio(p_partida_id, p_placar, p_vencedor, p_wo, p_data)` | `{"torneioId", "situacao"}` |
| `corrigirResultadoDeTorneio` | `corrigir_resultado_de_torneio(p_partida_id, p_placar, p_vencedor, p_wo, p_data)` | `{"torneioId", "situacao"}` |
| `apagarResultadoDeTorneio` | `apagar_resultado_de_torneio(p_partida_id)` | `{"torneioId", "situacao"}` |

Leituras (não gravam nada):

| Leitura da tela | No banco |
| --- | --- |
| `calcularRanking(banco)` | view `ranking` (`aluno_id`, `posicao`, `pontos`, `vitorias`, `derrotas`, `partidas`) |
| `calcularRanking(banco, ate)` (coluna "7 dias") | função `ranking_em(p_ate)`, mesmas colunas |
| `classificar` (tabela dos grupos e do todos contra todos) | função `classificacao_do_torneio(p_torneio_id)`: grupo, posição, jogos, vitórias, derrotas, sets, games e o critério que desfez o empate |

**Por que o ranking virou view + função, e não uma operação.** A pontuação é
só leitura: ninguém digita pontos, eles saem das partidas com resultado e das
Configurações (H7). Uma view com as permissões de quem consulta
(`security_invoker`) basta para o ranking de hoje. Como a tela também precisa
do ranking de 7 dias atrás (para a coluna de variação), e uma view não recebe
parâmetro, o cálculo fica na função `ranking_em(data)` e a view `ranking` só a
chama sem data. O filtro por categoria continua na tela (as posições da
categoria são renumeradas lá).

**O que o banco garante agora (e não só a tela).**

- Placar coerente com o vencedor (mesmas recusas da tela) e "W.O." no W.O.
- Jogadores ativos e inscritos no ranking; reserva só nas quadras 1 a 4, das
  07h às 22h, sem conflito (a mensagem diz quem ocupa a quadra).
- A chave dos três formatos é gerada pelo banco, com a mesma estrutura da tela:
  cabeças de chave nas mesmas vagas, folgas para os primeiros cabeças, mesmos
  nomes de fase, rodada e ordem, e cada partida apontando para a seguinte.
  Isso foi conferido comparando o banco com o front em 93 chaves (eliminatória
  de 2 a 64 inscrições, todos contra todos de 3 a 10, grupos de 6 a 24 com todos
  os resultados lançados): resultado idêntico, inclusive a classificação e o
  critério de desempate.
- O vencedor avança sozinho, no lado certo; correção e "apagar resultado" só
  enquanto a partida seguinte não foi jogada (nos grupos, enquanto a
  eliminatória não começou).
- No formato de grupos, o último jogo dos grupos monta a eliminatória
  (1A × 2B, 2A × 1B...). Se um resultado de grupo mudar antes de a eliminatória
  começar, ela é remontada (ou fica igual, se nada mudou); se um resultado de
  grupo for apagado, ela sai.
- Situação do torneio: em andamento ao gerar a chave, encerrado quando a final
  é decidida (ou todos os jogos do todos contra todos), de volta a em andamento
  se o resultado da final for apagado.
- Duas pessoas mexendo na mesma chave ao mesmo tempo: o torneio fica travado
  durante cada gravação, então uma espera a outra.

**Sorteio da chave.** A tela sorteia quem não é cabeça de chave com uma
"semente" própria (o mesmo sorteio se repete com a mesma semente), coisa que o
banco não reproduz de forma idêntica. Por isso `gerar_chave_do_torneio` aceita
`p_sorteio`: a lista de ids das inscrições na ordem sorteada pela tela (os
cabeças de chave podem vir na lista ou não; ficam sempre nas suas vagas). Com
essa lista, a chave do banco é exatamente a que a tela mostraria. Sem ela, o
banco sorteia sozinho (`random()`).

**Mudança no schema.** `torneio_inscritos` ganhou a coluna `ordem_inscricao`
(número crescente, preenchido sozinho). O último critério de desempate é
"cabeça de chave e ordem de inscrição", e no banco não havia como saber a ordem
em que as inscrições foram feitas (os ids são aleatórios). Na tela, essa ordem
é a posição na lista; ao ler do banco, ordene por `ordem_inscricao`.

**Diferenças em relação à tela de hoje.**

- Perfil sem permissão recebe "Seu perfil não tem permissão para esta
  operação." (mensagem comum a todos os módulos), em vez de "Seu perfil não tem
  acesso ao ranking e aos torneios.".
- Marcar partida **com reserva de quadra** e excluir partida com reserva futura
  também exigem permissão de gravar na agenda, porque gravam na agenda. Hoje,
  dono e recepção têm as duas.
- Na mensagem de conflito de quadra, os nomes dos alunos saem em ordem
  alfabética (na tela, na ordem em que foram incluídos).
- Os ids das partidas da chave seguem o mesmo padrão (`...-r1-2`,
  `...-gA-r1-1`), com um começo diferente (`pt-` + código aleatório).
- Datas vão como data (`"2026-11-10"`); um texto que não é data é recusado pelo
  banco antes da função.
- O desempate do ranking geral por nome usa a ordenação do banco, que pode
  diferir da tela em nomes com acento.

**Para perguntar à arena (não muda nada agora).** Ao registrar o resultado de
uma partida de ranking com reserva, a reserva deveria virar "realizada" na
agenda? Hoje nem a tela nem o banco fazem isso.
