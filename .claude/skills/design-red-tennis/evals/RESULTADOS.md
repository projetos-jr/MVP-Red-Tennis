# Rodada de 04/11/2026 — com e sem a skill

Cada caso rodou duas vezes (um agente lendo a skill antes, outro proibido de
abrir `.claude/skills/`), só leitura: o agente devolve o diff que faria, como
conferiria e o resumo para a pessoa. Avaliação feita à mão pelos critérios de
cada pasta `graders/`.

| Caso | Sem a skill | Com a skill |
| --- | --- | --- |
| `atrasados-em-destaque` | Usou `tijolo` da paleta e calculou o contraste à mão; achou a causa real (a lista abre só no mês atual) e propôs um aviso. **Nenhum teste novo.** Citou o script de capturas só para a tela padrão. | Tudo do lado esquerdo **e** um teste de contraste novo em `cores.test.ts` (inclusive o fundo do hover), a conta do aviso numa consulta com 3 testes, conferência nos 3 tamanhos e 2 perfis. |
| `filtro-sim-nao` | `InterruptorBola` (copiou do Estoque, que o pedido citava). | Igual, mais estado vazio e a conferência nos 3 tamanhos. Diferença pequena: o próprio pedido apontava o padrão. |
| `tela-de-relatorio` | Cartão branco, cores do piso, peças comuns; mas uma **tabela larga** (`min-w-[640px]`) que no celular rola dentro do cartão. | Cartão branco, barras na cor do piso, sem tabela larga (lista que funciona em 390px), `EstadoVazio`, tela de aviso para o professor (H9), teste comparando com o "% de ocupação" da agenda. |

**Conclusão:** o código já segue o padrão visual, então mesmo sem a skill os
agentes acertam a paleta. A skill faz diferença no que não está à vista no
código: **testar o contraste no CI**, conferir **os 3 tamanhos** (tabela larga
no celular) e a lista de conferência antes de entregar. Nenhum critério piorou
com a skill.

Achados úteis para o produto (fora do exercício):
- A lista do Financeiro abre só no mês atual: os atrasados de meses anteriores
  não aparecem nela (só no cartão "Em atraso"). Sugestão para o Consultor 3:
  o aviso "N lançamentos em atraso fora da vista" proposto nos dois casos.
- Não existe operação para inativar professor (só cadastrar e editar).
- O relatório de ocupação depende de confirmar com a arena se ela abre todos
  os dias das 07h às 22h e se quadra bloqueada conta como ocupada.
