create table if not exists financeiro_boletim (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references financeiro_uploads(id) on delete cascade,
  desc_conta_gerencial text not null default '',
  fantasia_cliente_fornecedor text not null default '',
  d_vencimento date,
  d_liquidacao date,
  d_competencia date,
  desc_centro_custo text not null default '',
  v_original numeric not null default 0,
  v_lancamento numeric not null default 0,
  tipo text not null,
  situacao text not null
);
