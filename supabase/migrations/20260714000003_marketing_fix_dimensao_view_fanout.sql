-- Corrige marketing_demandas_com_dimensao: dimensao_projetos tem uma linha por ano
-- para o mesmo cliente (ex: "BERNOULLI 2025" e "BERNOULLI 2026"), e como a chave
-- normalizada remove o ano, o join direto duplicava a linha de marketing_demandas
-- uma vez por ano cadastrado na dimensão (1401 -> 1693 linhas). Fix: LATERAL join
-- que escolhe 1 linha por chave (a de nome_projeto lexicograficamente maior, ou
-- seja, o ano mais recente quando o prefixo é igual).
create or replace view marketing_demandas_com_dimensao as
select
  d.*,
  dim.nome_projeto  as dimensao_nome_projeto,
  dim.ensino        as dimensao_ensino,
  dim.instituicao   as dimensao_instituicao,
  (dim.nome_projeto is not null) as match_dimensao
from marketing_demandas d
left join lateral (
  select dp.nome_projeto, dp.ensino, dp.instituicao
  from dimensao_projetos dp
  where marketing_chave_normalizada(dp.nome_projeto) = marketing_chave_normalizada(d.cliente_extraido)
  order by dp.nome_projeto desc
  limit 1
) dim on true;
