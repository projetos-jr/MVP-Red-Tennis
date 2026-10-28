-- Tira `eh_colaborador()` do schema exposto pela API (ela nao precisa ser
-- chamada via /rpc; so as politicas usam) e cobre as FKs sem indice.
create schema if not exists privado;
grant usage on schema privado to authenticated;
alter function public.eh_colaborador() set schema privado;

create index aulas_quadra_idx on public.aulas (quadra_id);
create index colaboradores_professor_idx on public.colaboradores (professor_id);
