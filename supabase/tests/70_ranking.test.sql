-- Funcoes do ranking e dos torneios: partidas de ranking, pontuacao, geracao
-- da chave nos tres formatos, avanco do vencedor, W.O., correcao, desempate,
-- permissao e auditoria. Espelha src/lib/banco/operacoes/ranking.test.ts e
-- src/lib/banco/regras/torneios.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'dono@teste'),
  ('00000000-0000-0000-0000-000000000002', 'recepcao@teste'),
  ('00000000-0000-0000-0000-000000000003', 'professor@teste');
insert into public.professores (id, nome, cor) values ('t-prof', 'Professor Teste', '#000000');
insert into public.colaboradores (id, nome, perfil, professor_id) values
  ('00000000-0000-0000-0000-000000000001', 'Dono Teste', 'dono', null),
  ('00000000-0000-0000-0000-000000000002', 'Recepção Teste', 'recepcao', null),
  ('00000000-0000-0000-0000-000000000003', 'Professor Teste', 'professor', 't-prof');

insert into public.alunos (id, nome, ativo, inscrito_ranking) values
  ('r-ana', 'Ana Teste', true, true),
  ('r-bia', 'Bia Teste', true, true),
  ('r-caio', 'Caio Teste', true, true),
  ('r-duda', 'Duda Teste', true, true),
  ('r-edu', 'Edu Teste', true, true),
  ('r-fabi', 'Fabi Teste', true, true),
  ('r-gui', 'Gui Teste', true, true),
  ('r-hugo', 'Hugo Teste', true, true),
  ('r-fora', 'Fora Ranking', true, false),
  ('r-ivo', 'Ivo Inativo', false, true);

create function pg_temp.entrar_como(p_id text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id, true);
  set local role authenticated;
$$;

-- ===========================================================================
-- Partidas de ranking
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');

select set_config('t.p1',
  public.registrar_partida('r-ana', 'r-bia', privado.hoje(), '6x4  6x4', 'A'), true);
select is(
  (select placar || '|' || vencedor || '|' || data::text from public.partidas
    where id = current_setting('t.p1')),
  '6/4 6/4|A|' || privado.hoje()::text,
  'registrar partida grava o resultado com o placar arrumado'
);
select is(
  (select string_agg(aluno_id || ':' || pontos, ',' order by aluno_id)
     from public.ranking where aluno_id in ('r-ana', 'r-bia')),
  'r-ana:10,r-bia:2',
  'a pontuacao e recalculada: vitoria 10, derrota 2 (H7)'
);
select is(
  (select pontos from public.ranking_em(privado.hoje() - 1) where aluno_id = 'r-ana'),
  0,
  'ranking_em(data) ignora as partidas depois da data'
);

select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-ana', privado.hoje(), '6/4 6/4', 'A') $$,
  'P0001', 'Escolha dois jogadores diferentes.',
  'recusa o mesmo jogador dos dois lados'
);
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-fora', privado.hoje(), '6/4 6/4', 'A') $$,
  'P0001', 'Fora Ranking não está inscrito no ranking.',
  'recusa quem nao esta inscrito no ranking'
);
select throws_ok(
  $$ select public.registrar_partida('r-ivo', 'r-ana', privado.hoje(), '6/4 6/4', 'A') $$,
  'P0001', 'Ivo Inativo não está ativo na arena.',
  'recusa aluno inativo'
);
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-bia', privado.hoje() + 1, '6/4 6/4', 'A') $$,
  'P0001', 'Essa data ainda não chegou: para uma partida futura, use “Marcar partida”.',
  'recusa resultado com data futura'
);
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-bia', privado.hoje(), '6/4 6/4', 'B') $$,
  'P0001', 'O placar não bate com o vencedor: por esse placar quem venceu foi Ana Teste.',
  'recusa placar incoerente com o vencedor'
);
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-bia', privado.hoje(), '6/4 3/6', 'A') $$,
  'P0001', 'O placar está empatado em sets (1 a 1). Falta o set decisivo?',
  'recusa placar empatado em sets'
);
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-bia', privado.hoje(), '6 a 4', 'A') $$,
  'P0001', 'Placar "6 a 4" não reconhecido. Escreva os sets separados por espaço, como 6/4 3/6 10/8.',
  'recusa placar que nao e placar'
);
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-bia', privado.hoje(), '6/4 6/3 2/6', 'A') $$,
  'P0001', 'O último set precisa ser de quem venceu a partida. Confira a ordem dos sets.',
  'recusa ultimo set de quem perdeu'
);

-- W.O.: quem faltou perde sem os pontos de participacao.
select public.registrar_partida('r-caio', 'r-duda', privado.hoje(), null, 'B', true);
select is(
  (select string_agg(aluno_id || ':' || pontos || ':' || vitorias || '-' || derrotas, ',' order by aluno_id)
     from public.ranking where aluno_id in ('r-caio', 'r-duda')),
  'r-caio:0:0-1,r-duda:10:1-0',
  'W.O.: quem compareceu ganha a vitoria; quem faltou nao ganha os pontos da derrota'
);

-- Correcao: recalcula e fica na auditoria.
select public.corrigir_resultado_de_partida(current_setting('t.p1'), '4/6 6/7(3)', 'B');
select is(
  (select string_agg(aluno_id || ':' || pontos, ',' order by aluno_id)
     from public.ranking where aluno_id in ('r-ana', 'r-bia')),
  'r-ana:2,r-bia:10',
  'corrigir o resultado recalcula a pontuacao'
);
select throws_ok(
  format($$ select public.registrar_resultado_de_partida(%L, '6/1 6/1', 'A') $$, current_setting('t.p1')),
  'P0001', 'Esta partida já tem resultado: use a correção.',
  'registrar de novo pede a correcao'
);
reset role;

select is(
  (select operacao || '|' || (antes ->> 'vencedor') || '|' || (depois ->> 'vencedor') || '|' || (depois ->> 'placar')
     from public.auditoria
    where tabela = 'partidas' and registro_id = current_setting('t.p1') and acao = 'alterar'),
  'Corrigir resultado de partida de ranking|A|B|4/6 6/7(3)',
  'a auditoria guarda o nome da operacao, como era e como ficou'
);

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.registrar_partida('r-ana', 'r-bia', privado.hoje(), '6/4 6/4', 'A') $$,
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'professor nao grava no ranking (H9)'
);
select ok(
  (select count(*) from public.ranking) > 0,
  'professor consulta o ranking'
);
reset role;

-- ===========================================================================
-- Partida marcada com reserva de quadra
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');

select set_config('t.p2', public.marcar_partida('r-edu', 'r-fabi', privado.hoje() + 2,
  '{"quadraId": "2", "horaInicio": "10:00", "horaFim": "11:00"}'), true);
select is(
  (select o.tipo || '|' || o.situacao || '|' || o.quadra_id || '|' ||
          (select string_agg(oa.aluno_id, ',' order by oa.aluno_id)
             from public.ocupacao_alunos oa where oa.ocupacao_id = o.id) || '|' ||
          (p.vencedor is null)::text
     from public.partidas p join public.ocupacoes o on o.id = p.ocupacao_id
    where p.id = current_setting('t.p2')),
  'Ranking|agendada|2|r-edu,r-fabi|true',
  'marcar partida cria a ocupacao Ranking com os dois jogadores, ligada a partida'
);
select throws_ok(
  $$ select public.marcar_partida('r-gui', 'r-hugo', privado.hoje() + 2,
       '{"quadraId": "2", "horaInicio": "10:30", "horaFim": "11:30"}') $$,
  'P0001',
  format('Quadra 2 já está ocupada em %s das 10:00 às 11:00 (Ranking · Edu Teste e Fabi Teste).',
         to_char(privado.hoje() + 2, 'DD/MM')),
  'recusa conflito de quadra dizendo quem ocupa'
);
select throws_ok(
  $$ select public.marcar_partida('r-gui', 'r-hugo', privado.hoje() + 2,
       '{"quadraId": "3", "horaInicio": "06:00", "horaFim": "07:00"}') $$,
  'P0001', 'A arena funciona das 07:00 às 22:00.',
  'recusa horario fora do funcionamento'
);
select throws_ok(
  $$ select public.marcar_partida('r-gui', 'r-hugo', privado.hoje() + 2,
       '{"quadraId": "paredao", "horaInicio": "10:00", "horaFim": "11:00"}') $$,
  'P0001', 'O paredão não recebe partidas: escolha uma das quadras 1 a 4.',
  'recusa o paredao'
);
select throws_ok(
  $$ select public.marcar_partida('r-gui', 'r-hugo', privado.hoje() - 1) $$,
  'P0001', 'Essa data já passou: para uma partida que já aconteceu, registre o resultado.',
  'recusa marcar partida no passado'
);
select throws_ok(
  format($$ select public.registrar_resultado_de_partida(%L, '6/3 6/2', 'A') $$, current_setting('t.p2')),
  'P0001',
  format('A partida está marcada para %s: o resultado entra a partir desse dia.',
         to_char(privado.hoje() + 2, 'DD/MM/YYYY')),
  'o resultado so entra a partir do dia marcado'
);

select public.excluir_partida(current_setting('t.p2'));
select is(
  (select situacao || '|' || motivo_cancelamento from public.ocupacoes o
    where o.quadra_id = '2' and o.data = privado.hoje() + 2 and o.tipo = 'Ranking') || '|' ||
  (select count(*) from public.partidas where id = current_setting('t.p2')),
  'cancelada|Partida de ranking excluída|0',
  'excluir a partida cancela a reserva futura'
);
reset role;

-- ===========================================================================
-- Torneios: cadastro
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');

select throws_ok(
  $$ select public.criar_torneio('Duplas', '2026-12-05', 'eliminatoria', true,
       '[{"alunosIds": ["r-ana"]}]') $$,
  'P0001', 'Cada inscrição de duplas precisa de dois jogadores.',
  'criar recusa dupla incompleta'
);
select throws_ok(
  $$ select public.criar_torneio('Simples', '2026-12-05', 'eliminatoria', false,
       '[{"alunosIds": ["r-ana"], "cabecaDeChave": 1}, {"alunosIds": ["r-bia"], "cabecaDeChave": 1}]') $$,
  'P0001', 'Numere os cabeças de chave em sequência (1, 2, 3…), sem repetir nem pular.',
  'criar recusa cabecas de chave repetidos'
);
select throws_ok(
  $$ select public.criar_torneio('Simples', '2026-12-05', 'eliminatoria', false,
       '[{"alunosIds": ["r-ana"]}, {"alunosIds": ["r-ana"]}]') $$,
  'P0001', 'Ana Teste aparece em duas inscrições.',
  'criar recusa aluno em duas inscricoes'
);
select throws_ok(
  $$ select public.criar_torneio('  ', '2026-12-05', 'eliminatoria', false, '[]') $$,
  'P0001', 'Dê um nome ao torneio.',
  'criar recusa torneio sem nome'
);

-- Edicao com inscricoes abertas: tira uma, poe outra (que vai para o fim).
select set_config('t.t0', public.criar_torneio('Rascunho', '2026-12-05', 'eliminatoria', false,
  '[{"alunosIds": ["r-ana"]}, {"alunosIds": ["r-bia"]}, {"alunosIds": ["r-caio"]}]'), true);
select public.editar_torneio(current_setting('t.t0'), 'Torneio de Natal', '2026-12-06',
  'eliminatoria', false, 'B',
  (select jsonb_agg(jsonb_build_object('id', i.id, 'alunosIds', to_jsonb(i.alunos_ids))
                    order by i.ordem_inscricao)
     from public.torneio_inscritos i
    where i.torneio_id = current_setting('t.t0') and i.alunos_ids <> '{r-bia}')
  || '[{"alunosIds": ["r-gui"], "cabecaDeChave": 1}]'::jsonb);
select is(
  (select t.nome || '|' || t.categoria || '|' ||
          (select string_agg(i.alunos_ids[1] || coalesce('#' || i.cabeca_de_chave, ''), ',' order by i.ordem_inscricao)
             from public.torneio_inscritos i where i.torneio_id = t.id)
     from public.torneios t where t.id = current_setting('t.t0')),
  'Torneio de Natal|B|r-ana,r-caio,r-gui#1',
  'editar muda os dados e as inscricoes (a nova vai para o fim)'
);

-- ===========================================================================
-- Eliminatoria simples com 6 inscritos
-- ===========================================================================
select set_config('t.t1', public.criar_torneio('Copa', '2026-12-05', 'eliminatoria', false,
  '[{"alunosIds": ["r-ana"], "cabecaDeChave": 1}, {"alunosIds": ["r-bia"], "cabecaDeChave": 2},
    {"alunosIds": ["r-caio"]}, {"alunosIds": ["r-duda"]}, {"alunosIds": ["r-edu"]}, {"alunosIds": ["r-fabi"]}]'),
  true);
-- Sorteio vindo da tela: fabi, edu, duda, caio.
select public.gerar_chave_do_torneio(current_setting('t.t1'), array(
  select i.id from public.torneio_inscritos i
   where i.torneio_id = current_setting('t.t1') and i.cabeca_de_chave is null
   order by i.ordem_inscricao desc));

-- Chave de 8: 1 x folga, 5 x 4, 3 x 6, folga x 2 (vagas 1,8,5,4,3,6,7,2).
select is(
  (select string_agg(format('%s-%s %s %s x %s >%s', p.rodada, p.ordem, p.fase,
            coalesce(nullif(array_to_string(p.lado_a, '+'), ''), '_'),
            coalesce(nullif(array_to_string(p.lado_b, '+'), ''), '_'),
            coalesce(s.rodada || '-' || s.ordem || p.lado_na_proxima, '')),
          '; ' order by p.rodada, p.ordem)
     from public.partidas p left join public.partidas s on s.id = p.proxima_partida_id
    where p.torneio_id = current_setting('t.t1')),
  '1-2 Quartas de final r-duda x r-edu >2-1B; 1-3 Quartas de final r-fabi x r-caio >2-2A; '
  || '2-1 Semifinal r-ana x _ >3-1A; 2-2 Semifinal _ x r-bia >3-1B; 3-1 Final _ x _ >',
  '6 inscritos: chave de 8, folgas para os cabecas 1 e 2 em lados opostos, cada partida aponta para a seguinte'
);
select is(
  (select situacao from public.torneios where id = current_setting('t.t1')),
  'em_andamento',
  'gerar a chave poe o torneio em andamento'
);
select throws_ok(
  format($$ select public.gerar_chave_do_torneio(%L) $$, current_setting('t.t1')),
  'P0001', 'A chave deste torneio já foi gerada.',
  'nao gera a chave duas vezes'
);
select throws_ok(
  format($$ select public.editar_torneio(%L, 'Outro nome', '2026-12-05', 'eliminatoria', false, null, '[]') $$,
         current_setting('t.t1')),
  'P0001', 'A chave já foi gerada: para mudar formato ou inscrições, desfaça a chave primeiro.',
  'com a chave gerada, nao muda as inscricoes'
);

select set_config('t.q2', (select id from public.partidas
  where torneio_id = current_setting('t.t1') and rodada = 1 and ordem = 2), true);
select set_config('t.q3', (select id from public.partidas
  where torneio_id = current_setting('t.t1') and rodada = 1 and ordem = 3), true);
select set_config('t.s1', (select id from public.partidas
  where torneio_id = current_setting('t.t1') and rodada = 2 and ordem = 1), true);
select set_config('t.s2', (select id from public.partidas
  where torneio_id = current_setting('t.t1') and rodada = 2 and ordem = 2), true);
select set_config('t.f', (select id from public.partidas
  where torneio_id = current_setting('t.t1') and rodada = 3), true);

select public.registrar_resultado_de_torneio(current_setting('t.q2'), '6/3 6/2', 'A');
select is(
  (select array_to_string(lado_b, ',') || '|' ||
          (inscricao_b_id = (select inscricao_a_id from public.partidas where id = current_setting('t.q2')))::text
     from public.partidas where id = current_setting('t.s1')),
  'r-duda|true',
  'o vencedor vai sozinho para o lado certo da partida seguinte'
);
select public.corrigir_resultado_de_torneio(current_setting('t.q2'), '3/6 2/6', 'B');
select is(
  (select array_to_string(lado_b, ',') from public.partidas where id = current_setting('t.s1')),
  'r-edu',
  'corrigir antes da seguinte ser jogada troca o vencedor na seguinte'
);
select throws_ok(
  format($$ select public.registrar_resultado_de_torneio(%L, '6/4 6/4', 'A') $$, current_setting('t.f')),
  'P0001', 'Esta partida ainda espera o vencedor da rodada anterior.',
  'partida sem os dois lados nao recebe resultado'
);

select public.registrar_resultado_de_torneio(current_setting('t.q3'), null, 'B', true);
select is(
  (select q.placar || '|' || q.wo::text || '|' || array_to_string(s.lado_a, ',')
     from public.partidas q, public.partidas s
    where q.id = current_setting('t.q3') and s.id = current_setting('t.s2')),
  'W.O.|true|r-caio',
  'W.O.: quem compareceu vence e avanca'
);

select public.registrar_resultado_de_torneio(current_setting('t.s1'), '6/4 6/4', 'A');
select throws_ok(
  format($$ select public.corrigir_resultado_de_torneio(%L, '6/4 6/4', 'A') $$, current_setting('t.q2')),
  'P0001', 'A partida seguinte (Semifinal) já foi jogada: este resultado não pode mais ser mudado.',
  'depois que a seguinte foi jogada, nao corrige'
);
select throws_ok(
  format($$ select public.apagar_resultado_de_torneio(%L) $$, current_setting('t.q2')),
  'P0001', 'A partida seguinte (Semifinal) já foi jogada: este resultado não pode mais ser mudado.',
  'depois que a seguinte foi jogada, nao apaga'
);
select throws_ok(
  format($$ select public.desfazer_chave_do_torneio(%L) $$, current_setting('t.t1')),
  'P0001', 'Já há resultados registrados: a chave não pode mais ser desfeita.',
  'com resultados, a chave nao pode ser desfeita'
);
select throws_ok(
  format($$ select public.registrar_resultado_de_partida(%L, '6/4 6/4', 'A') $$, current_setting('t.f')),
  'P0001', 'O resultado de partida de torneio é registrado na chave do torneio.',
  'partida de torneio nao recebe resultado como partida de ranking'
);

select public.registrar_resultado_de_torneio(current_setting('t.s2'), '4/6 4/6', 'B');
select is(
  public.registrar_resultado_de_torneio(current_setting('t.f'), '3/6 6/3 8/10', 'B') ->> 'situacao',
  'encerrado',
  'a final decidida encerra o torneio'
);
select is(
  public.apagar_resultado_de_torneio(current_setting('t.f')) ->> 'situacao',
  'em_andamento',
  'apagar o resultado da final reabre o torneio'
);
select is(
  (select array_to_string(lado_a, ',') || '|' || array_to_string(lado_b, ',') || '|' || coalesce(vencedor, '-')
     from public.partidas where id = current_setting('t.f')),
  'r-ana|r-bia|-',
  'a final continua com os dois finalistas, sem resultado'
);
reset role;

select is(
  (select count(*)::int from public.auditoria
    where tabela = 'partidas' and acao = 'criar' and operacao = 'Gerar chave do torneio'),
  5,
  'a auditoria registra as partidas criadas pela geracao da chave'
);

-- ===========================================================================
-- Todos contra todos com 5 inscritos
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select set_config('t.t2', public.criar_torneio('Liga', '2026-12-05', 'todos_contra_todos', false,
  '[{"alunosIds": ["r-ana"], "cabecaDeChave": 1}, {"alunosIds": ["r-bia"]}, {"alunosIds": ["r-caio"]},
    {"alunosIds": ["r-duda"]}, {"alunosIds": ["r-edu"]}]'), true);
select public.gerar_chave_do_torneio(current_setting('t.t2'));
select is(
  (select count(*) || '|' ||
          count(distinct least(inscricao_a_id, inscricao_b_id) || greatest(inscricao_a_id, inscricao_b_id)) || '|' ||
          count(distinct rodada) || '|' || max(ordem)
     from public.partidas where torneio_id = current_setting('t.t2')),
  '10|10|5|2',
  '5 inscritos: 10 partidas, todos os pares uma vez, 5 rodadas de 2 jogos'
);
select public.desfazer_chave_do_torneio(current_setting('t.t2'));
select is(
  (select situacao from public.torneios where id = current_setting('t.t2')) || '|' ||
  (select count(*) from public.partidas where torneio_id = current_setting('t.t2')),
  'inscricoes|0',
  'desfazer a chave sem resultados apaga as partidas e reabre as inscricoes'
);
select throws_ok(
  format($$ select public.desfazer_chave_do_torneio(%L) $$, current_setting('t.t2')),
  'P0001', 'Este torneio ainda não tem chave.',
  'nao desfaz chave que nao existe'
);
reset role;

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000003');
select throws_ok(
  format($$ select public.gerar_chave_do_torneio(%L) $$, current_setting('t.t2')),
  '42501', 'Seu perfil não tem permissão para esta operação.',
  'professor nao gera chave (H9)'
);
reset role;

-- ===========================================================================
-- Grupos + eliminatoria com 8 inscritos
-- ===========================================================================
select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select set_config('t.t3', public.criar_torneio('Grupos', '2026-12-05', 'grupos_eliminatoria', false,
  '[{"alunosIds": ["r-ana"], "cabecaDeChave": 1}, {"alunosIds": ["r-bia"], "cabecaDeChave": 2},
    {"alunosIds": ["r-caio"]}, {"alunosIds": ["r-duda"]}, {"alunosIds": ["r-edu"]},
    {"alunosIds": ["r-fabi"]}, {"alunosIds": ["r-gui"]}, {"alunosIds": ["r-hugo"]}]'), true);
select public.gerar_chave_do_torneio(current_setting('t.t3'));
select is(
  (select count(*) from public.partidas where torneio_id = current_setting('t.t3')) || '|' ||
  (select count(*) filter (where grupo = 'A') || '-' || count(*) filter (where grupo = 'B') || '|' ||
          (max(grupo) filter (where alunos_ids = '{r-ana}') <> max(grupo) filter (where alunos_ids = '{r-bia}'))::text
     from public.torneio_inscritos where torneio_id = current_setting('t.t3')),
  '12|4-4|true',
  '8 inscritos: dois grupos de 4, 12 jogos, cabecas em grupos diferentes'
);

-- Joga todos os jogos de grupo (vence sempre o lado A).
do $$
declare
  v_id text;
begin
  for v_id in
    select id from public.partidas
     where torneio_id = current_setting('t.t3') and grupo is not null
     order by grupo, rodada, ordem
  loop
    perform public.registrar_resultado_de_torneio(v_id, '6/4 6/4', 'A');
  end loop;
end;
$$;

-- A eliminatoria montada concorda com a classificacao: 1A x 2B e 2A x 1B.
select is(
  (select string_agg(inscricao_a_id || 'x' || inscricao_b_id, ',' order by ordem)
     from public.partidas
    where torneio_id = current_setting('t.t3') and grupo is null and rodada = 1),
  (with c as (select * from public.classificacao_do_torneio(current_setting('t.t3')))
   select (select inscricao_id from c where grupo = 'A' and posicao = 1) || 'x' ||
          (select inscricao_id from c where grupo = 'B' and posicao = 2) || ',' ||
          (select inscricao_id from c where grupo = 'A' and posicao = 2) || 'x' ||
          (select inscricao_id from c where grupo = 'B' and posicao = 1)),
  'terminados os grupos, a eliminatoria e montada sozinha: 1A x 2B e 2A x 1B'
);
select is(
  (select count(*)::int from public.partidas where torneio_id = current_setting('t.t3') and grupo is null),
  3,
  'a eliminatoria tem semifinais e final'
);

select public.registrar_resultado_de_torneio(
  (select id from public.partidas
    where torneio_id = current_setting('t.t3') and grupo is null and rodada = 1 and ordem = 1),
  '6/4 6/4', 'A');
select throws_ok(
  format($$ select public.corrigir_resultado_de_torneio(%L, '4/6 4/6', 'B') $$,
    (select id from public.partidas
      where torneio_id = current_setting('t.t3') and grupo = 'A' order by rodada, ordem limit 1)),
  'P0001', 'A fase eliminatória já começou: os resultados dos grupos não podem mais ser mudados.',
  'com a eliminatoria comecada, os grupos ficam travados'
);
reset role;

-- ===========================================================================
-- Classificacao com desempate (H8): Vitorias, Confronto direto, Saldo de sets
-- e Saldo de games. Partidas gravadas direto (como postgres).
-- ===========================================================================
insert into public.torneios (id, nome, data, formato, situacao)
values ('t-d1', 'Desempate 1', '2026-12-05', 'todos_contra_todos', 'em_andamento'),
       ('t-d2', 'Desempate 2', '2026-12-05', 'todos_contra_todos', 'em_andamento');
insert into public.torneio_inscritos (id, torneio_id, alunos_ids) values
  ('dA', 't-d1', '{r-ana}'), ('dB', 't-d1', '{r-bia}'), ('dC', 't-d1', '{r-caio}'), ('dD', 't-d1', '{r-duda}'),
  ('dX', 't-d2', '{r-ana}'), ('dY', 't-d2', '{r-bia}'), ('dZ', 't-d2', '{r-caio}');
insert into public.partidas (torneio_id, inscricao_a_id, inscricao_b_id, vencedor, placar) values
  ('t-d1', 'dA', 'dB', 'A', '7/6 7/6'),
  ('t-d1', 'dA', 'dD', 'A', '7/5 4/6 10/8'),
  ('t-d1', 'dC', 'dA', 'A', '6/0 6/0'),
  ('t-d1', 'dB', 'dC', 'A', '6/0 6/0'),
  ('t-d1', 'dB', 'dD', 'A', '6/0 6/0'),
  ('t-d1', 'dD', 'dC', 'A', '7/6 4/6 10/7'),
  ('t-d2', 'dX', 'dY', 'A', '6/0 6/0'),
  ('t-d2', 'dY', 'dZ', 'A', '6/4 3/6 10/8'),
  ('t-d2', 'dZ', 'dX', 'A', '6/4 6/4');

select pg_temp.entrar_como('00000000-0000-0000-0000-000000000002');
select is(
  (select string_agg(inscricao_id || ':' || vitorias || ':' || desempate, ',' order by posicao)
     from public.classificacao_do_torneio('t-d1')),
  'dA:2:Confronto direto,dB:2:Confronto direto,dD:1:Confronto direto,dC:1:Confronto direto',
  'empate em vitorias decidido pelo confronto direto, mesmo com saldo de sets pior'
);
select is(
  (select string_agg(inscricao_id || ':' || (sets_pro - sets_contra) || ':' || desempate, ',' order by posicao)
     from public.classificacao_do_torneio('t-d2')),
  'dZ:1:Saldo de sets,dX:0:Saldo de sets,dY:-1:Saldo de sets',
  'empate triplo (cada um venceu um) decidido pelo saldo de sets'
);
reset role;

select * from finish();
rollback;
