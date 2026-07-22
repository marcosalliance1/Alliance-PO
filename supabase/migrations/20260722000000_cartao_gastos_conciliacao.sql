create table public.cartao_gastos_geral (
  id uuid primary key default gen_random_uuid(),
  portador text not null,
  aba_origem text not null,
  numero_cartao_mascarado text,
  banco text,
  fatura_data_inicio date,
  fatura_data_fim date,
  fatura_vencimento date,
  item_comprado text,
  valor numeric not null,
  data date not null,
  descricao text,
  natureza_qual_casa text,
  jotform text,
  eh_comercial boolean not null default false,
  chave_natural text not null unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.cartao_gastos_comercial (
  id uuid primary key default gen_random_uuid(),
  planilha_aba text not null,
  segmento text not null,
  projeto text not null,
  categoria text,
  reuniao text,
  data date not null,
  valor numeric not null,
  fornecedor text,
  responsavel text,
  portador_raw text,
  portador text,
  fora_do_cartao boolean not null default false,
  chave_natural text not null unique,
  status_conciliacao text not null default 'nao_processado'
    check (status_conciliacao in ('conciliado','divergencia_data','cartao_divergente','nao_encontrado','ambiguo','fora_do_cartao','nao_processado')),
  match_geral_id uuid references public.cartao_gastos_geral(id),
  dif_dias integer,
  revisado_manualmente boolean not null default false,
  observacao_revisao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index on public.cartao_gastos_comercial (status_conciliacao);
create index on public.cartao_gastos_comercial (projeto);
create index on public.cartao_gastos_comercial (portador);
