-- Módulo Atendimento — painel da equipe (substitui as planilhas do Atendimento).
-- Fase 1: uma tabela genérica de registros por categoria (Demandas, Turmas, Rescisão,
-- Alteração de Plano, Cálculo de Rescisão, Achados & Perdidos, Aniversários, Calendário,
-- Eventos, Guias, Mensagens) + bucket privado para anexos (fotos/termos).
--
-- Por que genérica: o painel desenhado pela equipe é dirigido por configuração de campos
-- (cada aba = lista de campos). Os campos ficam em `dados` (jsonb); colunas comuns usadas
-- em filtro/relatório (categoria, projeto, status, datas) ficam em colunas próprias.
-- `extras` guarda as colunas da planilha original que não existem no painel (migração
-- sem perda de informação).
--
-- Tabela e bucket NOVOS e independentes: não altera nenhuma tabela existente.
-- Acesso: mesmo padrão atual do app (RLS ligada + policy aberta), a ser fechado quando
-- o login por e-mail @alliancebh.com.br entrar. A aba Pagamento (CPF/PIX) NÃO usa esta
-- tabela nesta fase e só entra depois do login.
--
-- Rollback:
--   drop table if exists atendimento_registros;
--   delete from storage.objects where bucket_id = 'atendimento-anexos';
--   delete from storage.buckets where id = 'atendimento-anexos';
--   drop policy if exists "Upload anexos atendimento"   on storage.objects;
--   drop policy if exists "Leitura anexos atendimento"  on storage.objects;
--   drop policy if exists "Exclusao anexos atendimento" on storage.objects;

create table if not exists atendimento_registros (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null check (categoria in (
                  'demandas','turmas','rescisao','alteracaoplano','calculoRescisao',
                  'achados','aniversarios','calendario','eventos','guias','mensagens',
                  'config')),                -- config: preferências do painel (ex.: link da Google Agenda)
  projeto_id    uuid references projetos(id) on delete set null,
  turma_nome    text,                       -- fallback quando a turma não tem P.O. (ou "Geral")
  status        text,
  dados         jsonb not null default '{}'::jsonb,
  extras        jsonb not null default '{}'::jsonb,
  fixado        boolean not null default false,
  criado_por    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluido_em  timestamptz
);

create index if not exists atendimento_registros_categoria_idx on atendimento_registros (categoria);
create index if not exists atendimento_registros_projeto_idx   on atendimento_registros (projeto_id);

-- Um perfil de turma por P.O.
create unique index if not exists atendimento_registros_turma_unica
  on atendimento_registros (projeto_id) where categoria = 'turmas' and projeto_id is not null;

create or replace function atendimento_registros_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists atendimento_registros_touch on atendimento_registros;
create trigger atendimento_registros_touch before update on atendimento_registros
  for each row execute function atendimento_registros_touch();

comment on table atendimento_registros is 'Painel do Atendimento (PO V2): registros por categoria, campos em dados jsonb.';

alter table atendimento_registros enable row level security;

grant select, insert, update, delete on atendimento_registros to anon, authenticated, service_role;

drop policy if exists "Acesso público atendimento_registros" on atendimento_registros;
create policy "Acesso público atendimento_registros"
  on atendimento_registros for all using (true) with check (true);

-- ── Storage: bucket privado para anexos ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('atendimento-anexos', 'atendimento-anexos', false)
on conflict (id) do nothing;

drop policy if exists "Upload anexos atendimento"   on storage.objects;
drop policy if exists "Leitura anexos atendimento"  on storage.objects;
drop policy if exists "Exclusao anexos atendimento" on storage.objects;

create policy "Upload anexos atendimento"
  on storage.objects for insert
  with check (bucket_id = 'atendimento-anexos');

create policy "Leitura anexos atendimento"
  on storage.objects for select
  using (bucket_id = 'atendimento-anexos');

-- Sem esta policy o storage.remove() falha calado e o arquivo fica órfão.
create policy "Exclusao anexos atendimento"
  on storage.objects for delete
  using (bucket_id = 'atendimento-anexos');
