-- Aba "Acompanhamento" do módulo comercial: registro único agregado sincronizado
-- da planilha "Acompanhamento Comercial" (metas, comissão e captação por RCA).
-- Mesmo padrão de `configuracoes`: id fixo + blob jsonb, sem tabela por linha.
create table if not exists acompanhamento_comercial (
  id text primary key default 'unico',
  spreadsheet_id text,
  data jsonb not null default '{}'::jsonb,
  sincronizado_em timestamptz
);

alter table acompanhamento_comercial enable row level security;

create policy allow_all_acompanhamento_comercial
  on acompanhamento_comercial
  for all
  to public
  using (true)
  with check (true);
