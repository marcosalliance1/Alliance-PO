-- Espelho da aba "ACOMP. ATENDIMENTO" de cada P.O.: grade (valores + formatação) lida da planilha pelo
-- sync_pos.js (conta de serviço). Tabela própria — e não coluna em projetos — porque o app carrega
-- projetos.* inteiro em toda tela e a grade média tem ~22 KB. Só leitura para o app; quem grava é a
-- service_role (sync). Rollback: drop table projeto_acomp;
create table if not exists projeto_acomp (
  projeto_id    uuid primary key references projetos(id) on delete cascade,
  sheet_id      text   not null,
  gid           bigint not null,
  titulo_aba    text,
  grade         jsonb  not null,
  bytes         int,
  atualizado_em timestamptz not null default now()
);

comment on table projeto_acomp is 'Espelho da aba ACOMP. ATENDIMENTO (grade com formatação). Gravada só pelo sync_pos.js; leitura aberta ao app.';

alter table projeto_acomp enable row level security;

create policy "leitura_projeto_acomp" on projeto_acomp
  for select to anon, authenticated using (true);
-- sem policy de insert/update/delete: só a service_role (que ignora RLS) grava.
