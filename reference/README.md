# Material de referência

Pasta para os arquivos originais do cliente usados como referência visual.
Nenhum deles é necessário para rodar o projeto.

| Arquivo | O que é | Situação |
| --- | --- | --- |
| `logo-red-tennis.webp` | Logo oficial da Red Tennis | **A adicionar** |
| `sistema-antigo.png` | Print do sistema de gestão atual do cliente | **A adicionar** |

## Sobre o logo

O MVP **não depende** desses arquivos: a marca é desenhada em SVG vetorial em
`src/components/layout/Logo.tsx`, reconstruída a partir do logo original (quadra
de saibro em curva sobre o letreiro RED TENNIS).

Para passar a usar o arquivo oficial em vez do vetor:

1. copie a imagem para `public/` (ex.: `public/logo-red-tennis.webp`);
2. em `src/lib/branding.ts`, aponte `LOGO_OFICIAL` para esse caminho.

## Sobre o sistema antigo

O sistema que a arena usa hoje tem um visual datado (ícones pixelados, tabelas
sem hierarquia), mas o dono **conhece de cor e gosta da estrutura**. No redesign
de novembro, a pedido dele, o nosso sistema passou a seguir essa estrutura, com
acabamento atual:

- **Tela inicial:** as quadras desenhadas no topo (Quadra 1 de cimento em
  azul/roxo, 2 a 4 de saibro em laranja) e um mosaico de botões grandes laranja
  (Diária, Agenda Professores, Financeiro, Estoque, Histórico, Clientes,
  Ranking, Torneio, LAP, Site...);
- **Agenda "Diária":** o dia atual e o próximo lado a lado, colunas por quadra,
  linhas de 30 em 30 minutos; e a visão "Quadra" (uma quadra, a semana inteira);
- **Lista de clientes** em tabela densa, com filtros Ativos/Inativos/Todos e
  Ranking/Alunos/Aluguel/Torneio;
- **Cores vivas**, nada de tons pastéis.

O que não foi copiado: os ícones pixelados (trocados por ícones próprios em
SVG), as fontes com sombra e as cores que falham no contraste. O sistema visual
está descrito na skill `.claude/skills/design-red-tennis/SKILL.md`.
