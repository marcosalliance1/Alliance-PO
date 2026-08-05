-- Carga histórica pré-Everest-MySQL (dados anteriores a 04/01/2023, quando a carga do
-- Data Warehouse do Everest começa). Duas tabelas fixas + views de união, pra manter
-- financeiro_cap e financeiro_boletim como fonte "viva" sem misturar dado congelado.
--
-- financeiro_cap_historico: carregada de "tabela fato CAP.xlsx" (aba Banco Dados, 2021+2022).
--   Exclui desc_conta_gerencial = 'TARIFAS BANCARIAS', mesma regra do parseCAPArquivo
--   (src/utils/parseFinanceiro.ts) — tarifa tem fonte própria no Boletim, evita duplicar.
--
-- financeiro_boletim_historico: carregada de "Boletim_Financeiro_Consolidado.xlsx"
--   (abas 2021 e 2022), mesmas regras de exclusão/classificação do parseBoletimArquivo.

create table public.financeiro_cap_historico (
  id uuid primary key default gen_random_uuid(),
  fantasia_fornecedor text,
  desc_conta_gerencial text,
  desc_centro_custo text,
  d_vencimento date,
  d_competencia date,
  v_titulo numeric,
  situacao text,
  portador text,
  dias_atraso integer,
  carregado_em timestamptz default now()
);

create table public.financeiro_boletim_historico (
  id uuid primary key default gen_random_uuid(),
  desc_conta_gerencial text,
  fantasia_empresa text,
  fantasia_cliente_fornecedor text,
  desc_centro_custo text,
  d_vencimento date,
  d_liquidacao date,
  d_competencia date,
  v_original numeric,
  v_lancamento numeric,
  tipo text,
  situacao text,
  carregado_em timestamptz default now()
);

create view public.financeiro_cap_completo as
  select id, fantasia_fornecedor, desc_conta_gerencial, desc_centro_custo,
         d_vencimento, d_competencia, v_titulo, situacao, portador, dias_atraso,
         'live'::text as fonte
  from public.financeiro_cap
  union all
  select id, fantasia_fornecedor, desc_conta_gerencial, desc_centro_custo,
         d_vencimento, d_competencia, v_titulo, situacao, portador, dias_atraso,
         'historico'::text as fonte
  from public.financeiro_cap_historico;

create view public.financeiro_boletim_completo as
  select id, desc_conta_gerencial, fantasia_empresa, fantasia_cliente_fornecedor,
         desc_centro_custo, d_vencimento, d_liquidacao, d_competencia,
         v_original, v_lancamento, tipo, situacao,
         'live'::text as fonte
  from public.financeiro_boletim
  union all
  select id, desc_conta_gerencial, fantasia_empresa, fantasia_cliente_fornecedor,
         desc_centro_custo, d_vencimento, d_liquidacao, d_competencia,
         v_original, v_lancamento, tipo, situacao,
         'historico'::text as fonte
  from public.financeiro_boletim_historico;
