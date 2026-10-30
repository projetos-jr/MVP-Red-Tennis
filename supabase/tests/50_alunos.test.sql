-- Funcoes de alunos (matricula, congelamento H4, inativacao), configuracoes,
-- professores e comentarios. Espelha src/lib/banco/operacoes/alunos.test.ts e
-- configuracoes.test.ts.
--
-- Dados (datas relativas a hoje, porque as regras olham para hoje):
--  - Ana (x1): matricula Individual; aula individual (quadra 1, 10h) e dupla
--    com Bruno (quadra 2, 18h) nos proximos dias; uma reposicao avulsa;
--  - Bruno (x2): matricula Dupla, na mesma dupla;
--  - Carla (x3): sem matricula; Davi (x4): matricula antiga, ja encerrada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(97);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'dono@teste'),
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste'),
  ('00000000-0000-0000-0000-000000000003', 'professor@teste');
insert into public.professores (id, nome, cor, repasse_modo, repasse_valor) values
  ('t-prof', 'Professor Teste', '#000000', 'por_hora', 50),
  ('t-prof2', 'Professora Dois', '#111111', 'por_hora', 60);
insert into public.colaboradores (id, nome, perfil, professor_id) values
  ('00000000-0000-0000-0000-000000000001', 'Dono Teste', 'dono', null),
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao', null),
  ('00000000-0000-0000-0000-000000000003', 'Professor Teste', 'professor', 't-prof');

-- Datas relativas a hoje: h(n) = hoje + n dias; d(n) = a mesma data como a tela mostra.
create function pg_temp.h(n int) returns date language sql as $$ select privado.hoje() + n $$;
create function pg_temp.d(n int) returns text language sql as $$
  select to_char(privado.hoje() + n, 'DD/MM/YYYY') $$;
create function pg_temp.entrar_como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  set local role authenticated;
$$;
-- Participantes de uma aula, em ordem.
create function pg_temp.quem(p_ocupacao text) returns text language sql as $$
  select coalesce(string_agg(aluno_id, ',' order by aluno_id), '')
    from public.ocupacao_alunos where ocupacao_id = p_ocupacao $$;
-- Guarda o retorno de uma funcao para varios testes.
create function pg_temp.guardar(p_nome text, p_valor jsonb) returns jsonb language sql as $$
  select set_config('teste.' || p_nome, p_valor::text, true)::jsonb $$;
create function pg_temp.lido(p_nome text) returns jsonb language sql as $$
  select current_setting('teste.' || p_nome)::jsonb $$;

insert into public.planos (id, nome, tipo, valor_mensal, aulas_por_semana, duracao_minutos, tabela) values
  ('pl-ind', 'Individual · 1x por semana', 'Individual', 720, 1, 60, 'nova'),
  ('pl-dup', 'Dupla · 1x por semana', 'Dupla', 520, 1, 60, 'nova'),
  ('pl-lap', 'LAP · 1x por semana', 'LAP', 380, 1, 60, 'nova'),
  ('pl-antigo', 'Plano de locação antigo', 'Plano de locação', 300, 1, 60, 'antiga');
insert into public.alunos (id, nome) values
  ('x1', 'Ana Teste'), ('x2', 'Bruno Teste'), ('x3', 'Carla Teste'), ('x4', 'Davi Teste');
insert into public.matriculas (id, aluno_id, plano_id, valor_mensal, dia_vencimento, inicio, fim) values
  ('mt-x1', 'x1', 'pl-ind', 720, 5, pg_temp.h(-60), null),
  ('mt-x2', 'x2', 'pl-dup', 520, 10, pg_temp.h(-60), null),
  ('mt-x4', 'x4', 'pl-antigo', 300, 10, pg_temp.h(-200), pg_temp.h(-100));
insert into public.horarios_fixos (id, quadra_id, dia_semana, hora_inicio, hora_fim, tipo, professor_id, inicio) values
  ('hf-ind', '1', 2, '10:00', '11:00', 'Individual', 't-prof', pg_temp.h(-60)),
  ('hf-dup', '2', 4, '18:00', '19:00', 'Dupla', 't-prof2', pg_temp.h(-60));
insert into public.horario_alunos (id, horario_fixo_id, aluno_id) values
  ('ha-ind-x1', 'hf-ind', 'x1'), ('ha-dup-x1', 'hf-dup', 'x1'), ('ha-dup-x2', 'hf-dup', 'x2');
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, professor_id, horario_fixo_id, situacao) values
  ('oc-i0', '1', pg_temp.h(-5), '10:00', '11:00', 'Individual', 't-prof', 'hf-ind', 'realizada'),
  ('oc-i1', '1', pg_temp.h(2), '10:00', '11:00', 'Individual', 't-prof', 'hf-ind', 'agendada'),
  ('oc-i2', '1', pg_temp.h(9), '10:00', '11:00', 'Individual', 't-prof', 'hf-ind', 'agendada'),
  ('oc-i3', '1', pg_temp.h(16), '10:00', '11:00', 'Individual', 't-prof', 'hf-ind', 'agendada'),
  ('oc-i4', '1', pg_temp.h(30), '10:00', '11:00', 'Individual', 't-prof', 'hf-ind', 'agendada'),
  ('oc-d1', '2', pg_temp.h(3), '18:00', '19:00', 'Dupla', 't-prof2', 'hf-dup', 'agendada'),
  ('oc-d2', '2', pg_temp.h(10), '18:00', '19:00', 'Dupla', 't-prof2', 'hf-dup', 'agendada'),
  ('oc-d3', '2', pg_temp.h(31), '18:00', '19:00', 'Dupla', 't-prof2', 'hf-dup', 'agendada'),
  ('oc-rep', '3', pg_temp.h(5), '08:00', '09:00', 'Individual', 't-prof', null, 'agendada');
insert into public.ocupacao_alunos (ocupacao_id, aluno_id) values
  ('oc-i0', 'x1'), ('oc-i1', 'x1'), ('oc-i2', 'x1'), ('oc-i3', 'x1'), ('oc-i4', 'x1'),
  ('oc-d1', 'x1'), ('oc-d1', 'x2'), ('oc-d2', 'x1'), ('oc-d2', 'x2'), ('oc-d3', 'x1'), ('oc-d3', 'x2'),
  ('oc-rep', 'x1');

-- =============================================================================
-- Permissoes
-- =============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.congelar_plano('x1', pg_temp.h(1), pg_temp.h(20), 'Viagem') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'professor nao congela plano (so consulta)'
);
reset role;

-- Congelar mexe na agenda: sem permissao de gravar na agenda, e recusado.
update public.configuracoes
   set permissoes = jsonb_set(permissoes, '{recepcao}', '["painel", "alunos", "professores"]')
 where id = 1;
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.congelar_plano('x1', pg_temp.h(1), pg_temp.h(20), 'Viagem') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'congelar exige permissao de gravar em alunos e na agenda'
);
reset role;
update public.configuracoes
   set permissoes = jsonb_set(permissoes, '{recepcao}',
     '["painel", "agenda", "alunos", "professores", "financeiro", "estoque", "ranking"]')
 where id = 1;

-- =============================================================================
-- Congelamento (H4)
-- =============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select is(
  (pg_temp.guardar('congelar', public.congelar_plano('x1', pg_temp.h(1), pg_temp.h(20), '  Viagem   longa ')) ->> 'aulas_suspensas')::int,
  5,
  'congelar suspende as 5 aulas fixas do periodo'
);
select is(
  (select situacao || '/' || motivo_cancelamento from public.ocupacoes where id = 'oc-i2'),
  'cancelada/Congelamento',
  'a aula que era so dela e cancelada com o motivo Congelamento'
);
select is(pg_temp.quem('oc-d2'), 'x2', 'na dupla a aula continua e so ela sai');
select ok(
  (select situacao = 'agendada' from public.ocupacoes where id = 'oc-i4')
  and pg_temp.quem('oc-d3') = 'x1,x2'
  and pg_temp.quem('oc-rep') = 'x1'
  and (select situacao = 'realizada' from public.ocupacoes where id = 'oc-i0'),
  'fora do periodo nada muda, nem a reposicao avulsa'
);
select is((select count(*)::int from public.reposicoes), 0, 'congelar nao gera credito de reposicao');
select is(
  (select motivo || ':' || jsonb_array_length(aulas_suspensas) || ':' || (aulas_suspensas -> 0 ->> 'ocupacaoId')
     from public.congelamentos where id = pg_temp.lido('congelar') ->> 'congelamento_id'),
  'Viagem longa:5:oc-i1',
  'o congelamento guarda o motivo limpo e as aulas suspensas, por data'
);

select throws_ok(
  $$ select public.congelar_plano('x1', pg_temp.h(25), pg_temp.h(28), 'Férias') $$,
  'P0001',
  format('Já existe um congelamento a partir de %s, sem volta registrada. Reative o plano antes de congelar de novo.', pg_temp.d(1)),
  'congelamento sem volta impede outro'
);
select throws_ok(
  $$ select public.trocar_plano('mt-x1', 'pl-lap', 380, 5, pg_temp.h(15)) $$,
  'P0001',
  'O plano atual está congelado (ou tem congelamento marcado) nesse período. Reative ou desmarque o congelamento antes de trocar de plano.',
  'plano congelado nao troca'
);
select throws_ok(
  $$ select public.congelar_plano('x2', pg_temp.h(1), pg_temp.h(5), '   ') $$,
  'P0001', 'Informe o motivo do congelamento.',
  'congelar exige motivo'
);
select throws_ok(
  $$ select public.congelar_plano('x3', pg_temp.h(1), pg_temp.h(5), 'Viagem') $$,
  'P0001', format('Carla Teste não tem matrícula valendo em %s.', pg_temp.d(1)),
  'congelar exige matricula valendo'
);
select throws_ok(
  $$ select public.congelar_plano('x2', pg_temp.h(5), pg_temp.h(1), 'Viagem') $$,
  'P0001', 'O fim previsto precisa ser no mesmo dia do início ou depois.',
  'fim previsto antes do inicio e recusado'
);
select throws_ok(
  $$ select public.congelar_plano('x2', pg_temp.h(800), pg_temp.h(810), 'Viagem') $$,
  'P0001', 'O início do congelamento precisa estar a até um ano de hoje. Confira o ano.',
  'data a mais de um ano e recusada'
);
reset role;

select ok(
  exists (select 1 from public.auditoria where tabela = 'congelamentos' and acao = 'criar'
            and operacao = 'Congelar plano' and usuario_nome = 'Recepção Teste')
  and exists (select 1 from public.auditoria where tabela = 'ocupacoes' and registro_id = 'oc-i2'
                and operacao = 'Congelar plano'),
  'a auditoria grava o nome da operacao no congelamento e nas aulas'
);

-- =============================================================================
-- Reativacao
-- =============================================================================
-- Enquanto a aula de h(16) estava cancelada, a quadra foi alugada.
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
values ('oc-av', '1', pg_temp.h(16), '10:00', '11:00', 'Locação Avulsa');
insert into public.ocupacao_alunos (ocupacao_id, aluno_id) values ('oc-av', 'x3');

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select is(
  (pg_temp.guardar('reativar', public.reativar_plano(pg_temp.lido('congelar') ->> 'congelamento_id', pg_temp.h(8))) ->> 'voltaram')::int,
  2,
  'reativar devolve as aulas suspensas da data de volta em diante'
);
select is(
  pg_temp.lido('reativar') -> 'nao_voltaram' -> 0 ->> 'ocupacao_id' || ' · ' ||
  (pg_temp.lido('reativar') -> 'nao_voltaram' -> 0 ->> 'motivo'),
  'oc-i3 · Quadra 1 já ocupada das 10:00 às 11:00 (Locação Avulsa · Carla Teste)',
  'a aula cuja quadra foi ocupada no meio-tempo nao volta, e a tela sabe por que'
);
select is(
  (select situacao || coalesce(motivo_cancelamento, '') || coalesce(cancelada_em::text, '')
     from public.ocupacoes where id = 'oc-i2'),
  'agendada',
  'a aula individual volta a ser agendada'
);
select is(pg_temp.quem('oc-d2'), 'x1,x2', 'ela volta para a lista da dupla');
select ok(
  (select situacao = 'cancelada' from public.ocupacoes where id = 'oc-i1')
  and pg_temp.quem('oc-d1') = 'x2'
  and (select situacao = 'cancelada' from public.ocupacoes where id = 'oc-i3'),
  'antes da volta (e a da quadra ocupada) continuam suspensas'
);
select is(
  (select fim_real from public.congelamentos where id = pg_temp.lido('congelar') ->> 'congelamento_id'),
  pg_temp.h(7),
  'o congelamento termina na vespera da volta'
);
select throws_ok(
  $$ select public.reativar_plano(pg_temp.lido('congelar') ->> 'congelamento_id', pg_temp.h(8)) $$,
  'P0001', 'Este congelamento já foi encerrado.',
  'nao reativa duas vezes'
);

-- Voltar antes do inicio anula o congelamento (Bruno, da dupla).
select is(
  (pg_temp.guardar('congelar2', public.congelar_plano('x2', pg_temp.h(2), pg_temp.h(12), 'Lesão')) ->> 'aulas_suspensas')::int,
  2,
  'congelar o Bruno suspende as duas aulas da dupla no periodo'
);
select is(
  (select situacao from public.ocupacoes where id = 'oc-d1'),
  'cancelada',
  'a aula em que so ele restava e cancelada'
);
select is(
  (public.reativar_plano(pg_temp.lido('congelar2') ->> 'congelamento_id', pg_temp.h(0)) ->> 'voltaram')::int,
  2,
  'voltar antes do inicio devolve tudo'
);
select is(
  (select fim_real from public.congelamentos where id = pg_temp.lido('congelar2') ->> 'congelamento_id'),
  pg_temp.h(1),
  'o congelamento fica anulado (fim na vespera do inicio)'
);
select lives_ok(
  $$ select public.congelar_plano('x2', pg_temp.h(2), pg_temp.h(12), 'Lesão') $$,
  'congelamento anulado nao impede outro no mesmo periodo'
);

-- =============================================================================
-- Matricula
-- =============================================================================
select pg_temp.guardar('troca', to_jsonb(public.trocar_plano('mt-x1', 'pl-dup', 500, 10, pg_temp.h(20))));
select is(
  (select fim from public.matriculas where id = 'mt-x1'),
  pg_temp.h(19),
  'troca de plano encerra a matricula atual na vespera'
);
select is(
  (select plano_id || ':' || valor_mensal || ':' || dia_vencimento || ':' || (inicio = pg_temp.h(20)) || ':' || coalesce(fim::text, 'sem fim')
     from public.matriculas where id = pg_temp.lido('troca') #>> '{}'),
  'pl-dup:500.00:10:true:sem fim',
  'e abre a nova com o plano, o valor e o vencimento novos'
);
select throws_ok(
  $$ select public.trocar_plano('mt-x2', 'pl-lap', 380, 5, pg_temp.h(-60)) $$,
  'P0001', format('O novo plano precisa começar depois de %s, quando começou o plano atual.', pg_temp.d(-60)),
  'a troca precisa comecar depois da matricula atual'
);
select is(
  public.cancelar_matricula_agendada(pg_temp.lido('troca') #>> '{}'),
  'mt-x1',
  'desmarcar a troca agendada devolve o plano anterior'
);
select is(
  (select count(*)::int || ':' || coalesce(max(fim)::text, 'sem fim') from public.matriculas where aluno_id = 'x1'),
  '1:sem fim',
  'a matricula anterior volta a valer sem data de fim'
);
select throws_ok(
  $$ select public.cancelar_matricula_agendada('mt-x1') $$,
  'P0001', 'Esta matrícula já começou. Para terminá-la, use "Encerrar matrícula".',
  'matricula que ja comecou nao e agendada'
);
select throws_ok(
  $$ select public.criar_matricula('x1', 'pl-lap', 380, 5, pg_temp.h(15)) $$,
  'P0001',
  format('O aluno já tem uma matrícula a partir de %s, sem data de fim. Use "Trocar de plano" ou encerre a matrícula atual.', pg_temp.d(-60)),
  'duas matriculas nao valem ao mesmo tempo'
);
select pg_temp.guardar('matricula', to_jsonb(public.criar_matricula('x3', 'pl-lap', 380.004, 5, pg_temp.h(0))));
select is(
  (select plano_id || ':' || valor_mensal from public.matriculas
    where id = pg_temp.lido('matricula') #>> '{}'),
  'pl-lap:380.00',
  'nova matricula para quem nao tem'
);
select throws_ok(
  $$ select public.criar_matricula('x3', 'nao-existe', 380, 5, pg_temp.h(40)) $$,
  'P0001', 'Escolha o plano.', 'plano inexistente e recusado'
);
select throws_ok(
  $$ select public.criar_matricula('x3', 'pl-lap', 0, 5, pg_temp.h(40)) $$,
  'P0001', 'Informe o valor combinado da mensalidade (maior que zero).', 'valor zerado e recusado'
);
select throws_ok(
  $$ select public.criar_matricula('x3', 'pl-lap', 380, 31, pg_temp.h(40)) $$,
  'P0001', 'O dia de vencimento precisa ser de 1 a 28.', 'vencimento fora de 1 a 28 e recusado'
);
select throws_ok(
  $$ select public.encerrar_matricula((select id from public.matriculas where aluno_id = 'x3'), pg_temp.h(-1)) $$,
  'P0001', format('A matrícula começou em %s: o último dia não pode ser antes disso.', pg_temp.d(0)),
  'encerrar antes do inicio e recusado'
);
select lives_ok(
  $$ select public.encerrar_matricula((select id from public.matriculas where aluno_id = 'x3'), pg_temp.h(10)) $$,
  'encerra a matricula no ultimo dia'
);
select throws_ok(
  $$ select public.criar_matricula('x3', 'pl-lap', 380, 5, pg_temp.h(5)) $$,
  'P0001',
  format('O aluno já tem uma matrícula de %s a %s: duas matrículas não podem valer ao mesmo tempo.', pg_temp.d(0), pg_temp.d(10)),
  'depois de encerrar, so comeca outra depois do ultimo dia'
);

-- =============================================================================
-- Inativacao
-- =============================================================================
-- Ana: troca de plano marcada (h60) e congelamento marcado (h40 a h50).
select public.trocar_plano('mt-x1', 'pl-lap', 380, 5, pg_temp.h(60));
select lives_ok(
  $$ select public.congelar_plano('x1', pg_temp.h(40), pg_temp.h(50), 'Férias') $$,
  'troca e congelamento marcados para depois'
);
select throws_ok(
  $$ select public.inativar_aluno('x1', pg_temp.h(1)) $$,
  'P0001',
  'O último dia não pode ser depois de hoje. Para uma saída futura, encerre a matrícula nessa data e inative o aluno quando ele sair.',
  'ultimo dia no futuro e recusado'
);
select lives_ok(
  $$ select public.inativar_aluno('x1', pg_temp.h(0), '  Mudou de   cidade ') $$,
  'inativa a aluna'
);
select is((select ativo from public.alunos where id = 'x1'), false, 'a aluna fica inativa');
select is(
  (select string_agg(id || ':' || (fim = pg_temp.h(0)), ',') from public.matriculas where aluno_id = 'x1'),
  'mt-x1:true',
  'a matricula termina hoje e a que ainda nao tinha comecado sai'
);
select is(
  (select c.fim_real from public.congelamentos c where c.matricula_id = 'mt-x1' and c.inicio = pg_temp.h(40)),
  pg_temp.h(39),
  'o congelamento marcado para depois da saida fica anulado'
);
select ok(
  (select situacao || '/' || motivo_cancelamento = 'cancelada/Aluno inativado' from public.ocupacoes where id = 'oc-i4')
  and pg_temp.quem('oc-d3') = 'x2',
  'as aulas fixas depois da saida saem da agenda (a dela e cancelada, na dupla ela sai)'
);
select ok(
  (select fim = pg_temp.h(0) from public.horarios_fixos where id = 'hf-ind')
  and (select fim is null from public.horarios_fixos where id = 'hf-dup')
  and (select string_agg(id, ',' order by id) from public.horario_alunos where aluno_id = 'x1') = 'ha-ind-x1',
  'o horario fixo so dela termina; no da dupla ela sai da lista'
);
select ok(
  pg_temp.quem('oc-rep') = 'x1'
  and (select situacao = 'agendada' from public.ocupacoes where id = 'oc-rep')
  and (select count(*) = 0 from public.reposicoes),
  'reserva avulsa nao muda e nao ha credito'
);
select is(
  (select texto || ' · ' || autor_nome from public.comentarios where entidade = 'aluno' and entidade_id = 'x1'),
  'Aluno inativado. Motivo: Mudou de cidade · Recepção Teste',
  'o motivo vira comentario na ficha'
);
select throws_ok(
  $$ select public.inativar_aluno('x1', pg_temp.h(0)) $$,
  'P0001', 'Ana Teste já está inativo.', 'nao inativa duas vezes'
);
select throws_ok(
  $$ select public.criar_matricula('x1', 'pl-ind', 720, 5, pg_temp.h(30)) $$,
  'P0001', 'Ana Teste está inativo. Reative o cadastro antes.', 'aluno inativo nao recebe matricula'
);

-- =============================================================================
-- Comentarios
-- =============================================================================
select pg_temp.guardar('comentario', to_jsonb(public.adicionar_comentario('aluno', 'x2', '  Ligar amanhã  ')));
select is(
  (select texto || ' · ' || autor_nome from public.comentarios
    where id = pg_temp.lido('comentario') #>> '{}'),
  'Ligar amanhã · Recepção Teste',
  'comentario com texto limpo e o autor de quem esta logado'
);
select throws_ok(
  $$ select public.adicionar_comentario('aluno', 'x2', '   ') $$,
  'P0001', 'Escreva o comentário antes de salvar.', 'comentario vazio e recusado'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select lives_ok(
  $$ select public.adicionar_comentario('aluno', 'x2', 'Professor também comenta') $$,
  'professor tambem comenta'
);
select throws_ok(
  $$ select public.editar_comentario(pg_temp.lido('comentario') #>> '{}', 'Outro texto') $$,
  'P0001', 'Só quem escreveu o comentário pode editá-lo.', 'nao edita comentario dos outros'
);
select throws_ok(
  $$ select public.apagar_comentario(pg_temp.lido('comentario') #>> '{}') $$,
  'P0001', 'Só quem escreveu o comentário pode apagá-lo.', 'nao apaga comentario dos outros'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select public.editar_comentario(pg_temp.lido('comentario') #>> '{}', ' Ligar na sexta ');
select is(
  (select texto || ':' || (editado_em is not null) from public.comentarios
    where id = pg_temp.lido('comentario') #>> '{}'),
  'Ligar na sexta:true',
  'quem escreveu edita, e a hora da edicao fica gravada'
);
select throws_ok(
  $$ select public.editar_comentario(pg_temp.lido('comentario') #>> '{}', '') $$,
  'P0001', 'O comentário não pode ficar vazio.', 'edicao nao deixa vazio'
);
select public.apagar_comentario(pg_temp.lido('comentario') #>> '{}');
select is(
  (select count(*)::int from public.comentarios where id = pg_temp.lido('comentario') #>> '{}'),
  0,
  'quem escreveu apaga'
);
reset role;
select is(
  (select string_agg(operacao, ',' order by id) from public.auditoria
    where tabela = 'comentarios' and registro_id = pg_temp.lido('comentario') #>> '{}'),
  'Adicionar comentário,Editar comentário,Apagar comentário',
  'a auditoria grava cada operacao do comentario'
);

-- =============================================================================
-- Professores (H9): a recepcao corrige o contato; so o dono mexe no repasse
-- =============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
update public.professores set telefone = '(11) 97777-1234' where id = 't-prof2';
select is(
  (select telefone from public.professores where id = 't-prof2'),
  '(11) 97777-1234',
  'recepcao corrige o contato do professor'
);
select throws_ok(
  $$ update public.professores set repasse_valor = 90 where id = 't-prof2' $$,
  'P0001', 'Só o dono cadastra professores e altera a regra de repasse.',
  'recepcao nao muda a regra de repasse'
);
select throws_ok(
  $$ insert into public.professores (nome, cor) values ('Paula Teste', '#123ABC') $$,
  '42501', null,
  'recepcao nao cadastra professor'
);
reset role;
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
update public.professores set repasse_modo = 'percentual', repasse_valor = 35 where id = 't-prof2';
select is(
  (select repasse_modo || ':' || repasse_valor from public.professores where id = 't-prof2'),
  'percentual:35.00',
  'o dono muda a regra de repasse'
);
reset role;

-- =============================================================================
-- Configuracoes (so o dono)
-- =============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.salvar_parametros(p_prazo_pagamento_reserva_horas => 48) $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'recepcao nao altera as configuracoes'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select public.salvar_parametros(p_prazo_pagamento_reserva_horas => 48);
select is(
  (select prazo_pagamento_reserva_horas::int || ':' || validade_reposicao_meses from public.configuracoes),
  '48:3',
  'o dono altera um parametro e os outros ficam como estao'
);
select throws_ok(
  $$ select public.salvar_parametros(p_validade_reposicao_meses => 1.5) $$,
  'P0001', 'A validade da reposição precisa ser de pelo menos 1 mês (número inteiro).',
  'validade da reposicao em meses inteiros'
);
select throws_ok(
  $$ select public.salvar_parametros(p_pontos_vitoria => 1, p_pontos_derrota => 3) $$,
  'P0001', 'A vitória precisa valer pelo menos tanto quanto a derrota.',
  'vitoria vale pelo menos a derrota'
);
select throws_ok(
  $$ select public.salvar_parametros(p_semanas_geradas_a_frente => 53) $$,
  'P0001', 'As semanas da agenda geradas à frente precisam ficar entre 1 e 52.',
  'semanas geradas a frente entre 1 e 52'
);
select throws_ok(
  $$ select public.salvar_parametros(p_formas_pagamento => '["Stone", "Pix", " stone "]') $$,
  'P0001', 'A forma de pagamento "stone" aparece duas vezes.',
  'forma de pagamento repetida e recusada'
);
select public.salvar_parametros(p_formas_pagamento => '[" Pix ", "Dinheiro"]');
select is(
  (select formas_pagamento from public.configuracoes),
  '["Pix", "Dinheiro"]'::jsonb,
  'formas de pagamento gravadas sem espacos nas pontas'
);
select public.salvar_parametros(
  p_criterios_desempate => '["Saldo de games", "Saldo de sets", "Confronto direto", "Vitórias"]');
select is(
  (select criterios_desempate ->> 0 from public.configuracoes),
  'Saldo de games',
  'criterios de desempate mudam de ordem'
);
select throws_ok(
  $$ select public.salvar_parametros(
       p_criterios_desempate => '["Vitórias", "Sorteio", "Saldo de sets", "Saldo de games"]') $$,
  'P0001', 'Os critérios de desempate só podem mudar de ordem.',
  'criterio novo e recusado'
);

-- Siglas (H1)
select public.incluir_sigla(' AT ', 'Atestado', 'Aluno apresentou atestado.', true, 'aluno');
select is(
  (select siglas -> -1 from public.configuracoes),
  '{"codigo": "AT", "nome": "Atestado", "descricao": "Aluno apresentou atestado.", "geraCredito": true, "aplicaA": "aluno"}'::jsonb,
  'inclui sigla nova com o codigo limpo'
);
select throws_ok(
  $$ select public.incluir_sigla('ch', 'Chuva de novo', '', true, 'ocupacao') $$,
  'P0001', 'Já existe a sigla "CH". Escolha outro código.',
  'codigo repetido (sem diferenciar maiusculas) e recusado'
);
select throws_ok(
  $$ select public.incluir_sigla('C H', 'Com espaço', '', true, 'ocupacao') $$,
  'P0001', 'O código da sigla precisa ter de 1 a 6 letras ou números, sem espaços.',
  'codigo invalido e recusado'
);
reset role;
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, situacao, motivo_cancelamento)
values ('oc-chuva', '4', pg_temp.h(3), '08:00', '09:00', 'Locação Avulsa', 'cancelada', 'CH');
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.editar_sigla('CH', (select s from public.configuracoes, jsonb_array_elements(siglas) s
                                         where s ->> 'codigo' = 'CH') || '{"codigo": "CHU"}') $$,
  'P0001',
  'A sigla CH já foi usada em aulas ou créditos de reposição, por isso o código não pode mudar. Crie uma sigla nova e desative esta.',
  'codigo de sigla ja usada nao muda'
);
select public.editar_sigla('CH', (select s from public.configuracoes, jsonb_array_elements(siglas) s
                                   where s ->> 'codigo' = 'CH') || '{"nome": "Chuva forte"}');
select is(
  (select siglas -> 0 ->> 'codigo' || ':' || (siglas -> 0 ->> 'nome') from public.configuracoes),
  'CH:Chuva forte',
  'edita o nome da sigla, no mesmo lugar da lista'
);
select public.editar_sigla('AT', '{"codigo": "ATM", "nome": "Atestado", "descricao": "", "geraCredito": true, "aplicaA": "aluno"}');
select is(
  (select siglas -> -1 ->> 'codigo' from public.configuracoes),
  'ATM',
  'o codigo de uma sigla ainda nao usada pode mudar'
);
select public.desativar_sigla('TIP');
select is(
  (select (s ->> 'desativada')::boolean from public.configuracoes, jsonb_array_elements(siglas) s
    where s ->> 'codigo' = 'TIP'),
  true,
  'desativar tira a sigla dos formularios sem apaga-la'
);
select public.reativar_sigla('TIP');
select is(
  (select (s ->> 'desativada')::boolean from public.configuracoes, jsonb_array_elements(siglas) s
    where s ->> 'codigo' = 'TIP'),
  false,
  'reativar devolve a sigla'
);
select throws_ok(
  $$ select public.desativar_sigla('XYZ') $$,
  'P0001', 'Sigla não encontrada.', 'sigla inexistente'
);

-- Planos (H2, H3)
select pg_temp.guardar('plano', to_jsonb(public.incluir_plano(' Individual · 2x por semana ', 'Individual', 1280, 2, 60, 'nova', true)));
select is(
  (select nome || ':' || valor_mensal || ':' || ativo from public.planos
    where id = pg_temp.lido('plano') #>> '{}'),
  'Individual · 2x por semana:1280.00:true',
  'inclui plano novo'
);
select throws_ok(
  $$ select public.incluir_plano('  LAP · 1X POR SEMANA ', 'LAP', 400, 1, 60, 'nova', true) $$,
  'P0001', 'Já existe um plano chamado "LAP · 1x por semana".',
  'nome de plano repetido e recusado'
);
select throws_ok(
  $$ select public.incluir_plano('Plano curto', 'LAP', 400, 1, 10, 'nova', true) $$,
  'P0001', 'A duração da aula precisa ficar entre 15 e 240 minutos.',
  'duracao fora dos limites e recusada'
);
select throws_ok(
  $$ select public.apagar_plano('pl-ind') $$,
  'P0001',
  'O plano "Individual · 1x por semana" tem 1 matrícula(s) vigente(s) e não pode ser apagado. Desative-o: ele deixa de ser oferecido e quem já tem continua com ele.',
  'plano com matricula vigente nao e apagado'
);
select throws_ok(
  $$ select public.apagar_plano('pl-antigo') $$,
  'P0001',
  'O plano "Plano de locação antigo" aparece no histórico de 1 matrícula(s) e não pode ser apagado. Desative-o para que deixe de ser oferecido.',
  'plano que so aparece no historico tambem nao e apagado'
);
select public.apagar_plano(pg_temp.lido('plano') #>> '{}');
select is(
  (select count(*)::int from public.planos where id = pg_temp.lido('plano') #>> '{}'),
  0,
  'plano sem matricula e apagado'
);
select throws_ok(
  $$ select public.editar_plano('pl-ind', 'Individual · 1x por semana', 'Dupla', 720, 1, 60, 'nova', true) $$,
  'P0001',
  'O plano "Individual · 1x por semana" já tem matrículas, por isso o tipo não pode mudar. Crie um plano novo e desative este.',
  'o tipo so muda em plano sem matricula'
);
select public.editar_plano('pl-ind', 'Individual · 1x por semana', 'Individual', 800, 1, 60, 'nova', true);
select is(
  (select p.valor_mensal || ':' || m.valor_mensal from public.planos p, public.matriculas m
    where p.id = 'pl-ind' and m.id = 'mt-x1'),
  '800.00:720.00',
  'mudar o valor do plano nao muda o valor das matriculas (H3)'
);

-- Permissoes (H9)
select throws_ok(
  $$ select public.alterar_permissoes(jsonb_set(
       (select permissoes from public.configuracoes), '{dono}', '["painel", "agenda"]')) $$,
  'P0001', 'O dono não pode tirar o próprio acesso às Configurações.',
  'o dono nao tira o proprio acesso as configuracoes'
);
select throws_ok(
  $$ select public.alterar_permissoes(jsonb_set(
       (select permissoes from public.configuracoes), '{recepcao}', '["agenda", "configuracoes"]')) $$,
  'P0001', 'Só o perfil Dono pode ter acesso às Configurações.',
  'so o dono tem as configuracoes'
);
select throws_ok(
  $$ select public.alterar_permissoes(jsonb_set(
       (select permissoes from public.configuracoes), '{professor}', '["agenda", "alunos", "financeiro_pagar"]')) $$,
  'P0001', 'Para ver as contas a pagar, o perfil Professor precisa ter acesso ao Financeiro.',
  'contas a pagar exigem o financeiro'
);
select public.alterar_permissoes(jsonb_set(
  (select permissoes from public.configuracoes), '{recepcao}',
  '["historico", "painel", "agenda", "alunos", "professores", "financeiro", "ranking", "historico", "modulo-inventado"]'));
select is(
  (select permissoes -> 'recepcao' from public.configuracoes),
  '["painel", "agenda", "alunos", "professores", "financeiro", "ranking", "historico"]'::jsonb,
  'permissoes gravadas sem repeticao, sem modulo desconhecido e na ordem padrao'
);
reset role;

select is(
  (select string_agg(distinct operacao, ',' order by operacao) from public.auditoria where tabela = 'configuracoes'
      and operacao in ('Alterar configurações', 'Incluir sigla de reposição', 'Alterar permissões')),
  'Alterar configurações,Alterar permissões,Incluir sigla de reposição',
  'a auditoria das configuracoes grava o nome de cada operacao'
);

select * from finish();
rollback;
