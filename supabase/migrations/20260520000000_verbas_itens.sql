create table if not exists verbas_itens (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos(id) on delete cascade,
  projeto_nome    text not null,
  segmento        text not null,
  categoria       text not null,
  sub_categoria   text not null default '',
  item            text not null default '',
  valor_orcado    numeric not null default 0,
  sincronizado_em timestamptz not null default now()
);

create index if not exists verbas_itens_projeto_id_idx on verbas_itens(projeto_id);
create index if not exists verbas_itens_segmento_idx   on verbas_itens(segmento);
create index if not exists verbas_itens_categoria_idx  on verbas_itens(categoria);
