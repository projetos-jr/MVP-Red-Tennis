# Skills do projeto

Instruções que o Claude Code carrega sozinho quando a tarefa combina com a
descrição de cada uma. Servem para a equipe trabalhar sempre do mesmo jeito,
mesmo sem formação técnica.

| Skill | Quando entra |
| --- | --- |
| `mudar-banco` | Qualquer mudança no banco (tabela, coluna, função, permissão): migração nova, RLS, auditoria, testes e publicação |
| `nova-operacao` | Botão, formulário ou fluxo que grava dados, de ponta a ponta (tela, banco, ligação, testes) |
| `revisar-pr` | Revisar um pull request pela definição de pronto, com parecer em linguagem simples |
| `pedido-do-cliente` | Classificar um pedido do cliente quanto ao escopo e preparar a resposta |
| `status-semanal` | Rascunho do e-mail de status de sexta para o cliente |

Cada skill de texto tem casos de teste em `evals/` (pedido, o que se espera e
os critérios). Para rodar os mesmos testes com o Claude Code:
`claude plugin eval .claude/skills/<skill>`.

Para pedir uma skill sem esperar que ela entre sozinha, diga o nome: "use a
skill revisar-pr no PR #20".
