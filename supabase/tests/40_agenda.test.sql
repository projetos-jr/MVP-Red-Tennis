-- Funcoes da agenda e da reposicao (migracao 20261030120100_funcoes_agenda).
-- Mesmos casos de src/lib/banco/operacoes/agenda.test.ts que se aplicam ao
-- banco. As datas sao relativas a hoje (privado.hoje()), porque agendar exige
-- data de hoje em diante. Ids devolvidos ficam guardados em `t.*` (set_config).
begin;
create extension if not exists pgtap with schema extensions;
select plan(88);

-- ---------------------------------------------------------------------------
-- Cadastros do teste (dados inventados)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'dono@teste'),
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste'),
  ('00000000-0000-0000-0000-000000000003', 'professor@teste');
insert into public.professores (id, nome, cor) values
  ('t-prof', 'Professor Teste', '#000000'),
  ('t-prof2', 'Renata Teste', '#111111');
insert into public.colaboradores (id, nome, perfil, professor_id) values
  ('00000000-0000-0000-0000-000000000001', 'Dono Teste', 'dono', null),
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao', null),
  ('00000000-0000-0000-0000-000000000003', 'Professor Teste', 'professor', 't-prof');
insert into public.alunos (id, nome, ativo) values
  ('t-ana', 'Ana Teste', true),
  ('t-bruno', 'Bruno Teste', true),
  ('t-carla', 'Carla Teste', true),
  ('t-davi', 'Davi Teste', true),
  ('t-fabio', 'Fabio Teste', true),
  ('t-eva', 'Eva Teste', false);

-- Entra como alguem: o papel "authenticated" com o id do usuario.
create function pg_temp.entrar_como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  set local role authenticated;
$$;

-- ===========================================================================
-- Horario avulso e conflito de quadra
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');

select lives_ok(
  $$ select set_config('t.a1', public.criar_horario_avulso(
       p_quadra_id => '1', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']), true) $$,
  'recepcao cria uma aula avulsa'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '1', p_data => privado.hoje() + 2, p_hora_inicio => '10:30', p_hora_fim => '11:30',
       p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']) $$,
  'P0001',
  format('Quadra 1 já está ocupada em %s das 10:00 às 11:00 (Individual · Ana Teste).',
         to_char(privado.hoje() + 2, 'DD/MM')),
  'recusa outra ocupacao na mesma quadra e horario, dizendo quem ocupa'
);

select lives_ok(
  $$ select set_config('t.a2', public.criar_horario_avulso(
       p_quadra_id => '1', p_data => privado.hoje() + 2, p_hora_inicio => '11:00', p_hora_fim => '12:00',
       p_tipo => 'Individual', p_professor_id => 't-prof2', p_alunos_ids => array['t-davi']), true) $$,
  'aceita a aula que comeca quando a outra termina (11:00-12:00)'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() - 1, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']) $$,
  'P0001', 'Escolha uma data a partir de hoje.',
  'recusa data passada'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '21:30', p_hora_fim => '22:30',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']) $$,
  'P0001', 'A arena funciona das 07:00 às 22:00.',
  'recusa horario fora do funcionamento'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_alunos_ids => array['t-ana']) $$,
  'P0001', 'Escolha o professor da aula.',
  'recusa aula sem professor'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array[]::text[]) $$,
  'P0001', 'Escolha pelo menos um aluno.',
  'recusa aula sem aluno'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-eva']) $$,
  'P0001', 'Eva Teste não está mais ativo na arena.',
  'recusa aluno que saiu da arena'
);

select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Bloqueio', p_alunos_ids => array['t-ana']) $$,
  'P0001', 'Para fechar a quadra, use “Bloquear quadra”.',
  'bloqueio nao e marcado como horario avulso'
);

-- H10: professor em duas aulas ao mesmo tempo.
reset role;
update public.configuracoes set bloquear_professor_em_duas_aulas = true where id = 1;
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-bruno']) $$,
  'P0001',
  format('Professor Teste já tem aula em %s das 10:00 às 11:00 (Quadra 1).', to_char(privado.hoje() + 2, 'DD/MM')),
  'com a opcao ligada, recusa o professor em duas aulas ao mesmo tempo (H10)'
);
reset role;
update public.configuracoes set bloquear_professor_em_duas_aulas = false where id = 1;
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ select set_config('t.a3', public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-bruno']), true) $$,
  'com a opcao desligada (padrao), grava o professor em duas aulas (H10)'
);

-- Locacao avulsa (H5).
select lives_ok(
  $$ select set_config('t.l1', public.criar_horario_avulso(
       p_quadra_id => '2', p_data => privado.hoje() + 2, p_hora_inicio => '19:00', p_hora_fim => '20:00',
       p_tipo => 'Locação Avulsa', p_professor_id => 't-prof', p_alunos_ids => array['t-davi', 't-carla']), true) $$,
  'recepcao marca uma locacao avulsa'
);
select is(
  (select situacao || ' · ' || coalesce(professor_id, 'sem professor') || ' · '
          || (prazo_pagamento = now() + interval '24 hours')::text
     from public.ocupacoes where id = current_setting('t.l1')),
  'aguardando_pagamento · sem professor · true',
  'locacao avulsa nasce aguardando pagamento, sem professor, com prazo de 24 h (H5)'
);
select is(
  (select format('%s|%s|%s|%s|%s|%s', tipo, categoria, pessoa_id, valor, vencimento, item)
     from public.lancamentos where ocupacao_id = current_setting('t.l1')),
  format('receber|Locação|t-davi|120.00|%s|Locação avulsa · Quadra 2 · %s 19:00',
         ((now() + interval '24 hours') at time zone 'America/Sao_Paulo')::date,
         to_char(privado.hoje() + 2, 'DD/MM')),
  'a locacao cria a cobranca a receber do titular, vencendo no prazo da reserva'
);
select set_config('t.l2', public.criar_horario_avulso(
  p_quadra_id => '3', p_data => privado.hoje(), p_hora_inicio => '21:00', p_hora_fim => '22:00',
  p_tipo => 'Locação Avulsa', p_alunos_ids => array['t-davi']), true);
select is(
  (select prazo_pagamento from public.ocupacoes where id = current_setting('t.l2')),
  (privado.hoje() + time '21:00') at time zone 'America/Sao_Paulo',
  'o prazo da reserva nunca passa do inicio dela'
);
-- Depois das 21:00 esta reserva ja nasce vencida: sai da frente dos testes de H5.
select public.cancelar_ocupacao(current_setting('t.l2'), 'Teste');
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '4', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']) $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'o perfil de professor so consulta a agenda (H9)'
);
reset role;

select is(
  (select operacao from public.auditoria
    where tabela = 'ocupacoes' and acao = 'criar' and registro_id = current_setting('t.a1')),
  'Criar horário avulso',
  'a auditoria grava o nome da operacao'
);

-- ===========================================================================
-- Horario fixo (recorrencia) e encerramento
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
-- Uma dupla avulsa ocupa o horario que o fixo quer usar na segunda semana.
select public.criar_horario_avulso(
  p_quadra_id => '3', p_data => privado.hoje() + 10, p_hora_inicio => '18:00', p_hora_fim => '19:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']);

select throws_ok(
  $$ select public.criar_horario_fixo(
       p_quadra_id => '3', p_data_inicio => privado.hoje() + 3, p_hora_inicio => '18:00', p_hora_fim => '19:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']) $$,
  'P0001',
  format('Quadra 3 já está ocupada em %s das 18:00 às 19:00 (Dupla · Bruno Teste e Carla Teste).',
         to_char(privado.hoje() + 10, 'DD/MM')),
  'recusa salvar o horario fixo sem decidir as datas em conflito'
);

select throws_ok(
  $$ select public.criar_horario_fixo(
       p_quadra_id => '3', p_data_inicio => privado.hoje() + 3, p_hora_inicio => '18:00', p_hora_fim => '19:00',
       p_tipo => 'Locação Avulsa', p_alunos_ids => array['t-ana']) $$,
  'P0001',
  'Horário fixo é para aulas e locações mensais. Locação avulsa e ranking são marcados como avulso.',
  'nao aceita locacao avulsa como horario fixo'
);

select lives_ok(
  $$ select set_config('t.f', public.criar_horario_fixo(
       p_quadra_id => '3', p_data_inicio => privado.hoje() + 3, p_hora_inicio => '18:00', p_hora_fim => '19:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana'],
       p_datas_puladas => array[privado.hoje() + 10]) ->> 'horario_fixo_id', true) $$,
  'pulando a data em conflito, cria o horario fixo'
);

select is(
  (select array_agg(data order by data) from public.ocupacoes where horario_fixo_id = current_setting('t.f')),
  (select array_agg(d order by d)
     from (select privado.hoje() + 3 + 7 * n as d from generate_series(0, 20) n) s
    where d <= privado.hoje() - (extract(isodow from privado.hoje())::integer - 1) + 83
      and d <> privado.hoje() + 10),
  'uma aula por semana ate o fim da 12a semana (H12), sem a data pulada'
);

select is(
  (select count(*)::integer from public.ocupacao_alunos p
     join public.ocupacoes o on o.id = p.ocupacao_id
    where o.horario_fixo_id = current_setting('t.f') and p.aluno_id = 't-ana'),
  (select count(*)::integer from public.ocupacoes where horario_fixo_id = current_setting('t.f')),
  'o aluno entra em todas as aulas do horario fixo'
);

select is(
  (select h.dia_semana || '|' || (select count(*) from public.horario_alunos where horario_fixo_id = h.id)
     from public.horarios_fixos h where h.id = current_setting('t.f')),
  extract(dow from privado.hoje() + 3)::integer || '|1',
  'o molde guarda o dia da semana e os alunos'
);

select throws_ok(
  $$ select public.criar_horario_fixo(
       p_quadra_id => '4', p_data_inicio => privado.hoje() + 3, p_hora_inicio => '07:00', p_hora_fim => '08:00',
       p_tipo => 'LAP', p_professor_id => 't-prof2', p_alunos_ids => array['t-carla'],
       p_fim => privado.hoje() + 3, p_datas_puladas => array[privado.hoje() + 3]) $$,
  'P0001', 'Todas as datas foram puladas: não há aula para criar.',
  'recusa quando todas as datas foram puladas'
);

select throws_ok(
  $$ select public.encerrar_horario_fixo(current_setting('t.f'), privado.hoje() + 2) $$,
  'P0001',
  format('Este horário começou em %s: o encerramento precisa ser depois disso.',
         to_char(privado.hoje() + 3, 'DD/MM/YYYY')),
  'recusa encerrar antes do inicio do horario'
);

select is(
  (select (public.encerrar_horario_fixo(current_setting('t.f'), privado.hoje() + 17) ->> 'aulas_removidas')::integer),
  (select count(*)::integer
     from (select privado.hoje() + 3 + 7 * n as d from generate_series(0, 20) n) s
    where d <= privado.hoje() - (extract(isodow from privado.hoje())::integer - 1) + 83
      and d > privado.hoje() + 17),
  'encerrar tira as aulas depois do fim'
);
select is(
  (select array_agg(data order by data) from public.ocupacoes where horario_fixo_id = current_setting('t.f')),
  array[privado.hoje() + 3, privado.hoje() + 17],
  'as aulas ate o fim ficam'
);
select throws_ok(
  $$ select public.encerrar_horario_fixo(current_setting('t.f'), privado.hoje() + 24) $$,
  'P0001',
  format('Este horário já termina em %s.', to_char(privado.hoje() + 17, 'DD/MM/YYYY')),
  'recusa encerrar depois do fim que ja existe'
);
reset role;

select is(
  (select count(*)::integer from public.auditoria
    where tabela = 'ocupacoes' and acao = 'apagar' and operacao = 'Encerrar horário fixo'),
  (select count(*)::integer
     from (select privado.hoje() + 3 + 7 * n as d from generate_series(0, 20) n) s
    where d <= privado.hoje() - (extract(isodow from privado.hoje())::integer - 1) + 83
      and d > privado.hoje() + 17),
  'cada aula tirada da agenda fica na auditoria'
);

-- O credito de uma falta avisada numa aula que sai da agenda sai junto; se ja
-- foi usado, recusa.
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select set_config('t.g', public.criar_horario_fixo(
  p_quadra_id => '1', p_data_inicio => privado.hoje() + 4, p_hora_inicio => '07:00', p_hora_fim => '08:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-fabio', 't-ana']) ->> 'horario_fixo_id', true);
select public.marcar_presenca(
  (select id from public.ocupacoes where horario_fixo_id = current_setting('t.g') and data = privado.hoje() + 18),
  't-fabio', 'falta_avisada', '24h');
select lives_ok(
  $$ select public.usar_reposicao(current_setting('t.a2'), 't-fabio') $$,
  'o aluno usa o credito da falta avisada numa reposicao'
);
select throws_ok(
  $$ select public.encerrar_horario_fixo(current_setting('t.g'), privado.hoje() + 11) $$,
  'P0001',
  'Um crédito de reposição gerado por uma dessas aulas já foi usado. Escolha uma data de encerramento depois dela.',
  'recusa encerrar quando um credito das aulas tiradas ja foi usado'
);
select is(
  (select (public.remover_aluno(current_setting('t.a2'), 't-fabio') ->> 'minutos_devolvidos')::integer),
  60,
  'tirar da aula o aluno que entrou por reposicao devolve os minutos'
);
select lives_ok(
  $$ select public.encerrar_horario_fixo(current_setting('t.g'), privado.hoje() + 11) $$,
  'sem o uso, o horario fixo e encerrado'
);
select is(
  (select count(*)::integer from public.reposicoes where aluno_id = 't-fabio'),
  0,
  'o credito gerado pela aula que saiu da agenda sai junto'
);

-- ===========================================================================
-- Presenca e falta avisada (H1)
-- ===========================================================================
select set_config('t.p', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje() + 2, p_hora_inicio => '10:00', p_hora_fim => '11:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']), true);

select is(
  (select (public.marcar_presenca(current_setting('t.p'), 't-bruno', 'falta_avisada', '24h') ->> 'minutos_de_credito')::integer),
  60,
  'falta avisada com sigla que da direito gera o credito'
);
select is(
  (select string_agg(format('%s|%s|%s|%s', aluno_id, minutos, sigla, validade), ';')
     from public.reposicoes where ocupacao_origem_id = current_setting('t.p'))
    || ' · ' || (select situacao from public.ocupacoes where id = current_setting('t.p')),
  format('t-bruno|60|24h|%s · agendada', ((privado.hoje() + 2) + interval '3 months')::date),
  'numa Dupla, o credito e so daquele aluno, valido por 3 meses, e a aula continua'
);
select throws_ok(
  $$ select public.marcar_presenca(current_setting('t.p'), 't-carla', 'presente') $$,
  'P0001', 'Presença e falta só podem ser marcadas no dia da aula ou depois.',
  'presenca so no dia da aula ou depois'
);
select throws_ok(
  $$ select public.marcar_presenca(current_setting('t.p'), 't-carla', 'falta_avisada') $$,
  'P0001', 'Escolha a sigla da falta avisada.',
  'falta avisada pede sigla'
);
select throws_ok(
  $$ select public.marcar_presenca(current_setting('t.p'), 't-carla', 'falta_avisada', 'CH') $$,
  'P0001', 'A sigla CH é para cancelar a aula inteira, não para a falta de um aluno.',
  'CH e da aula inteira, nao da falta de um aluno'
);

select set_config('t.i1', public.criar_horario_avulso(
  p_quadra_id => '1', p_data => privado.hoje() + 4, p_hora_inicio => '08:00', p_hora_fim => '09:00',
  p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']), true);
select is(
  (select (public.marcar_presenca(current_setting('t.i1'), 't-ana', 'falta_avisada', 'TIP') ->> 'aula_cancelada')::boolean),
  true,
  'em aula Individual a falta avisada cancela a aula'
);
select is(
  (select situacao || ' · ' || motivo_cancelamento from public.ocupacoes where id = current_setting('t.i1'))
    || ' · ' || (select count(*) from public.reposicoes where aluno_id = 't-ana')
    || ' · ' || (select saldo from public.saldo_reposicao where aluno_id = 't-ana'),
  'cancelada · TIP · 1 · 60',
  'a aula fica cancelada com a sigla e um credito so'
);

select set_config('t.t1', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje(), p_hora_inicio => '07:00', p_hora_fim => '08:00',
  p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-carla']), true);
select public.marcar_presenca(current_setting('t.t1'), 't-carla', 'presente');
select is(
  (select situacao from public.ocupacoes where id = current_setting('t.t1')),
  'realizada',
  'presenca no dia da aula: a aula passa a realizada'
);
select throws_ok(
  $$ select public.remarcar_ocupacao(current_setting('t.t1'), '4', privado.hoje() + 1, '07:00', '08:00') $$,
  'P0001', 'Esta aula já aconteceu: não dá para remarcar.',
  'aula realizada nao e remarcada'
);

-- ===========================================================================
-- Usar reposicao
-- ===========================================================================
select throws_ok(
  $$ select public.usar_reposicao(current_setting('t.a1'), 't-carla') $$,
  'P0001', 'Saldo de reposição insuficiente: o aluno tem 0 minutos e a aula precisa de 60.',
  'sem saldo, recusa usar reposicao'
);
select is(
  (select (public.usar_reposicao(current_setting('t.a1'), 't-bruno') ->> 'saldo')::integer),
  0,
  'com saldo, inclui o aluno na aula e debita os minutos'
);
select throws_ok(
  $$ select public.usar_reposicao(current_setting('t.a1'), 't-bruno') $$,
  'P0001', 'Este aluno já está na aula.',
  'nao inclui o mesmo aluno duas vezes'
);
select throws_ok(
  $$ select public.marcar_presenca(current_setting('t.p'), 't-bruno', 'a_marcar') $$,
  'P0001', 'O crédito desta falta avisada já foi usado numa reposição: não dá para desfazê-lo.',
  'nao desfaz a falta avisada cujo credito ja foi usado (saldo nunca negativo)'
);
select public.remover_aluno(current_setting('t.a1'), 't-bruno');
select is(
  (select saldo from public.saldo_reposicao where aluno_id = 't-bruno'),
  60,
  'remover o aluno devolve os minutos'
);
select public.marcar_presenca(current_setting('t.p'), 't-bruno', 'a_marcar');
select is(
  (select count(*)::integer from public.reposicoes where aluno_id = 't-bruno')
    || ' · ' || (select saldo from public.saldo_reposicao where aluno_id = 't-bruno'),
  '0 · 0',
  'desfazer a falta avisada retira o credito'
);

select set_config('t.r1', public.marcar_aula_de_reposicao(
  p_aluno_id => 't-ana', p_quadra_id => '3', p_data => privado.hoje() + 5,
  p_hora_inicio => '08:00', p_hora_fim => '09:00', p_tipo => 'Individual', p_professor_id => 't-prof'), true);
select is(
  (select descricao || ' · ' || (select saldo from public.saldo_reposicao where aluno_id = 't-ana')
     from public.ocupacoes where id = current_setting('t.r1')),
  'Reposição · 0',
  'marca uma aula nova de reposicao e debita o saldo'
);
select throws_ok(
  $$ select public.marcar_aula_de_reposicao(
       p_aluno_id => 't-ana', p_quadra_id => '3', p_data => privado.hoje() + 5,
       p_hora_inicio => '10:00', p_hora_fim => '11:00', p_tipo => 'Locação Avulsa') $$,
  'P0001', 'A reposição é para aulas e locações do plano.',
  'reposicao so em aulas e locacoes do plano'
);
select throws_ok(
  $$ select public.incluir_aluno(current_setting('t.i1'), 't-carla') $$,
  'P0001', 'Esta aula está cancelada.',
  'nao inclui aluno em aula cancelada'
);
select lives_ok(
  $$ select public.incluir_aluno(current_setting('t.a1'), 't-carla') $$,
  'inclui aluno numa aula sem usar reposicao'
);
reset role;

-- Creditos vencidos nao contam; o uso consome primeiro o que vence antes.
insert into public.reposicoes (aluno_id, minutos, sigla, validade) values
  ('t-davi', 60, 'CH', privado.hoje() - 1),
  ('t-davi', 30, 'CH', privado.hoje() + 60),
  ('t-davi', 30, 'CH', privado.hoje() + 10);
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select is(
  (select saldo || ' · ' || proximo_vencimento from public.saldo_reposicao where aluno_id = 't-davi'),
  format('60 · %s', privado.hoje() + 10),
  'credito vencido nao conta no saldo'
);
select public.marcar_aula_de_reposicao(
  p_aluno_id => 't-davi', p_quadra_id => '3', p_data => privado.hoje() + 5,
  p_hora_inicio => '09:00', p_hora_fim => '09:30', p_tipo => 'Individual', p_professor_id => 't-prof');
select is(
  (select saldo || ' · ' || proximo_vencimento from public.saldo_reposicao where aluno_id = 't-davi'),
  format('30 · %s', privado.hoje() + 60),
  'o uso consome primeiro o credito que vence antes'
);

-- ===========================================================================
-- Cancelar aula
-- ===========================================================================
select set_config('t.c', public.criar_horario_avulso(
  p_quadra_id => '2', p_data => privado.hoje() + 6, p_hora_inicio => '10:00', p_hora_fim => '11:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']), true);

select throws_ok(
  $$ select public.cancelar_ocupacao(current_setting('t.c'), '  ') $$,
  'P0001', 'Informe o motivo do cancelamento.',
  'cancelar exige motivo'
);
select throws_ok(
  $$ select public.cancelar_ocupacao(current_setting('t.c'), '24h') $$,
  'P0001', 'A sigla 24h é para a falta de um aluno: marque “Falta avisada” na lista de alunos.',
  '24h nao cancela a aula inteira'
);
select is(
  (select (public.cancelar_ocupacao(current_setting('t.c'), 'FP') ->> 'minutos')::integer),
  120,
  'cancelar com FP devolve os minutos gerados'
);
select is(
  (select situacao || ' · ' || motivo_cancelamento from public.ocupacoes where id = current_setting('t.c'))
    || ' · ' || (select string_agg(aluno_id || ':' || minutos || ':' || sigla, ',' order by aluno_id)
                   from public.reposicoes where ocupacao_origem_id = current_setting('t.c')),
  'cancelada · FP · t-bruno:60:FP,t-carla:60:FP',
  'a aula fica cancelada e cada aluno ganha o credito (H1)'
);
select throws_ok(
  $$ select public.cancelar_ocupacao(current_setting('t.c'), 'FP') $$,
  'P0001', 'Esta aula já está cancelada.',
  'nao cancela duas vezes'
);

select set_config('t.k', public.criar_horario_avulso(
  p_quadra_id => '2', p_data => privado.hoje() + 6, p_hora_inicio => '14:00', p_hora_fim => '15:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']), true);
select public.marcar_presenca(current_setting('t.k'), 't-bruno', 'falta_avisada', '24h');
select set_config('t.res', public.cancelar_ocupacao(current_setting('t.k'), 'CH')::text, true);
select is(
  (current_setting('t.res')::jsonb ->> 'minutos')
    || ' · ' || (select string_agg(aluno_id || ':' || presenca, ',' order by aluno_id)
                   from public.ocupacao_alunos where ocupacao_id = current_setting('t.k')),
  '60 · t-bruno:falta_avisada,t-carla:a_marcar',
  'quem ja tinha credito da falta avisada nao ganha de novo; a falta avisada fica registrada'
);

select set_config('t.res', public.cancelar_ocupacao(current_setting('t.l1'), 'Cliente desistiu')::text, true);
select is(
  (current_setting('t.res')::jsonb ->> 'minutos')
    || ' · ' || (select motivo_cancelamento || ' · ' || (cancelado_em is not null)
                   from public.lancamentos where ocupacao_id = current_setting('t.l1')),
  '0 · Reserva cancelada na agenda: Cliente desistiu. · true',
  'texto livre cancela sem credito, e a cobranca nao paga da locacao e anulada (sem apagar)'
);
reset role;

select is(
  (select string_agg(distinct operacao, ',') from public.auditoria
    where tabela = 'reposicoes' and registro_id in
      (select id from public.reposicoes where ocupacao_origem_id = current_setting('t.c'))),
  'Cancelar aula',
  'os creditos gerados ficam na auditoria com o nome da operacao'
);

-- ===========================================================================
-- Remarcar
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_like(
  $$ select public.remarcar_ocupacao(current_setting('t.a3'), '1', privado.hoje() + 2, '10:30', '11:30') $$,
  format('Quadra 1 já está ocupada em %s das 10:00 às 11:00%%', to_char(privado.hoje() + 2, 'DD/MM')),
  'recusa remarcar para cima de outra ocupacao'
);
select throws_ok(
  $$ select public.remarcar_ocupacao(current_setting('t.a3'), '2', privado.hoje() + 2, '10:00', '11:00') $$,
  'P0001', 'Escolha uma data, um horário ou uma quadra diferente.',
  'recusa remarcar para o mesmo lugar'
);
select public.remarcar_ocupacao(current_setting('t.a3'), '2', privado.hoje() + 2, '16:00', '17:00');
select is(
  (select quadra_id || ' ' || to_char(hora_inicio, 'HH24:MI') from public.ocupacoes
    where id = current_setting('t.a3')),
  '2 16:00',
  'remarca para um horario livre'
);
select set_config('t.l3', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje() + 7, p_hora_inicio => '19:00', p_hora_fim => '20:00',
  p_tipo => 'Locação Avulsa', p_alunos_ids => array['t-davi']), true);
select public.remarcar_ocupacao(current_setting('t.l3'), 'paredao', privado.hoje() + 8, '08:00', '09:30');
select is(
  (select item || '|' || valor from public.lancamentos where ocupacao_id = current_setting('t.l3')),
  format('Locação avulsa · Paredão · %s 08:00|90.00', to_char(privado.hoje() + 8, 'DD/MM')),
  'a cobranca da locacao acompanha a nova data e duracao'
);

-- ===========================================================================
-- Bloquear quadra
-- ===========================================================================
select set_config('t.b1', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje() + 9, p_hora_inicio => '08:00', p_hora_fim => '09:00',
  p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']), true);
select set_config('t.b2', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje() + 9, p_hora_inicio => '09:00', p_hora_fim => '10:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']), true);
select set_config('t.b3', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje() + 9, p_hora_inicio => '07:00', p_hora_fim => '08:00',
  p_tipo => 'Locação Avulsa', p_alunos_ids => array['t-davi']), true);
select set_config('t.b4', public.criar_horario_avulso(
  p_quadra_id => '4', p_data => privado.hoje() + 9, p_hora_inicio => '11:00', p_hora_fim => '12:00',
  p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']), true);

select is(
  (select (public.bloquear_quadra(array['4'], privado.hoje() + 9, '07:00', '10:00', 'Manutenção do saibro')
            ->> 'minutos')::integer),
  180,
  'bloquear cancela as aulas do periodo e gera os creditos (locacao avulsa nao gera)'
);
select is(
  (select string_agg(coalesce(motivo_cancelamento, situacao), ',' order by hora_inicio)
     from public.ocupacoes
    where id in (current_setting('t.b3'), current_setting('t.b1'), current_setting('t.b2'), current_setting('t.b4')))
    || ' · ' || (select (cancelado_em is not null)::text from public.lancamentos
                  where ocupacao_id = current_setting('t.b3'))
    || ' · ' || (select count(*) from public.ocupacoes
                  where quadra_id = '4' and data = privado.hoje() + 9 and tipo = 'Bloqueio'
                    and descricao = 'Manutenção do saibro'),
  'IAC,IAC,IAC,agendada · true · 1',
  'as aulas do periodo ficam canceladas com IAC, a cobranca e anulada e o bloqueio e criado'
);
select throws_ok(
  $$ select public.bloquear_quadra(array['4'], privado.hoje() + 9, '09:00', '11:00', 'Outro') $$,
  'P0001',
  format('Quadra 4 já está bloqueada em %s das 07:00 às 10:00 (Bloqueio · Manutenção do saibro).',
         to_char(privado.hoje() + 9, 'DD/MM')),
  'um bloqueio nao cancela outro'
);
select throws_ok(
  $$ select public.criar_horario_avulso(
       p_quadra_id => '4', p_data => privado.hoje() + 9, p_hora_inicio => '08:00', p_hora_fim => '09:00',
       p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']) $$,
  'P0001',
  format('Quadra 4 já está ocupada em %s das 07:00 às 10:00 (Bloqueio · Manutenção do saibro).',
         to_char(privado.hoje() + 9, 'DD/MM')),
  'o bloqueio segue a regra de conflito'
);
select throws_ok(
  $$ select public.bloquear_quadra(array['2'], privado.hoje() + 9, '07:00', '10:00', ' ') $$,
  'P0001', 'Descreva o motivo do bloqueio (ex.: manutenção do saibro).',
  'bloqueio exige descricao'
);
select is(
  (select jsonb_array_length(public.bloquear_quadra(array['2', '3'], privado.hoje() + 9, '07:00', '10:00', 'Evento')
            -> 'bloqueios')),
  2,
  'bloqueia varias quadras de uma vez'
);

-- ===========================================================================
-- Cancelar por chuva
-- ===========================================================================
select set_config('t.c1', public.criar_horario_avulso(
  p_quadra_id => '1', p_data => privado.hoje() + 12, p_hora_inicio => '14:00', p_hora_fim => '15:00',
  p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-ana']), true);
select set_config('t.c2', public.criar_horario_avulso(
  p_quadra_id => '2', p_data => privado.hoje() + 12, p_hora_inicio => '16:00', p_hora_fim => '17:00',
  p_tipo => 'Dupla', p_professor_id => 't-prof2', p_alunos_ids => array['t-bruno', 't-carla']), true);
select set_config('t.c3', public.criar_horario_avulso(
  p_quadra_id => '2', p_data => privado.hoje() + 12, p_hora_inicio => '19:00', p_hora_fim => '20:00',
  p_tipo => 'Individual', p_professor_id => 't-prof', p_alunos_ids => array['t-davi']), true);
select set_config('t.c4', public.criar_horario_avulso(
  p_quadra_id => '3', p_data => privado.hoje() + 12, p_hora_inicio => '14:00', p_hora_fim => '15:00',
  p_tipo => 'Individual', p_professor_id => 't-prof2', p_alunos_ids => array['t-carla']), true);
select public.bloquear_quadra(array['1'], privado.hoje() + 12, '08:00', '10:00', 'Evento');

select is(
  (select (public.cancelar_por_chuva(privado.hoje() + 12, array['1', '2'], '13:00', '18:00') ->> 'aulas')::integer),
  2,
  'chuva cancela o que esta ativo nas quadras e na faixa'
);
select is(
  (select string_agg(coalesce(motivo_cancelamento, situacao), ',' order by quadra_id, hora_inicio)
     from public.ocupacoes
    where id in (current_setting('t.c1'), current_setting('t.c2'), current_setting('t.c3'), current_setting('t.c4')))
    || ' · ' || (select situacao from public.ocupacoes
                  where quadra_id = '1' and data = privado.hoje() + 12 and tipo = 'Bloqueio')
    || ' · ' || (select count(*) from public.reposicoes
                  where sigla = 'CH' and ocupacao_origem_id in (current_setting('t.c1'), current_setting('t.c2'))),
  'CH,CH,agendada,agendada · agendada · 3',
  'fora da faixa e das quadras nada muda; o bloqueio fica como esta; cada aluno ganha o credito'
);
select is(
  (select (public.cancelar_por_chuva(privado.hoje() + 12, array['1', '2', '3', '4', 'paredao']) ->> 'aulas')::integer),
  2,
  'sem horario, a chuva cancela o dia inteiro'
);
select throws_ok(
  $$ select public.cancelar_por_chuva(privado.hoje() + 12, array['1', '2']) $$,
  'P0001', 'Não há aulas ativas nessas quadras nesse período.',
  'sem aulas, recusa'
);
select throws_ok(
  $$ select public.cancelar_por_chuva(privado.hoje() + 12, array[]::text[]) $$,
  'P0001', 'Escolha pelo menos uma quadra.',
  'chuva exige pelo menos uma quadra'
);

-- ===========================================================================
-- Reservas sem pagamento (H5)
-- ===========================================================================
select set_config('t.l4', public.criar_horario_avulso(
  p_quadra_id => '3', p_data => privado.hoje() + 11, p_hora_inicio => '19:00', p_hora_fim => '20:00',
  p_tipo => 'Locação Avulsa', p_alunos_ids => array['t-davi']), true);
select throws_ok(
  $$ select public.liberar_reserva(current_setting('t.l4')) $$,
  'P0001',
  (select format('O prazo desta reserva só vence em %s.',
                 to_char(prazo_pagamento at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'))
     from public.ocupacoes where id = current_setting('t.l4')),
  'antes do prazo, recusa liberar'
);
select throws_ok(
  $$ select public.liberar_reserva(current_setting('t.a1')) $$,
  'P0001', 'Esta reserva não está aguardando pagamento.',
  'so libera reserva aguardando pagamento'
);
reset role;

-- Reservas com prazo vencido (gravadas direto, como se o tempo tivesse passado).
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, situacao, prazo_pagamento) values
  ('t-v1', '3', privado.hoje() + 1, '19:00', '20:00', 'Locação Avulsa', 'aguardando_pagamento', now() - interval '1 hour'),
  ('t-v2', '3', privado.hoje() + 1, '20:00', '21:00', 'Locação Avulsa', 'aguardando_pagamento', now() - interval '1 hour'),
  ('t-v3', '4', privado.hoje() + 1, '20:00', '21:00', 'Locação Avulsa', 'aguardando_pagamento', now() - interval '1 hour');
insert into public.ocupacao_alunos (ocupacao_id, aluno_id) values ('t-v1', 't-davi');
insert into public.lancamentos (id, tipo, categoria, pessoa_id, pessoa_tipo, item, valor, vencimento, ocupacao_id)
values ('t-lv1', 'receber', 'Locação', 't-davi', 'aluno', 'Locação avulsa', 120, privado.hoje(), 't-v1');

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select public.liberar_reserva('t-v1');
select is(
  (select situacao || ' · ' || motivo_cancelamento from public.ocupacoes where id = 't-v1')
    || ' · ' || (select (cancelado_em is not null)::text from public.lancamentos where id = 't-lv1')
    || ' · ' || (select count(*) from public.reposicoes where ocupacao_origem_id = 't-v1'),
  'cancelada · Sem pagamento no prazo · true · 0',
  'vencida, libera o horario sem credito e anula a cobranca'
);
select is(public.liberar_reservas_vencidas(), 2, 'libera todas as vencidas de uma vez');
select is(public.liberar_reservas_vencidas(), 0, 'sem vencidas, nao muda nada');
select throws_ok(
  $$ select privado.liberar_reservas_vencidas_automaticamente() $$,
  '42501', null,
  'ninguem da API executa a rotina automatica'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.liberar_reservas_vencidas() $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'o professor nao libera reservas'
);
reset role;

-- Rotina automatica (pg_cron): roda sem ninguem logado.
select set_config('request.jwt.claim.sub', '', true);
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, situacao, prazo_pagamento)
values ('t-v4', '2', privado.hoje() + 1, '20:00', '21:00', 'Locação Avulsa', 'aguardando_pagamento', now() - interval '1 hour');
select is(privado.liberar_reservas_vencidas_automaticamente(), 0,
  'com a opcao desligada, a rotina automatica nao libera nada (H5)');
update public.configuracoes set liberar_reserva_automaticamente = true where id = 1;
select is(privado.liberar_reservas_vencidas_automaticamente(), 1,
  'com a opcao ligada, a rotina automatica libera as vencidas');
select is(
  (select operacao || ' · ' || coalesce(usuario_id::text, 'sem usuario') from public.auditoria
    where tabela = 'ocupacoes' and registro_id = 't-v4' and acao = 'alterar'),
  'Liberar reservas vencidas (automático) · sem usuario',
  'a auditoria mostra a rotina automatica'
);

select * from finish();
rollback;
