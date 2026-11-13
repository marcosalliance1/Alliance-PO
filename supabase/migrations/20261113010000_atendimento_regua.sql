-- Atendimento Fase 2: categoria 'regua' (Régua ao Contrário — 1 linha por marco,
-- ligada à P.O. da turma; dados = {diasAntes, marco}; status = 'Pendente' | 'Feito').
-- Só amplia a lista de categorias aceitas em atendimento_registros (tabela criada hoje).
--
-- Rollback:
--   delete from atendimento_registros where categoria = 'regua';
--   alter table atendimento_registros drop constraint atendimento_registros_categoria_check;
--   alter table atendimento_registros add constraint atendimento_registros_categoria_check check (categoria in (
--     'demandas','turmas','rescisao','alteracaoplano','calculoRescisao','achados','aniversarios',
--     'calendario','eventos','guias','mensagens','config'));

alter table atendimento_registros drop constraint if exists atendimento_registros_categoria_check;
alter table atendimento_registros add constraint atendimento_registros_categoria_check check (categoria in (
  'demandas','turmas','rescisao','alteracaoplano','calculoRescisao','achados','aniversarios',
  'calendario','eventos','guias','mensagens','config','regua'));
