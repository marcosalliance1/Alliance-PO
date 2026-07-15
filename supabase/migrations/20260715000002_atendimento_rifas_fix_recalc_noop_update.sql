-- rifas_recalcular_matches rodava um UPDATE incondicional por linha a cada sync,
-- o que disparava o trigger moddatetime mesmo quando nada mudava, fazendo toda
-- rifa parecer "alterada no Alliance" na sync seguinte (quebrava a detecção de
-- conflito). Corrige adicionando WHERE ... IS DISTINCT FROM para só escrever
-- (e portanto só tocar updated_at) quando o match realmente muda.
create or replace function rifas_recalcular_matches(p_limiar real default 0.6) returns void
language plpgsql as $$
declare
  r record;
  ov integer;
  sug record;
begin
  for r in select id, turma from rifas loop
    select dimensao_projeto_id into ov from rifas_turma_overrides where turma = r.turma;

    if ov is not null then
      update rifas set dimensao_projeto_id = ov, match_confianca = 1.0, match_manual = true
        where id = r.id
          and (dimensao_projeto_id is distinct from ov or match_confianca is distinct from 1.0 or match_manual is distinct from true);
    else
      select * into sug from rifas_sugerir_match(r.turma);
      if sug.score >= p_limiar then
        update rifas set dimensao_projeto_id = sug.dimensao_projeto_id, match_confianca = sug.score, match_manual = false
          where id = r.id
            and (dimensao_projeto_id is distinct from sug.dimensao_projeto_id or match_confianca is distinct from sug.score or match_manual is distinct from false);
      else
        update rifas set dimensao_projeto_id = null, match_confianca = sug.score, match_manual = false
          where id = r.id
            and (dimensao_projeto_id is distinct from null or match_confianca is distinct from sug.score or match_manual is distinct from false);
      end if;
    end if;
  end loop;
end;
$$;
