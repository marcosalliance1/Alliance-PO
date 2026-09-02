-- Info do Evento (operacional): réplica do modelo já usado no módulo pré-eventos,
-- agora também por projeto da P.O. Alliance. Editável só no sistema (sem sync de
-- planilha nesta primeira entrega) — dado nullable, projeto antigo abre vazio.
alter table projetos add column if not exists info_evento jsonb;
