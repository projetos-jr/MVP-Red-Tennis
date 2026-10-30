# Revisão de consistência visual

Outubro de 2026, branch `revisao-consistencia`. Os seis módulos foram feitos em
paralelo e cada um resolveu do seu jeito coisas que deveriam ser iguais. Esta
revisão deixou o sistema com cara de "feito por uma pessoa só", **sem mudar a
identidade** (paleta saibro/tijolo/areia, cartões, quadras em 3D, cores da
agenda), as regras de negócio, as consultas nem as operações.

## Como foi feita

Capturas de tela **antes e depois** de 21 telas, 6 janelas/painéis e 3
situações (histórico com registros, aluno não encontrado, sem acesso), em 3
tamanhos: computador (1440×900), tablet (1180×820, com toque) e celular
(390×844, com toque). Um roteiro automático conferiu em cada uma: erros no
console, rolagem para o lado, contraste de textos pequenos e tamanho dos
alvos de toque.

| Medida | Antes | Depois |
| --- | --- | --- |
| Erros no console ou na página | 0 | 0 |
| Telas com rolagem para o lado no celular | 0 | 0 |
| Textos pequenos abaixo de 4,5:1 (computador, fora a grade da agenda) | 1.911 | 128 |
| Alvos de toque abaixo de 44px (tablet / celular) | 1.132 / 1.158 | 322 / 594 |

O que sobrou de contraste são traços "—" de campo vazio, separadores "·" e os
dias de outro mês no calendário (de propósito apagados). O que sobrou de toque
está em "O que ficou de fora".

## O que estava diferente e o que mudou

| Estava assim | Onde | Agora |
| --- | --- | --- |
| A mesma situação com cores diferentes: "Mês em andamento" cinza no financeiro e azul na ficha do professor; "Em atraso" vermelho claro no financeiro e vermelho cheio no painel da aula; "Plano congelado" com dois azuis; produto abaixo do mínimo amarelo no painel e "Repor já" no estoque | Financeiro, ficha do professor, painel da aula, painel (Precisa de atenção) | Uma cor e um ícone por situação, em todas as telas (`EtiquetaDeSituacao`) |
| "Pago" e "Em aberto" sem ícone e com letra de 10px no consumo; forma de pagamento colorida na ficha do aluno ("Bradesco" vermelho parecia alerta) e neutra no financeiro | Ficha do aluno e do professor (consumo, pagamentos) | Mesmas etiquetas do financeiro; forma de pagamento sempre neutra |
| Botão desabilitado vermelho a 50%, quase sumindo ("Adicionar comentário", "Salvar…" nas Configurações, "Salvar horário") | Todas | Cinza neutro e legível |
| Listas longas de uma vez (93 alunos, 40 lançamentos, 50 alterações, 25 partidas) e cinco jeitos de "ver mais" | Alunos, financeiro, histórico, ranking, fichas, produto | 20 por vez e o mesmo rodapé "Mostrando 20 de 93 · Mostrar mais 20" (`MostrarMais`) |
| Voltar: link "← Alunos" em umas telas, botão só com ícone no modo quadra e na impressão, "Voltar para o estoque" no produto; botões do cabeçalho com três arranjos no celular | Todas as telas com título | Mesmo cabeçalho e mesmo "← Área" (`CabecalhoDaPagina`, `LinkDeVolta`) |
| "Sem acesso", "não encontrado" e histórico vazio com quatro desenhos; "Carregando" de três jeitos | Financeiro, estoque, fichas, torneio, histórico | `EstadoVazio` e `Carregando` |
| Filtro-pílula copiado em três lugares; "Limpar filtros" em três cores; "Ver todos" como botão cinza e "Ver agenda" como link | Agenda, estoque, ranking, alunos, financeiro, histórico, painel | `BotaoFiltro` e a classe `link-acao` (link tijolo) |
| Texto de apoio cinza com contraste 3,8:1 (e 2,3:1 em alguns) | Todas | Tom `areia-500` um pouco mais escuro (5,1:1); categorias B e C do ranking com texto mais escuro |
| No tablet e no celular, botões com 40px, filtros com 28px, abas com 32px | Todas | 44px de altura em telas de toque; no computador com mouse nada muda |
| Professor com cor sorteada nas Configurações (repasse) | Configurações | A cor dele na agenda, como na lista e na ficha |
| Nenhuma aba marcada nas telas de Professores | Professores | A aba Alunos fica marcada |
| Botão de perigo escrito de três jeitos | Agenda, confirmações | Classe `btn-perigo` |

## Peças comuns para usar em telas novas

Ficam em `src/components/ui/`. Cada arquivo tem um exemplo no comentário.

- **`CabecalhoDaPagina`**: título, descrição e ações. A ação principal
  (`btn-primario`) vai por último. Telas de detalhe põem antes um
  **`LinkDeVolta`** (`<LinkDeVolta href="/alunos">Alunos</LinkDeVolta>`).
- **`EtiquetaDeSituacao`**: `situacao="pago" | "pendente" | "em_atraso" |
  "cancelado" | "congelado" | "em_andamento"` escolhe cor e ícone; `tom=` só a
  cor (ex.: `tom="positivo"` para "Ativo"); `pequena` para listas compactas.
  Categoria e forma de pagamento usam **`EtiquetaNeutra`**. Os tons (`TONS`)
  são as únicas cores de situação: não crie outras.
- **`MostrarMais`** com `ITENS_POR_PAGINA` (20): rodapé de lista longa. Volte o
  limite para 20 quando um filtro mudar.
- **`EstadoVazio`**: ícone, título, explicação e ações, para "sem acesso",
  "não encontrado" e "nada cadastrado ainda". Dentro de uma lista com filtro,
  basta uma linha de texto centralizada.
- **`Carregando`**: o aviso enquanto a tela monta (e, com o Supabase, enquanto
  os dados chegam).
- **`BotaoFiltro`**: pílula para poucas opções. Muitas opções: `select` com a
  classe `campo`. Trocar de visão ou aba: `Segmentado`.
- Classes em `globals.css`: `btn-primario`, `btn-secundario`, `btn-fantasma`,
  `btn-perigo`, `link-acao` e `alvo-de-toque` (44px no toque para algo
  clicável que não é botão nem campo).
- `Avatar` aceita `cor` (use `professor.cor` para professores).

Para texto pequeno, use `text-areia-500` ou mais escuro. `text-areia-400` fica
para ícones, traços e placeholders.

## O que ficou de fora (e por quê)

1. **Cores da agenda.** As etiquetas Q1–Q4 têm texto branco sobre amarelo e
   azul claro (contraste baixo) e as aulas passadas ficam a 60%. É a legenda
   validada com o cliente; se a equipe quiser, a pergunta é: "podemos escurecer
   só o texto dessas etiquetas?".
2. **Nomes diferentes para a mesma área**: "Ranking / Torneio" (menu),
   "Ranking & Torneios" (título) e "Ranking e torneios" (Configurações);
   "Caixa" (celular) e "Financeiro". É vocabulário do cliente: decidir com ele.
3. **Textos diferentes para a mesma situação**: "Prazo venceu em" (financeiro)
   e "Prazo vencido" (painel); "Pendente" e "Em aberto"; "A fechar" e "Sem
   fechamento". Unifiquei cor e ícone, não o texto, porque a regra da revisão
   era não mudar textos.
4. **Toque**: ainda menores que 44px os nomes de alunos e itens dentro de
   listas e tabelas (são links do conteúdo, e aumentar mudaria a densidade das
   listas), as caixas de permissão (20px) e os interruptores (28px) das
   Configurações. Vale rever quando o tablet da arena for definido (H11).
5. **Avatares** de quem também é professor fora das telas de professores (topo,
   login, lista do financeiro) ainda usam a cor sorteada: essas telas não leem
   a cor do professor.
6. **Pequenos espaçamentos**: mensagens "Nenhum…" dentro das listas variam
   entre 24 e 48px de altura; a lista de alunos usa margem lateral de 16px e as
   tabelas, 20px. Diferença pequena, sem ganho que justifique mexer em vinte
   arquivos.
7. **"Mostrar todos / Mostrar menos" do Precisa de atenção** (painel) ficou
   como era: abre e fecha dentro de um resumo, é diferente de uma lista longa.
8. As capturas mostram datas como "10/29/2026" porque o navegador de teste
   está em inglês; num navegador em português aparece "29/10/2026".

## Como conferir

1. `npm run dev` e abra <http://localhost:3000/financeiro>: 20 lançamentos e,
   no fim, "Mostrando 20 de … · Mostrar mais 20".
2. Abra a ficha de um aluno: "Adicionar comentário" aparece cinza (legível);
   escreva algo e ele fica vermelho. As formas de pagamento estão neutras.
3. Compare a ficha de um professor com Financeiro › Professores: "Mês em
   andamento" é cinza com relógio nos dois.
4. Para ver o tamanho de toque no computador: no Chrome, F12 → ícone de
   celular/tablet (modo dispositivo, que liga o toque) → recarregue. Os botões
   e filtros passam a ter 44px de altura.

Nota técnica: para capturar tela inteira com toque no Playwright, não use
`fullPage: true` (ela desliga a emulação de toque durante a foto); aumente a
janela até a altura da página e tire a foto normal.
