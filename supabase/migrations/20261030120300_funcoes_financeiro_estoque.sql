-- ============================================================================
--  Funcoes do financeiro e do estoque
-- ============================================================================
--  As operacoes de `src/lib/banco/operacoes/financeiro.ts` e `estoque.ts`
--  viram funcoes do Postgres, chamadas pela tela com `supabase.rpc(...)`.
--  Cada funcao e uma transacao: se uma regra falha, nada e gravado.
--
--  Padrao (ver 20261030120000_funcoes_base.sql):
--   - `security invoker`: a RLS continua valendo (a funcao nunca faz mais do
--     que a pessoa poderia fazer direto nas tabelas);
--   - `privado.iniciar_operacao(nome, modulo)` confere a permissao do modulo
--     principal e grava o nome da operacao na auditoria;
--   - quando a operacao grava tambem em outro modulo (ex.: o consumo gera uma
--     conta a receber), a permissao desse outro modulo e conferida com
--     `privado.pode_gravar`, com a mesma mensagem de permissao;
--   - regra violada: `privado.recusar('mensagem')`, com a mesma mensagem que
--     o front mostra hoje.
--
--  Modulos: contas a receber = "financeiro"; contas a pagar e repasses =
--  "financeiro_pagar"; produtos, consumos e movimentos = "estoque"; mudar a
--  situacao de uma reserva = "agenda".
--
--  Mudanca de schema: o indice unico das mensalidades passa a ignorar as
--  anuladas (ver secao 1).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Indice das mensalidades: uma VALIDA por matricula por mes
-- ---------------------------------------------------------------------------
--  O indice anterior contava tambem as anuladas, mas a tela orienta "Para
--  cobrar de novo, anule a anterior" (criar a mensalidade de novo, a mao,
--  depois de anular). "Gerar mensalidades" continua pulando as anuladas
--  (regra da funcao), entao gerar de novo nao desfaz uma anulacao.
drop index public.lancamentos_mensalidade_unica;
create unique index lancamentos_mensalidade_unica
  on public.lancamentos (matricula_id, competencia)
  where categoria = 'Mensalidade' and cancelado_em is null;

-- ---------------------------------------------------------------------------
-- 2. Apoio (textos das mensagens e conferencias comuns)
-- ---------------------------------------------------------------------------

-- "2026-10" -> "outubro de 2026" (mensagens).
create function privado.financeiro_nome_do_mes(competencia text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'])
         [substr(competencia, 6, 2)::int]
         || ' de ' || substr(competencia, 1, 4);
$$;

-- "2026-10" -> "out/2026" (texto das mensalidades e dos repasses).
create function privado.financeiro_mes_curto(competencia text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'])
         [substr(competencia, 6, 2)::int]
         || '/' || substr(competencia, 1, 4);
$$;

-- Nome do produto para comparar: sem acento, minusculo, espacos simples.
-- "Água  Mineral" e "agua mineral" sao o mesmo produto. Usa translate (e nao
-- a extensao unaccent) para funcionar em qualquer Postgres.
create function privado.estoque_nome_normalizado(nome text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(translate(nome,
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY')), '\s+', ' ', 'g'));
$$;

-- Recusa com a mensagem de permissao de `iniciar_operacao`, para o segundo
-- modulo de uma operacao que grava em mais de um.
create function privado.financeiro_exigir_gravacao(modulo text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not privado.pode_gravar(modulo) then
    raise exception using
      errcode = '42501',
      message = 'Seu perfil não tem permissão para esta operação.';
  end if;
end;
$$;

-- Confere data, forma e parte do convenio de um pagamento (conferirPagamento
-- do front). Devolve a parte do convenio arredondada (vazia se zero).
create function privado.financeiro_conferir_pagamento(
  p_pago_em date,
  p_forma_pagamento text,
  p_valor_convenio numeric,
  p_valor numeric
)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_forma text := nullif(btrim(coalesce(p_forma_pagamento, '')), '');
begin
  if v_forma is not null and not coalesce(
    (select c.formas_pagamento ? v_forma from public.configuracoes c where c.id = 1), false
  ) then
    perform privado.recusar(format('Forma de pagamento desconhecida: %s.', v_forma));
  end if;

  if p_pago_em is not null then
    if p_pago_em > privado.hoje() then
      perform privado.recusar('A data do pagamento não pode ser depois de hoje.');
    end if;
    if v_forma is null then
      perform privado.recusar('Escolha a forma de pagamento.');
    end if;
  end if;

  if p_valor_convenio is null then
    return null;
  end if;
  if p_valor_convenio = 'NaN'::numeric then
    perform privado.recusar('Informe a parte coberta pelo convênio em reais (ou deixe o campo vazio).');
  end if;
  if p_valor_convenio < 0 then
    perform privado.recusar('A parte coberta pelo convênio não pode ser negativa.');
  end if;
  if p_valor_convenio > p_valor then
    perform privado.recusar('A parte coberta pelo convênio não pode ser maior que o valor do lançamento.');
  end if;
  return case when p_valor_convenio > 0 then round(p_valor_convenio, 2) end;
end;
$$;

-- Nome de quem esta logado (vai no `responsavel` dos movimentos de estoque).
create function privado.estoque_nome_do_responsavel()
returns text
language sql
stable
set search_path = ''
as $$
  select c.nome from public.colaboradores c where c.id = (select auth.uid());
$$;

revoke execute on function
  privado.financeiro_nome_do_mes(text),
  privado.financeiro_mes_curto(text),
  privado.estoque_nome_normalizado(text),
  privado.financeiro_exigir_gravacao(text),
  privado.financeiro_conferir_pagamento(date, text, numeric, numeric),
  privado.estoque_nome_do_responsavel()
  from public, anon;
grant execute on function
  privado.financeiro_nome_do_mes(text),
  privado.financeiro_mes_curto(text),
  privado.estoque_nome_normalizado(text),
  privado.financeiro_exigir_gravacao(text),
  privado.financeiro_conferir_pagamento(date, text, numeric, numeric),
  privado.estoque_nome_do_responsavel()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Financeiro
-- ---------------------------------------------------------------------------

-- Novo lancamento (a receber ou a pagar). Mensalidade lancada a mao fica
-- ligada a matricula vigente no vencimento; repasse lancado a mao exige o
-- professor e o mes. Devolve o id do lancamento.
create function public.criar_lancamento(
  p_tipo text,
  p_categoria text,
  p_item text,
  p_valor numeric,
  p_vencimento date,
  p_pessoa_id text default null,
  p_nome_pagante text default null,
  p_forma_pagamento text default null,
  p_comprovante text default null,
  p_pago_em date default null,
  p_valor_convenio numeric default null,
  p_competencia text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item text := nullif(btrim(coalesce(p_item, '')), '');
  v_nome_pagante text := nullif(btrim(coalesce(p_nome_pagante, '')), '');
  v_valor numeric;
  v_convenio numeric;
  v_aluno record;
  v_professor record;
  v_matricula_id text;
  v_competencia text;
  v_pessoa_tipo text;
  v_pessoa_id text;
  v_id text;
begin
  perform privado.iniciar_operacao(
    'Novo lançamento',
    case when p_tipo = 'receber' then 'financeiro' else 'financeiro_pagar' end
  );

  if not (
    (p_tipo = 'receber' and p_categoria in ('Mensalidade', 'Aula avulsa', 'Locação', 'Consumo', 'Torneio', 'Outros'))
    or (p_tipo = 'pagar' and p_categoria in ('Despesa', 'Fornecedor', 'Repasse', 'Outros'))
  ) then
    perform privado.recusar(case when p_tipo = 'receber'
      then 'Escolha uma categoria de conta a receber.'
      else 'Escolha uma categoria de conta a pagar.' end);
  end if;
  if v_item is null then
    perform privado.recusar('Descreva o item do lançamento.');
  end if;
  if p_valor is null or p_valor = 'NaN'::numeric or round(p_valor, 2) <= 0 then
    perform privado.recusar('O valor precisa ser maior que zero.');
  end if;
  v_valor := round(p_valor, 2);
  if p_vencimento is null then
    perform privado.recusar('Informe uma data de vencimento válida.');
  end if;
  v_convenio := privado.financeiro_conferir_pagamento(p_pago_em, p_forma_pagamento, p_valor_convenio, v_valor);

  if p_tipo = 'receber' then
    if p_pessoa_id is not null then
      select a.id, a.nome into v_aluno from public.alunos a where a.id = p_pessoa_id;
      if not found then
        perform privado.recusar('Aluno não encontrado.');
      end if;
      v_pessoa_id := v_aluno.id;
      v_pessoa_tipo := 'aluno';
      v_nome_pagante := coalesce(v_nome_pagante, v_aluno.nome);
    end if;
    if v_nome_pagante is null then
      perform privado.recusar('Escolha o aluno ou informe quem vai pagar.');
    end if;

    -- Mensalidade a mao: ligada a matricula, para "Gerar mensalidades" a
    -- reconhecer e nao cobrar o mesmo mes duas vezes.
    if p_categoria = 'Mensalidade' then
      if v_pessoa_id is null then
        perform privado.recusar('Escolha o aluno da mensalidade.');
      end if;
      select m.id into v_matricula_id
        from public.matriculas m
       where m.aluno_id = v_pessoa_id
         and m.inicio <= p_vencimento
         and (m.fim is null or m.fim >= p_vencimento);
      if v_matricula_id is null then
        perform privado.recusar(format(
          '%s não tem matrícula vigente em %s. Use outra categoria, como Aula avulsa.',
          v_aluno.nome, to_char(p_vencimento, 'DD/MM/YYYY')));
      end if;
      v_competencia := to_char(p_vencimento, 'YYYY-MM');
      if exists (
        select 1 from public.lancamentos l
         where l.categoria = 'Mensalidade'
           and l.matricula_id = v_matricula_id
           and l.competencia = v_competencia
           and l.cancelado_em is null
      ) then
        perform privado.recusar(format(
          'Já existe a mensalidade de %s de %s. Para cobrar de novo, anule a anterior.',
          privado.financeiro_nome_do_mes(v_competencia), v_aluno.nome));
      end if;
    end if;

  elsif p_categoria = 'Repasse' then
    select p.id, p.nome into v_professor from public.professores p where p.id = p_pessoa_id;
    if not found then
      perform privado.recusar('Escolha o professor do repasse.');
    end if;
    if p_competencia is null or p_competencia !~ '^\d{4}-(0[1-9]|1[0-2])$' then
      perform privado.recusar('Informe o mês de referência do repasse.');
    end if;
    v_pessoa_id := v_professor.id;
    v_pessoa_tipo := 'professor';
    v_nome_pagante := coalesce(v_nome_pagante, v_professor.nome);
    v_competencia := p_competencia;

  else
    if v_nome_pagante is null then
      perform privado.recusar('Informe o favorecido (quem vai receber o pagamento).');
    end if;
  end if;

  insert into public.lancamentos (
    tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor, vencimento,
    pago_em, forma_pagamento, valor_convenio, comprovante, competencia, matricula_id
  ) values (
    p_tipo, p_categoria, v_pessoa_id, v_pessoa_tipo, v_nome_pagante, v_item, v_valor, p_vencimento,
    p_pago_em, nullif(btrim(coalesce(p_forma_pagamento, '')), ''), v_convenio,
    nullif(btrim(coalesce(p_comprovante, '')), ''), v_competencia, v_matricula_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Registra o pagamento. Se o lancamento e de uma reserva "aguardando
-- pagamento", a reserva fica confirmada ("agendada") na mesma transacao.
-- Devolve { "id": lancamento, "reserva_confirmada": true/false }.
create function public.registrar_pagamento(
  p_id text,
  p_pago_em date,
  p_forma_pagamento text,
  p_valor_convenio numeric default null,
  p_comprovante text default null,
  p_nome_pagante text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
  v_situacao_reserva text;
  v_convenio numeric;
  v_confirmou boolean := false;
begin
  -- Sem nenhum dos dois modulos, nem adianta procurar o lancamento.
  if not (privado.pode_gravar('financeiro') or privado.pode_gravar('financeiro_pagar')) then
    perform privado.financeiro_exigir_gravacao('financeiro');
  end if;

  -- Trava o lancamento: dois balcoes nao registram o mesmo pagamento.
  select * into v_lancamento from public.lancamentos where id = p_id for update;
  if not found then
    perform privado.recusar('Lançamento não encontrado.');
  end if;
  perform privado.iniciar_operacao(
    'Registrar pagamento',
    case when v_lancamento.tipo = 'receber' then 'financeiro' else 'financeiro_pagar' end
  );

  if v_lancamento.cancelado_em is not null then
    perform privado.recusar('Este lançamento foi anulado e não pode ser pago.');
  end if;
  if v_lancamento.pago_em is not null then
    perform privado.recusar(format('Este lançamento já foi pago em %s.',
      to_char(v_lancamento.pago_em, 'DD/MM/YYYY')));
  end if;
  if p_pago_em is null then
    perform privado.recusar('Informe a data do pagamento.');
  end if;
  if nullif(btrim(coalesce(p_forma_pagamento, '')), '') is null then
    perform privado.recusar('Escolha a forma de pagamento.');
  end if;
  v_convenio := privado.financeiro_conferir_pagamento(
    p_pago_em, p_forma_pagamento, p_valor_convenio, v_lancamento.valor);

  -- Reserva ligada: se ainda aguarda pagamento, fica confirmada.
  if v_lancamento.ocupacao_id is not null then
    select o.situacao into v_situacao_reserva
      from public.ocupacoes o where o.id = v_lancamento.ocupacao_id for update;
    if not found then
      -- A reserva existe (chave estrangeira), mas este perfil nao enxerga a agenda.
      perform privado.financeiro_exigir_gravacao('agenda');
    end if;
    if v_situacao_reserva = 'aguardando_pagamento' then
      perform privado.financeiro_exigir_gravacao('agenda');
      update public.ocupacoes set situacao = 'agendada' where id = v_lancamento.ocupacao_id;
      v_confirmou := true;
    end if;
  end if;

  update public.lancamentos
     set pago_em = p_pago_em,
         forma_pagamento = btrim(p_forma_pagamento),
         valor_convenio = v_convenio,
         comprovante = coalesce(nullif(btrim(coalesce(p_comprovante, '')), ''), comprovante),
         nome_pagante = coalesce(nullif(btrim(coalesce(p_nome_pagante, '')), ''), nome_pagante)
   where id = p_id;

  return jsonb_build_object('id', p_id, 'reserva_confirmada', v_confirmou);
end;
$$;

-- Anula o lancamento (nunca apaga), com motivo. Pago tambem pode ser anulado
-- (estorno). Nao deixa uma reserva aguardando pagamento sem cobranca.
-- Devolve o id do lancamento.
create function public.anular_lancamento(p_id text, p_motivo text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_situacao_reserva text;
begin
  if not (privado.pode_gravar('financeiro') or privado.pode_gravar('financeiro_pagar')) then
    perform privado.financeiro_exigir_gravacao('financeiro');
  end if;

  select * into v_lancamento from public.lancamentos where id = p_id for update;
  if not found then
    perform privado.recusar('Lançamento não encontrado.');
  end if;
  perform privado.iniciar_operacao(
    'Anular lançamento',
    case when v_lancamento.tipo = 'receber' then 'financeiro' else 'financeiro_pagar' end
  );

  if v_lancamento.cancelado_em is not null then
    perform privado.recusar(format('Este lançamento já foi anulado em %s.',
      to_char(v_lancamento.cancelado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')));
  end if;
  if v_motivo is null then
    perform privado.recusar('Escreva o motivo da anulação.');
  end if;
  if v_lancamento.ocupacao_id is not null then
    select o.situacao into v_situacao_reserva
      from public.ocupacoes o where o.id = v_lancamento.ocupacao_id for share;
    if not found then
      perform privado.financeiro_exigir_gravacao('agenda');
    end if;
    if v_situacao_reserva = 'aguardando_pagamento' then
      perform privado.recusar(
        'Esta cobrança é de uma reserva que ainda aguarda pagamento. '
        || 'Registre o pagamento ou cancele a reserva na agenda.');
    end if;
  end if;

  update public.lancamentos
     set cancelado_em = now(), motivo_cancelamento = v_motivo
   where id = p_id;
  return p_id;
end;
$$;

-- Cria a mensalidade de cada matricula vigente no vencimento que ainda nao
-- tem a do mes (anulada conta como existente). Rodar de novo nao duplica.
-- Congelados (H4) recebem a cobranca normalmente, como no front.
-- Devolve { "criadas": n, "ja_geradas": n }.
create function public.gerar_mensalidades(p_competencia text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ano int;
  v_mes int;
  v_ultimo_dia int;
  v_criadas int;
  v_ja_geradas int;
begin
  perform privado.iniciar_operacao('Gerar mensalidades', 'financeiro');
  if p_competencia is null or p_competencia !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    perform privado.recusar('Escolha um mês válido.');
  end if;

  -- Dois cliques ao mesmo tempo no mesmo mes: o segundo espera o primeiro.
  perform pg_advisory_xact_lock(hashtext('gerar_mensalidades:' || p_competencia));

  v_ano := substr(p_competencia, 1, 4)::int;
  v_mes := substr(p_competencia, 6, 2)::int;
  v_ultimo_dia := extract(day from make_date(v_ano, v_mes, 1) + interval '1 month - 1 day')::int;

  -- Matriculas vigentes no vencimento do mes. O vencimento respeita o ultimo
  -- dia (fevereiro nao tem dia 30). Mensalidade anulada conta como existente.
  with vigentes as (
    select m.id as matricula_id, m.aluno_id, a.nome as aluno_nome, pl.nome as plano_nome,
           m.valor_mensal, v.vencimento,
           exists (
             select 1 from public.lancamentos l
              where l.categoria = 'Mensalidade'
                and l.matricula_id = m.id
                and l.competencia = p_competencia
           ) as ja_existe
      from public.matriculas m
      join public.alunos a on a.id = m.aluno_id
      left join public.planos pl on pl.id = m.plano_id
     cross join lateral (
       select make_date(v_ano, v_mes, least(m.dia_vencimento, v_ultimo_dia)) as vencimento
     ) v
     where m.inicio <= v.vencimento
       and (m.fim is null or m.fim >= v.vencimento)
  ),
  novas as (
    insert into public.lancamentos (
      tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor,
      vencimento, competencia, matricula_id
    )
    select
      'receber', 'Mensalidade', t.aluno_id, 'aluno',
      -- Quem pagou a ultima mensalidade desta matricula (pai, empresa...).
      coalesce((
        select l.nome_pagante from public.lancamentos l
         where l.categoria = 'Mensalidade' and l.matricula_id = t.matricula_id
         order by l.vencimento desc, l.criado_em
         limit 1
      ), t.aluno_nome),
      'Mensalidade ' || privado.financeiro_mes_curto(p_competencia) || coalesce(' · ' || t.plano_nome, ''),
      t.valor_mensal, t.vencimento, p_competencia, t.matricula_id
    from vigentes t
    where not t.ja_existe
    returning 1
  )
  select (select count(*) from novas), (select count(*) from vigentes where ja_existe)
    into v_criadas, v_ja_geradas;

  return jsonb_build_object('criadas', v_criadas, 'ja_geradas', v_ja_geradas);
end;
$$;

-- Fecha o repasse de um mes ja terminado: para cada professor com aulas
-- realizadas no mes e ainda sem fechamento, grava o repasse (aulas, minutos e
-- valor previsto pela regra dele, H6) e lanca a conta a pagar com o que falta
-- (desconta adiantamentos ja lancados). Mesmo calculo de `repassePrevisto`:
--  - por hora: minutos / 60 x valor da hora;
--  - percentual: percentual sobre as mensalidades do mes, pagas, dos alunos
--    dessas aulas.
-- Devolve { "repasses_fechados": n, "contas_a_pagar": n }.
create function public.fechar_repasse_do_mes(p_competencia text, p_vencimento date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mes text;
  v_inicio date;
  v_fim date;
  v_professor record;
  v_previsto numeric;
  v_receita numeric;
  v_ja_lancado numeric;
  v_falta numeric;
  v_repasse_id text;
  v_repasses int := 0;
  v_contas int := 0;
begin
  perform privado.iniciar_operacao('Fechar repasse do mês', 'financeiro_pagar');
  if p_competencia is null or p_competencia !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    perform privado.recusar('Escolha um mês válido.');
  end if;
  v_mes := privado.financeiro_nome_do_mes(p_competencia);
  if not p_competencia < to_char(privado.hoje(), 'YYYY-MM') then
    perform privado.recusar(format(
      'Só dá para fechar o repasse de um mês que já terminou: %s ainda não acabou.', v_mes));
  end if;
  if p_vencimento is null then
    perform privado.recusar('Informe a data de pagamento do repasse.');
  end if;

  -- Dois fechamentos ao mesmo tempo do mesmo mes: o segundo espera e recusa.
  perform pg_advisory_xact_lock(hashtext('fechar_repasse_do_mes:' || p_competencia));

  v_inicio := (p_competencia || '-01')::date;
  v_fim := (v_inicio + interval '1 month')::date;

  if not exists (
    select 1 from public.ocupacoes o
      join public.professores p on p.id = o.professor_id
     where o.situacao = 'realizada' and o.data >= v_inicio and o.data < v_fim
  ) then
    perform privado.recusar(format('Nenhum professor deu aulas em %s.', v_mes));
  end if;

  for v_professor in
    select p.id, p.nome, p.repasse_modo, p.repasse_valor,
           count(o.id)::int as aulas,
           sum(extract(epoch from (o.hora_fim - o.hora_inicio)) / 60)::int as minutos,
           array_agg(o.id) as aulas_ids
      from public.professores p
      join public.ocupacoes o
        on o.professor_id = p.id
       and o.situacao = 'realizada'
       and o.data >= v_inicio and o.data < v_fim
     where not exists (
       select 1 from public.repasses r
        where r.professor_id = p.id and r.competencia = p_competencia
     )
     group by p.id
     order by p.nome
  loop
    if v_professor.repasse_modo = 'por_hora' then
      v_previsto := round(v_professor.minutos * v_professor.repasse_valor / 60, 2);
    else
      select coalesce(sum(l.valor), 0) into v_receita
        from public.lancamentos l
       where l.categoria = 'Mensalidade'
         and l.competencia = p_competencia
         and l.pago_em is not null
         and l.pessoa_id in (
           select oa.aluno_id from public.ocupacao_alunos oa
            where oa.ocupacao_id = any (v_professor.aulas_ids)
         );
      v_previsto := round(v_receita * v_professor.repasse_valor / 100, 2);
    end if;

    insert into public.repasses (professor_id, competencia, aulas_dadas, minutos_dados, valor_previsto)
    values (v_professor.id, p_competencia, v_professor.aulas, v_professor.minutos, v_previsto)
    returning id into v_repasse_id;
    v_repasses := v_repasses + 1;

    select coalesce(sum(l.valor), 0) into v_ja_lancado
      from public.lancamentos l
     where l.categoria = 'Repasse'
       and l.pessoa_id = v_professor.id
       and l.competencia = p_competencia
       and l.cancelado_em is null;
    v_falta := round(v_previsto - v_ja_lancado, 2);
    continue when v_falta <= 0;

    insert into public.lancamentos (
      tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor,
      vencimento, competencia, repasse_id
    ) values (
      'pagar', 'Repasse', v_professor.id, 'professor', v_professor.nome,
      format('Repasse %s · %s aulas', privado.financeiro_mes_curto(p_competencia), v_professor.aulas),
      v_falta, p_vencimento, p_competencia, v_repasse_id
    );
    v_contas := v_contas + 1;
  end loop;

  if v_repasses = 0 then
    perform privado.recusar(format('O repasse de %s já foi fechado.', v_mes));
  end if;

  return jsonb_build_object('repasses_fechados', v_repasses, 'contas_a_pagar', v_contas);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Estoque
-- ---------------------------------------------------------------------------

-- Confere os campos do cadastro (vale para cadastrar e editar) e recusa nome
-- repetido (sem acento/maiuscula, contando inativos). Devolve o nome limpo.
create function privado.estoque_conferir_produto(
  p_nome text,
  p_categoria text,
  p_unidade text,
  p_preco_custo numeric,
  p_preco_venda numeric,
  p_estoque_minimo integer,
  p_ignorar_id text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_nome text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_repetido record;
begin
  if v_nome = '' then
    perform privado.recusar('Informe o nome do produto.');
  end if;
  if p_categoria is null or p_categoria not in ('Bebidas', 'Cervejas', 'Lanches', 'Acessórios') then
    perform privado.recusar('Escolha a categoria do produto.');
  end if;
  if btrim(coalesce(p_unidade, '')) = '' then
    perform privado.recusar('Informe a unidade (lata 350ml, unidade, pacote…).');
  end if;
  if p_preco_custo is null or p_preco_custo = 'NaN'::numeric then
    perform privado.recusar('Informe o preço de custo.');
  end if;
  if p_preco_venda is null or p_preco_venda = 'NaN'::numeric then
    perform privado.recusar('Informe o preço de venda.');
  end if;
  if p_preco_custo < 0 then
    perform privado.recusar('O preço de custo não pode ser negativo.');
  end if;
  if p_preco_venda < 0 then
    perform privado.recusar('O preço de venda não pode ser negativo.');
  end if;
  if p_estoque_minimo is null or p_estoque_minimo < 0 then
    perform privado.recusar('O estoque mínimo precisa ser um número inteiro, zero ou maior.');
  end if;

  -- Dois cadastros ao mesmo tempo com o mesmo nome: o segundo espera e recusa.
  perform pg_advisory_xact_lock(hashtext('produtos:nome'));
  select p.nome, p.ativo into v_repetido
    from public.produtos p
   where p.id is distinct from p_ignorar_id
     and privado.estoque_nome_normalizado(p.nome) = privado.estoque_nome_normalizado(v_nome)
   limit 1;
  if found then
    perform privado.recusar(case when v_repetido.ativo
      then format('Já existe um produto chamado "%s".', v_repetido.nome)
      else format('Já existe um produto inativo chamado "%s". Reative-o em vez de cadastrar outro.', v_repetido.nome)
    end);
  end if;
  return v_nome;
end;
$$;
revoke execute on function
  privado.estoque_conferir_produto(text, text, text, numeric, numeric, integer, text)
  from public, anon;
grant execute on function
  privado.estoque_conferir_produto(text, text, text, numeric, numeric, integer, text)
  to authenticated;

-- Produto novo: ativo e sem saldo (o saldo vem da primeira entrada).
-- Devolve o id do produto.
create function public.cadastrar_produto(
  p_nome text,
  p_categoria text,
  p_unidade text,
  p_preco_custo numeric,
  p_preco_venda numeric,
  p_estoque_minimo integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nome text;
  v_id text;
begin
  perform privado.iniciar_operacao('Cadastrar produto', 'estoque');
  v_nome := privado.estoque_conferir_produto(
    p_nome, p_categoria, p_unidade, p_preco_custo, p_preco_venda, p_estoque_minimo, null);
  insert into public.produtos (nome, categoria, unidade, preco_custo, preco_venda, estoque_minimo, ativo)
  values (v_nome, p_categoria, btrim(p_unidade), round(p_preco_custo, 2), round(p_preco_venda, 2),
          p_estoque_minimo, true)
  returning id into v_id;
  return v_id;
end;
$$;

-- Edita o cadastro. Mudar nome ou preco nao reescreve o historico (cada
-- consumo guarda nome e preco da venda). Sem mudanca, nada e gravado.
-- Devolve o id do produto.
create function public.editar_produto(
  p_id text,
  p_nome text,
  p_categoria text,
  p_unidade text,
  p_preco_custo numeric,
  p_preco_venda numeric,
  p_estoque_minimo integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nome text;
begin
  perform privado.iniciar_operacao('Editar produto', 'estoque');
  perform 1 from public.produtos where id = p_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  v_nome := privado.estoque_conferir_produto(
    p_nome, p_categoria, p_unidade, p_preco_custo, p_preco_venda, p_estoque_minimo, p_id);
  -- O gatilho de auditoria ignora alteracao que nao muda nada.
  update public.produtos
     set nome = v_nome,
         categoria = p_categoria,
         unidade = btrim(p_unidade),
         preco_custo = round(p_preco_custo, 2),
         preco_venda = round(p_preco_venda, 2),
         estoque_minimo = p_estoque_minimo
   where id = p_id;
  return p_id;
end;
$$;

-- Inativo sai das listas de venda, mas continua no historico; o saldo que
-- sobrou continua contado. Devolve o id do produto.
create function public.inativar_produto(p_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_produto record;
begin
  perform privado.iniciar_operacao('Inativar produto', 'estoque');
  select p.nome, p.ativo into v_produto from public.produtos p where p.id = p_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  if not v_produto.ativo then
    perform privado.recusar(format('%s já está inativo.', v_produto.nome));
  end if;
  update public.produtos set ativo = false where id = p_id;
  return p_id;
end;
$$;

create function public.reativar_produto(p_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_produto record;
begin
  perform privado.iniciar_operacao('Reativar produto', 'estoque');
  select p.nome, p.ativo into v_produto from public.produtos p where p.id = p_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  if v_produto.ativo then
    perform privado.recusar(format('%s já está ativo.', v_produto.nome));
  end if;
  update public.produtos set ativo = true where id = p_id;
  return p_id;
end;
$$;

-- Entrada de mercadoria. Com `p_conta_a_pagar` ({ "favorecido", "valor",
-- "vencimento" }), grava na mesma transacao a conta a pagar ao fornecedor,
-- ligada ao movimento (exige tambem o modulo "financeiro_pagar").
-- Devolve { "movimento_id": ..., "lancamento_id": ... ou null }.
create function public.registrar_entrada(
  p_produto_id text,
  p_quantidade integer,
  p_observacao text default null,
  p_conta_a_pagar jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_produto record;
  v_tem_conta boolean := p_conta_a_pagar is not null and jsonb_typeof(p_conta_a_pagar) <> 'null';
  v_favorecido text;
  v_valor numeric;
  v_vencimento date;
  v_movimento_id text;
  v_lancamento_id text;
begin
  perform privado.iniciar_operacao('Registrar entrada de mercadoria', 'estoque');
  if v_tem_conta then
    perform privado.financeiro_exigir_gravacao('financeiro_pagar');
  end if;

  select p.nome, p.ativo into v_produto from public.produtos p where p.id = p_produto_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  if not v_produto.ativo then
    perform privado.recusar(format(
      '%s está inativo. Reative o produto antes de registrar a entrada.', v_produto.nome));
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    perform privado.recusar('A quantidade precisa ser um número inteiro maior que zero.');
  end if;

  if v_tem_conta then
    v_favorecido := btrim(coalesce(p_conta_a_pagar ->> 'favorecido', ''));
    if v_favorecido = '' then
      perform privado.recusar('Informe o fornecedor que vai receber a conta a pagar.');
    end if;
    if jsonb_typeof(p_conta_a_pagar -> 'valor') = 'number' then
      v_valor := round((p_conta_a_pagar ->> 'valor')::numeric, 2);
    end if;
    if v_valor is null or v_valor <= 0 then
      perform privado.recusar('O valor da conta a pagar precisa ser maior que zero.');
    end if;
    begin
      if (p_conta_a_pagar ->> 'vencimento') ~ '^\d{4}-\d{2}-\d{2}$' then
        v_vencimento := (p_conta_a_pagar ->> 'vencimento')::date;
      end if;
    exception when data_exception then
      v_vencimento := null;
    end;
    if v_vencimento is null then
      perform privado.recusar('Informe o vencimento da conta a pagar.');
    end if;
  end if;

  insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel, observacao)
  values (p_produto_id, 'entrada', p_quantidade, privado.estoque_nome_do_responsavel(),
          nullif(btrim(coalesce(p_observacao, '')), ''))
  returning id into v_movimento_id;

  if v_tem_conta then
    insert into public.lancamentos (
      tipo, categoria, nome_pagante, item, valor, vencimento, movimento_estoque_id
    ) values (
      'pagar', 'Fornecedor', v_favorecido,
      format('Compra: %s× %s', p_quantidade, v_produto.nome),
      v_valor, v_vencimento, v_movimento_id
    )
    returning id into v_lancamento_id;
  end if;

  return jsonb_build_object('movimento_id', v_movimento_id, 'lancamento_id', v_lancamento_id);
end;
$$;

-- Perda (quebra, vencimento, cortesia...), com motivo. Nunca passa do saldo.
-- Devolve o id do movimento.
create function public.registrar_perda(p_produto_id text, p_quantidade integer, p_motivo text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nome text;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_saldo integer;
  v_id text;
begin
  perform privado.iniciar_operacao('Registrar perda', 'estoque');
  select p.nome into v_nome from public.produtos p where p.id = p_produto_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    perform privado.recusar('A quantidade precisa ser um número inteiro maior que zero.');
  end if;
  if v_motivo = '' then
    perform privado.recusar('Informe o motivo da perda.');
  end if;
  -- A saida nunca passa do saldo (o gatilho `movimentos_estoque_saldo` tambem
  -- confere; aqui a recusa sai com o mesmo codigo das outras regras).
  select s.saldo into v_saldo from public.saldo_estoque s where s.produto_id = p_produto_id;
  if p_quantidade > v_saldo then
    perform privado.recusar(case when v_saldo = 0
      then format('%s está esgotado.', v_nome)
      else format('Só há %s unidade(s) de %s em estoque.', v_saldo, v_nome)
    end);
  end if;
  insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel, observacao)
  values (p_produto_id, 'perda', p_quantidade, privado.estoque_nome_do_responsavel(), v_motivo)
  returning id into v_id;
  return v_id;
end;
$$;

-- Ajuste de inventario: grava a diferenca (com sinal) entre o contado e o
-- saldo do sistema; o saldo passa a ser exatamente o contado.
-- Devolve { "movimento_id": ..., "diferenca": n }.
create function public.ajustar_inventario(
  p_produto_id text,
  p_saldo_contado integer,
  p_observacao text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_saldo integer;
  v_diferenca integer;
  v_observacao text;
  v_id text;
begin
  perform privado.iniciar_operacao('Ajustar inventário', 'estoque');
  -- Trava o produto: nenhuma venda entra entre a leitura do saldo e o ajuste.
  perform 1 from public.produtos where id = p_produto_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  if p_saldo_contado is null or p_saldo_contado < 0 then
    perform privado.recusar('O saldo contado precisa ser um número inteiro, zero ou maior.');
  end if;
  select s.saldo into v_saldo from public.saldo_estoque s where s.produto_id = p_produto_id;
  v_diferenca := p_saldo_contado - v_saldo;
  if v_diferenca = 0 then
    perform privado.recusar(format(
      'O saldo contado é igual ao do sistema (%s): não há o que ajustar.', v_saldo));
  end if;
  v_observacao := format('Contagem: %s (sistema: %s)', p_saldo_contado, v_saldo)
    || coalesce(' · ' || nullif(btrim(coalesce(p_observacao, '')), ''), '');

  insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel, observacao)
  values (p_produto_id, 'ajuste', v_diferenca, privado.estoque_nome_do_responsavel(), v_observacao)
  returning id into v_id;
  return jsonb_build_object('movimento_id', v_id, 'diferenca', v_diferenca);
end;
$$;

-- Consumo no balcao: numa transacao grava o consumo, a baixa no estoque
-- (movimento "venda") e a conta a receber (vencimento = hoje + prazo das
-- Configuracoes, H13). Trava o produto: duas vendas ao mesmo tempo nao passam
-- do saldo. Exige "estoque" e "financeiro". Devolve o id do consumo.
create function public.lancar_consumo(
  p_pessoa_id text,
  p_pessoa_tipo text,
  p_produto_id text,
  p_quantidade integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pessoa_nome text;
  v_produto record;
  v_saldo integer;
  v_valor numeric;
  v_prazo integer;
  v_consumo_id text;
  v_movimento_id text;
begin
  perform privado.iniciar_operacao('Lançar consumo', 'estoque');
  perform privado.financeiro_exigir_gravacao('financeiro');

  if p_pessoa_tipo = 'aluno' then
    select a.nome into v_pessoa_nome from public.alunos a where a.id = p_pessoa_id;
  elsif p_pessoa_tipo = 'professor' then
    select p.nome into v_pessoa_nome from public.professores p where p.id = p_pessoa_id;
  end if;
  if v_pessoa_nome is null then
    perform privado.recusar('Pessoa não encontrada no cadastro.');
  end if;

  select p.nome, p.ativo, p.preco_venda into v_produto
    from public.produtos p where p.id = p_produto_id for update;
  if not found then
    perform privado.recusar('Produto não encontrado.');
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    perform privado.recusar('A quantidade precisa ser um número inteiro maior que zero.');
  end if;
  if not v_produto.ativo then
    perform privado.recusar(format('%s está inativo e não pode ser vendido.', v_produto.nome));
  end if;
  select s.saldo into v_saldo from public.saldo_estoque s where s.produto_id = p_produto_id;
  if p_quantidade > v_saldo then
    perform privado.recusar(case when v_saldo = 0
      then format('%s está esgotado.', v_produto.nome)
      else format('Só há %s unidade(s) de %s em estoque.', v_saldo, v_produto.nome)
    end);
  end if;

  -- Nome e preco do momento da venda: mudar o cadastro nao reescreve a conta.
  insert into public.consumos (pessoa_id, pessoa_tipo, produto_id, produto_nome, quantidade, valor_unitario)
  values (p_pessoa_id, p_pessoa_tipo, p_produto_id, v_produto.nome, p_quantidade, v_produto.preco_venda)
  returning id into v_consumo_id;

  insert into public.movimentos_estoque (produto_id, tipo, quantidade, responsavel, observacao, consumo_id)
  values (p_produto_id, 'venda', p_quantidade, privado.estoque_nome_do_responsavel(),
          'Consumo no balcão', v_consumo_id)
  returning id into v_movimento_id;

  -- Produto de preco zero (cortesia) nao gera cobranca: o lancamento exige
  -- valor maior que zero.
  v_valor := round(p_quantidade * v_produto.preco_venda, 2);
  if v_valor > 0 then
    select c.prazo_pagamento_consumo_dias into v_prazo from public.configuracoes c where c.id = 1;
    insert into public.lancamentos (
      tipo, categoria, pessoa_id, pessoa_tipo, nome_pagante, item, valor, vencimento, consumo_id
    ) values (
      'receber', 'Consumo', p_pessoa_id, p_pessoa_tipo, v_pessoa_nome,
      format('%s× %s', p_quantidade, v_produto.nome),
      v_valor, privado.hoje() + coalesce(v_prazo, 0), v_consumo_id
    );
  end if;

  return v_consumo_id;
end;
$$;

-- Fecha a conta: paga de uma vez todos os consumos em aberto da pessoa
-- (pendentes e em atraso). Ja pagos, anulados e de outras pessoas nao mudam.
-- Exige "estoque" e "financeiro".
-- Devolve { "lancamentos_pagos": n, "total": valor }.
create function public.fechar_conta_de_consumo(
  p_pessoa_id text,
  p_pago_em date,
  p_forma_pagamento text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids text[];
  v_total numeric;
  v_ultimo date;
begin
  perform privado.iniciar_operacao('Fechar conta de consumo', 'estoque');
  perform privado.financeiro_exigir_gravacao('financeiro');

  if p_pago_em is null then
    perform privado.recusar('Informe a data do pagamento.');
  end if;
  if p_pago_em > privado.hoje() then
    perform privado.recusar('A data do pagamento não pode ser depois de hoje.');
  end if;
  if not coalesce(
    (select c.formas_pagamento ? p_forma_pagamento from public.configuracoes c where c.id = 1), false
  ) then
    perform privado.recusar('Escolha a forma de pagamento.');
  end if;

  -- Trava as cobrancas em aberto: dois balcoes nao recebem a mesma conta.
  select array_agg(l.id), sum(l.valor),
         max((l.criado_em at time zone 'America/Sao_Paulo')::date)
    into v_ids, v_total, v_ultimo
    from (
      select l.id, l.valor, l.criado_em
        from public.lancamentos l
       where l.tipo = 'receber'
         and l.categoria = 'Consumo'
         and l.consumo_id is not null
         and l.pessoa_id = p_pessoa_id
         and l.pago_em is null
         and l.cancelado_em is null
       for update
    ) l;
  if v_ids is null then
    perform privado.recusar('Não há consumo em aberto nesta conta.');
  end if;
  if p_pago_em < v_ultimo then
    perform privado.recusar(format(
      'A data do pagamento não pode ser antes do último consumo em aberto (%s).',
      to_char(v_ultimo, 'DD/MM/YYYY')));
  end if;

  update public.lancamentos
     set pago_em = p_pago_em, forma_pagamento = p_forma_pagamento
   where id = any (v_ids);

  return jsonb_build_object('lancamentos_pagos', cardinality(v_ids), 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Quem pode chamar: so quem esta logado (a permissao fina e da funcao/RLS)
-- ---------------------------------------------------------------------------
revoke execute on function
  public.criar_lancamento(text, text, text, numeric, date, text, text, text, text, date, numeric, text),
  public.registrar_pagamento(text, date, text, numeric, text, text),
  public.anular_lancamento(text, text),
  public.gerar_mensalidades(text),
  public.fechar_repasse_do_mes(text, date),
  public.cadastrar_produto(text, text, text, numeric, numeric, integer),
  public.editar_produto(text, text, text, text, numeric, numeric, integer),
  public.inativar_produto(text),
  public.reativar_produto(text),
  public.registrar_entrada(text, integer, text, jsonb),
  public.registrar_perda(text, integer, text),
  public.ajustar_inventario(text, integer, text),
  public.lancar_consumo(text, text, text, integer),
  public.fechar_conta_de_consumo(text, date, text)
  from public, anon;
grant execute on function
  public.criar_lancamento(text, text, text, numeric, date, text, text, text, text, date, numeric, text),
  public.registrar_pagamento(text, date, text, numeric, text, text),
  public.anular_lancamento(text, text),
  public.gerar_mensalidades(text),
  public.fechar_repasse_do_mes(text, date),
  public.cadastrar_produto(text, text, text, numeric, numeric, integer),
  public.editar_produto(text, text, text, text, numeric, numeric, integer),
  public.inativar_produto(text),
  public.reativar_produto(text),
  public.registrar_entrada(text, integer, text, jsonb),
  public.registrar_perda(text, integer, text),
  public.ajustar_inventario(text, integer, text),
  public.lancar_consumo(text, text, text, integer),
  public.fechar_conta_de_consumo(text, date, text)
  to authenticated;
