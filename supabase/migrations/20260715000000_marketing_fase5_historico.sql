-- Fase 5: tempo de execução e histórico de status do board Marketing.

alter table marketing_demandas
  add column if not exists created_at timestamptz;

create table if not exists marketing_status_historico (
  id                bigserial primary key,
  item_id           bigint not null references marketing_demandas(id) on delete cascade,
  status_anterior   text,
  status_novo       text not null,
  mudou_em          timestamptz not null default now()
);

create index if not exists marketing_status_historico_item_id_idx on marketing_status_historico(item_id);
