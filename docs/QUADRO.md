# Quadro de tarefas (rascunho)

> As issues estão desligadas neste repositório (padrão de fork). Enquanto
> isso, o quadro fica aqui. Quando alguém ligar as issues (*Settings → General
> → Features → Issues*) e criar o quadro no GitHub Projects, cada item abaixo
> vira uma issue com o mesmo título, critério de aceite e etiqueta de módulo —
> o Claude Code pode criar todas de uma vez.
>
> Situação em 03/11/2026. Não coloque aqui dados do cliente nem de alunos
> (o repositório é público).

Legenda: **[pessoa]** só uma pessoa da equipe pode fazer (contas, senhas,
painéis); **[claude]** o Claude Code pode fazer com a equipe revisando.

---

## Pendências da semana 1 (26–30/10)

### 1. Ligar as issues e montar o quadro no GitHub Projects · base · [pessoa] coordenador
- [ ] *Settings → General → Features → Issues* ligado.
- [ ] Projeto com as colunas A fazer, Fazendo, Em revisão, Pronto.
- [ ] Os itens deste arquivo viraram issues (pedir ao Claude Code) e este arquivo foi apagado.

### 2. Branch padrão `main` e `main` protegida · base · [pessoa] coordenador
- [ ] *Settings → General → Default branch* = `main`; branch antiga `claude/fervent-feynman-svpzu0` apagada.
- [ ] *Settings → Rules*: PR obrigatório com 1 aprovação e os checks `verificar`, `banco` e `integracao` verdes, sem exceção para administradores.
- [ ] Cada consultor com a própria conta no GitHub, como colaborador (o GitHub não deixa o autor aprovar o próprio PR; com uma conta só para todos, ninguém consegue revisar ninguém).

### 3. Segredos do GitHub para publicar o banco · base · [pessoa] Consultor 2
Passo a passo em `docs/AMBIENTES.md` ("Configuração única no GitHub").
- [ ] Ambientes `teste` e `producao` (só `main`; produção com aprovação), cada um com `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`.
- [ ] Actions → publicar-banco → Run workflow (`teste`, com dados de exemplo) verde.
- [ ] *Allow new users to sign up* desligado nos dois projetos do Supabase.

### 4. Site de teste publicado na Cloudflare com login · base · [pessoa] Consultor 1
- [ ] Worker `mvp-red-tennis` ligado ao repositório (build `npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`), publicando a `main`.
- [ ] Variáveis de build `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do projeto **de teste**.
- [ ] O endereço `*.workers.dev` abre a tela de login com e-mail e senha.

### 5. Usuários da equipe no Supabase de teste · base · [pessoa] + [claude]
- [ ] Cada pessoa da equipe criada em *Authentication → Users* (com *Auto Confirm User*).
- [ ] O Claude Code liberou cada uma em `colaboradores` (informar só e-mail e perfil, nunca senha).
- [ ] Cada perfil entrou no site de teste e viu só as áreas dele.

### 6. Perguntas ao cliente registradas por e-mail · base · [pessoa] coordenador
- [ ] E-mail com as regras em aberto (hipóteses H1–H14 de `docs/MODELO-E-TELAS.md` e as dúvidas listadas nos documentos dos módulos), com prazo de resposta.
- [ ] Respostas registradas e hipóteses atualizadas nas Configurações.

### 7. Fotos reais e repositório público (LGPD) · base · [pessoa] coordenador
- [ ] Decidir: tirar as fotos dos membros de `public/avatars/` (o sistema já usa iniciais quando não há foto) e/ou mover o código para um repositório **privado** da organização.
- [ ] Decisão registrada.

---

## Semana 2 (2–6/11): fechar funcionalidades, demo e CSAT

### 8. Validar a agenda com o banco de teste · agenda · Consultor 1 + Consultor 2
- [ ] Roteiro de `docs/modulos/agenda.md` executado no site de teste: horário avulso, fixo (com data em conflito), bloqueio, chuva, cancelamento com créditos, reposição, presença.
- [ ] Duas pessoas tentando marcar a mesma quadra e horário: a segunda recebe a mensagem de conflito.

### 9. Relatórios no banco · agenda/financeiro · Consultor 2
- [ ] Views (com permissões de quem consulta) de ocupação por quadra, aulas por professor, inadimplência e saldo de reposição (esta já existe: `saldo_reposicao`).
- [ ] Testes pgTAP; documentado em `docs/BANCO.md`.

### 10. Rotina das aulas fixas além das semanas geradas (H12) · agenda · Consultor 2
- [ ] Rotina (pg_cron) que cria as próximas datas dos horários fixos sem fim, respeitando conflitos e bloqueios; testes.

### 11. Liberação automática de reservas (pg_cron) no projeto de teste · agenda · Consultor 2
- [ ] Conferir que o agendamento `liberar-reservas-vencidas` existe no projeto de teste depois da publicação; com a opção desligada, nada é liberado.

### 12. Validar financeiro, estoque e ranking com o banco de teste · financeiro/estoque/ranking · Consultor 3
- [ ] Roteiros de `docs/modulos/financeiro.md`, `estoque.md` e `ranking.md` executados no site de teste, com cada perfil.
- [ ] Venda no balcão com estoque zerado recusada; repasse não fecha duas vezes; chave de torneio igual à mostrada na tela.

### 13. Demonstração e CSAT de 06/11 · base · coordenador
- [ ] Roteiro de demo pelo dia a dia da recepção, ensaiado no site de teste.
- [ ] CSAT (nota 1–5 por módulo + campo aberto); cada comentário classificado (erro, ajuste dentro do escopo, fora do escopo — skill `pedido-do-cliente`).

---

## Semana 3 (9–13/11): integração, dados reais, backup

### 14. Importação dos dados reais · base · Consultor 2
- [ ] Scripts versionados e idempotentes (chave única como CPF ou e-mail), relatório de contagens e rejeições, conferência de amostra pelo cliente.
- [ ] Só no ambiente de teste; cópias locais das planilhas apagadas (LGPD).

### 15. Backup diário e teste de restauração · base · Consultor 2
- [ ] Workflow agendado com `pg_dump` (segredo `SUPABASE_DB_URL` do Session pooler), criptografado, em armazenamento da conta do cliente, com aviso se falhar.
- [ ] Restauração testada num banco limpo e documentada.

### 16. Testes de concorrência e de perfil pela API · base · Consultor 3
- [ ] Dois aparelhos gravando ao mesmo tempo (agenda, estoque, chave).
- [ ] Cada perfil tentando ler e gravar direto na API o que não pode (deve ser recusado).

### 17. Feature freeze (13/11) e lista da fase 2 · base · coordenador

---

## Semana 4 (16–20/11): conserto e documentação

### 18. Desempenho com dados reais · base · Consultor 1 + Consultor 2
- [ ] Agenda semanal em menos de 2 s; ler só o período em uso em vez das tabelas inteiras.

### 19. Guia de instalação testado do zero · base · Consultor 2
- [ ] Outro projeto Supabase e Supabase auto-hospedado com Docker, testado por quem não montou o ambiente.

### 20. Componentes de terceiros e licenças · base · Consultor 3
- [ ] `npx license-checker --summary` + serviços externos (Supabase, Cloudflare, GitHub) e extensões do banco (btree_gist, pg_cron, pgTAP).

### 21. Manual do usuário · base · Consultor 1
- [ ] Por tarefa do dia a dia, com capturas, testado por alguém de fora.
