-- extrairCap() em sync.js (C:\Users\Alliance\alliance-po-everest-sync\sync.js) já não
-- tem cutoff de data — sempre buscou o histórico completo de "501 a pagar" direto do
-- Everest (situação 1/9, exclui TARIFAS BANCARIAS). Validado em 2026-08-10 contra
-- export do Marcos: 460 títulos 2021-2022 (R$1.648.115,02, já excluindo tarifas) batem
-- exato entre financeiro_cap_historico e a base viva do Everest.
--
-- Com o live já cobrindo 2021-2022, a view para de unir com financeiro_cap_historico
-- (senão duplicaria essas linhas). financeiro_cap_historico fica intacta no banco, sem
-- uso, caso precise reverter.
--
-- financeiro_boletim_historico/_completo (receitas/tarifas) NÃO são tocadas aqui —
-- ainda não validadas contra um export separado.
create or replace view financeiro_cap_completo as
select id, fantasia_fornecedor, desc_conta_gerencial, desc_centro_custo,
       d_vencimento, d_competencia, v_titulo, situacao, portador, dias_atraso,
       'live'::text as fonte
from financeiro_cap;

alter view financeiro_cap_completo set (security_invoker = true);
