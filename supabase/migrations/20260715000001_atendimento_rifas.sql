-- Módulo Atendimento > Rifas — Fase 1
-- Observação: o prompt original referenciava uma tabela `centro_custo(id uuid)` que não
-- existe neste projeto. O equivalente real é `dimensao_projetos` (id integer, já usado
-- pelo módulo Marketing). Os FKs abaixo apontam para ela.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- ── Tabelas principais ───────────────────────────────────────────────────────

create table if not exists rifas (
  id                  uuid primary key default gen_random_uuid(),
  turma               text not null,
  dimensao_projeto_id integer references dimensao_projetos(id),
  match_confianca     real,              -- score 0-1 do match automático (similaridade)
  match_manual        boolean not null default false, -- true quando veio de rifas_turma_overrides
  edicao              text,              -- ex "3/7"
  formacao            text,
  ano_formatura       int,
  atribuido_raw       text,              -- coluna ATRIBUÍDO? — dado sujo, não tipar
  dia_vencimento      date,
  premio_descricao    text,
  valor_boleto        numeric(10,2),
  situacao            text check (situacao in ('EM ANDAMENTO','SORTEADA','FECHADA','NÃO VAI TER')),
  sheet_row_number    int,
  sheet_row_hash      text,              -- snapshot da linha da planilha na última sync (ver nota de sincronização)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists rifas_turma_idx on rifas(turma);
create index if not exists rifas_dimensao_projeto_id_idx on rifas(dimensao_projeto_id);

create table if not exists rifas_ganhadores (
  id                uuid primary key default gen_random_uuid(),
  rifa_id           uuid references rifas(id) on delete set null,
  turma             text not null,
  responsavel       text,
  tipo              text,              -- lista aberta: 'Rifas do Projeto', 'Sorteio Comissão', 'Sorteio Comercial', 'Torneio Personalidades', ...
  premio_descricao  text,
  data_sorteio      date,
  sorteado          boolean not null default false,
  nome_ganhador     text,
  contato           text,
  contato_feito     boolean not null default false,
  premio_entregue   text,              -- texto livre (SIM/NÃO/"Esperando retirada"/etc)
  financeiro        text,
  obs               text,
  sheet_row_number  int,
  sheet_row_hash    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists rifas_ganhadores_rifa_id_idx on rifas_ganhadores(rifa_id);
create index if not exists rifas_ganhadores_turma_idx on rifas_ganhadores(turma);

create table if not exists rifas_compras (
  id                    uuid primary key default gen_random_uuid(),
  ganhador_id           uuid not null references rifas_ganhadores(id) on delete cascade,
  endereco              text,
  informacoes           text,
  site                  text,
  valor                 numeric(10,2),
  status                text check (status in ('Comprado','Não comprado')),
  data_compra           date,
  data_entrega_raw      text,          -- dado sujo, não tipar
  nome_cartao           text,
  preenchido_planilha   boolean not null default false,
  sheet_row_number      int,
  sheet_row_hash        text,
  created_at            timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists rifas_compras_ganhador_id_idx on rifas_compras(ganhador_id);

-- ── Vínculos manuais turma ↔ dimensao_projetos (têm prioridade sobre o match automático) ──

create table if not exists rifas_turma_overrides (
  turma               text primary key,
  dimensao_projeto_id integer not null references dimensao_projetos(id),
  criado_em           timestamptz not null default now()
);

-- ── Auditoria de sincronização ───────────────────────────────────────────────

create table if not exists rifas_sync_conflitos (
  id             bigserial primary key,
  tabela_origem  text not null check (tabela_origem in ('rifas','rifas_ganhadores','rifas_compras')),
  registro_id    uuid not null,
  campo          text not null,
  valor_alliance text,
  valor_sheet    text,
  resolvido      boolean not null default false,
  detectado_em   timestamptz not null default now()
);

create index if not exists rifas_sync_conflitos_pendentes_idx on rifas_sync_conflitos(resolvido) where not resolvido;

create table if not exists rifas_sync_log (
  id                     bigserial primary key,
  executado_em           timestamptz not null default now(),
  registros_criados      int not null default 0,
  registros_atualizados  int not null default 0,
  conflitos_detectados   int not null default 0,
  erro                   text
);

-- ── Triggers de updated_at ───────────────────────────────────────────────────

create trigger rifas_set_updated_at before update on rifas
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger rifas_ganhadores_set_updated_at before update on rifas_ganhadores
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger rifas_compras_set_updated_at before update on rifas_compras
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── Matching turma ↔ dimensao_projetos por similaridade de texto ────────────
-- Reaproveita a normalização usada em marketing_chave_normalizada (tira acento,
-- maiúsculas, remove tudo que não é letra/número) e usa pg_trgm para achar o
-- nome_projeto mais parecido.

create or replace function rifas_normalizar_turma(nome text) returns text
language sql immutable as $$
  select nullif(
    regexp_replace(
      upper(extensions.unaccent(trim(coalesce(nome, '')))),
      '[^A-Z0-9]+', '', 'g'
    ),
    ''
  );
$$;

create or replace function rifas_sugerir_match(p_turma text)
returns table(dimensao_projeto_id integer, nome_projeto text, score real)
language sql stable as $$
  select
    dp.id,
    dp.nome_projeto,
    greatest(
      extensions.similarity(rifas_normalizar_turma(p_turma), rifas_normalizar_turma(dp.nome_projeto)),
      extensions.word_similarity(rifas_normalizar_turma(p_turma), rifas_normalizar_turma(dp.nome_projeto))
    )::real as score
  from dimensao_projetos dp
  order by score desc
  limit 1;
$$;

-- Recalcula dimensao_projeto_id/match_confianca de todas as rifas: overrides manuais
-- sempre vencem; senão usa a melhor sugestão de rifas_sugerir_match acima do limiar.
create or replace function rifas_recalcular_matches(p_limiar real default 0.6) returns void
language plpgsql as $$
declare
  r record;
  ov integer;
  sug record;
begin
  for r in select id, turma from rifas loop
    select dimensao_projeto_id into ov from rifas_turma_overrides where turma = r.turma;

    if ov is not null then
      update rifas set dimensao_projeto_id = ov, match_confianca = 1.0, match_manual = true where id = r.id;
    else
      select * into sug from rifas_sugerir_match(r.turma);
      if sug.score >= p_limiar then
        update rifas set dimensao_projeto_id = sug.dimensao_projeto_id, match_confianca = sug.score, match_manual = false where id = r.id;
      else
        update rifas set dimensao_projeto_id = null, match_confianca = sug.score, match_manual = false where id = r.id;
      end if;
    end if;
  end loop;
end;
$$;
