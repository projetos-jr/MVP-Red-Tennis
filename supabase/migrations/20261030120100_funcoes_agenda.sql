-- ============================================================================
--  Funcoes da agenda e da reposicao
-- ============================================================================
--  As operacoes da agenda (src/lib/banco/operacoes/agenda.ts) viram funcoes do
--  Postgres, chamadas pela tela com `supabase.rpc('nome', { p_... })`. Cada uma
--  e "tudo ou nada": se uma regra for violada, nada e gravado e a tela recebe a
--  mesma mensagem que o front mostra hoje.
--
--  O que este arquivo cria:
--   1. Pecas internas (schema `privado`): textos das mensagens, conferencias
--      (quadra livre, professor livre, horario valido...), o calculo do saldo
--      de reposicao e a rotina comum de cancelamento (creditos + anulacao da
--      cobranca ainda nao paga).
--   2. A view `saldo_reposicao` (saldo de cada aluno, sempre calculado).
--   3. As funcoes de operacao (schema `public`), uma por operacao da tela.
--   4. A liberacao automatica das reservas vencidas (Hipotese H5) e o seu
--      agendamento a cada 15 minutos com pg_cron, quando a extensao existir.
--
--  Regras que o banco ja garantia antes (migracao do modelo novo) e continuam
--  valendo: duas ocupacoes ativas nunca dividem quadra e horario (exclusion
--  constraint), horario dentro do funcionamento, cancelar exige motivo, RLS
--  por perfil e auditoria automatica.
--
--  Todas as funcoes de operacao sao `security invoker`: rodam com as
--  permissoes de quem chamou (a RLS continua valendo). A unica excecao e a
--  rotina automatica, que roda sem ninguem logado (ver item 4).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pecas internas
-- ---------------------------------------------------------------------------

-- Tipos de aula que exigem professor (Individual, Dupla, LAP).
create function privado.tipo_com_professor(p_tipo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tipo in ('Individual', 'Dupla', 'LAP');
$$;

-- Tipos que dao direito a reposicao e que podem virar horario fixo: os planos
-- mensais. Locacao avulsa e ranking sao pagos por uso.
create function privado.tipo_de_plano(p_tipo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tipo in ('Individual', 'Dupla', 'LAP', 'Locação Mensal', 'Plano de locação');
$$;

-- "Quadra 2" ou "Paredão".
create function privado.rotulo_da_quadra(p_quadra_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_quadra_id = 'paredao' then 'Paredão' else 'Quadra ' || p_quadra_id end;
$$;

-- Duracao em minutos.
create function privado.minutos_entre(p_inicio time, p_fim time)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (extract(epoch from (p_fim - p_inicio)) / 60)::integer;
$$;

-- "Individual · Ana e Bruno", "Dupla · Ana e mais 2", "Bloqueio · Manutencao".
-- Os nomes dos alunos vem em ordem alfabetica.
create function privado.descrever_ocupacao(p_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when o.tipo = 'Bloqueio' then 'Bloqueio' || coalesce(' · ' || nullif(o.descricao, ''), '')
    else o.tipo || case
      when n.total = 0 then ''
      when n.total <= 2 then ' · ' || array_to_string(n.nomes, ' e ')
      else ' · ' || n.nomes[1] || ' e mais ' || (n.total - 1)
    end
  end
  from public.ocupacoes o
  cross join lateral (
    select count(*)::integer as total,
           coalesce(array_agg(a.nome order by a.nome), '{}') as nomes
      from public.ocupacao_alunos p
      join public.alunos a on a.id = p.aluno_id
     where p.ocupacao_id = o.id
  ) n
  where o.id = p_id;
$$;

-- A quadra existe.
create function privado.garantir_quadra(p_quadra_id text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.quadras where id = p_quadra_id) then
    perform privado.recusar('Quadra não encontrada.');
  end if;
end;
$$;

-- Agendamentos novos so a partir de hoje (o passado fica como historico).
create function privado.garantir_data_futura(p_data date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_data is null then
    perform privado.recusar('Informe uma data válida.');
  end if;
  if p_data < privado.hoje() then
    perform privado.recusar('Escolha uma data a partir de hoje.');
  end if;
end;
$$;

-- Inicio antes do fim, dentro do funcionamento da arena.
create function privado.garantir_horario_valido(p_inicio time, p_fim time)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_inicio is null or p_fim is null or not p_inicio < p_fim then
    perform privado.recusar('O horário de término precisa ser depois do início.');
  end if;
  if p_inicio < '07:00' or p_fim > '22:00' then
    perform privado.recusar('A arena funciona das 07:00 às 22:00.');
  end if;
end;
$$;

-- A quadra esta livre no intervalo? A exclusion constraint de `ocupacoes`
-- garante a regra mesmo com dois balcoes ao mesmo tempo; esta conferencia so
-- troca o erro tecnico por uma mensagem que diz quem ocupa.
create function privado.garantir_quadra_livre(
  p_quadra_id text,
  p_data date,
  p_inicio time,
  p_fim time,
  p_ignorar_id text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_conflito public.ocupacoes%rowtype;
begin
  select o.* into v_conflito
    from public.ocupacoes o
   where o.quadra_id = p_quadra_id
     and o.data = p_data
     and o.situacao <> 'cancelada'
     and o.hora_inicio < p_fim
     and p_inicio < o.hora_fim
     and o.id is distinct from p_ignorar_id
   order by o.hora_inicio, o.criado_em
   limit 1;
  if found then
    perform privado.recusar(format(
      '%s já está ocupada em %s das %s às %s (%s).',
      privado.rotulo_da_quadra(p_quadra_id),
      to_char(p_data, 'DD/MM'),
      to_char(v_conflito.hora_inicio, 'HH24:MI'),
      to_char(v_conflito.hora_fim, 'HH24:MI'),
      privado.descrever_ocupacao(v_conflito.id)
    ));
  end if;
end;
$$;

-- Hipotese H10: professor em duas aulas ao mesmo tempo. So recusa com
-- `bloquear_professor_em_duas_aulas` ligado. Nao ha constraint para isso, entao
-- a funcao trava o professor (trava da transacao) para dois balcoes nao
-- marcarem o mesmo professor ao mesmo tempo.
create function privado.garantir_professor_livre(
  p_professor_id text,
  p_data date,
  p_inicio time,
  p_fim time,
  p_ignorar_id text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_conflito public.ocupacoes%rowtype;
begin
  if p_professor_id is null then
    return;
  end if;
  if not coalesce(
    (select bloquear_professor_em_duas_aulas from public.configuracoes where id = 1), false
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('agenda:professor:' || p_professor_id));

  select o.* into v_conflito
    from public.ocupacoes o
    join public.quadras q on q.id = o.quadra_id
   where o.professor_id = p_professor_id
     and o.data = p_data
     and o.situacao <> 'cancelada'
     and o.hora_inicio < p_fim
     and p_inicio < o.hora_fim
     and o.id is distinct from p_ignorar_id
   order by o.hora_inicio, q.ordem
   limit 1;
  if found then
    perform privado.recusar(format(
      '%s já tem aula em %s das %s às %s (%s).',
      coalesce((select nome from public.professores where id = p_professor_id), 'O professor'),
      to_char(p_data, 'DD/MM'),
      to_char(v_conflito.hora_inicio, 'HH24:MI'),
      to_char(v_conflito.hora_fim, 'HH24:MI'),
      privado.rotulo_da_quadra(v_conflito.quadra_id)
    ));
  end if;
end;
$$;

-- Aulas (Individual, Dupla, LAP) exigem professor ativo; locacoes e ranking
-- nao tem professor (o informado e ignorado).
create function privado.validar_professor(p_tipo text, p_professor_id text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if not privado.tipo_com_professor(p_tipo) then
    return null;
  end if;
  if nullif(btrim(coalesce(p_professor_id, '')), '') is null then
    perform privado.recusar('Escolha o professor da aula.');
  end if;
  if not exists (select 1 from public.professores where id = p_professor_id and ativo) then
    perform privado.recusar('Professor não encontrado.');
  end if;
  return p_professor_id;
end;
$$;

-- Alunos de um agendamento: pelo menos um, sem repetir (mantendo a ordem),
-- todos ativos na arena.
create function privado.validar_alunos(p_alunos_ids text[])
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_unicos text[];
  v_id text;
  v_aluno record;
begin
  select coalesce(array_agg(u.id order by u.ordem), '{}')
    into v_unicos
    from (
      select x.id, min(x.ordem) as ordem
        from unnest(p_alunos_ids) with ordinality as x(id, ordem)
       where x.id is not null
       group by x.id
    ) u;
  if cardinality(v_unicos) = 0 then
    perform privado.recusar('Escolha pelo menos um aluno.');
  end if;
  foreach v_id in array v_unicos loop
    select nome, ativo into v_aluno from public.alunos where id = v_id;
    if not found then
      perform privado.recusar('Aluno não encontrado.');
    end if;
    if not v_aluno.ativo then
      perform privado.recusar(format('%s não está mais ativo na arena.', v_aluno.nome));
    end if;
  end loop;
  return v_unicos;
end;
$$;

-- A sigla na lista das Configuracoes (Hipotese H1), ou null.
create function privado.buscar_sigla(p_codigo text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select s
    from public.configuracoes c, jsonb_array_elements(c.siglas) s
   where c.id = 1 and s ->> 'codigo' = p_codigo
   limit 1;
$$;

-- A sigla da direito a credito para este tipo de aula?
create function privado.sigla_gera_credito(p_sigla text, p_tipo text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((privado.buscar_sigla(p_sigla) ->> 'geraCredito')::boolean, false)
     and privado.tipo_de_plano(p_tipo);
$$;

-- Validade de um credito gerado por uma aula na data (data + N meses; 31/01 +
-- 1 mes = 28/02, como no front).
create function privado.validade_do_credito(p_data date)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_data + make_interval(months => c.validade_reposicao_meses))::date
    from public.configuracoes c where c.id = 1;
$$;

-- Trava o extrato de reposicao do aluno ate o fim da transacao: duas
-- operacoes ao mesmo tempo nao usam o mesmo saldo.
create function privado.travar_reposicao(p_aluno_id text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('agenda:reposicao:' || p_aluno_id));
$$;

-- Extrato de reposicao do aluno, com a mesma regra do front
-- (src/lib/banco/regras/reposicao.ts, `extratoReposicao`):
--  - cada uso (minutos negativos), em ordem de criacao, consome os creditos que
--    ja existiam e valiam no dia do uso, comecando pelo que vence antes;
--  - saldo = o que resta dos creditos ainda validos em `p_hoje`;
--  - sem_cobertura = minutos usados que nenhum credito cobre (deve ser 0: e o
--    que garante que o saldo nunca fica negativo quando um credito e retirado).
create function privado.calcular_reposicao(p_aluno_id text, p_hoje date)
returns table (
  saldo integer,
  sem_cobertura integer,
  proximo_vencimento date,
  minutos_a_vencer integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_validade date[];
  v_criado timestamptz[];
  v_restante integer[];
  v_total integer;
  v_uso record;
  v_dia date;
  v_falta integer;
  v_usado integer;
  i integer;
begin
  saldo := 0;
  sem_cobertura := 0;

  select coalesce(array_agg(r.validade order by r.validade, r.criado_em, r.id), '{}'),
         coalesce(array_agg(r.criado_em order by r.validade, r.criado_em, r.id), '{}'),
         coalesce(array_agg(r.minutos order by r.validade, r.criado_em, r.id), '{}')
    into v_validade, v_criado, v_restante
    from public.reposicoes r
   where r.aluno_id = p_aluno_id and r.minutos > 0;
  v_total := cardinality(v_validade);

  for v_uso in
    select -r.minutos as minutos, r.criado_em
      from public.reposicoes r
     where r.aluno_id = p_aluno_id and r.minutos < 0
     order by r.criado_em, r.id
  loop
    v_dia := (v_uso.criado_em at time zone 'America/Sao_Paulo')::date;
    v_falta := v_uso.minutos;
    for i in 1 .. v_total loop
      exit when v_falta <= 0;
      if v_criado[i] <= v_uso.criado_em and v_validade[i] >= v_dia and v_restante[i] > 0 then
        v_usado := least(v_restante[i], v_falta);
        v_restante[i] := v_restante[i] - v_usado;
        v_falta := v_falta - v_usado;
      end if;
    end loop;
    sem_cobertura := sem_cobertura + v_falta;
  end loop;

  for i in 1 .. v_total loop
    if v_validade[i] >= p_hoje and v_restante[i] > 0 then
      saldo := saldo + v_restante[i];
      if proximo_vencimento is null then
        proximo_vencimento := v_validade[i];
        minutos_a_vencer := v_restante[i];
      end if;
    end if;
  end loop;

  return next;
end;
$$;

-- Recusa o uso de minutos acima do saldo disponivel hoje (trava o extrato).
create function privado.garantir_saldo_suficiente(p_aluno_id text, p_minutos integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_saldo integer;
begin
  perform privado.travar_reposicao(p_aluno_id);
  select c.saldo into v_saldo from privado.calcular_reposicao(p_aluno_id, privado.hoje()) c;
  if p_minutos > v_saldo then
    perform privado.recusar(format(
      'Saldo de reposição insuficiente: o aluno tem %s minutos e a aula precisa de %s.',
      v_saldo, p_minutos
    ));
  end if;
end;
$$;

-- Recusa se algum uso de reposicao dos alunos ficou sem credito que o cubra
-- (depois de retirar um credito).
create function privado.garantir_extrato_coerente(p_alunos_ids text[], p_mensagem text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id text;
begin
  foreach v_id in array coalesce(p_alunos_ids, '{}') loop
    if (select c.sem_cobertura from privado.calcular_reposicao(v_id, privado.hoje()) c) > 0 then
      perform privado.recusar(p_mensagem);
    end if;
  end loop;
end;
$$;

-- Prazo de pagamento de uma reserva (Hipotese H5): `prazo_pagamento_reserva_horas`
-- depois de agora, mas nunca depois do inicio da propria reserva.
create function privado.prazo_da_reserva(p_data date, p_inicio time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(
    privado.agora() + make_interval(hours => c.prazo_pagamento_reserva_horas),
    p_data + p_inicio
  ) at time zone 'America/Sao_Paulo'
  from public.configuracoes c where c.id = 1;
$$;

-- Valor da locacao: preco por hora (quadra ou paredao) x duracao.
create function privado.preco_da_locacao(p_quadra_id text, p_inicio time, p_fim time)
returns numeric
language sql
stable
set search_path = ''
as $$
  select round(
    case when p_quadra_id = 'paredao' then c.preco_paredao_hora else c.preco_locacao_hora end
      * privado.minutos_entre(p_inicio, p_fim) / 60.0,
    2
  )
  from public.configuracoes c where c.id = 1;
$$;

-- "Locação avulsa · Quadra 2 · 10/11 19:00".
create function privado.item_da_locacao(p_quadra_id text, p_data date, p_inicio time)
returns text
language sql
immutable
set search_path = ''
as $$
  select format('Locação avulsa · %s · %s %s',
    privado.rotulo_da_quadra(p_quadra_id), to_char(p_data, 'DD/MM'), to_char(p_inicio, 'HH24:MI'));
$$;

-- Anula (lancamento nunca se apaga) as cobrancas ainda nao pagas das ocupacoes.
create function privado.anular_cobrancas(p_ids text[], p_motivo text)
returns void
language sql
set search_path = ''
as $$
  update public.lancamentos
     set cancelado_em = now(), motivo_cancelamento = p_motivo
   where ocupacao_id = any (p_ids)
     and pago_em is null
     and cancelado_em is null;
$$;

-- Rotina comum de cancelamento (cancelar aula, falta avisada em aula
-- individual, bloqueio, chuva, reserva sem pagamento), como `cancelarNoBanco`
-- do front:
--  - credito de reposicao para quem tem direito (sigla que gera credito, tipo
--    de plano mensal), menos para quem ja ganhou credito desta aula (falta
--    avisada);
--  - situacao "cancelada", com o motivo e a hora do cancelamento;
--  - as presencas voltam para "a marcar", menos as faltas avisadas;
--  - a cobranca ainda nao paga da reserva e anulada.
-- Quem chama ja conferiu que as ocupacoes estao ativas e as travou.
-- Devolve { aulas, alunos, minutos, creditos: [{ aluno_id, ocupacao_id, minutos }] }.
create function privado.cancelar_ocupacoes(p_ids text[], p_motivo text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_creditos jsonb;
  v_alunos integer;
begin
  with novos as (
    insert into public.reposicoes (aluno_id, minutos, sigla, ocupacao_origem_id, validade)
    select p.aluno_id,
           privado.minutos_entre(o.hora_inicio, o.hora_fim),
           p_motivo,
           o.id,
           privado.validade_do_credito(o.data)
      from public.ocupacoes o
      join public.ocupacao_alunos p on p.ocupacao_id = o.id
     where o.id = any (p_ids)
       and privado.sigla_gera_credito(p_motivo, o.tipo)
       and not exists (
         select 1 from public.reposicoes r
          where r.ocupacao_origem_id = o.id and r.aluno_id = p.aluno_id and r.minutos > 0
       )
    returning reposicoes.aluno_id, reposicoes.ocupacao_origem_id, reposicoes.minutos
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'aluno_id', n.aluno_id, 'ocupacao_id', n.ocupacao_origem_id, 'minutos', n.minutos)), '[]')
    into v_creditos
    from novos n;

  select count(*) into v_alunos from public.ocupacao_alunos where ocupacao_id = any (p_ids);

  update public.ocupacoes
     set situacao = 'cancelada', motivo_cancelamento = p_motivo, cancelada_em = now()
   where id = any (p_ids);

  update public.ocupacao_alunos
     set presenca = 'a_marcar', sigla = null
   where ocupacao_id = any (p_ids)
     and presenca not in ('falta_avisada', 'a_marcar');

  perform privado.anular_cobrancas(p_ids, format('Reserva cancelada na agenda: %s.', p_motivo));

  return jsonb_build_object(
    'aulas', coalesce(cardinality(p_ids), 0),
    'alunos', v_alunos,
    'minutos', (select coalesce(sum((c ->> 'minutos')::integer), 0) from jsonb_array_elements(v_creditos) c),
    'creditos', v_creditos
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Saldo de reposicao de cada aluno (sempre calculado, nunca guardado)
-- ---------------------------------------------------------------------------
create view public.saldo_reposicao
with (security_invoker = true) as
select
  a.id as aluno_id,
  c.saldo,
  c.proximo_vencimento,
  c.minutos_a_vencer
from public.alunos a
cross join lateral privado.calcular_reposicao(a.id, privado.hoje()) c;

revoke all on public.saldo_reposicao from anon;
revoke all on public.saldo_reposicao from authenticated;
grant select on public.saldo_reposicao to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Operacoes da agenda (uma funcao por operacao da tela)
-- ---------------------------------------------------------------------------

-- Novo horario avulso (uma data so: aula avulsa, locacao avulsa, ranking).
-- Locacao avulsa nasce "aguardando pagamento", com prazo (H5) e a cobranca a
-- receber ligada a ocupacao. O primeiro aluno e o titular (quem paga).
-- Devolve o id da ocupacao.
create function public.criar_horario_avulso(
  p_quadra_id text,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_tipo text,
  p_alunos_ids text[],
  p_professor_id text default null,
  p_descricao text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_professor_id text;
  v_alunos text[];
  v_locacao boolean := p_tipo = 'Locação Avulsa';
  v_prazo timestamptz;
  v_id text;
  v_titular record;
begin
  perform privado.iniciar_operacao('Criar horário avulso', 'agenda');
  perform privado.garantir_quadra(p_quadra_id);
  perform privado.garantir_data_futura(p_data);
  perform privado.garantir_horario_valido(p_hora_inicio, p_hora_fim);
  if p_tipo = 'Bloqueio' then
    perform privado.recusar('Para fechar a quadra, use “Bloquear quadra”.');
  end if;
  v_professor_id := privado.validar_professor(p_tipo, p_professor_id);
  v_alunos := privado.validar_alunos(p_alunos_ids);
  perform privado.garantir_quadra_livre(p_quadra_id, p_data, p_hora_inicio, p_hora_fim);
  perform privado.garantir_professor_livre(v_professor_id, p_data, p_hora_inicio, p_hora_fim);

  if v_locacao then
    v_prazo := privado.prazo_da_reserva(p_data, p_hora_inicio);
  end if;

  insert into public.ocupacoes
    (quadra_id, data, hora_inicio, hora_fim, tipo, professor_id, situacao, prazo_pagamento, descricao)
  values
    (p_quadra_id, p_data, p_hora_inicio, p_hora_fim, p_tipo, v_professor_id,
     case when v_locacao then 'aguardando_pagamento' else 'agendada' end,
     v_prazo, nullif(btrim(coalesce(p_descricao, '')), ''))
  returning id into v_id;

  insert into public.ocupacao_alunos (ocupacao_id, aluno_id)
  select v_id, a from unnest(v_alunos) a;

  if v_locacao then
    select id, nome into v_titular from public.alunos where id = v_alunos[1];
    insert into public.lancamentos
      (tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor, vencimento, ocupacao_id)
    values
      ('receber', 'Locação', v_titular.id, 'aluno', v_titular.nome,
       privado.item_da_locacao(p_quadra_id, p_data, p_hora_inicio),
       privado.preco_da_locacao(p_quadra_id, p_hora_inicio, p_hora_fim),
       (v_prazo at time zone 'America/Sao_Paulo')::date,
       v_id);
  end if;

  return v_id;
end;
$$;

-- Horario que se repete toda semana: grava o molde (`horarios_fixos`), os
-- alunos dele (`horario_alunos`) e uma ocupacao por data, ate o horizonte da
-- agenda (H12: fim da semana que fica `semanas_geradas_a_frente` semanas a
-- frente). Datas em conflito precisam vir em `p_datas_puladas` (a tela mostra
-- a lista antes de salvar); a primeira data em conflito nao pulada recusa tudo.
-- Devolve { horario_fixo_id, aulas }.
create function public.criar_horario_fixo(
  p_quadra_id text,
  p_data_inicio date,
  p_hora_inicio time,
  p_hora_fim time,
  p_tipo text,
  p_alunos_ids text[],
  p_professor_id text default null,
  p_fim date default null,
  p_datas_puladas date[] default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_professor_id text;
  v_alunos text[];
  v_semanas smallint;
  v_ate date;
  v_limite date;
  v_datas date[];
  v_restantes date[];
  v_data date;
  v_molde text;
begin
  perform privado.iniciar_operacao('Criar horário fixo', 'agenda');
  perform privado.garantir_quadra(p_quadra_id);
  perform privado.garantir_data_futura(p_data_inicio);
  if p_fim is not null and p_fim < p_data_inicio then
    perform privado.recusar('A data final precisa ser depois da primeira aula.');
  end if;
  perform privado.garantir_horario_valido(p_hora_inicio, p_hora_fim);
  if not privado.tipo_de_plano(p_tipo) then
    perform privado.recusar(
      'Horário fixo é para aulas e locações mensais. Locação avulsa e ranking são marcados como avulso.');
  end if;
  v_professor_id := privado.validar_professor(p_tipo, p_professor_id);
  v_alunos := privado.validar_alunos(p_alunos_ids);

  -- Horizonte (H12): segunda-feira desta semana + N semanas - 1 dia.
  select semanas_geradas_a_frente into v_semanas from public.configuracoes where id = 1;
  v_ate := privado.hoje() - (extract(isodow from privado.hoje())::integer - 1) + 7 * v_semanas - 1;
  v_limite := least(coalesce(p_fim, v_ate), v_ate);

  select coalesce(array_agg(d order by d), '{}')
    into v_datas
    from (
      select p_data_inicio + 7 * n as d
        from generate_series(0, greatest((v_limite - p_data_inicio) / 7, 0)) n
    ) s
   where d <= v_limite;
  if cardinality(v_datas) = 0 then
    perform privado.recusar(format(
      'A primeira aula precisa cair até %s: a agenda é criada até %s semanas à frente.',
      to_char(v_ate, 'DD/MM/YYYY'), v_semanas));
  end if;

  select coalesce(array_agg(d order by d), '{}')
    into v_restantes
    from unnest(v_datas) d
   where not (d = any (array_remove(coalesce(p_datas_puladas, '{}'), null)));
  if cardinality(v_restantes) = 0 then
    perform privado.recusar('Todas as datas foram puladas: não há aula para criar.');
  end if;

  -- A mesma regra de sempre, data a data: a primeira em conflito recusa tudo.
  foreach v_data in array v_restantes loop
    perform privado.garantir_quadra_livre(p_quadra_id, v_data, p_hora_inicio, p_hora_fim);
    perform privado.garantir_professor_livre(v_professor_id, v_data, p_hora_inicio, p_hora_fim);
  end loop;

  insert into public.horarios_fixos
    (quadra_id, dia_semana, hora_inicio, hora_fim, tipo, professor_id, inicio, fim)
  values
    (p_quadra_id, extract(dow from p_data_inicio)::smallint, p_hora_inicio, p_hora_fim,
     p_tipo, v_professor_id, p_data_inicio, p_fim)
  returning id into v_molde;

  insert into public.horario_alunos (horario_fixo_id, aluno_id)
  select v_molde, a from unnest(v_alunos) a;

  insert into public.ocupacoes
    (quadra_id, data, hora_inicio, hora_fim, tipo, professor_id, horario_fixo_id, situacao)
  select p_quadra_id, d, p_hora_inicio, p_hora_fim, p_tipo, v_professor_id, v_molde, 'agendada'
    from unnest(v_restantes) d;

  insert into public.ocupacao_alunos (ocupacao_id, aluno_id)
  select o.id, a
    from public.ocupacoes o
    cross join unnest(v_alunos) a
   where o.horario_fixo_id = v_molde;

  return jsonb_build_object('horario_fixo_id', v_molde, 'aulas', cardinality(v_restantes));
end;
$$;

-- Aula nova paga com os minutos de reposicao do aluno (recusa se o saldo nao
-- bastar). Grava a ocupacao ("Reposição"), o aluno e o uso dos minutos.
-- Devolve o id da ocupacao.
create function public.marcar_aula_de_reposicao(
  p_aluno_id text,
  p_quadra_id text,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_tipo text,
  p_professor_id text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_professor_id text;
  v_aluno text;
  v_minutos integer;
  v_id text;
begin
  perform privado.iniciar_operacao('Marcar aula de reposição', 'agenda');
  perform privado.garantir_quadra(p_quadra_id);
  perform privado.garantir_data_futura(p_data);
  perform privado.garantir_horario_valido(p_hora_inicio, p_hora_fim);
  if not privado.tipo_de_plano(p_tipo) then
    perform privado.recusar('A reposição é para aulas e locações do plano.');
  end if;
  v_professor_id := privado.validar_professor(p_tipo, p_professor_id);
  v_aluno := (privado.validar_alunos(array[p_aluno_id]))[1];
  v_minutos := privado.minutos_entre(p_hora_inicio, p_hora_fim);
  perform privado.garantir_saldo_suficiente(v_aluno, v_minutos);
  perform privado.garantir_quadra_livre(p_quadra_id, p_data, p_hora_inicio, p_hora_fim);
  perform privado.garantir_professor_livre(v_professor_id, p_data, p_hora_inicio, p_hora_fim);

  insert into public.ocupacoes
    (quadra_id, data, hora_inicio, hora_fim, tipo, professor_id, situacao, descricao)
  values
    (p_quadra_id, p_data, p_hora_inicio, p_hora_fim, p_tipo, v_professor_id, 'agendada', 'Reposição')
  returning id into v_id;

  insert into public.ocupacao_alunos (ocupacao_id, aluno_id) values (v_id, v_aluno);
  insert into public.reposicoes (aluno_id, minutos, ocupacao_uso_id)
  values (v_aluno, -v_minutos, v_id);

  return v_id;
end;
$$;

-- Inclui um aluno numa aula que ja existe (sem mexer na reposicao).
-- Devolve o id da participacao (`ocupacao_alunos`).
create function public.incluir_aluno(p_ocupacao_id text, p_aluno_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
  v_aluno text;
  v_id text;
begin
  perform privado.iniciar_operacao('Incluir aluno na aula', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_ocupacao_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao = 'cancelada' then
    perform privado.recusar('Esta aula está cancelada.');
  end if;
  if v_ocupacao.tipo = 'Bloqueio' then
    perform privado.recusar('Bloqueio de quadra não tem alunos.');
  end if;
  v_aluno := (privado.validar_alunos(array[p_aluno_id]))[1];
  if exists (select 1 from public.ocupacao_alunos where ocupacao_id = v_ocupacao.id and aluno_id = v_aluno) then
    perform privado.recusar('Este aluno já está na aula.');
  end if;

  insert into public.ocupacao_alunos (ocupacao_id, aluno_id)
  values (v_ocupacao.id, v_aluno)
  returning id into v_id;
  return v_id;
end;
$$;

-- Inclui o aluno numa aula que ja existe pagando com minutos de reposicao:
-- confere o saldo (credito vencido nao conta; o uso consome primeiro o que
-- vence antes) e grava o uso ligado a aula.
-- Devolve { minutos, saldo } (saldo que sobra).
create function public.usar_reposicao(p_ocupacao_id text, p_aluno_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
  v_aluno text;
  v_minutos integer;
begin
  perform privado.iniciar_operacao('Usar reposição', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_ocupacao_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao = 'cancelada' then
    perform privado.recusar('Esta aula está cancelada.');
  end if;
  if not privado.tipo_de_plano(v_ocupacao.tipo) then
    perform privado.recusar('A reposição só pode ser usada em aulas e locações do plano.');
  end if;
  if v_ocupacao.data < privado.hoje() then
    perform privado.recusar('A reposição precisa ser marcada numa aula de hoje em diante.');
  end if;
  v_aluno := (privado.validar_alunos(array[p_aluno_id]))[1];
  if exists (select 1 from public.ocupacao_alunos where ocupacao_id = v_ocupacao.id and aluno_id = v_aluno) then
    perform privado.recusar('Este aluno já está na aula.');
  end if;
  v_minutos := privado.minutos_entre(v_ocupacao.hora_inicio, v_ocupacao.hora_fim);
  perform privado.garantir_saldo_suficiente(v_aluno, v_minutos);

  insert into public.ocupacao_alunos (ocupacao_id, aluno_id) values (v_ocupacao.id, v_aluno);
  insert into public.reposicoes (aluno_id, minutos, ocupacao_uso_id)
  values (v_aluno, -v_minutos, v_ocupacao.id);

  return jsonb_build_object(
    'minutos', v_minutos,
    'saldo', (select c.saldo from privado.calcular_reposicao(v_aluno, privado.hoje()) c)
  );
end;
$$;

-- Tira o aluno da aula. Se ele estava ali por reposicao, os minutos voltam
-- para o saldo (o uso e apagado; a auditoria guarda).
-- Devolve { minutos_devolvidos }.
create function public.remover_aluno(p_ocupacao_id text, p_aluno_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
  v_devolvidos integer;
begin
  perform privado.iniciar_operacao('Remover aluno da aula', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_ocupacao_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao = 'cancelada' then
    perform privado.recusar('Esta aula está cancelada.');
  end if;
  delete from public.ocupacao_alunos where ocupacao_id = v_ocupacao.id and aluno_id = p_aluno_id;
  if not found then
    perform privado.recusar('Este aluno não está na aula.');
  end if;

  with apagados as (
    delete from public.reposicoes
     where aluno_id = p_aluno_id and minutos < 0 and ocupacao_uso_id = v_ocupacao.id
    returning reposicoes.minutos
  )
  select coalesce(-sum(a.minutos), 0) into v_devolvidos from apagados a;

  return jsonb_build_object('minutos_devolvidos', v_devolvidos);
end;
$$;

-- Presenca, falta ou falta avisada de um aluno (Hipotese H1).
--  - Falta avisada pede uma sigla de aluno ("aluno" ou "ambos"); se ela da
--    direito, o credito e so desse aluno.
--  - Em aula Individual, a falta avisada cancela a aula (com a mesma sigla).
--  - Presenca e falta so no dia da aula ou depois; a aula passa a "realizada".
--  - Trocar a marcacao retira o credito anterior (recusa se ele ja foi usado).
-- Devolve { minutos_de_credito, aula_cancelada }: minutos de credito que a
-- falta avisada deixou para o aluno nesta aula (0 = nenhum).
create function public.marcar_presenca(
  p_ocupacao_id text,
  p_aluno_id text,
  p_presenca text,
  p_sigla text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
  v_participacao public.ocupacao_alunos%rowtype;
  v_sigla text;
  v_regra jsonb;
  v_credito public.reposicoes%rowtype;
  v_tem_credito boolean;
  v_gera_credito boolean;
  v_minutos integer := 0;
  v_cancelada boolean := false;
begin
  perform privado.iniciar_operacao('Marcar presença', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_ocupacao_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao = 'cancelada' then
    perform privado.recusar('Esta aula está cancelada: não dá para marcar presença.');
  end if;
  select * into v_participacao
    from public.ocupacao_alunos
   where ocupacao_id = v_ocupacao.id and aluno_id = p_aluno_id
   for update;
  if not found then
    perform privado.recusar('Este aluno não está na aula.');
  end if;
  if p_presenca in ('presente', 'falta') and v_ocupacao.data > privado.hoje() then
    perform privado.recusar('Presença e falta só podem ser marcadas no dia da aula ou depois.');
  end if;

  if p_presenca = 'falta_avisada' then
    v_sigla := nullif(btrim(coalesce(p_sigla, '')), '');
    if v_sigla is null then
      perform privado.recusar('Escolha a sigla da falta avisada.');
    end if;
    v_regra := privado.buscar_sigla(v_sigla);
    if v_regra is null then
      perform privado.recusar(format('A sigla %s não existe nas Configurações.', v_sigla));
    end if;
    if v_regra ->> 'aplicaA' = 'ocupacao' then
      perform privado.recusar(format(
        'A sigla %s é para cancelar a aula inteira, não para a falta de um aluno.', v_sigla));
    end if;
  end if;

  -- Nada mudou: nada a gravar.
  if v_participacao.presenca = p_presenca and v_participacao.sigla is not distinct from v_sigla then
    return jsonb_build_object(
      'minutos_de_credito',
      coalesce((select minutos from public.reposicoes
                 where ocupacao_origem_id = v_ocupacao.id and aluno_id = p_aluno_id and minutos > 0
                 limit 1), 0),
      'aula_cancelada', false);
  end if;

  -- Credito desta aula para este aluno: nasce, troca de sigla ou e retirado.
  perform privado.travar_reposicao(p_aluno_id);
  select * into v_credito
    from public.reposicoes
   where ocupacao_origem_id = v_ocupacao.id and aluno_id = p_aluno_id and minutos > 0
   limit 1
   for update;
  v_tem_credito := found;
  v_gera_credito := v_sigla is not null and privado.sigla_gera_credito(v_sigla, v_ocupacao.tipo);

  if v_tem_credito and v_gera_credito then
    if v_credito.sigla is distinct from v_sigla then
      update public.reposicoes set sigla = v_sigla where id = v_credito.id;
    end if;
    v_minutos := v_credito.minutos;
  elsif v_tem_credito then
    delete from public.reposicoes where id = v_credito.id;
    perform privado.garantir_extrato_coerente(
      array[p_aluno_id],
      'O crédito desta falta avisada já foi usado numa reposição: não dá para desfazê-lo.');
  elsif v_gera_credito then
    v_minutos := privado.minutos_entre(v_ocupacao.hora_inicio, v_ocupacao.hora_fim);
    insert into public.reposicoes (aluno_id, minutos, sigla, ocupacao_origem_id, validade)
    values (p_aluno_id, v_minutos, v_sigla, v_ocupacao.id, privado.validade_do_credito(v_ocupacao.data));
  end if;

  update public.ocupacao_alunos
     set presenca = p_presenca, sigla = v_sigla
   where id = v_participacao.id;

  if p_presenca = 'falta_avisada' and v_ocupacao.tipo = 'Individual' then
    perform privado.cancelar_ocupacoes(array[v_ocupacao.id], v_sigla);
    v_cancelada := true;
  elsif p_presenca in ('presente', 'falta') and v_ocupacao.situacao = 'agendada' then
    update public.ocupacoes set situacao = 'realizada' where id = v_ocupacao.id;
  end if;

  return jsonb_build_object('minutos_de_credito', v_minutos, 'aula_cancelada', v_cancelada);
end;
$$;

-- Cancela uma ocupacao. O motivo e obrigatorio: uma sigla das Configuracoes
-- (gera credito quando da direito, H1) ou um texto livre (sem credito).
-- Devolve { aulas, alunos, minutos, creditos } (minutos de credito gerados).
create function public.cancelar_ocupacao(p_id text, p_motivo text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  perform privado.iniciar_operacao('Cancelar aula', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao = 'cancelada' then
    perform privado.recusar('Esta aula já está cancelada.');
  end if;
  if v_motivo = '' then
    perform privado.recusar('Informe o motivo do cancelamento.');
  end if;
  if privado.buscar_sigla(v_motivo) ->> 'aplicaA' = 'aluno' then
    perform privado.recusar(format(
      'A sigla %s é para a falta de um aluno: marque “Falta avisada” na lista de alunos.', v_motivo));
  end if;
  return privado.cancelar_ocupacoes(array[v_ocupacao.id], v_motivo);
end;
$$;

-- Muda a data, o horario ou a quadra de UMA ocupacao (o horario fixo continua
-- igual nas outras semanas). O prazo da reserva nunca passa do inicio dela, e
-- a cobranca ainda nao paga da locacao acompanha a nova data e duracao.
-- Devolve o id da ocupacao.
create function public.remarcar_ocupacao(
  p_id text,
  p_quadra_id text,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
  v_inicio timestamptz;
  v_prazo timestamptz;
begin
  perform privado.iniciar_operacao('Remarcar aula', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao = 'cancelada' then
    perform privado.recusar('Esta aula está cancelada.');
  end if;
  if v_ocupacao.situacao = 'realizada' then
    perform privado.recusar('Esta aula já aconteceu: não dá para remarcar.');
  end if;
  perform privado.garantir_quadra(p_quadra_id);
  perform privado.garantir_data_futura(p_data);
  perform privado.garantir_horario_valido(p_hora_inicio, p_hora_fim);
  if p_quadra_id = v_ocupacao.quadra_id and p_data = v_ocupacao.data
     and p_hora_inicio = v_ocupacao.hora_inicio and p_hora_fim = v_ocupacao.hora_fim then
    perform privado.recusar('Escolha uma data, um horário ou uma quadra diferente.');
  end if;
  perform privado.garantir_quadra_livre(p_quadra_id, p_data, p_hora_inicio, p_hora_fim, v_ocupacao.id);
  perform privado.garantir_professor_livre(
    v_ocupacao.professor_id, p_data, p_hora_inicio, p_hora_fim, v_ocupacao.id);

  v_inicio := (p_data + p_hora_inicio) at time zone 'America/Sao_Paulo';
  v_prazo := case
    when v_ocupacao.prazo_pagamento > v_inicio then v_inicio
    else v_ocupacao.prazo_pagamento
  end;

  update public.ocupacoes
     set quadra_id = p_quadra_id, data = p_data, hora_inicio = p_hora_inicio,
         hora_fim = p_hora_fim, prazo_pagamento = v_prazo
   where id = v_ocupacao.id;

  if v_ocupacao.tipo = 'Locação Avulsa' then
    update public.lancamentos
       set item = privado.item_da_locacao(p_quadra_id, p_data, p_hora_inicio),
           valor = privado.preco_da_locacao(p_quadra_id, p_hora_inicio, p_hora_fim),
           vencimento = coalesce((v_prazo at time zone 'America/Sao_Paulo')::date, vencimento)
     where ocupacao_id = v_ocupacao.id
       and pago_em is null
       and cancelado_em is null;
  end if;

  return v_ocupacao.id;
end;
$$;

-- Encerra um horario fixo: `fim` passa a ser a ultima data do molde e as
-- aulas depois dela que ainda nao aconteceram (de hoje em diante, agendadas ou
-- aguardando pagamento) saem da agenda, com os alunos delas, os creditos que
-- elas geraram e os usos de reposicao nelas (os minutos voltam). Recusa se um
-- desses creditos ja foi usado. Canceladas e realizadas ficam como historico.
-- Devolve { aulas_removidas }.
create function public.encerrar_horario_fixo(p_horario_fixo_id text, p_fim date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_horario public.horarios_fixos%rowtype;
  v_ids text[];
  v_alunos text[];
  v_aluno text;
begin
  perform privado.iniciar_operacao('Encerrar horário fixo', 'agenda');
  select * into v_horario from public.horarios_fixos where id = p_horario_fixo_id for update;
  if not found then
    perform privado.recusar('Horário fixo não encontrado.');
  end if;
  if p_fim is null then
    perform privado.recusar('Informe uma data válida.');
  end if;
  if p_fim < v_horario.inicio then
    perform privado.recusar(format(
      'Este horário começou em %s: o encerramento precisa ser depois disso.',
      to_char(v_horario.inicio, 'DD/MM/YYYY')));
  end if;
  if v_horario.fim is not null and p_fim >= v_horario.fim then
    perform privado.recusar(format('Este horário já termina em %s.', to_char(v_horario.fim, 'DD/MM/YYYY')));
  end if;

  select coalesce(array_agg(s.id), '{}')
    into v_ids
    from (
      select o.id
        from public.ocupacoes o
       where o.horario_fixo_id = v_horario.id
         and o.data > p_fim
         and o.data >= privado.hoje()
         and o.situacao in ('agendada', 'aguardando_pagamento')
       order by o.data
       for update
    ) s;

  if cardinality(v_ids) > 0 then
    -- Creditos gerados por essas aulas e usos de reposicao nelas saem junto.
    select coalesce(array_agg(distinct r.aluno_id), '{}')
      into v_alunos
      from public.reposicoes r
     where r.ocupacao_uso_id = any (v_ids)
        or (r.minutos > 0 and r.ocupacao_origem_id = any (v_ids));
    foreach v_aluno in array v_alunos loop
      perform privado.travar_reposicao(v_aluno);
    end loop;
    delete from public.reposicoes r
     where r.ocupacao_uso_id = any (v_ids)
        or (r.minutos > 0 and r.ocupacao_origem_id = any (v_ids));
    perform privado.garantir_extrato_coerente(
      v_alunos,
      'Um crédito de reposição gerado por uma dessas aulas já foi usado. Escolha uma data de encerramento depois dela.');

    perform privado.anular_cobrancas(v_ids, 'Horário fixo encerrado na agenda.');
    delete from public.ocupacao_alunos where ocupacao_id = any (v_ids);
    delete from public.ocupacoes where id = any (v_ids);
  end if;

  update public.horarios_fixos set fim = p_fim where id = v_horario.id;

  return jsonb_build_object('aulas_removidas', cardinality(v_ids));
end;
$$;

-- Fecha uma ou mais quadras num periodo (manutencao, evento, torneio). As
-- aulas do periodo sao canceladas com IAC (gerando os creditos) e cada quadra
-- ganha uma ocupacao "Bloqueio", que segue a mesma regra de conflito.
-- Devolve { bloqueios: [ids], aulas, alunos, minutos, creditos }.
create function public.bloquear_quadra(
  p_quadras_ids text[],
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_descricao text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quadras text[];
  v_quadra text;
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_bloqueio public.ocupacoes%rowtype;
  v_afetadas text[];
  v_resultado jsonb;
  v_bloqueios text[] := '{}';
  v_id text;
begin
  perform privado.iniciar_operacao('Bloquear quadra', 'agenda');
  select coalesce(array_agg(u.id order by u.ordem), '{}')
    into v_quadras
    from (
      select x.id, min(x.ordem) as ordem
        from unnest(p_quadras_ids) with ordinality as x(id, ordem)
       where x.id is not null
       group by x.id
    ) u;
  if cardinality(v_quadras) = 0 then
    perform privado.recusar('Escolha pelo menos uma quadra.');
  end if;
  foreach v_quadra in array v_quadras loop
    perform privado.garantir_quadra(v_quadra);
  end loop;
  perform privado.garantir_data_futura(p_data);
  perform privado.garantir_horario_valido(p_hora_inicio, p_hora_fim);
  if v_descricao = '' then
    perform privado.recusar('Descreva o motivo do bloqueio (ex.: manutenção do saibro).');
  end if;

  -- Um bloqueio nao cancela outro.
  select o.* into v_bloqueio
    from public.ocupacoes o
    join public.quadras q on q.id = o.quadra_id
   where o.data = p_data
     and o.quadra_id = any (v_quadras)
     and o.tipo = 'Bloqueio'
     and o.situacao <> 'cancelada'
     and o.hora_inicio < p_hora_fim
     and p_hora_inicio < o.hora_fim
   order by o.hora_inicio, q.ordem
   limit 1;
  if found then
    perform privado.recusar(format(
      '%s já está bloqueada em %s das %s às %s (%s).',
      privado.rotulo_da_quadra(v_bloqueio.quadra_id),
      to_char(v_bloqueio.data, 'DD/MM'),
      to_char(v_bloqueio.hora_inicio, 'HH24:MI'),
      to_char(v_bloqueio.hora_fim, 'HH24:MI'),
      privado.descrever_ocupacao(v_bloqueio.id)));
  end if;

  select coalesce(array_agg(s.id), '{}')
    into v_afetadas
    from (
      select o.id
        from public.ocupacoes o
       where o.data = p_data
         and o.quadra_id = any (v_quadras)
         and o.tipo <> 'Bloqueio'
         and o.situacao <> 'cancelada'
         and o.hora_inicio < p_hora_fim
         and p_hora_inicio < o.hora_fim
       for update
    ) s;
  v_resultado := privado.cancelar_ocupacoes(v_afetadas, 'IAC');

  -- A regra de sempre continua valendo depois dos cancelamentos.
  foreach v_quadra in array v_quadras loop
    perform privado.garantir_quadra_livre(v_quadra, p_data, p_hora_inicio, p_hora_fim);
    insert into public.ocupacoes (quadra_id, data, hora_inicio, hora_fim, tipo, situacao, descricao)
    values (v_quadra, p_data, p_hora_inicio, p_hora_fim, 'Bloqueio', 'agendada', v_descricao)
    returning id into v_id;
    v_bloqueios := v_bloqueios || v_id;
  end loop;

  return v_resultado || jsonb_build_object('bloqueios', to_jsonb(v_bloqueios));
end;
$$;

-- Cancela com CH tudo o que estiver ativo nas quadras e no periodo (sem
-- horario = dia inteiro, 07:00 as 22:00), gerando os creditos de reposicao.
-- Bloqueios ficam como estao. Aceita data passada (chuva de ontem).
-- Devolve { aulas, alunos, minutos, creditos }.
create function public.cancelar_por_chuva(
  p_data date,
  p_quadras_ids text[],
  p_hora_inicio time default null,
  p_hora_fim time default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quadras text[];
  v_quadra text;
  v_inicio time := coalesce(p_hora_inicio, '07:00');
  v_fim time := coalesce(p_hora_fim, '22:00');
  v_afetadas text[];
begin
  perform privado.iniciar_operacao('Cancelar por chuva', 'agenda');
  select coalesce(array_agg(distinct x), '{}')
    into v_quadras
    from unnest(p_quadras_ids) x
   where x is not null;
  if cardinality(v_quadras) = 0 then
    perform privado.recusar('Escolha pelo menos uma quadra.');
  end if;
  foreach v_quadra in array v_quadras loop
    perform privado.garantir_quadra(v_quadra);
  end loop;
  if p_data is null then
    perform privado.recusar('Informe uma data válida.');
  end if;
  perform privado.garantir_horario_valido(v_inicio, v_fim);

  select coalesce(array_agg(s.id), '{}')
    into v_afetadas
    from (
      select o.id
        from public.ocupacoes o
       where o.data = p_data
         and o.quadra_id = any (v_quadras)
         and o.tipo <> 'Bloqueio'
         and o.situacao <> 'cancelada'
         and o.hora_inicio < v_fim
         and v_inicio < o.hora_fim
       for update
    ) s;
  if cardinality(v_afetadas) = 0 then
    perform privado.recusar('Não há aulas ativas nessas quadras nesse período.');
  end if;

  return privado.cancelar_ocupacoes(v_afetadas, 'CH');
end;
$$;

-- "Liberar horario" (H5): cancela a reserva que passou do prazo sem
-- pagamento, com o motivo "Sem pagamento no prazo" (sem credito), e anula a
-- cobranca. Devolve o id da ocupacao.
create function public.liberar_reserva(p_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocupacao public.ocupacoes%rowtype;
begin
  perform privado.iniciar_operacao('Liberar reserva sem pagamento', 'agenda');
  select * into v_ocupacao from public.ocupacoes where id = p_id for update;
  if not found then
    perform privado.recusar('Horário não encontrado na agenda.');
  end if;
  if v_ocupacao.situacao <> 'aguardando_pagamento' then
    perform privado.recusar('Esta reserva não está aguardando pagamento.');
  end if;
  if v_ocupacao.prazo_pagamento is null then
    perform privado.recusar('Esta reserva não tem prazo de pagamento.');
  end if;
  if v_ocupacao.prazo_pagamento >= now() then
    perform privado.recusar(format(
      'O prazo desta reserva só vence em %s.',
      to_char(v_ocupacao.prazo_pagamento at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')));
  end if;
  perform privado.cancelar_ocupacoes(array[v_ocupacao.id], 'Sem pagamento no prazo');
  return v_ocupacao.id;
end;
$$;

-- Libera de uma vez todas as reservas vencidas (a tela chama ao abrir a
-- agenda quando `liberar_reserva_automaticamente` esta ligado). Sem nenhuma
-- vencida, nao faz nada. Devolve quantas foram liberadas.
create function public.liberar_reservas_vencidas()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids text[];
begin
  perform privado.iniciar_operacao('Liberar reservas vencidas', 'agenda');
  select coalesce(array_agg(s.id), '{}')
    into v_ids
    from (
      select o.id
        from public.ocupacoes o
       where o.situacao = 'aguardando_pagamento'
         and o.prazo_pagamento < now()
       for update
    ) s;
  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  perform privado.cancelar_ocupacoes(v_ids, 'Sem pagamento no prazo');
  return cardinality(v_ids);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Liberacao automatica das reservas vencidas (H5, rotina agendada)
-- ---------------------------------------------------------------------------
--  A rotina agendada roda sem ninguem logado, entao nao passa pela RLS nem por
--  `iniciar_operacao` (que exige um perfil). Por isso e SECURITY DEFINER, fica
--  no schema `privado` e NINGUEM da API pode executa-la (sem grant para
--  authenticated): so o agendador do banco. So faz algo se a opcao
--  `liberar_reserva_automaticamente` estiver ligada nas Configuracoes.
--  Na auditoria aparece sem usuario, com a operacao
--  "Liberar reservas vencidas (automático)". Devolve quantas liberou.
create function privado.liberar_reservas_vencidas_automaticamente()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids text[];
begin
  if not coalesce(
    (select liberar_reserva_automaticamente from public.configuracoes where id = 1), false
  ) then
    return 0;
  end if;
  perform set_config('app.operacao', 'Liberar reservas vencidas (automático)', true);
  select coalesce(array_agg(s.id), '{}')
    into v_ids
    from (
      select o.id
        from public.ocupacoes o
       where o.situacao = 'aguardando_pagamento'
         and o.prazo_pagamento < now()
       for update
    ) s;
  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  perform privado.cancelar_ocupacoes(v_ids, 'Sem pagamento no prazo');
  return cardinality(v_ids);
end;
$$;

-- Agenda a rotina a cada 15 minutos, so se o pg_cron existir neste Postgres
-- (existe no Supabase; o Postgres local dos testes nao tem). Se nao der para
-- agendar, a migracao continua e deixa um aviso: a recepcao ainda libera pela
-- tela, e a agenda libera as vencidas ao abrir quando a opcao esta ligada.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule(
        'liberar-reservas-vencidas',
        '*/15 * * * *',
        'select privado.liberar_reservas_vencidas_automaticamente()'
      );
    exception when others then
      raise warning 'pg_cron disponivel, mas a rotina nao foi agendada: %', sqlerrm;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permissoes de execucao
-- ---------------------------------------------------------------------------
-- Pecas internas: so quem esta logado (as funcoes de operacao rodam com o
-- usuario de quem chamou e precisam delas). Nada para anonimos.
revoke execute on function
  privado.tipo_com_professor(text),
  privado.tipo_de_plano(text),
  privado.rotulo_da_quadra(text),
  privado.minutos_entre(time, time),
  privado.descrever_ocupacao(text),
  privado.garantir_quadra(text),
  privado.garantir_data_futura(date),
  privado.garantir_horario_valido(time, time),
  privado.garantir_quadra_livre(text, date, time, time, text),
  privado.garantir_professor_livre(text, date, time, time, text),
  privado.validar_professor(text, text),
  privado.validar_alunos(text[]),
  privado.buscar_sigla(text),
  privado.sigla_gera_credito(text, text),
  privado.validade_do_credito(date),
  privado.travar_reposicao(text),
  privado.calcular_reposicao(text, date),
  privado.garantir_saldo_suficiente(text, integer),
  privado.garantir_extrato_coerente(text[], text),
  privado.prazo_da_reserva(date, time),
  privado.preco_da_locacao(text, time, time),
  privado.item_da_locacao(text, date, time),
  privado.anular_cobrancas(text[], text),
  privado.cancelar_ocupacoes(text[], text)
  from public, anon;
grant execute on function
  privado.tipo_com_professor(text),
  privado.tipo_de_plano(text),
  privado.rotulo_da_quadra(text),
  privado.minutos_entre(time, time),
  privado.descrever_ocupacao(text),
  privado.garantir_quadra(text),
  privado.garantir_data_futura(date),
  privado.garantir_horario_valido(time, time),
  privado.garantir_quadra_livre(text, date, time, time, text),
  privado.garantir_professor_livre(text, date, time, time, text),
  privado.validar_professor(text, text),
  privado.validar_alunos(text[]),
  privado.buscar_sigla(text),
  privado.sigla_gera_credito(text, text),
  privado.validade_do_credito(date),
  privado.travar_reposicao(text),
  privado.calcular_reposicao(text, date),
  privado.garantir_saldo_suficiente(text, integer),
  privado.garantir_extrato_coerente(text[], text),
  privado.prazo_da_reserva(date, time),
  privado.preco_da_locacao(text, time, time),
  privado.item_da_locacao(text, date, time),
  privado.anular_cobrancas(text[], text),
  privado.cancelar_ocupacoes(text[], text)
  to authenticated;

-- Rotina automatica: so o agendador (dono das funcoes).
revoke execute on function privado.liberar_reservas_vencidas_automaticamente()
  from public, anon, authenticated;

-- Operacoes da tela: so quem esta logado (a permissao de cada perfil e
-- conferida dentro, por `iniciar_operacao`, e pela RLS).
revoke execute on function
  public.criar_horario_avulso(text, date, time, time, text, text[], text, text),
  public.criar_horario_fixo(text, date, time, time, text, text[], text, date, date[]),
  public.marcar_aula_de_reposicao(text, text, date, time, time, text, text),
  public.incluir_aluno(text, text),
  public.usar_reposicao(text, text),
  public.remover_aluno(text, text),
  public.marcar_presenca(text, text, text, text),
  public.cancelar_ocupacao(text, text),
  public.remarcar_ocupacao(text, text, date, time, time),
  public.encerrar_horario_fixo(text, date),
  public.bloquear_quadra(text[], date, time, time, text),
  public.cancelar_por_chuva(date, text[], time, time),
  public.liberar_reserva(text),
  public.liberar_reservas_vencidas()
  from public, anon;
grant execute on function
  public.criar_horario_avulso(text, date, time, time, text, text[], text, text),
  public.criar_horario_fixo(text, date, time, time, text, text[], text, date, date[]),
  public.marcar_aula_de_reposicao(text, text, date, time, time, text, text),
  public.incluir_aluno(text, text),
  public.usar_reposicao(text, text),
  public.remover_aluno(text, text),
  public.marcar_presenca(text, text, text, text),
  public.cancelar_ocupacao(text, text),
  public.remarcar_ocupacao(text, text, date, time, time),
  public.encerrar_horario_fixo(text, date),
  public.bloquear_quadra(text[], date, time, time, text),
  public.cancelar_por_chuva(date, text[], time, time),
  public.liberar_reserva(text),
  public.liberar_reservas_vencidas()
  to authenticated;
