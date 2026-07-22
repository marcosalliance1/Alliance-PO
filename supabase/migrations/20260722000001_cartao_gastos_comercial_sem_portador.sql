alter table public.cartao_gastos_comercial
  add column if not exists portador_nao_informado boolean not null default false;

alter table public.cartao_gastos_comercial
  drop constraint if exists cartao_gastos_comercial_status_conciliacao_check;

alter table public.cartao_gastos_comercial
  add constraint cartao_gastos_comercial_status_conciliacao_check
  check (status_conciliacao in ('conciliado','divergencia_data','cartao_divergente','nao_encontrado','ambiguo','fora_do_cartao','sem_portador','nao_processado'));
