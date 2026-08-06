-- Fecha o buraco de segurança: a anon key (exposta no bundle JS do site) hoje
-- consegue ler/escrever essas tabelas financeiras diretamente, sem login, porque
-- RLS está desligado nelas. A partir daqui, só usuário autenticado (login no
-- PO V2) ou a service_role key (usada só pelo sync.js local) têm acesso —
-- com UMA exceção: o Portal do Cliente (login próprio, não usa Supabase Auth,
-- então enxerga o banco como "anon") lê financeiro_boletim pra mostrar
-- vencimentos próximos ao cliente (DashboardPortal.tsx). Por isso
-- financeiro_boletim libera SELECT pra anon também; escrita continua só
-- autenticado. As outras tabelas não são tocadas pelo portal.
--
-- Rollback: `alter table <tabela> disable row level security;` em cada uma.

alter table financeiro_cap enable row level security;
alter table financeiro_boletim enable row level security;
alter table financeiro_uploads enable row level security;
alter table financeiro_car enable row level security;
alter table financeiro_tarifas enable row level security;
alter table financeiro_cap_historico enable row level security;
alter table financeiro_boletim_historico enable row level security;
alter table financeiro_boletim_excluido_log enable row level security;

create policy "authenticated_all_financeiro_cap" on financeiro_cap
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_financeiro_uploads" on financeiro_uploads
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_financeiro_car" on financeiro_car
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_financeiro_tarifas" on financeiro_tarifas
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_financeiro_cap_historico" on financeiro_cap_historico
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_financeiro_boletim_historico" on financeiro_boletim_historico
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_financeiro_boletim_excluido_log" on financeiro_boletim_excluido_log
  for all to authenticated using (true) with check (true);

-- financeiro_boletim: leitura liberada pra anon (Portal do Cliente) + authenticated;
-- escrita (insert/update/delete) só authenticated.
create policy "select_all_financeiro_boletim" on financeiro_boletim
  for select to anon, authenticated using (true);
create policy "authenticated_write_financeiro_boletim" on financeiro_boletim
  for insert to authenticated with check (true);
create policy "authenticated_update_financeiro_boletim" on financeiro_boletim
  for update to authenticated using (true) with check (true);
create policy "authenticated_delete_financeiro_boletim" on financeiro_boletim
  for delete to authenticated using (true);

-- As views _completo são owned by postgres, que ignora RLS por padrão — sem
-- isso, elas continuariam vazando tudo pra anon key mesmo com RLS ligado nas
-- tabelas base.
alter view financeiro_boletim_completo set (security_invoker = true);
alter view financeiro_cap_completo set (security_invoker = true);
