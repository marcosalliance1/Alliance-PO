-- Metas de margem: guarda o ORÇADO da aba "1. RESUMO GERAL" de cada P.O. (receita, custo total, margem)
-- para que o dashboard "Metas de margem" use os mesmos números da planilha.
--
-- Formato: { "receita": number|null, "custo": number|null, "margem": number|null, "celulas": "I24/I48/I49", "lidoEm": "ISO" }
-- Coluna NULLABLE e sem default: nenhuma linha, tela ou cálculo existente é afetado.
--
-- BACKUP (feito antes de aplicar):
--   C:\Users\Alliance\alliance-po-everest-sync\backups\projetos_antes_resumo_geral_orcado_2026-11-04.json
--
-- ROLLBACK:
--   alter table projetos drop column if exists resumo_geral_orcado;

alter table projetos add column if not exists resumo_geral_orcado jsonb;

comment on column projetos.resumo_geral_orcado is
  'ORÇADO do 1. RESUMO GERAL da planilha (receita, custo, margem). Gravado pelo sync; usado pelo dashboard Metas de margem.';
