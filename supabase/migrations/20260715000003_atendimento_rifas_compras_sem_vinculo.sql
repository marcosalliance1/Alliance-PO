-- Uma compra sem ganhador resolvido (turma+prêmio+nome não bateu com nenhum ganhador
-- já sincronizado) deve ser criada mesmo assim, sinalizada como "sem vínculo" pra revisão
-- manual — não travar a importação. Isso exige (1) ganhador_id nullable e (2) guardar
-- turma/prêmio/nome do ganhador na própria linha de compra, já que sem o join por
-- ganhador_id não haveria mais nenhuma forma de identificar a que a compra se refere.
alter table rifas_compras alter column ganhador_id drop not null;
alter table rifas_compras add column if not exists turma text;
alter table rifas_compras add column if not exists premio_descricao text;
alter table rifas_compras add column if not exists nome_ganhador text;
