-- ============================================================================
--  Funcoes do modulo de alunos, das configuracoes, dos professores e dos
--  comentarios
-- ============================================================================
--  Transforma em funcoes do Postgres as operacoes da tela que gravam em mais
--  de uma tabela ou que tem regra que o banco ainda nao garantia (mesmos nomes
--  e mesmas mensagens de `src/lib/banco/operacoes/alunos.ts`,
--  `configuracoes.ts`, `professores.ts` e `base.ts`). A tela chama cada uma com
--  `supabase.rpc('nome', { p_campo: valor })`. Tudo ou nada: se uma regra for
--  violada, nada e gravado.
--
--  Alunos (modulo "alunos"):
--    criar_matricula, trocar_plano, encerrar_matricula,
--    cancelar_matricula_agendada, congelar_plano, reativar_plano,
--    inativar_aluno.
--    Congelar, reativar e inativar tambem mexem na agenda (ocupacoes, alunos
--    das aulas, horarios fixos): exigem permissao de gravar em "alunos" E em
--    "agenda". A logica de agenda necessaria esta aqui mesmo (funcoes
--    `privado.alunos_*`), sem depender das funcoes do modulo de agenda.
--  Configuracoes (modulo "configuracoes", so o dono):
--    salvar_parametros, incluir_sigla, editar_sigla, desativar_sigla,
--    reativar_sigla, incluir_plano, editar_plano, apagar_plano,
--    alterar_permissoes.
--  Comentarios (qualquer colaborador ativo):
--    adicionar_comentario, editar_comentario, apagar_comentario.
--
--  Ficam como gravacao direta na tabela (constraints + RLS bastam): cadastro
--  e edicao de aluno, reativar cadastro, corrigir matricula, cadastro e edicao
--  de professor, desativar/reativar plano do catalogo. Ver
--  `docs/modulos/alunos.md` e `docs/modulos/base.md`.
--
--  Mudancas de esquema (explicadas no fim de cada secao):
--   1. `congelamentos`: o fim real pode ser a vespera do inicio (congelamento
--      anulado antes de comecar, como na tela).
--   2. `professores`: a recepcao passa a poder corrigir o cadastro (H9), e um
--      gatilho garante que so o dono muda a regra de repasse.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mudancas de esquema
-- ---------------------------------------------------------------------------

-- 1.1 Congelamento anulado. Na tela, voltar antes (ou no dia) do inicio cancela
-- o congelamento: o fim real fica na vespera do inicio ("nunca valeu"), e o
-- registro continua no historico. O check antigo (fim_real >= inicio) nao
-- deixava gravar isso.
do $$
declare
  v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.congelamentos'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%fim_real >= inicio%';
  if v_nome is not null then
    execute format('alter table public.congelamentos drop constraint %I', v_nome);
  end if;
end;
$$;
alter table public.congelamentos
  add constraint congelamentos_fim_real_valido
  check (fim_real is null or fim_real >= inicio - 1);

-- 1.2 Professores (H9): so o dono cadastra professores e muda a regra de
-- repasse; a recepcao corrige os demais dados (contato, cor, especialidade).
-- A politica antiga deixava so o dono alterar qualquer coisa.
create policy "recepcao corrige o cadastro do professor" on public.professores
  for update to authenticated
  using (privado.pode_gravar('professores'))
  with check (privado.pode_gravar('professores'));

-- Regra de repasse: so o dono altera (quem nao e colaborador, como as rotinas
-- do proprio banco, nao e barrado).
create function privado.alunos_proteger_repasse()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.repasse_modo, new.repasse_valor) is distinct from (old.repasse_modo, old.repasse_valor)
     and privado.meu_perfil() <> 'dono' then
    perform privado.recusar('Só o dono cadastra professores e altera a regra de repasse.');
  end if;
  return new;
end;
$$;

create trigger proteger_repasse
  before update on public.professores
  for each row execute function privado.alunos_proteger_repasse();

-- ---------------------------------------------------------------------------
-- 2. Funcoes auxiliares (schema privado)
-- ---------------------------------------------------------------------------

-- "2026-11-05" -> "05/11/2026", como `formatarData` da tela.
create function privado.alunos_data_br(p_data date)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_data, 'DD/MM/YYYY');
$$;

-- "  ana   beatriz " -> "ana beatriz" (como `limparNome` da tela).
create function privado.alunos_limpar(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(coalesce(p_texto, ''), '^\s+|\s+$', '', 'g'),
    '\s+', ' ', 'g'
  );
$$;

-- Tira so os espacos das pontas (como `trim()` da tela).
create function privado.alunos_aparar(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_texto, ''), '^\s+|\s+$', '', 'g');
$$;

-- Datas digitadas precisam estar a ate um ano de hoje (erro de digitacao no ano).
create function privado.alunos_garantir_data_proxima(p_data date, p_rotulo text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_data < (privado.hoje() - interval '12 months')::date
     or p_data > (privado.hoje() + interval '12 months')::date then
    perform privado.recusar(format('%s precisa estar a até um ano de hoje. Confira o ano.', p_rotulo));
  end if;
end;
$$;

-- Congelar, reativar e inativar tambem gravam na agenda: exige as duas
-- permissoes, com a mesma mensagem de `privado.iniciar_operacao`.
create function privado.alunos_exigir_agenda()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not privado.pode_gravar('agenda') then
    raise exception using
      errcode = '42501',
      message = 'Seu perfil não tem permissão para esta operação.';
  end if;
end;
$$;

-- Aluno existente e ativo, travado para a operacao.
create function privado.alunos_buscar_ativo(p_aluno_id text)
returns public.alunos
language plpgsql
set search_path = ''
as $$
declare
  v_aluno public.alunos;
begin
  select * into v_aluno from public.alunos where id = p_aluno_id for update;
  if not found then
    perform privado.recusar('Aluno não encontrado.');
  end if;
  if not v_aluno.ativo then
    perform privado.recusar(format('%s está inativo. Reative o cadastro antes.', v_aluno.nome));
  end if;
  return v_aluno;
end;
$$;

-- Plano ativo, valor e vencimento validos, inicio a ate um ano de hoje.
create function privado.alunos_validar_matricula(
  p_plano_id text,
  p_valor_mensal numeric,
  p_dia_vencimento numeric,
  p_inicio date
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_plano public.planos;
begin
  select * into v_plano from public.planos where id = p_plano_id;
  if not found then
    perform privado.recusar('Escolha o plano.');
  end if;
  if not v_plano.ativo then
    perform privado.recusar(format('O plano "%s" não está mais disponível.', v_plano.nome));
  end if;
  if p_valor_mensal is null or round(p_valor_mensal, 2) <= 0 then
    perform privado.recusar('Informe o valor combinado da mensalidade (maior que zero).');
  end if;
  if p_dia_vencimento is null or p_dia_vencimento <> trunc(p_dia_vencimento)
     or p_dia_vencimento < 1 or p_dia_vencimento > 28 then
    perform privado.recusar('O dia de vencimento precisa ser de 1 a 28.');
  end if;
  if p_inicio is null then
    perform privado.recusar('Informe a data de início.');
  end if;
  perform privado.alunos_garantir_data_proxima(p_inicio, 'A data de início');
end;
$$;

-- Um aluno nunca tem duas matriculas valendo no mesmo dia. A exclusion
-- constraint de `matriculas` ja garante; aqui so da a mensagem clara.
create function privado.alunos_garantir_sem_matricula_sobreposta(
  p_aluno_id text,
  p_inicio date,
  p_fim date,
  p_ignorar_id text default null
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_conflito public.matriculas;
begin
  select * into v_conflito
    from public.matriculas
   where aluno_id = p_aluno_id
     and id is distinct from p_ignorar_id
     and inicio <= coalesce(p_fim, 'infinity'::date)
     and p_inicio <= coalesce(fim, 'infinity'::date)
   order by inicio
   limit 1;
  if not found then
    return;
  end if;
  if v_conflito.fim is not null then
    perform privado.recusar(format(
      'O aluno já tem uma matrícula de %s a %s: duas matrículas não podem valer ao mesmo tempo.',
      privado.alunos_data_br(v_conflito.inicio), privado.alunos_data_br(v_conflito.fim)));
  end if;
  perform privado.recusar(format(
    'O aluno já tem uma matrícula a partir de %s, sem data de fim. Use "Trocar de plano" ou encerre a matrícula atual.',
    privado.alunos_data_br(v_conflito.inicio)));
end;
$$;

-- "Quadra 2", "Paredão".
create function privado.alunos_rotulo_quadra(p_quadra_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_quadra_id = 'paredao' then 'Paredão' else 'Quadra ' || p_quadra_id end;
$$;

-- "Individual · Ana e Bruno", "Bloqueio · Manutencao"... (como `descreverOcupacao`).
-- Os nomes saem em ordem alfabetica.
create function privado.alunos_descrever_ocupacao(p_ocupacao_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when o.tipo = 'Bloqueio' then 'Bloqueio' || coalesce(' · ' || nullif(o.descricao, ''), '')
    when n.qtd = 0 then o.tipo
    when n.qtd <= 2 then o.tipo || ' · ' || n.nomes
    else o.tipo || ' · ' || n.primeiro || ' e mais ' || (n.qtd - 1)
  end
  from public.ocupacoes o
  cross join lateral (
    select count(*) as qtd,
           string_agg(a.nome, ' e ' order by a.nome) as nomes,
           min(a.nome) as primeiro
      from public.ocupacao_alunos p
      join public.alunos a on a.id = p.aluno_id
     where p.ocupacao_id = o.id
  ) n
  where o.id = p_ocupacao_id;
$$;

-- Suspende as aulas fixas do aluno entre as datas (Hipotese H4), sem gerar
-- credito de reposicao: so as que vem de horario fixo e estao agendadas. Se o
-- aluno e o unico participante, a aula e cancelada com `p_motivo` (a quadra
-- fica livre); numa turma, ele sai da lista. Devolve a lista gravada em
-- `congelamentos.aulas_suspensas`: [{ "ocupacaoId", "acao" }], por data e hora.
create function privado.alunos_suspender_aulas(
  p_aluno_id text,
  p_inicio date,
  p_fim date,
  p_motivo text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_lista jsonb;
begin
  -- Trava as aulas antes de decidir (ninguem mexe nelas no meio-tempo).
  perform 1
     from public.ocupacoes o
     join public.ocupacao_alunos p on p.ocupacao_id = o.id
    where p.aluno_id = p_aluno_id
      and o.horario_fixo_id is not null
      and o.situacao = 'agendada'
      and o.data between p_inicio and p_fim
      for update of o;

  select coalesce(jsonb_agg(
           jsonb_build_object('ocupacaoId', s.id, 'acao', s.acao)
           order by s.data, s.hora_inicio), '[]'::jsonb)
    into v_lista
    from (
      select o.id, o.data, o.hora_inicio,
             case when (select count(*) from public.ocupacao_alunos t where t.ocupacao_id = o.id) <= 1
                  then 'cancelada' else 'retirado' end as acao
        from public.ocupacoes o
        join public.ocupacao_alunos p on p.ocupacao_id = o.id
       where p.aluno_id = p_aluno_id
         and o.horario_fixo_id is not null
         and o.situacao = 'agendada'
         and o.data between p_inicio and p_fim
    ) s;

  update public.ocupacoes
     set situacao = 'cancelada', motivo_cancelamento = p_motivo, cancelada_em = now()
   where id in (select e ->> 'ocupacaoId' from jsonb_array_elements(v_lista) e
                 where e ->> 'acao' = 'cancelada');

  delete from public.ocupacao_alunos
   where aluno_id = p_aluno_id
     and ocupacao_id in (select e ->> 'ocupacaoId' from jsonb_array_elements(v_lista) e
                          where e ->> 'acao' = 'retirado');

  return v_lista;
end;
$$;

-- Texto comparavel: sem espacos nas pontas, minusculo e sem acento (como
-- `mesmoTexto` da tela).
create function privado.configuracoes_chave(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    lower(btrim(coalesce(p_texto, ''))),
    'áàâãäåéèêëíìîïóòôõöúùûüçñý',
    'aaaaaaeeeeiiiiooooouuuucny'
  );
$$;

-- Numero inteiro entre os limites, ou recusa com a mensagem do parametro.
create function privado.configuracoes_inteiro(
  p_valor numeric,
  p_minimo integer,
  p_maximo integer,
  p_mensagem text
)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_valor is null or p_valor <> trunc(p_valor) or p_valor < p_minimo or p_valor > p_maximo then
    perform privado.recusar(p_mensagem);
  end if;
  return p_valor::smallint;
end;
$$;

-- Os campos que a tela edita numa sigla, sem espacos nas pontas.
create function privado.configuracoes_normalizar_sigla(p_sigla jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'codigo', privado.alunos_aparar(p_sigla ->> 'codigo'),
    'nome', privado.alunos_aparar(p_sigla ->> 'nome'),
    'descricao', privado.alunos_aparar(p_sigla ->> 'descricao'),
    'geraCredito', coalesce(p_sigla -> 'geraCredito', 'null'::jsonb),
    'aplicaA', coalesce(p_sigla -> 'aplicaA', 'null'::jsonb)
  );
$$;

-- Codigo de 1 a 6 letras ou numeros, sem repetir as `p_outras`, com nome,
-- onde vale e se gera credito.
create function privado.configuracoes_validar_sigla(p_sigla jsonb, p_outras jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_repetida text;
begin
  if coalesce(p_sigla ->> 'codigo', '') !~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿ]{1,6}$' then
    perform privado.recusar('O código da sigla precisa ter de 1 a 6 letras ou números, sem espaços.');
  end if;
  select o ->> 'codigo' into v_repetida
    from jsonb_array_elements(p_outras) o
   where privado.configuracoes_chave(o ->> 'codigo') = privado.configuracoes_chave(p_sigla ->> 'codigo')
   limit 1;
  if v_repetida is not null then
    perform privado.recusar(format('Já existe a sigla "%s". Escolha outro código.', v_repetida));
  end if;
  if coalesce(p_sigla ->> 'nome', '') = '' then
    perform privado.recusar('Dê um nome à sigla.');
  end if;
  if coalesce(p_sigla ->> 'aplicaA', '') not in ('ocupacao', 'aluno', 'ambos') then
    perform privado.recusar('Escolha onde a sigla vale: aula inteira, um aluno ou os dois.');
  end if;
  if jsonb_typeof(p_sigla -> 'geraCredito') is distinct from 'boolean' then
    perform privado.recusar('Diga se a sigla gera crédito de reposição.');
  end if;
end;
$$;

-- Quantas vezes o codigo ja foi gravado (aulas canceladas, faltas e creditos).
create function privado.configuracoes_usos_da_sigla(p_codigo text)
returns integer
language sql
stable
set search_path = ''
as $$
  select (select count(*) from public.ocupacoes where motivo_cancelamento = p_codigo)::integer
       + (select count(*) from public.ocupacao_alunos where sigla = p_codigo)::integer
       + (select count(*) from public.reposicoes where sigla = p_codigo)::integer;
$$;

-- Nome sem repetir, tipo valido, valor > 0, aulas de 1 a 7, duracao de 15 a
-- 240 minutos, tabela nova ou antiga.
create function privado.configuracoes_validar_plano(
  p_ignorar_id text,
  p_nome text,
  p_tipo text,
  p_valor_mensal numeric,
  p_aulas_por_semana numeric,
  p_duracao_minutos numeric,
  p_tabela text,
  p_ativo boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_repetido text;
begin
  if p_nome = '' then
    perform privado.recusar('Dê um nome ao plano.');
  end if;
  select nome into v_repetido
    from public.planos
   where id is distinct from p_ignorar_id
     and privado.configuracoes_chave(nome) = privado.configuracoes_chave(p_nome)
   limit 1;
  if v_repetido is not null then
    perform privado.recusar(format('Já existe um plano chamado "%s".', v_repetido));
  end if;
  if coalesce(p_tipo, '') not in ('Individual', 'Dupla', 'LAP', 'Locação Mensal', 'Plano de locação') then
    perform privado.recusar('Escolha o tipo do plano.');
  end if;
  if p_valor_mensal is null or round(p_valor_mensal, 2) <= 0 then
    perform privado.recusar('O valor mensal do plano precisa ser maior que zero.');
  end if;
  perform privado.configuracoes_inteiro(p_aulas_por_semana, 1, 7,
    'As aulas por semana precisam ficar entre 1 e 7.');
  perform privado.configuracoes_inteiro(p_duracao_minutos, 15, 240,
    'A duração da aula precisa ficar entre 15 e 240 minutos.');
  if coalesce(p_tabela, '') not in ('nova', 'antiga') then
    perform privado.recusar('Diga se o plano é da tabela nova ou da antiga.');
  end if;
  if p_ativo is null then
    perform privado.recusar('Diga se o plano está ativo.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Matricula
-- ---------------------------------------------------------------------------

-- Nova matricula de um aluno ativo. Devolve o id da matricula.
create function public.criar_matricula(
  p_aluno_id text,
  p_plano_id text,
  p_valor_mensal numeric,
  p_dia_vencimento numeric,
  p_inicio date
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno public.alunos;
  v_id text;
begin
  perform privado.iniciar_operacao('Nova matrícula', 'alunos');
  v_aluno := privado.alunos_buscar_ativo(p_aluno_id);
  perform privado.alunos_validar_matricula(p_plano_id, p_valor_mensal, p_dia_vencimento, p_inicio);
  perform privado.alunos_garantir_sem_matricula_sobreposta(v_aluno.id, p_inicio, null);

  insert into public.matriculas (aluno_id, plano_id, valor_mensal, dia_vencimento, inicio)
  values (v_aluno.id, p_plano_id, round(p_valor_mensal, 2), p_dia_vencimento::smallint, p_inicio)
  returning id into v_id;
  return v_id;
end;
$$;

-- Troca de plano: a matricula atual termina na vespera de `p_inicio` e uma
-- nova comeca nesse dia. Devolve o id da matricula nova.
create function public.trocar_plano(
  p_matricula_id text,
  p_plano_id text,
  p_valor_mensal numeric,
  p_dia_vencimento numeric,
  p_inicio date
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual public.matriculas;
  v_ultimo_dia date;
  v_id text;
begin
  perform privado.iniciar_operacao('Trocar de plano', 'alunos');
  select * into v_atual from public.matriculas where id = p_matricula_id for update;
  if not found then
    perform privado.recusar('Matrícula não encontrada.');
  end if;
  perform privado.alunos_buscar_ativo(v_atual.aluno_id);
  perform privado.alunos_validar_matricula(p_plano_id, p_valor_mensal, p_dia_vencimento, p_inicio);

  if p_inicio <= v_atual.inicio then
    perform privado.recusar(format(
      'O novo plano precisa começar depois de %s, quando começou o plano atual.',
      privado.alunos_data_br(v_atual.inicio)));
  end if;
  if v_atual.fim is not null and p_inicio > v_atual.fim + 1 then
    perform privado.recusar(format(
      'Esta matrícula terminou em %s. Para voltar, use "Nova matrícula".',
      privado.alunos_data_br(v_atual.fim)));
  end if;

  v_ultimo_dia := p_inicio - 1;
  if exists (
    select 1 from public.congelamentos c
     where c.matricula_id = v_atual.id
       and not (c.fim_real is not null and c.fim_real < c.inicio)
       and (c.fim_real is null or c.fim_real > v_ultimo_dia)
  ) then
    perform privado.recusar('O plano atual está congelado (ou tem congelamento marcado) nesse período. Reative ou desmarque o congelamento antes de trocar de plano.');
  end if;
  perform privado.alunos_garantir_sem_matricula_sobreposta(v_atual.aluno_id, p_inicio, null, v_atual.id);

  update public.matriculas set fim = v_ultimo_dia
   where id = v_atual.id and fim is distinct from v_ultimo_dia;
  insert into public.matriculas (aluno_id, plano_id, valor_mensal, dia_vencimento, inicio)
  values (v_atual.aluno_id, p_plano_id, round(p_valor_mensal, 2), p_dia_vencimento::smallint, p_inicio)
  returning id into v_id;
  return v_id;
end;
$$;

-- Encerra a matricula no ultimo dia informado; o congelamento em curso
-- termina junto. As aulas da agenda nao mudam. Devolve o id da matricula.
create function public.encerrar_matricula(p_matricula_id text, p_ultimo_dia date)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_matricula public.matriculas;
  v_depois date;
begin
  perform privado.iniciar_operacao('Encerrar matrícula', 'alunos');
  select * into v_matricula from public.matriculas where id = p_matricula_id for update;
  if not found then
    perform privado.recusar('Matrícula não encontrada.');
  end if;
  if p_ultimo_dia is null then
    perform privado.recusar('Informe o último dia da matrícula.');
  end if;
  perform privado.alunos_garantir_data_proxima(p_ultimo_dia, 'O último dia');
  if p_ultimo_dia < v_matricula.inicio then
    perform privado.recusar(format(
      'A matrícula começou em %s: o último dia não pode ser antes disso.',
      privado.alunos_data_br(v_matricula.inicio)));
  end if;
  if v_matricula.fim is not null and p_ultimo_dia >= v_matricula.fim then
    perform privado.recusar(format('A matrícula já termina em %s.', privado.alunos_data_br(v_matricula.fim)));
  end if;

  select min(c.inicio) into v_depois
    from public.congelamentos c
   where c.matricula_id = v_matricula.id
     and not (c.fim_real is not null and c.fim_real < c.inicio)
     and c.inicio > p_ultimo_dia;
  if v_depois is not null then
    perform privado.recusar(format(
      'Há um congelamento marcado a partir de %s. Desmarque o congelamento antes de encerrar a matrícula nessa data.',
      privado.alunos_data_br(v_depois)));
  end if;

  update public.matriculas set fim = p_ultimo_dia where id = v_matricula.id;
  update public.congelamentos c set fim_real = p_ultimo_dia
   where c.matricula_id = v_matricula.id
     and not (c.fim_real is not null and c.fim_real < c.inicio)
     and (c.fim_real is null or c.fim_real > p_ultimo_dia);
  return v_matricula.id;
end;
$$;

-- Cancela uma matricula que ainda nao comecou. Se era uma troca de plano, a
-- anterior volta a valer sem data de fim. Devolve o id da matricula que voltou
-- a valer (ou null).
create function public.cancelar_matricula_agendada(p_matricula_id text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_matricula public.matriculas;
  v_reabrir text;
begin
  perform privado.iniciar_operacao('Desmarcar matrícula agendada', 'alunos');
  select * into v_matricula from public.matriculas where id = p_matricula_id for update;
  if not found then
    perform privado.recusar('Matrícula não encontrada.');
  end if;
  if v_matricula.inicio <= privado.hoje() then
    perform privado.recusar('Esta matrícula já começou. Para terminá-la, use "Encerrar matrícula".');
  end if;
  if exists (
    select 1 from public.congelamentos c
     where c.matricula_id = v_matricula.id
       and not (c.fim_real is not null and c.fim_real < c.inicio)
  ) then
    perform privado.recusar('Há um congelamento marcado nesta matrícula. Desmarque o congelamento antes.');
  end if;

  -- A anterior (que termina na vespera) volta a valer, se nao houver outra depois.
  select m.id into v_reabrir
    from public.matriculas m
   where m.aluno_id = v_matricula.aluno_id
     and m.fim = v_matricula.inicio - 1
     and not exists (
       select 1 from public.matriculas d
        where d.aluno_id = v_matricula.aluno_id and d.inicio > v_matricula.inicio
     )
   for update;

  -- Os congelamentos anulados dela saem junto (on delete cascade).
  delete from public.matriculas where id = v_matricula.id;
  if v_reabrir is not null then
    update public.matriculas set fim = null where id = v_reabrir;
  end if;
  return v_reabrir;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Congelamento (Hipotese H4)
-- ---------------------------------------------------------------------------

-- Congela o plano de `p_inicio` ate `p_fim_previsto`. As aulas fixas do aluno
-- no periodo ficam suspensas sem gerar credito (canceladas com motivo
-- "Congelamento", ou o aluno sai da turma); o congelamento guarda a lista para
-- devolve-las na volta. A mensalidade nao muda.
-- Devolve { "congelamento_id", "aulas_suspensas" (quantas) }.
create function public.congelar_plano(
  p_aluno_id text,
  p_inicio date,
  p_fim_previsto date,
  p_motivo text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno public.alunos;
  v_matricula public.matriculas;
  v_conflito public.congelamentos;
  v_motivo text := privado.alunos_limpar(p_motivo);
  v_suspensas jsonb;
  v_id text;
begin
  perform privado.iniciar_operacao('Congelar plano', 'alunos');
  perform privado.alunos_exigir_agenda();
  v_aluno := privado.alunos_buscar_ativo(p_aluno_id);

  if p_inicio is null then
    perform privado.recusar('Informe o início do congelamento.');
  end if;
  if p_fim_previsto is null then
    perform privado.recusar('Informe o fim previsto do congelamento.');
  end if;
  perform privado.alunos_garantir_data_proxima(p_inicio, 'O início do congelamento');
  if p_fim_previsto < p_inicio then
    perform privado.recusar('O fim previsto precisa ser no mesmo dia do início ou depois.');
  end if;
  if v_motivo = '' then
    perform privado.recusar('Informe o motivo do congelamento.');
  end if;
  if length(v_motivo) > 200 then
    perform privado.recusar('O motivo pode ter no máximo 200 caracteres.');
  end if;

  -- Trava a matricula: dois congelamentos da mesma matricula nao entram juntos.
  select * into v_matricula
    from public.matriculas
   where aluno_id = v_aluno.id
     and inicio <= p_inicio
     and (fim is null or fim >= p_inicio)
     for update;
  if not found then
    perform privado.recusar(format('%s não tem matrícula valendo em %s.',
      v_aluno.nome, privado.alunos_data_br(p_inicio)));
  end if;
  if v_matricula.fim is not null and p_fim_previsto > v_matricula.fim then
    perform privado.recusar(format(
      'A matrícula termina em %s: o congelamento precisa acabar até essa data.',
      privado.alunos_data_br(v_matricula.fim)));
  end if;

  -- Periodos nao se sobrepoem (congelamento sem volta conta "ate a volta").
  select * into v_conflito
    from public.congelamentos c
   where c.matricula_id = v_matricula.id
     and not (c.fim_real is not null and c.fim_real < c.inicio)
     and c.inicio <= p_fim_previsto
     and p_inicio <= coalesce(c.fim_real, 'infinity'::date)
   order by c.inicio
   limit 1;
  if found then
    if v_conflito.fim_real is not null then
      perform privado.recusar(format(
        'Já houve um congelamento de %s a %s: os períodos não podem se sobrepor.',
        privado.alunos_data_br(v_conflito.inicio), privado.alunos_data_br(v_conflito.fim_real)));
    end if;
    perform privado.recusar(format(
      'Já existe um congelamento a partir de %s, sem volta registrada. Reative o plano antes de congelar de novo.',
      privado.alunos_data_br(v_conflito.inicio)));
  end if;

  v_suspensas := privado.alunos_suspender_aulas(v_aluno.id, p_inicio, p_fim_previsto, 'Congelamento');

  insert into public.congelamentos (matricula_id, inicio, fim_previsto, motivo, aulas_suspensas)
  values (v_matricula.id, p_inicio, p_fim_previsto, v_motivo, v_suspensas)
  returning id into v_id;

  return jsonb_build_object(
    'congelamento_id', v_id,
    'aulas_suspensas', jsonb_array_length(v_suspensas)
  );
end;
$$;

-- O aluno volta em `p_data_volta` (o congelamento fica ate a vespera). As
-- aulas suspensas dessa data (ou de hoje) em diante voltam para a agenda,
-- menos as que nao podem (quadra ocupada no meio-tempo, professor ocupado com
-- H10 ligada, aula da turma cancelada). Voltar no dia do inicio, ou antes,
-- anula o congelamento.
-- Devolve { "voltaram": quantas, "nao_voltaram": [{ "ocupacao_id", "data", "motivo" }] }.
create function public.reativar_plano(p_congelamento_id text, p_data_volta date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cong public.congelamentos;
  v_matricula public.matriculas;
  v_a_partir_de date;
  v_bloquear_professor boolean;
  v_item record;
  v_oc public.ocupacoes;
  v_conflito public.ocupacoes;
  v_voltaram integer := 0;
  v_nao_voltaram jsonb := '[]'::jsonb;
  v_motivo text;
begin
  perform privado.iniciar_operacao('Reativar plano', 'alunos');
  perform privado.alunos_exigir_agenda();

  select * into v_cong from public.congelamentos where id = p_congelamento_id for update;
  if not found then
    perform privado.recusar('Congelamento não encontrado.');
  end if;
  if v_cong.fim_real is not null then
    perform privado.recusar('Este congelamento já foi encerrado.');
  end if;
  select * into v_matricula from public.matriculas where id = v_cong.matricula_id;
  if not found then
    perform privado.recusar('Matrícula não encontrada.');
  end if;
  if p_data_volta is null then
    perform privado.recusar('Informe a data de volta.');
  end if;
  perform privado.alunos_garantir_data_proxima(p_data_volta, 'A data de volta');
  if v_matricula.fim is not null and p_data_volta > v_matricula.fim + 1 then
    perform privado.recusar(format(
      'A matrícula termina em %s: a volta precisa ser até o dia seguinte.',
      privado.alunos_data_br(v_matricula.fim)));
  end if;

  -- O passado nao muda: as aulas voltam da data de volta (ou de hoje) em diante.
  v_a_partir_de := greatest(p_data_volta, privado.hoje());
  select bloquear_professor_em_duas_aulas into v_bloquear_professor
    from public.configuracoes where id = 1;

  for v_item in
    select e ->> 'ocupacaoId' as ocupacao_id, e ->> 'acao' as acao
      from jsonb_array_elements(v_cong.aulas_suspensas) e
      join public.ocupacoes o on o.id = e ->> 'ocupacaoId'
     where o.data >= v_a_partir_de
     order by o.data, o.hora_inicio
  loop
    select * into v_oc from public.ocupacoes where id = v_item.ocupacao_id for update;
    v_motivo := null;

    if v_item.acao = 'cancelada' then
      -- Se alguem ja mexeu nesta aula pela agenda, ela nao e mais do congelamento.
      continue when v_oc.situacao <> 'cancelada'
                 or v_oc.motivo_cancelamento is distinct from 'Congelamento';

      select * into v_conflito
        from public.ocupacoes c
       where c.id <> v_oc.id
         and c.situacao <> 'cancelada'
         and c.quadra_id = v_oc.quadra_id
         and c.data = v_oc.data
         and c.hora_inicio < v_oc.hora_fim
         and v_oc.hora_inicio < c.hora_fim
       order by c.hora_inicio
       limit 1;
      if found then
        v_motivo := format('%s já ocupada das %s às %s (%s)',
          privado.alunos_rotulo_quadra(v_oc.quadra_id),
          to_char(v_conflito.hora_inicio, 'HH24:MI'),
          to_char(v_conflito.hora_fim, 'HH24:MI'),
          privado.alunos_descrever_ocupacao(v_conflito.id));
      elsif coalesce(v_bloquear_professor, false) and v_oc.professor_id is not null and exists (
        select 1 from public.ocupacoes c
         where c.id <> v_oc.id
           and c.situacao <> 'cancelada'
           and c.professor_id = v_oc.professor_id
           and c.data = v_oc.data
           and c.hora_inicio < v_oc.hora_fim
           and v_oc.hora_inicio < c.hora_fim
      ) then
        v_motivo := 'o professor já tem outra aula nesse horário';
      else
        begin
          update public.ocupacoes
             set situacao = 'agendada', motivo_cancelamento = null, cancelada_em = null
           where id = v_oc.id;
          v_voltaram := v_voltaram + 1;
        exception when exclusion_violation then
          -- Alguem ocupou a quadra entre a conferencia e a gravacao.
          v_motivo := format('%s já ocupada nesse horário', privado.alunos_rotulo_quadra(v_oc.quadra_id));
        end;
      end if;
    else
      -- "retirado": a aula da turma continuou; o aluno volta para a lista.
      if v_oc.situacao = 'cancelada' then
        v_motivo := 'a aula da turma foi cancelada'
          || coalesce(' (' || nullif(v_oc.motivo_cancelamento, '') || ')', '');
      elsif v_oc.situacao <> 'realizada' and not exists (
        select 1 from public.ocupacao_alunos p
         where p.ocupacao_id = v_oc.id and p.aluno_id = v_matricula.aluno_id
      ) then
        insert into public.ocupacao_alunos (ocupacao_id, aluno_id)
        values (v_oc.id, v_matricula.aluno_id);
        v_voltaram := v_voltaram + 1;
      end if;
    end if;

    if v_motivo is not null then
      v_nao_voltaram := v_nao_voltaram || jsonb_build_object(
        'ocupacao_id', v_oc.id, 'data', v_oc.data, 'motivo', v_motivo);
    end if;
  end loop;

  -- Ultimo dia congelado: vespera da volta (ou do inicio, se voltou antes: anulado).
  update public.congelamentos
     set fim_real = greatest(p_data_volta, v_cong.inicio) - 1
   where id = v_cong.id;

  return jsonb_build_object('voltaram', v_voltaram, 'nao_voltaram', v_nao_voltaram);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Inativacao
-- ---------------------------------------------------------------------------

-- O aluno sai da arena. Numa operacao so:
--  - a matricula que vale termina no ultimo dia (as que ainda nao comecaram
--    sao apagadas: nunca valeram);
--  - o congelamento em curso termina no ultimo dia (o marcado para depois da
--    saida fica anulado);
--  - as aulas fixas depois do ultimo dia saem da agenda, sem credito (a que
--    era so dele e cancelada com motivo "Aluno inativado"; na turma ele sai);
--  - os horarios fixos que eram so dele terminam; nos de turma ele sai;
--  - o motivo, se houver, vira comentario na ficha.
-- Lancamentos, historico e reservas avulsas nao mudam. Devolve o id do aluno.
create function public.inativar_aluno(p_aluno_id text, p_ultimo_dia date, p_motivo text default null)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aluno public.alunos;
  v_hoje date := privado.hoje();
  v_motivo text := privado.alunos_limpar(p_motivo);
  v_comecou date;
begin
  perform privado.iniciar_operacao('Inativar aluno', 'alunos');
  perform privado.alunos_exigir_agenda();

  select * into v_aluno from public.alunos where id = p_aluno_id for update;
  if not found then
    perform privado.recusar('Aluno não encontrado.');
  end if;
  if not v_aluno.ativo then
    perform privado.recusar(format('%s já está inativo.', v_aluno.nome));
  end if;
  if p_ultimo_dia is null then
    perform privado.recusar('Informe o último dia do aluno na arena.');
  end if;
  if p_ultimo_dia > v_hoje then
    perform privado.recusar('O último dia não pode ser depois de hoje. Para uma saída futura, encerre a matrícula nessa data e inative o aluno quando ele sair.');
  end if;
  perform privado.alunos_garantir_data_proxima(p_ultimo_dia, 'O último dia');
  if length(v_motivo) > 300 then
    perform privado.recusar('O motivo pode ter no máximo 300 caracteres.');
  end if;

  select min(inicio) into v_comecou
    from public.matriculas
   where aluno_id = v_aluno.id and inicio <= v_hoje and inicio > p_ultimo_dia;
  if v_comecou is not null then
    perform privado.recusar(format(
      'A matrícula atual começou em %s: o último dia não pode ser antes disso.',
      privado.alunos_data_br(v_comecou)));
  end if;

  -- Matriculas: as que ainda nao comecaram saem (com os congelamentos delas);
  -- a que vale termina no ultimo dia.
  delete from public.matriculas where aluno_id = v_aluno.id and inicio > v_hoje;
  update public.matriculas set fim = p_ultimo_dia
   where aluno_id = v_aluno.id and (fim is null or fim > p_ultimo_dia);

  -- Congelamentos: em curso termina na saida; marcado para depois fica anulado.
  update public.congelamentos c
     set fim_real = case when c.inicio <= p_ultimo_dia then p_ultimo_dia else c.inicio - 1 end
    from public.matriculas m
   where m.id = c.matricula_id
     and m.aluno_id = v_aluno.id
     and not (c.fim_real is not null and c.fim_real < c.inicio)
     and (c.fim_real is null or c.fim_real > p_ultimo_dia);

  -- Horarios fixos: nos de turma ele sai da lista; o que era so dele termina.
  delete from public.horario_alunos ha
   using public.horarios_fixos h
   where h.id = ha.horario_fixo_id
     and ha.aluno_id = v_aluno.id
     and (h.fim is null or h.fim > p_ultimo_dia)
     and exists (select 1 from public.horario_alunos o
                  where o.horario_fixo_id = h.id and o.aluno_id <> v_aluno.id);
  update public.horarios_fixos h
     set fim = greatest(h.inicio, p_ultimo_dia)
   where (h.fim is null or h.fim > p_ultimo_dia)
     and exists (select 1 from public.horario_alunos ha
                  where ha.horario_fixo_id = h.id and ha.aluno_id = v_aluno.id)
     and not exists (select 1 from public.horario_alunos o
                      where o.horario_fixo_id = h.id and o.aluno_id <> v_aluno.id);

  -- Aulas fixas depois do ultimo dia saem da agenda, sem credito.
  perform privado.alunos_suspender_aulas(v_aluno.id, p_ultimo_dia + 1, 'infinity'::date, 'Aluno inativado');

  update public.alunos set ativo = false where id = v_aluno.id;

  if v_motivo <> '' then
    insert into public.comentarios (entidade, entidade_id, texto, autor_id, autor_nome)
    select 'aluno', v_aluno.id, 'Aluno inativado. Motivo: ' || v_motivo, c.id, c.nome
      from public.colaboradores c
     where c.id = (select auth.uid());
  end if;

  return v_aluno.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Configuracoes (so o dono)
-- ---------------------------------------------------------------------------

-- Altera um ou mais parametros simples (os nao informados ficam como estao),
-- depois de conferir os limites de cada um. Sem retorno.
create function public.salvar_parametros(
  p_validade_reposicao_meses numeric default null,
  p_prazo_pagamento_reserva_horas numeric default null,
  p_liberar_reserva_automaticamente boolean default null,
  p_semanas_geradas_a_frente numeric default null,
  p_bloquear_professor_em_duas_aulas boolean default null,
  p_pontos_vitoria numeric default null,
  p_pontos_derrota numeric default null,
  p_torneio_conta_para_ranking boolean default null,
  p_classificados_por_grupo numeric default null,
  p_criterios_desempate jsonb default null,
  p_formas_pagamento jsonb default null,
  p_prazo_pagamento_consumo_dias numeric default null,
  p_preco_locacao_hora numeric default null,
  p_preco_paredao_hora numeric default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual public.configuracoes;
  v_novo public.configuracoes;
  v_forma jsonb;
  v_formas jsonb := '[]'::jsonb;
  v_repetida text;
begin
  perform privado.iniciar_operacao('Alterar configurações', 'configuracoes');
  select * into v_atual from public.configuracoes where id = 1 for update;
  v_novo := v_atual;

  v_novo.validade_reposicao_meses := privado.configuracoes_inteiro(
    coalesce(p_validade_reposicao_meses, v_atual.validade_reposicao_meses), 1, 32767,
    'A validade da reposição precisa ser de pelo menos 1 mês (número inteiro).');
  v_novo.prazo_pagamento_reserva_horas := privado.configuracoes_inteiro(
    coalesce(p_prazo_pagamento_reserva_horas, v_atual.prazo_pagamento_reserva_horas), 1, 32767,
    'O prazo para pagar a reserva precisa ser maior que zero (em horas inteiras).');
  v_novo.semanas_geradas_a_frente := privado.configuracoes_inteiro(
    coalesce(p_semanas_geradas_a_frente, v_atual.semanas_geradas_a_frente), 1, 52,
    'As semanas da agenda geradas à frente precisam ficar entre 1 e 52.');
  v_novo.pontos_vitoria := privado.configuracoes_inteiro(
    coalesce(p_pontos_vitoria, v_atual.pontos_vitoria), 0, 32767,
    'Os pontos por vitória e por derrota precisam ser números inteiros, sem valor negativo.');
  v_novo.pontos_derrota := privado.configuracoes_inteiro(
    coalesce(p_pontos_derrota, v_atual.pontos_derrota), 0, 32767,
    'Os pontos por vitória e por derrota precisam ser números inteiros, sem valor negativo.');
  if v_novo.pontos_vitoria < v_novo.pontos_derrota then
    perform privado.recusar('A vitória precisa valer pelo menos tanto quanto a derrota.');
  end if;
  v_novo.classificados_por_grupo := privado.configuracoes_inteiro(
    coalesce(p_classificados_por_grupo, v_atual.classificados_por_grupo), 1, 32767,
    'Precisa passar pelo menos 1 jogador de cada grupo.');
  v_novo.prazo_pagamento_consumo_dias := privado.configuracoes_inteiro(
    coalesce(p_prazo_pagamento_consumo_dias, v_atual.prazo_pagamento_consumo_dias), 1, 32767,
    'O prazo para pagar o consumo do balcão precisa ser de pelo menos 1 dia.');

  v_novo.preco_locacao_hora := round(coalesce(p_preco_locacao_hora, v_atual.preco_locacao_hora), 2);
  if v_novo.preco_locacao_hora <= 0 then
    perform privado.recusar('O preço da hora de locação das quadras precisa ser maior que zero.');
  end if;
  v_novo.preco_paredao_hora := round(coalesce(p_preco_paredao_hora, v_atual.preco_paredao_hora), 2);
  if v_novo.preco_paredao_hora <= 0 then
    perform privado.recusar('O preço da hora de locação do paredão precisa ser maior que zero.');
  end if;

  v_novo.liberar_reserva_automaticamente := coalesce(p_liberar_reserva_automaticamente, v_atual.liberar_reserva_automaticamente);
  v_novo.bloquear_professor_em_duas_aulas := coalesce(p_bloquear_professor_em_duas_aulas, v_atual.bloquear_professor_em_duas_aulas);
  v_novo.torneio_conta_para_ranking := coalesce(p_torneio_conta_para_ranking, v_atual.torneio_conta_para_ranking);

  -- Formas de pagamento: pelo menos uma, sem nome vazio e sem repeticao.
  if p_formas_pagamento is not null then
    if jsonb_typeof(p_formas_pagamento) is distinct from 'array'
       or jsonb_array_length(p_formas_pagamento) = 0 then
      perform privado.recusar('Informe pelo menos uma forma de pagamento.');
    end if;
    for v_forma in select e from jsonb_array_elements(p_formas_pagamento) e loop
      if jsonb_typeof(v_forma) <> 'string' or privado.alunos_aparar(v_forma #>> '{}') = '' then
        perform privado.recusar('Há uma forma de pagamento sem nome.');
      end if;
      v_formas := v_formas || to_jsonb(privado.alunos_aparar(v_forma #>> '{}'));
    end loop;
    select f.nome into v_repetida
      from jsonb_array_elements_text(v_formas) with ordinality as f(nome, n)
     where exists (
       select 1 from jsonb_array_elements_text(v_formas) with ordinality as g(nome, n)
        where g.n < f.n and privado.configuracoes_chave(g.nome) = privado.configuracoes_chave(f.nome))
     order by f.n
     limit 1;
    if v_repetida is not null then
      perform privado.recusar(format('A forma de pagamento "%s" aparece duas vezes.', v_repetida));
    end if;
    v_novo.formas_pagamento := v_formas;
  end if;

  -- Criterios de desempate: o calculo do torneio conhece cada um pelo nome,
  -- entao a lista so pode mudar de ordem.
  if p_criterios_desempate is not null then
    if jsonb_typeof(p_criterios_desempate) is distinct from 'array'
       or jsonb_array_length(p_criterios_desempate) <> jsonb_array_length(v_atual.criterios_desempate) then
      perform privado.recusar('Os critérios de desempate só podem mudar de ordem.');
    end if;
    if (select count(distinct privado.configuracoes_chave(e))
          from jsonb_array_elements_text(p_criterios_desempate) e) <> jsonb_array_length(p_criterios_desempate)
       or exists (select 1 from jsonb_array_elements(p_criterios_desempate) e
                   where not v_atual.criterios_desempate @> jsonb_build_array(e)) then
      perform privado.recusar('Os critérios de desempate só podem mudar de ordem.');
    end if;
    v_novo.criterios_desempate := p_criterios_desempate;
  end if;

  -- Salvar sem mudar nada nao grava historico (o gatilho de auditoria ignora).
  update public.configuracoes c set
    validade_reposicao_meses = v_novo.validade_reposicao_meses,
    prazo_pagamento_reserva_horas = v_novo.prazo_pagamento_reserva_horas,
    liberar_reserva_automaticamente = v_novo.liberar_reserva_automaticamente,
    semanas_geradas_a_frente = v_novo.semanas_geradas_a_frente,
    bloquear_professor_em_duas_aulas = v_novo.bloquear_professor_em_duas_aulas,
    pontos_vitoria = v_novo.pontos_vitoria,
    pontos_derrota = v_novo.pontos_derrota,
    torneio_conta_para_ranking = v_novo.torneio_conta_para_ranking,
    classificados_por_grupo = v_novo.classificados_por_grupo,
    criterios_desempate = v_novo.criterios_desempate,
    formas_pagamento = v_novo.formas_pagamento,
    prazo_pagamento_consumo_dias = v_novo.prazo_pagamento_consumo_dias,
    preco_locacao_hora = v_novo.preco_locacao_hora,
    preco_paredao_hora = v_novo.preco_paredao_hora
  where c.id = 1;
end;
$$;

-- Siglas de reposicao (Hipotese H1). Inclui uma sigla nova no fim da lista.
create function public.incluir_sigla(
  p_codigo text,
  p_nome text,
  p_descricao text default '',
  p_gera_credito boolean default null,
  p_aplica_a text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_siglas jsonb;
  v_sigla jsonb;
begin
  perform privado.iniciar_operacao('Incluir sigla de reposição', 'configuracoes');
  select siglas into v_siglas from public.configuracoes where id = 1 for update;
  v_sigla := privado.configuracoes_normalizar_sigla(jsonb_build_object(
    'codigo', p_codigo, 'nome', p_nome, 'descricao', p_descricao,
    'geraCredito', p_gera_credito, 'aplicaA', p_aplica_a));
  perform privado.configuracoes_validar_sigla(v_sigla, v_siglas);
  update public.configuracoes set siglas = v_siglas || jsonb_build_array(v_sigla) where id = 1;
end;
$$;

-- Edita nome, descricao, credito e onde vale. O codigo so muda enquanto
-- ninguem o usou (aulas e creditos antigos guardam o codigo como texto).
-- `p_sigla` = { codigo, nome, descricao, geraCredito, aplicaA }.
create function public.editar_sigla(p_codigo_atual text, p_sigla jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_siglas jsonb;
  v_atual jsonb;
  v_posicao bigint;
  v_sigla jsonb;
  v_outras jsonb;
begin
  perform privado.iniciar_operacao('Editar sigla de reposição', 'configuracoes');
  select siglas into v_siglas from public.configuracoes where id = 1 for update;
  select s, n into v_atual, v_posicao
    from jsonb_array_elements(v_siglas) with ordinality as x(s, n)
   where s ->> 'codigo' = p_codigo_atual
   order by n
   limit 1;
  if v_atual is null then
    perform privado.recusar('Sigla não encontrada.');
  end if;

  -- Mantem o que a tela nao edita (ex.: "desativada").
  v_sigla := v_atual || privado.configuracoes_normalizar_sigla(coalesce(p_sigla, '{}'::jsonb));
  if v_sigla ->> 'codigo' <> v_atual ->> 'codigo'
     and privado.configuracoes_usos_da_sigla(v_atual ->> 'codigo') > 0 then
    perform privado.recusar(format(
      'A sigla %s já foi usada em aulas ou créditos de reposição, por isso o código não pode mudar. Crie uma sigla nova e desative esta.',
      v_atual ->> 'codigo'));
  end if;
  select coalesce(jsonb_agg(s order by n), '[]'::jsonb) into v_outras
    from jsonb_array_elements(v_siglas) with ordinality as x(s, n)
   where n <> v_posicao;
  perform privado.configuracoes_validar_sigla(v_sigla, v_outras);

  update public.configuracoes
     set siglas = (select jsonb_agg(case when n = v_posicao then v_sigla else s end order by n)
                     from jsonb_array_elements(v_siglas) with ordinality as x(s, n))
   where id = 1;
end;
$$;

-- Desativa ou reativa uma sigla: sai (ou volta) dos formularios novos; o que
-- ja foi gravado com ela continua valendo.
create function privado.configuracoes_situacao_da_sigla(p_codigo text, p_desativada boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_siglas jsonb;
begin
  select siglas into v_siglas from public.configuracoes where id = 1 for update;
  if not exists (select 1 from jsonb_array_elements(v_siglas) s where s ->> 'codigo' = p_codigo) then
    perform privado.recusar('Sigla não encontrada.');
  end if;
  update public.configuracoes
     set siglas = (select jsonb_agg(
                     case when s ->> 'codigo' = p_codigo
                          then s || jsonb_build_object('desativada', p_desativada) else s end
                     order by n)
                     from jsonb_array_elements(v_siglas) with ordinality as x(s, n))
   where id = 1;
end;
$$;

create function public.desativar_sigla(p_codigo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform privado.iniciar_operacao('Desativar sigla de reposição', 'configuracoes');
  perform privado.configuracoes_situacao_da_sigla(p_codigo, true);
end;
$$;

create function public.reativar_sigla(p_codigo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform privado.iniciar_operacao('Reativar sigla de reposição', 'configuracoes');
  perform privado.configuracoes_situacao_da_sigla(p_codigo, false);
end;
$$;

-- Planos (Hipoteses H2 e H3). Inclui um plano no catalogo. Devolve o id.
create function public.incluir_plano(
  p_nome text,
  p_tipo text,
  p_valor_mensal numeric,
  p_aulas_por_semana numeric,
  p_duracao_minutos numeric,
  p_tabela text,
  p_ativo boolean default true
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nome text := privado.alunos_aparar(p_nome);
  v_id text;
begin
  perform privado.iniciar_operacao('Incluir plano', 'configuracoes');
  perform privado.configuracoes_validar_plano(null, v_nome, p_tipo, p_valor_mensal,
    p_aulas_por_semana, p_duracao_minutos, p_tabela, p_ativo);
  insert into public.planos (nome, tipo, valor_mensal, aulas_por_semana, duracao_minutos, tabela, ativo)
  values (v_nome, p_tipo, round(p_valor_mensal, 2), p_aulas_por_semana::smallint,
          p_duracao_minutos::smallint, p_tabela, p_ativo)
  returning id into v_id;
  return v_id;
end;
$$;

-- Mudar o valor de um plano nao muda as matriculas (cada aluno mantem o valor
-- combinado, H3). O tipo so muda enquanto o plano nao tem matricula.
-- Devolve o id do plano.
create function public.editar_plano(
  p_id text,
  p_nome text,
  p_tipo text,
  p_valor_mensal numeric,
  p_aulas_por_semana numeric,
  p_duracao_minutos numeric,
  p_tabela text,
  p_ativo boolean
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual public.planos;
  v_nome text := privado.alunos_aparar(p_nome);
begin
  perform privado.iniciar_operacao('Editar plano', 'configuracoes');
  select * into v_atual from public.planos where id = p_id for update;
  if not found then
    perform privado.recusar('Plano não encontrado.');
  end if;
  perform privado.configuracoes_validar_plano(v_atual.id, v_nome, p_tipo, p_valor_mensal,
    p_aulas_por_semana, p_duracao_minutos, p_tabela, p_ativo);
  if p_tipo <> v_atual.tipo and exists (select 1 from public.matriculas where plano_id = v_atual.id) then
    perform privado.recusar(format(
      'O plano "%s" já tem matrículas, por isso o tipo não pode mudar. Crie um plano novo e desative este.',
      v_atual.nome));
  end if;

  -- Sem mudanca, o gatilho de auditoria nao grava nada.
  update public.planos set
    nome = v_nome,
    tipo = p_tipo,
    valor_mensal = round(p_valor_mensal, 2),
    aulas_por_semana = p_aulas_por_semana::smallint,
    duracao_minutos = p_duracao_minutos::smallint,
    tabela = p_tabela,
    ativo = p_ativo
  where id = v_atual.id;
  return v_atual.id;
end;
$$;

-- Apaga um plano criado por engano. Plano que aparece em alguma matricula
-- (vigente ou no historico) nao se apaga: desativa-se. Sem retorno.
create function public.apagar_plano(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plano public.planos;
  v_vigentes integer;
  v_todas integer;
begin
  perform privado.iniciar_operacao('Apagar plano', 'configuracoes');
  select * into v_plano from public.planos where id = p_id for update;
  if not found then
    perform privado.recusar('Plano não encontrado.');
  end if;
  select count(*) filter (where fim is null or fim >= privado.hoje()), count(*)
    into v_vigentes, v_todas
    from public.matriculas where plano_id = v_plano.id;
  if v_vigentes > 0 then
    perform privado.recusar(format(
      'O plano "%s" tem %s matrícula(s) vigente(s) e não pode ser apagado. Desative-o: ele deixa de ser oferecido e quem já tem continua com ele.',
      v_plano.nome, v_vigentes));
  end if;
  if v_todas > 0 then
    perform privado.recusar(format(
      'O plano "%s" aparece no histórico de %s matrícula(s) e não pode ser apagado. Desative-o para que deixe de ser oferecido.',
      v_plano.nome, v_todas));
  end if;
  delete from public.planos where id = v_plano.id;
end;
$$;

-- Permissoes dos perfis (Hipotese H9). Tira repeticoes e modulos desconhecidos,
-- poe na ordem padrao e confere: contas a pagar exigem o Financeiro; o dono
-- nunca perde as Configuracoes; so o dono tem as Configuracoes. Sem retorno.
create function public.alterar_permissoes(p_permissoes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_modulos text[] := array['painel', 'agenda', 'alunos', 'professores', 'financeiro',
    'financeiro_pagar', 'estoque', 'ranking', 'configuracoes', 'historico'];
  v_perfil text;
  v_nome_perfil text;
  v_lista jsonb;
  v_permissoes jsonb := '{}'::jsonb;
begin
  perform privado.iniciar_operacao('Alterar permissões', 'configuracoes');
  perform 1 from public.configuracoes where id = 1 for update;

  foreach v_perfil in array array['dono', 'recepcao', 'professor'] loop
    select coalesce(jsonb_agg(m order by n), '[]'::jsonb) into v_lista
      from unnest(v_modulos) with ordinality as x(m, n)
     where jsonb_typeof(p_permissoes -> v_perfil) = 'array'
       and (p_permissoes -> v_perfil) ? m;
    v_nome_perfil := case v_perfil when 'dono' then 'Dono' when 'recepcao' then 'Recepção' else 'Professor' end;
    if v_lista ? 'financeiro_pagar' and not v_lista ? 'financeiro' then
      perform privado.recusar(format(
        'Para ver as contas a pagar, o perfil %s precisa ter acesso ao Financeiro.', v_nome_perfil));
    end if;
    v_permissoes := v_permissoes || jsonb_build_object(v_perfil, v_lista);
  end loop;

  if not (v_permissoes -> 'dono') ? 'configuracoes' then
    perform privado.recusar('O dono não pode tirar o próprio acesso às Configurações.');
  end if;
  if (v_permissoes -> 'recepcao') ? 'configuracoes' or (v_permissoes -> 'professor') ? 'configuracoes' then
    perform privado.recusar('Só o perfil Dono pode ter acesso às Configurações.');
  end if;

  update public.configuracoes set permissoes = v_permissoes where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Comentarios (qualquer colaborador ativo; cada um edita e apaga o seu)
-- ---------------------------------------------------------------------------

-- Comentar nao depende de modulo: basta ser colaborador ativo (mesma regra
-- da politica de `comentarios`). Marca o nome da operacao na auditoria.
create function privado.alunos_iniciar_comentario(p_nome text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not privado.eh_colaborador() then
    raise exception using
      errcode = '42501',
      message = 'Seu perfil não tem permissão para esta operação.';
  end if;
  perform set_config('app.operacao', p_nome, true);
end;
$$;

-- Autor e nome do autor vem de quem esta logado (nao da tela). Devolve o id.
create function public.adicionar_comentario(p_entidade text, p_entidade_id text, p_texto text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_texto text := privado.alunos_aparar(p_texto);
  v_id text;
begin
  perform privado.alunos_iniciar_comentario('Adicionar comentário');
  if v_texto = '' then
    perform privado.recusar('Escreva o comentário antes de salvar.');
  end if;
  insert into public.comentarios (entidade, entidade_id, texto, autor_id, autor_nome)
  select p_entidade, p_entidade_id, v_texto, c.id, c.nome
    from public.colaboradores c
   where c.id = (select auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- So quem escreveu edita. Grava a hora da edicao. Devolve o id.
create function public.editar_comentario(p_id text, p_texto text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comentario public.comentarios;
  v_texto text := privado.alunos_aparar(p_texto);
begin
  perform privado.alunos_iniciar_comentario('Editar comentário');
  select * into v_comentario from public.comentarios where id = p_id;
  if not found then
    perform privado.recusar('Comentário não encontrado.');
  end if;
  if v_comentario.autor_id is distinct from (select auth.uid()) then
    perform privado.recusar('Só quem escreveu o comentário pode editá-lo.');
  end if;
  if v_texto = '' then
    perform privado.recusar('O comentário não pode ficar vazio.');
  end if;
  update public.comentarios set texto = v_texto, editado_em = now() where id = p_id;
  return p_id;
end;
$$;

-- So quem escreveu apaga (a auditoria guarda o texto). Sem retorno.
create function public.apagar_comentario(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comentario public.comentarios;
begin
  perform privado.alunos_iniciar_comentario('Apagar comentário');
  select * into v_comentario from public.comentarios where id = p_id;
  if not found then
    perform privado.recusar('Comentário não encontrado.');
  end if;
  if v_comentario.autor_id is distinct from (select auth.uid()) then
    perform privado.recusar('Só quem escreveu o comentário pode apagá-lo.');
  end if;
  delete from public.comentarios where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Quem pode chamar: so usuarios logados (a RLS e as funcoes conferem o resto)
-- ---------------------------------------------------------------------------
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname = 'privado' and (p.proname like 'alunos\_%' or p.proname like 'configuracoes\_%'))
        or (n.nspname = 'public' and p.proname in (
              'criar_matricula', 'trocar_plano', 'encerrar_matricula', 'cancelar_matricula_agendada',
              'congelar_plano', 'reativar_plano', 'inativar_aluno',
              'salvar_parametros', 'incluir_sigla', 'editar_sigla', 'desativar_sigla', 'reativar_sigla',
              'incluir_plano', 'editar_plano', 'apagar_plano', 'alterar_permissoes',
              'adicionar_comentario', 'editar_comentario', 'apagar_comentario'))
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
