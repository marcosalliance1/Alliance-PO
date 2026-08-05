-- Contagem real de formandos aderidos ("TOTAL FORMANDOS" na aba ACOMP. ATENDIMENTO
-- do Google Sheets do projeto), sincronizada junto com total_convidados_atual.
alter table projetos add column if not exists total_adesoes_atual integer;
