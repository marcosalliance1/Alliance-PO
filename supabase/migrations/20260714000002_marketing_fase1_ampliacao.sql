-- Fase 1 do plano de ampliação do sync de Marketing: novas colunas, subitens e
-- mapeamento com a dimensão de centro de custo já usada pelo módulo financeiro.
-- Não remove nem altera dados existentes de marketing_demandas.

alter table marketing_demandas
  add column if not exists turma               text,
  add column if not exists solicitante          text,
  add column if not exists link_demandas_texto  text,
  add column if not exists tem_arquivo          boolean not null default false;

create table if not exists marketing_subitens (
  id                bigint primary key,
  item_id           bigint not null references marketing_demandas(id) on delete cascade,
  nome              text not null,
  owner_person_id   bigint,
  owner_person_name text,
  status            text,
  status_is_done    boolean not null default false,
  data              date
);

create index if not exists marketing_subitens_item_id_idx on marketing_subitens(item_id);

-- Mapeamento com dimensao_projetos (mesma tabela e mesma lógica de match exato do
-- financeiro: trim + igualdade de string — ver src/pages/Financeiro.tsx, dimMapT).
-- Diferença necessária: dimensao_projetos.nome_projeto sempre inclui o ano
-- (ex: "CMMG 82 2030"), enquanto cliente_extraido do marketing nunca inclui o ano
-- (ex: "CMMG 82" / "CMMG82"). Um match exato char-a-char nunca bateria, então a
-- chave de comparação normaliza os dois lados do mesmo jeito: remove o ano final
-- de 4 dígitos (só existe do lado da dimensão) e remove todos os espaços — sem
-- nenhuma outra heurística de similaridade (sem fuzzy match).
create or replace function marketing_chave_normalizada(nome text) returns text
language sql immutable as $$
  select nullif(
    regexp_replace(
      upper(trim(regexp_replace(coalesce(nome, ''), '\s*\d{4}$', ''))),
      '\s+', '', 'g'
    ),
    ''
  );
$$;

create or replace view marketing_demandas_com_dimensao as
select
  d.*,
  dim.nome_projeto  as dimensao_nome_projeto,
  dim.ensino        as dimensao_ensino,
  dim.instituicao   as dimensao_instituicao,
  (dim.nome_projeto is not null) as match_dimensao
from marketing_demandas d
left join dimensao_projetos dim
  on marketing_chave_normalizada(d.cliente_extraido) = marketing_chave_normalizada(dim.nome_projeto);
