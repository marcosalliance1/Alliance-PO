-- Camada de dados para sincronização do board "Marketing" do monday.com (board_id 8225814416)

create table if not exists marketing_grupos (
  group_id    text primary key,
  nome        text not null,
  is_arquivo  boolean not null default false
);

insert into marketing_grupos (group_id, nome, is_arquivo) values
  ('novo_grupo_mkm5kpys', 'LACROU 2025', true),
  ('group_mkzawvhz',      'LACROU 2026', true),
  ('group_mkswp5en',      'PAUTA DO DIA', false),
  ('group_mm25f9dr',      'ENSINO FUNDAMENTAL', false),
  ('novo_grupo_mkm56c8j', 'ENSINO MÉDIO', false),
  ('novo_grupo_mkm5ma05', 'ENSINO SUPERIOR', false),
  ('novo_grupo_mkm5k53d', 'INSTITUCIONAL', false),
  ('novo_grupo_mkm5gh0f', 'SOLICITAÇÕES - PRODUÇÃO&COMERCIAL', false),
  ('novo_grupo_mkm56zta', 'PRODUTOS BABADOS', false)
on conflict (group_id) do update set
  nome       = excluded.nome,
  is_arquivo = excluded.is_arquivo;

create table if not exists marketing_demandas (
  id                bigint primary key,
  group_id          text references marketing_grupos(group_id),
  nome              text not null,
  cliente_extraido  text,
  status            text not null,
  status_is_done    boolean not null default false,
  prioridade        text,
  data_inicio       date,
  data_fim          date,
  monday_updated_at timestamptz,
  synced_at         timestamptz not null default now()
);

create index if not exists marketing_demandas_status_idx   on marketing_demandas(status);
create index if not exists marketing_demandas_group_id_idx on marketing_demandas(group_id);
create index if not exists marketing_demandas_data_fim_idx on marketing_demandas(data_fim);

create table if not exists marketing_demandas_responsaveis (
  item_id     bigint not null references marketing_demandas(id) on delete cascade,
  person_id   bigint not null,
  person_name text not null,
  primary key (item_id, person_id)
);

create index if not exists marketing_demandas_responsaveis_person_id_idx on marketing_demandas_responsaveis(person_id);
