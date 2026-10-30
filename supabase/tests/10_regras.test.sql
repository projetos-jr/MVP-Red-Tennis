-- Regras que o banco garante sozinho, qualquer que seja a tela.
-- Mesmos casos de src/lib/banco/regras/regras.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- ---------------------------------------------------------------------------
-- Conflito de quadra
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-a', '1', '2026-11-10', '10:00', '11:00', 'Individual') $$,
  'aceita 10:00-11:00 na quadra 1'
);

select throws_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-b', '1', '2026-11-10', '10:30', '11:30', 'Dupla') $$,
  '23P01', null,
  'recusa 10:30-11:30 na mesma quadra e data'
);

select lives_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-c', '1', '2026-11-10', '11:00', '12:00', 'Dupla') $$,
  'aceita 11:00-12:00 (uma termina quando a outra comeca)'
);

select lives_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-d', '2', '2026-11-10', '10:00', '11:00', 'Individual') $$,
  'aceita o mesmo horario em outra quadra'
);

select throws_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, descricao)
     values ('t-e', '1', '2026-11-10', '09:00', '12:00', 'Bloqueio', 'Manutenção') $$,
  '23P01', null,
  'bloqueio segue a mesma regra de conflito'
);

update public.ocupacoes set situacao = 'cancelada', motivo_cancelamento = 'CH' where id = 't-a';
select lives_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-f', '1', '2026-11-10', '10:00', '11:00', 'LAP') $$,
  'aula cancelada libera o horario'
);

select throws_ok(
  $$ update public.ocupacoes set situacao = 'cancelada' where id = 't-c' $$,
  '23514', null,
  'cancelar exige motivo'
);

select throws_ok(
  $$ insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo)
     values ('t-g', '3', '2026-11-10', '21:30', '22:30', 'Individual') $$,
  '23514', null,
  'recusa horario fora do funcionamento (07h-22h)'
);

-- ---------------------------------------------------------------------------
-- Estoque nunca negativo
-- ---------------------------------------------------------------------------
insert into public.produtos (id, nome, categoria, unidade, preco_custo, preco_venda)
values ('t-p', 'Água teste', 'Bebidas', 'garrafa', 2, 5);
insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel)
values ('t-p', 'entrada', 3, 'teste');

select throws_like(
  $$ insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel)
     values ('t-p', 'venda', 4, 'teste') $$,
  'Só há 3 unidade(s) de Água teste em estoque.',
  'recusa venda maior que o saldo, com mensagem clara'
);

select is(
  (select saldo from public.saldo_estoque where produto_id = 't-p'),
  3,
  'o saldo e a soma dos movimentos'
);

-- ---------------------------------------------------------------------------
-- Matriculas e financeiro
-- ---------------------------------------------------------------------------
insert into public.alunos (id, nome) values ('t-al', 'Aluno Teste');
insert into public.planos (id, nome, tipo, valor_mensal, aulas_por_semana, duracao_minutos, tabela)
values ('t-pl', 'Plano teste', 'Individual', 500, 1, 60, 'nova');
insert into public.matriculas (id, aluno_id, plano_id, valor_mensal, dia_vencimento, inicio, fim)
values ('t-m1', 't-al', 't-pl', 500, 10, '2026-01-01', '2026-06-30');

select throws_ok(
  $$ insert into public.matriculas (id, aluno_id, plano_id, valor_mensal, dia_vencimento, inicio)
     values ('t-m2', 't-al', 't-pl', 500, 10, '2026-06-01') $$,
  '23P01', null,
  'um aluno nunca tem duas matriculas vigentes ao mesmo tempo'
);

select lives_ok(
  $$ insert into public.matriculas (id, aluno_id, plano_id, valor_mensal, dia_vencimento, inicio)
     values ('t-m3', 't-al', 't-pl', 520, 10, '2026-07-01') $$,
  'troca de plano: a nova comeca depois que a anterior termina'
);

insert into public.lancamentos (id, tipo, categoria, pessoa_id, item, valor, vencimento, competencia, matricula_id)
values ('t-l1', 'receber', 'Mensalidade', 't-al', 'Mensalidade', 520,
        (now() at time zone 'America/Sao_Paulo')::date - 1, '2026-07', 't-m3');

select throws_ok(
  $$ insert into public.lancamentos (id, tipo, categoria, pessoa_id, item, valor, vencimento, competencia, matricula_id)
     values ('t-l2', 'receber', 'Mensalidade', 't-al', 'Mensalidade', 520, '2026-07-10', '2026-07', 't-m3') $$,
  '23505', null,
  'uma mensalidade por matricula por mes (gerar de novo nao duplica)'
);

select throws_ok(
  $$ insert into public.lancamentos (id, tipo, categoria, item, valor, vencimento)
     values ('t-l3', 'pagar', 'Mensalidade', 'Errado', 10, '2026-07-10') $$,
  '23514', null,
  'categoria precisa combinar com o tipo (mensalidade nao e conta a pagar)'
);

select throws_ok(
  $$ update public.lancamentos set cancelado_em = now() where id = 't-l1' $$,
  '23514', null,
  'anular exige motivo'
);

select is(
  (select situacao from public.lancamentos_com_situacao where id = 't-l1'),
  'em_atraso',
  'a situacao e calculada pelo vencimento'
);

select * from finish();
rollback;
