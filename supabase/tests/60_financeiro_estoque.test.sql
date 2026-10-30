-- Funcoes do financeiro e do estoque (espelham os casos de
-- src/lib/banco/operacoes/financeiro.test.ts e estoque.test.ts).
begin;
create extension if not exists pgtap with schema extensions;
select plan(82);

-- --- Cadastros do teste (como postgres, sem RLS) -----------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'dono@teste'),
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste'),
  ('00000000-0000-0000-0000-000000000003', 'professor@teste');
insert into public.professores (id, nome, cor, repasse_modo, repasse_valor) values
  ('t-prof', 'Professor Hora', '#000000', 'por_hora', 78),
  ('t-prof-pct', 'Professora Percentual', '#111111', 'percentual', 40);
insert into public.colaboradores (id, nome, perfil, professor_id) values
  ('00000000-0000-0000-0000-000000000001', 'Dono Teste', 'dono', null),
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao', null),
  ('00000000-0000-0000-0000-000000000003', 'Professor Hora', 'professor', 't-prof');
insert into public.alunos (id, nome) values
  ('t-a1', 'Guilherme Teste'),
  ('t-a2', 'Bruna Teste'),
  ('t-a3', 'Carla Teste');
insert into public.planos (id, nome, tipo, valor_mensal, aulas_por_semana, duracao_minutos, tabela)
values ('t-pl', 'Individual 1x', 'Individual', 720, 1, 60, 'nova');
insert into public.matriculas (id, aluno_id, plano_id, valor_mensal, dia_vencimento, inicio) values
  ('t-mt1', 't-a1', 't-pl', 720, 10, '2026-01-15'),
  ('t-mt3', 't-a3', 't-pl', 640, 15, '2025-01-01');
-- Carla esta congelada (H4): a mensalidade sai mesmo assim.
insert into public.congelamentos (id, matricula_id, inicio, fim_previsto, motivo)
values ('t-cg', 't-mt3', '2026-10-20', '2026-12-01', 'Viagem');

-- Reserva aguardando pagamento e a cobranca dela.
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, situacao, prazo_pagamento)
values ('t-res', '2', '2026-11-12', '10:00', '11:00', 'Locação Avulsa', 'aguardando_pagamento', '2026-11-11 18:00-03');
insert into public.lancamentos (id, tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor, vencimento, ocupacao_id)
values ('t-lc-res', 'receber', 'Locação', 't-a2', 'aluno', 'Bruna Teste', 'Locação avulsa · Quadra 2', 120, '2026-11-11', 't-res');

-- Mes passado (relativo a hoje): aulas para o repasse.
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, professor_id, situacao, motivo_cancelamento)
select o.id, '3', (date_trunc('month', privado.hoje()) - interval '1 month')::date + o.dia,
       '10:00', '11:00', 'Individual', o.professor_id, o.situacao, o.motivo
  from (values
    ('t-o1', 4, 't-prof', 'realizada', null),
    ('t-o2', 11, 't-prof', 'realizada', null),
    ('t-o3', 18, 't-prof', 'cancelada', 'Chuva'),
    ('t-o4', 5, 't-prof-pct', 'realizada', null)
  ) as o(id, dia, professor_id, situacao, motivo);
-- Aula deste mes: nao entra no repasse do mes passado.
insert into public.ocupacoes (id, quadra_id, data, hora_inicio, hora_fim, tipo, professor_id, situacao)
values ('t-o5', '3', date_trunc('month', privado.hoje())::date, '12:00', '13:00', 'Individual', 't-prof', 'realizada');
insert into public.ocupacao_alunos (ocupacao_id, aluno_id) values ('t-o4', 't-a1');
-- Mensalidade paga do aluno da professora percentual (base do percentual).
insert into public.lancamentos (id, tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor,
                                vencimento, pago_em, forma_pagamento, competencia, matricula_id)
values ('t-lc-mens-ant', 'receber', 'Mensalidade', 't-a1', 'aluno', 'Guilherme Teste', 'Mensalidade', 500,
        (date_trunc('month', privado.hoje()) - interval '1 month')::date + 9,
        (date_trunc('month', privado.hoje()) - interval '1 month')::date + 9, 'Stone',
        to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM'), null);
-- Adiantamento de repasse ja lancado a mao para o Professor Hora.
insert into public.lancamentos (id, tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor, vencimento, competencia)
values ('t-lc-adiant', 'pagar', 'Repasse', 't-prof', 'professor', 'Professor Hora', 'Adiantamento', 50,
        privado.hoje(), to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM'));

-- Estoque: agua com 10 unidades e um produto inativo.
insert into public.produtos (id, nome, categoria, unidade, preco_custo, preco_venda, ativo) values
  ('t-agua', 'Água Mineral', 'Bebidas', 'garrafa', 2, 5, true),
  ('t-velho', 'Isotônico Antigo', 'Bebidas', 'garrafa', 3, 7, false);
insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel)
values ('t-agua', 'entrada', 10, 'Teste'), ('t-velho', 'entrada', 4, 'Teste');

create function pg_temp.entrar_como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  set local role authenticated;
$$;

-- ============================================================================
-- Financeiro: novo lancamento
-- ============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select set_config('teste.lc', public.criar_lancamento(
  p_tipo => 'receber', p_categoria => 'Aula avulsa', p_item => 'Aula avulsa', p_valor => 90,
  p_vencimento => '2026-11-10', p_pessoa_id => 't-a1', p_nome_pagante => 'Helena Lima',
  p_pago_em => privado.hoje(), p_forma_pagamento => 'Stone', p_comprovante => 'recibo.pdf'), true);
reset role;
select is(
  (select concat_ws('|', pessoa_id, pessoa_tipo, nome_pagante, forma_pagamento, comprovante, valor)
     from public.lancamentos where id = current_setting('teste.lc')),
  't-a1|aluno|Helena Lima|Stone|recibo.pdf|90.00',
  'recepcao lanca a receber ja pago, com quem pagou e comprovante'
);
select is(
  (select operacao from public.auditoria where tabela = 'lancamentos' and registro_id = current_setting('teste.lc')),
  'Novo lançamento',
  'a auditoria grava o nome da operacao'
);

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Aula avulsa', 'Aula', 0, '2026-11-10', 't-a1') $$,
  'P0001', 'O valor precisa ser maior que zero.', 'valor zero e recusado'
);
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Aula avulsa', 'Aula', 0.001, '2026-11-10', 't-a1') $$,
  'P0001', 'O valor precisa ser maior que zero.', 'valor que arredonda para zero e recusado'
);
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Aula avulsa', '   ', 90, '2026-11-10', 't-a1') $$,
  'P0001', 'Descreva o item do lançamento.', 'item vazio e recusado'
);
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Despesa', 'Aula', 90, '2026-11-10', 't-a1') $$,
  'P0001', 'Escolha uma categoria de conta a receber.', 'categoria do outro tipo e recusada'
);
select throws_ok(
  $$ select public.criar_lancamento('pagar', 'Despesa', 'Energia elétrica', 1850, '2026-11-10') $$,
  'P0001', 'Informe o favorecido (quem vai receber o pagamento).', 'conta a pagar exige favorecido'
);
select lives_ok(
  $$ select public.criar_lancamento('pagar', 'Despesa', 'Energia elétrica', 1850, '2026-11-10',
       p_nome_pagante => 'Companhia de energia') $$,
  'dono lanca conta a pagar'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.criar_lancamento('pagar', 'Despesa', 'Energia elétrica', 1850, '2026-11-10',
       p_nome_pagante => 'Companhia de energia') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'recepcao nao lanca conta a pagar (H9)'
);
reset role;
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Aula avulsa', 'Aula', 90, '2026-11-10', 't-a1') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'professor nao lanca no financeiro'
);
reset role;

-- Mensalidade lancada a mao
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Mensalidade', 'Mensalidade nov/2026', 720, '2026-11-10', 't-a2') $$,
  'P0001', 'Bruna Teste não tem matrícula vigente em 10/11/2026. Use outra categoria, como Aula avulsa.',
  'mensalidade a mao exige matricula vigente'
);
select set_config('teste.mens', public.criar_lancamento(
  'receber', 'Mensalidade', 'Mensalidade nov/2026', 720, '2026-11-10', 't-a1'), true);
select is(
  (select matricula_id || ' ' || competencia from public.lancamentos where id = current_setting('teste.mens')),
  't-mt1 2026-11',
  'mensalidade a mao fica ligada a matricula e ao mes'
);
select throws_ok(
  $$ select public.criar_lancamento('receber', 'Mensalidade', 'Mensalidade nov/2026', 720, '2026-11-10', 't-a1') $$,
  'P0001', 'Já existe a mensalidade de novembro de 2026 de Guilherme Teste. Para cobrar de novo, anule a anterior.',
  'mensalidade a mao nao duplica o mes'
);
select lives_ok(
  $$ select public.anular_lancamento(current_setting('teste.mens'), 'Valor errado');
     select set_config('teste.mens', public.criar_lancamento(
       'receber', 'Mensalidade', 'Mensalidade nov/2026', 700, '2026-11-10', 't-a1'), true) $$,
  'depois de anular, da para cobrar o mes de novo'
);

-- ============================================================================
-- Financeiro: gerar mensalidades
-- ============================================================================
select is(
  public.gerar_mensalidades('2026-11'),
  '{"criadas": 1, "ja_geradas": 1}'::jsonb,
  'gera so a que falta (a lancada a mao conta) e a congelada recebe a cobranca'
);
select is(
  (select concat_ws('|', pessoa_id, valor, vencimento, item) from public.lancamentos
    where matricula_id = 't-mt3' and competencia = '2026-11'),
  't-a3|640.00|2026-11-15|Mensalidade nov/2026 · Individual 1x',
  'mensalidade gerada com valor, vencimento e texto da matricula'
);
select is(
  public.gerar_mensalidades('2026-11'),
  '{"criadas": 0, "ja_geradas": 2}'::jsonb,
  'gerar de novo nao duplica'
);
select is(
  (select count(*)::int from public.lancamentos where categoria = 'Mensalidade' and competencia = '2026-11'),
  3,
  'no mes ha a anulada, a refeita e a gerada'
);
select throws_ok(
  $$ select public.gerar_mensalidades('2026-13') $$,
  'P0001', 'Escolha um mês válido.', 'mes invalido e recusado'
);

-- ============================================================================
-- Financeiro: registrar pagamento e anular
-- ============================================================================
select throws_ok(
  $$ select public.anular_lancamento('t-lc-res', 'Desistiu') $$,
  'P0001', 'Esta cobrança é de uma reserva que ainda aguarda pagamento. Registre o pagamento ou cancele a reserva na agenda.',
  'nao anula a cobranca de uma reserva aguardando pagamento'
);
select is(
  public.registrar_pagamento('t-lc-res', privado.hoje(), 'Dinheiro'),
  '{"id": "t-lc-res", "reserva_confirmada": true}'::jsonb,
  'pagar a cobranca da reserva devolve a confirmacao'
);
reset role;
select is(
  (select situacao from public.ocupacoes where id = 't-res'),
  'agendada',
  'a reserva fica confirmada na mesma operacao'
);
select is(
  (select array_agg(tabela order by tabela) from public.auditoria where operacao = 'Registrar pagamento'),
  array['lancamentos', 'ocupacoes'],
  'auditoria do pagamento nas duas tabelas'
);

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.registrar_pagamento('t-lc-res', privado.hoje(), 'Stone') $$,
  'P0001', format('Este lançamento já foi pago em %s.', to_char(privado.hoje(), 'DD/MM/YYYY')),
  'nao paga duas vezes'
);
select set_config('teste.lc2', public.criar_lancamento(
  'receber', 'Aula avulsa', 'Aula avulsa', 90, '2026-11-10', 't-a1'), true);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.lc2'), privado.hoje() + 1, 'Stone') $$,
  'P0001', 'A data do pagamento não pode ser depois de hoje.', 'pagamento no futuro e recusado'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.lc2'), privado.hoje(), ' ') $$,
  'P0001', 'Escolha a forma de pagamento.', 'pagamento exige a forma'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.lc2'), privado.hoje(), 'Cheque') $$,
  'P0001', 'Forma de pagamento desconhecida: Cheque.', 'forma fora da lista e recusada'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.lc2'), privado.hoje(), 'Total Pass', 91) $$,
  'P0001', 'A parte coberta pelo convênio não pode ser maior que o valor do lançamento.',
  'convenio maior que o valor e recusado'
);
select is(
  public.registrar_pagamento(current_setting('teste.lc2'), privado.hoje(), 'Total Pass', 63,
                             p_nome_pagante => 'Empresa X') ->> 'reserva_confirmada',
  'false',
  'pagamento sem reserva ligada'
);
select is(
  (select valor_convenio || ' ' || nome_pagante from public.lancamentos where id = current_setting('teste.lc2')),
  '63.00 Empresa X',
  'guarda a parte do convenio e quem pagou'
);
select throws_ok(
  $$ select public.anular_lancamento(current_setting('teste.lc2'), '   ') $$,
  'P0001', 'Escreva o motivo da anulação.', 'anular exige motivo'
);
select lives_ok(
  $$ select public.anular_lancamento(current_setting('teste.lc2'), 'Estorno') $$,
  'pago tambem pode ser anulado (estorno)'
);
select throws_ok(
  $$ select public.anular_lancamento(current_setting('teste.lc2'), 'De novo') $$,
  'P0001', format('Este lançamento já foi anulado em %s.', to_char(privado.hoje(), 'DD/MM/YYYY')),
  'nao anula duas vezes'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.lc2'), privado.hoje(), 'Stone') $$,
  'P0001', 'Este lançamento foi anulado e não pode ser pago.', 'anulado nao pode ser pago'
);
reset role;
select is(
  (select count(*)::int from public.lancamentos where id = current_setting('teste.lc2') and motivo_cancelamento = 'Estorno'),
  1,
  'anulado continua na tabela, com o motivo'
);

-- ============================================================================
-- Financeiro: fechar repasse do mes
-- ============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.fechar_repasse_do_mes(to_char(privado.hoje(), 'YYYY-MM'), privado.hoje() + 5) $$,
  'P0001',
  format('Só dá para fechar o repasse de um mês que já terminou: %s ainda não acabou.',
         privado.financeiro_nome_do_mes(to_char(privado.hoje(), 'YYYY-MM'))),
  'nao fecha o mes que ainda nao acabou'
);
select throws_ok(
  $$ select public.fechar_repasse_do_mes(to_char(date_trunc('month', privado.hoje()) - interval '3 months', 'YYYY-MM'), privado.hoje()) $$,
  'P0001',
  format('Nenhum professor deu aulas em %s.',
         privado.financeiro_nome_do_mes(to_char(date_trunc('month', privado.hoje()) - interval '3 months', 'YYYY-MM'))),
  'recusa mes sem aulas'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.fechar_repasse_do_mes(to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM'), privado.hoje() + 5) $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'recepcao nao fecha repasse'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select is(
  public.fechar_repasse_do_mes(to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM'), privado.hoje() + 5),
  '{"repasses_fechados": 2, "contas_a_pagar": 2}'::jsonb,
  'dono fecha o repasse dos dois professores'
);
select is(
  (select concat_ws('|', aulas_dadas, minutos_dados, valor_previsto) from public.repasses where professor_id = 't-prof'),
  '2|120|156.00',
  'por hora: 2 aulas de 1h a R$ 78 (a cancelada e a deste mes nao contam)'
);
select is(
  (select valor from public.lancamentos where repasse_id is not null and pessoa_id = 't-prof'),
  106.00,
  'a conta a pagar desconta o adiantamento ja lancado'
);
select is(
  (select valor_previsto from public.repasses where professor_id = 't-prof-pct'),
  200.00,
  'percentual: 40% das mensalidades pagas dos alunos das aulas'
);
select is(
  (select concat_ws('|', tipo, categoria, pessoa_tipo, nome_pagante, item) from public.lancamentos
    where repasse_id is not null and pessoa_id = 't-prof'),
  concat_ws('|', 'pagar', 'Repasse', 'professor', 'Professor Hora',
            'Repasse ' || privado.financeiro_mes_curto(to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM')) || ' · 2 aulas'),
  'conta a pagar do repasse com professor e texto'
);
select throws_ok(
  $$ select public.fechar_repasse_do_mes(to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM'), privado.hoje() + 5) $$,
  'P0001',
  format('O repasse de %s já foi fechado.',
         privado.financeiro_nome_do_mes(to_char(date_trunc('month', privado.hoje()) - interval '1 month', 'YYYY-MM'))),
  'nao fecha o mesmo mes duas vezes'
);
reset role;
select is(
  (select count(*)::int from public.auditoria where tabela = 'repasses' and operacao = 'Fechar repasse do mês'),
  2,
  'auditoria do fechamento com o nome da operacao'
);

-- ============================================================================
-- Estoque: cadastro de produto
-- ============================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select set_config('teste.picole', public.cadastrar_produto('  Picolé   de  fruta ', 'Lanches', 'unidade', 2.5, 6, 3), true);
reset role;
select is(
  (select concat_ws('|', p.nome, p.ativo, s.saldo) from public.produtos p
     join public.saldo_estoque s on s.produto_id = p.id where p.id = current_setting('teste.picole')),
  'Picolé de fruta|t|0',
  'cadastra ativo, sem saldo e com o nome limpo'
);
select is(
  (select acao || ' ' || operacao from public.auditoria where tabela = 'produtos' and registro_id = current_setting('teste.picole')),
  'criar Cadastrar produto',
  'auditoria do cadastro'
);
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.cadastrar_produto('agua  MINERAL', 'Bebidas', 'garrafa', 2, 5, 0) $$,
  'P0001', 'Já existe um produto chamado "Água Mineral".',
  'nome repetido e recusado, sem diferenca de acento e maiuscula'
);
select throws_ok(
  $$ select public.cadastrar_produto('Isotonico antigo', 'Bebidas', 'garrafa', 2, 5, 0) $$,
  'P0001', 'Já existe um produto inativo chamado "Isotônico Antigo". Reative-o em vez de cadastrar outro.',
  'o nome de um produto inativo tambem conta'
);
select throws_ok(
  $$ select public.cadastrar_produto('Barra de cereal', 'Lanches', 'unidade', -1, 5, 0) $$,
  'P0001', 'O preço de custo não pode ser negativo.', 'preco negativo e recusado'
);
select lives_ok(
  $$ select public.editar_produto(current_setting('teste.picole'), 'Picolé de fruta', 'Lanches', 'unidade', 2.5, 7, 3) $$,
  'na edicao, o proprio nome pode ficar'
);
select throws_ok(
  $$ select public.editar_produto(current_setting('teste.picole'), 'Água mineral', 'Lanches', 'unidade', 2.5, 7, 3) $$,
  'P0001', 'Já existe um produto chamado "Água Mineral".', 'na edicao, o nome de outro produto nao'
);
select lives_ok(
  $$ select public.inativar_produto(current_setting('teste.picole')) $$,
  'inativa o produto'
);
select throws_ok(
  $$ select public.inativar_produto(current_setting('teste.picole')) $$,
  'P0001', 'Picolé de fruta já está inativo.', 'nao inativa duas vezes'
);
select lives_ok(
  $$ select public.reativar_produto(current_setting('teste.picole')) $$,
  'reativa o produto'
);

-- ============================================================================
-- Estoque: entrada, perda e ajuste
-- ============================================================================
select throws_ok(
  $$ select public.registrar_entrada('t-agua', 12, null,
       '{"favorecido": "Distribuidora X", "valor": 24, "vencimento": "2026-11-20"}') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'recepcao nao gera conta a pagar ao fornecedor'
);
select lives_ok(
  $$ select public.registrar_entrada('t-agua', 3, 'Reposição') $$,
  'recepcao registra entrada sem conta a pagar'
);
select throws_ok(
  $$ select public.registrar_entrada('t-velho', 3) $$,
  'P0001', 'Isotônico Antigo está inativo. Reative o produto antes de registrar a entrada.',
  'produto inativo nao recebe entrada'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000001');
select set_config('teste.entrada', public.registrar_entrada('t-agua', 12, null,
  '{"favorecido": "Distribuidora X", "valor": 24, "vencimento": "2026-11-20"}')::text, true);
select is(
  (select concat_ws('|', l.tipo, l.categoria, l.nome_pagante, l.item, l.valor, l.vencimento, m.tipo, m.quantidade, m.responsavel)
     from public.lancamentos l
     join public.movimentos_estoque m on m.id = l.movimento_estoque_id
    where l.id = current_setting('teste.entrada')::jsonb ->> 'lancamento_id'),
  'pagar|Fornecedor|Distribuidora X|Compra: 12× Água Mineral|24.00|2026-11-20|entrada|12|Dono Teste',
  'entrada com conta a pagar: movimento e lancamento ligados'
);
select throws_ok(
  $$ select public.registrar_entrada('t-agua', 12, null, '{"favorecido": " ", "valor": 24, "vencimento": "2026-11-20"}') $$,
  'P0001', 'Informe o fornecedor que vai receber a conta a pagar.',
  'conta a pagar incompleta recusa a entrada inteira'
);
select throws_ok(
  $$ select public.registrar_entrada('t-agua', 0) $$,
  'P0001', 'A quantidade precisa ser um número inteiro maior que zero.', 'quantidade zero e recusada'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.registrar_perda('t-agua', 2, '  ') $$,
  'P0001', 'Informe o motivo da perda.', 'perda exige motivo'
);
select throws_ok(
  $$ select public.registrar_perda('t-agua', 1000, 'Quebra') $$,
  'P0001', 'Só há 25 unidade(s) de Água Mineral em estoque.', 'perda maior que o saldo e recusada'
);
select lives_ok(
  $$ select public.registrar_perda('t-agua', 2, 'Garrafa quebrada') $$,
  'perda baixa o saldo'
);
select is(
  public.ajustar_inventario('t-agua', 20, 'Contagem de sexta') ->> 'diferenca',
  '-3',
  'ajuste grava a diferenca com sinal'
);
select is(
  (select saldo from public.saldo_estoque where produto_id = 't-agua'),
  20,
  'depois do ajuste, o saldo e o contado'
);
select throws_ok(
  $$ select public.ajustar_inventario('t-agua', 20) $$,
  'P0001', 'O saldo contado é igual ao do sistema (20): não há o que ajustar.',
  'contagem igual ao sistema e recusada'
);
select throws_ok(
  $$ select public.ajustar_inventario('t-agua', -1) $$,
  'P0001', 'O saldo contado precisa ser um número inteiro, zero ou maior.',
  'contagem negativa e recusada'
);

-- ============================================================================
-- Estoque: consumo no balcao e fechar conta
-- ============================================================================
select set_config('teste.consumo', public.lancar_consumo('t-a1', 'aluno', 't-agua', 2), true);
reset role;
select is(
  (select concat_ws('|', c.produto_nome, c.quantidade, c.valor_unitario, m.tipo, m.quantidade, m.observacao,
                    l.tipo, l.categoria, l.nome_pagante, l.item, l.valor, l.vencimento = privado.hoje() + 7)
     from public.consumos c
     join public.movimentos_estoque m on m.consumo_id = c.id
     join public.lancamentos l on l.consumo_id = c.id
    where c.id = current_setting('teste.consumo')),
  'Água Mineral|2|5.00|venda|2|Consumo no balcão|receber|Consumo|Guilherme Teste|2× Água Mineral|10.00|t',
  'grava o consumo, a venda no estoque e o lancamento a receber juntos (vencimento H13)'
);
select is(
  (select count(*)::int from public.auditoria
    where operacao = 'Lançar consumo' and acao = 'criar'
      and tabela in ('consumos', 'movimentos_estoque', 'lancamentos')),
  3,
  'auditoria das tres tabelas com o nome da operacao'
);

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.lancar_consumo('t-a1', 'aluno', 't-agua', 100) $$,
  'P0001', 'Só há 18 unidade(s) de Água Mineral em estoque.', 'se o saldo nao basta, nada e gravado'
);
select throws_ok(
  $$ select public.lancar_consumo('t-a1', 'aluno', current_setting('teste.picole'), 1) $$,
  'P0001', 'Picolé de fruta está esgotado.', 'estoque zerado recusa a venda'
);
select throws_ok(
  $$ select public.lancar_consumo('t-a1', 'aluno', 't-velho', 1) $$,
  'P0001', 'Isotônico Antigo está inativo e não pode ser vendido.', 'produto inativo recusa a venda'
);
select throws_ok(
  $$ select public.lancar_consumo('nao-existe', 'aluno', 't-agua', 1) $$,
  'P0001', 'Pessoa não encontrada no cadastro.', 'pessoa fora do cadastro e recusada'
);
select lives_ok(
  $$ select public.lancar_consumo('t-prof', 'professor', 't-agua', 1);
     select public.lancar_consumo('t-a2', 'aluno', 't-agua', 1) $$,
  'professor tambem tem conta de consumo'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.lancar_consumo('t-a1', 'aluno', 't-agua', 1) $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'o perfil de professor nao grava no estoque (H9)'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.fechar_conta_de_consumo('t-a1', privado.hoje() + 1, 'Stone') $$,
  'P0001', 'A data do pagamento não pode ser depois de hoje.', 'fechar conta com data futura e recusado'
);
select throws_ok(
  $$ select public.fechar_conta_de_consumo('t-a1', privado.hoje() - 1, 'Stone') $$,
  'P0001',
  format('A data do pagamento não pode ser antes do último consumo em aberto (%s).', to_char(privado.hoje(), 'DD/MM/YYYY')),
  'fechar conta antes do ultimo consumo e recusado'
);
select throws_ok(
  $$ select public.fechar_conta_de_consumo('t-a1', privado.hoje(), 'Cheque') $$,
  'P0001', 'Escolha a forma de pagamento.', 'fechar conta com forma desconhecida e recusado'
);
select is(
  public.fechar_conta_de_consumo('t-a1', privado.hoje(), 'Dinheiro'),
  '{"lancamentos_pagos": 1, "total": 10.00}'::jsonb,
  'paga os consumos em aberto da pessoa'
);
select is(
  (select count(*)::int from public.lancamentos
    where categoria = 'Consumo' and pago_em is null and pessoa_id in ('t-a2', 't-prof')),
  2,
  'os consumos de outras pessoas continuam em aberto'
);
select throws_ok(
  $$ select public.fechar_conta_de_consumo('t-a1', privado.hoje(), 'Dinheiro') $$,
  'P0001', 'Não há consumo em aberto nesta conta.', 'sem nada em aberto, recusa'
);
reset role;

select * from finish();
rollback;
