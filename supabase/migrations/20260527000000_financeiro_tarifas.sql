create table financeiro_tarifas (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references financeiro_uploads(id) on delete cascade,
  fantasia_empresa text,
  desc_conta_gerencial text,
  desc_centro_custo text,
  d_movimento date,
  d_vencimento date,
  d_competencia date,
  v_lancamento numeric,
  origem text,
  razao_social text
);
