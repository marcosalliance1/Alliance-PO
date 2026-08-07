-- Fecha o vazamento crítico de credenciais: a policy `portal_clientes_select`
-- (SELECT / public / true) deixa a anon key (exposta no bundle JS) baixar
-- e-mail + senha_hash (bcrypt) de TODAS as comissões, sem login. A verificação
-- de senha do Portal do Cliente passou a rodar no servidor (Edge Function
-- `portal-login`, service_role) — o navegador não lê mais esta tabela. Removendo
-- a leitura pública, o anon perde acesso. O admin (autenticado no PO V2) continua
-- gerenciando clientes pela policy `portal_clientes_write` (ALL / authenticated),
-- que também cobre SELECT pra role authenticated.
--
-- ATENÇÃO — ORDEM DE APLICAÇÃO: só rodar DEPOIS que o front novo (signIn via
-- `portal-login`) estiver publicado no Vercel. Enquanto o build antigo estiver no
-- ar, o portal em produção ainda lê `portal_clientes` como anon e o login das
-- comissões quebraria no instante em que esta policy for removida.
--
-- Rollback:
--   create policy "portal_clientes_select" on public.portal_clientes
--     for select to public using (true);

drop policy if exists "portal_clientes_select" on public.portal_clientes;
