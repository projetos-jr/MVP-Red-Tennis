---
name: design-red-tennis
description: Sistema visual do Red Tennis (cores vivas de quadra, tipografia de placar, mosaico, agenda colorida) e como aplicá-lo em qualquer tela, componente ou ajuste visual — paleta em src/lib/paleta.ts, regras de contraste testadas, peças comuns (InterruptorBola, .ladrilho, .vidro, .textura-saibro), cores da agenda e conferência por capturas. Use sempre que a tarefa criar ou mudar algo que aparece na tela, mesmo que a pessoa não fale em "design" (por exemplo, "faz uma tela de relatório", "o botão ficou feio", "deixa a agenda mais clara", "coloca uma cor nos atrasados", "ajusta o layout no tablet").
---

# Design Red Tennis

O dono da arena usou por anos um sistema antigo que ele conhece de cor: tela inicial com as
quadras desenhadas e um **mosaico de botões grandes laranja**, e a agenda do dia com as quadras
lado a lado. Ele pediu **cores vivas (nada de pastel)** e o básico que funcione. O nosso visual
traz essa estrutura com acabamento atual e uma personalidade de clube de tênis, **sem exagero**.

Princípio: **vivo onde se age, calmo onde se lê.** Botões, mosaico, abas, blocos da agenda e
quadras são vivos; tabelas, formulários, cartões e textos ficam em fundo branco e neutro, para
a recepção ler rápido o dia inteiro.

## Cores — sempre pela paleta

A fonte única é `src/lib/paleta.ts` (o Tailwind lê de lá). Nunca escreva um hex solto num
componente: use a classe (`bg-saibro-600`) ou importe `PALETA`. Para recalibrar, muda-se só
a paleta, e o teste `src/lib/cores.test.ts` diz se algum texto deixou de ser legível.

| Família | Papel | Tons mais usados |
| --- | --- | --- |
| `saibro` | Laranja do saibro: ação principal, mosaico, aba ativa, foco | 600 botão; 700 texto/link laranja; 50–100 fundo de destaque |
| `tijolo` | Vermelho: só perigo, alerta, atraso e o letreiro da marca | 600–700 |
| `areia` | Neutros: fundo do app (100), bordas (200–300), textos (500 apoio, 900 principal) | 100, 200, 500, 900 |
| `cimento` | Azul/roxo da Quadra 1 (piso de cimento) | 600–700 |
| `quadra` | Verde de quadra: faixa das quadras, "livre", "sim", positivo | 700 (texto branco por cima) |
| `bola` | Amarelo da bola: detalhes pequenos (interruptor ligado, linha do agora) | 300 (texto escuro por cima) |

Cores nativas do Tailwind que já têm significado continuam: `emerald` (pago), `amber`
(aguardando), `sky` (chuva/info), `violet` (reposição). Não crie outras.

## Contraste (testado no CI)

- Texto pequeno precisa de **4,5:1**; texto grande em negrito (≥ 18,66px) de 3:1.
- Texto **branco** só sobre `saibro/tijolo/cimento-600+` e `quadra-700+`.
- Texto laranja: `text-saibro-700` (o 600 só sobre branco puro).
- Sobre amarelo (`bola`), verdes e azuis claros: texto escuro (`text-areia-900`).
- Nunca use `opacity` em elemento com texto (apagar = outro fundo, riscado ou texto `areia-600`).
- Fundo com textura/gradiente: declare `data-fundo-de-contraste="#hex"` no elemento, para a
  conferência automática saber com que cor medir.
- Escolher texto sobre uma cor calculada: `textoLegivelSobre(fundo)` em `src/lib/cores.ts`.

## Tipografia

- Texto: Inter (`font-sans`). Títulos, números grandes, rótulos do mosaico e cabeçalhos da
  agenda: Barlow Semi Condensed (`font-display`, 600/700), com cara de placar.
- As duas fontes vêm empacotadas (`@fontsource`, em `app/layout.tsx`): funcionam offline.

## Peças comuns (use antes de criar outra)

- `CabecalhoDaPagina` (título em `font-display`), `LinkDeVolta`, `Card`/`CardHeader`,
  `StatCard`, `Segmentado` (ativo laranja cheio), `BotaoFiltro`, `MostrarMais`, `EstadoVazio`,
  `Carregando`, `Modal`, `Confirmacao`, `EtiquetaDeSituacao` (situações: pago, pendente, em
  atraso... sempre com ícone e texto) e `EtiquetaNeutra`.
- `InterruptorBola` (`components/ui/InterruptorBola.tsx`): liga/desliga com a bola de tênis.
  Use em toda opção sim/não (Configurações, "Mostrar canceladas"). Caixas de seleção ficam
  para listas e matrizes (permissões).
- Classes globais (`app/globals.css`): `.btn-primario` (laranja), `.btn-secundario`,
  `.btn-fantasma`, `.btn-perigo` (vermelho), `.link-acao`, `.campo`, `.alvo-de-toque`,
  `.vidro` (topo e rodapé translúcidos), `.textura-saibro`, `.ladrilho` (botão do mosaico),
  `.linha-de-quadra` (linha branca decorativa).
- Ícones: SVG próprios em `components/ui/Icons.tsx` (traço 1.7, `currentColor`). Sem
  bibliotecas de ícones nem imagens de terceiros.

## Onde vai a personalidade (e onde não vai)

| Sim | Não |
| --- | --- |
| Mosaico do Início (`.ladrilho` com textura de saibro e linha de quadra) | Tabelas, formulários, janelas |
| Faixa das quadras (pisos desenhados: saibro laranja, cimento azul) | Etiquetas de situação (continuam claras) |
| Topo e rodapé em `.vidro`, pílula laranja que desliza até a aba ativa | Cartões de conteúdo (brancos, borda `areia-200`) |
| Interruptores (bola de tênis), bolinha amarela na linha do "agora" da agenda | Animações de enfeite: só o deslizar das abas e o hover do mosaico, sempre com `motion-safe`/`motion-reduce` |

## Agenda

- Cada tipo da legenda do cliente tem `cheia` (fundo vivo do bloco) e `sobreCheia` (texto) em
  `ESTILO_OCUPACAO` (`src/lib/theme.ts`). Os matizes foram combinados com o cliente: não
  mude sem alinhar. Bloqueio é neutro listrado. Etiquetas e impressão usam os tons claros
  (`fundo`/`texto`/`borda`).
- Situações no bloco: prazo vencido = anel duplo (branco + vermelho) e ⚠; cancelada = fundo
  branco, borda tracejada na cor do tipo, riscada; passado = película leve por trás.
- Linhas de 30 minutos, colunas = quadras (Diária) ou dias (Quadra/Professor).

## Tamanhos de tela e toque

- Computador 1440, tablet 1180 (na quadra, com toque), celular 390. Abaixo de 768px a
  navegação vai para o rodapé e as tabelas viram cartões.
- Em toque (`pointer: coarse`), todo alvo tem pelo menos **44px** de altura (`.btn`, `.campo`,
  `.alvo-de-toque` já fazem isso).

## Conferência (antes de entregar)

```bash
npm test          # inclui cores.test.ts (contraste de todos os tokens e estilos)
npm run lint
npm run build && npx next start -p 3600
node scripts/visual/conferir-telas.cjs --base http://127.0.0.1:3600 --saida telas-para-ver/depois
```

O script fotografa todas as telas em 3 tamanhos e 3 perfis e conta: erros no console,
rolagem lateral no celular, textos abaixo do contraste mínimo e alvos de toque < 44px.
Compare com a rodada anterior e olhe as capturas da tela que você mudou nos 3 tamanhos.

## Não faça

- Hex solto, cor nativa nova, pastel no lugar de cor viva em ação, `opacity` em texto,
  `text-saibro-600` sobre fundo colorido, vermelho para algo que não é perigo ou alerta.
- Biblioteca de componentes/ícones nova sem registrar a licença (exigência do contrato).
