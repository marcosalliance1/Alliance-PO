-- Agendamento da sincronização do board Marketing (monday.com) a cada 30 minutos.
--
-- Nota: o cron existente "relatorio-semanal" usa current_setting('app.service_role_key'),
-- que nunca foi configurado no banco — todas as execuções desse job falharam (ver
-- cron.job_run_details). Como a Edge Function é chamada com verify_jwt=false, o header
-- Authorization não precisa carregar uma credencial privilegiada, só precisa ser um JWT
-- válido para não quebrar o parsing. Por isso aqui usamos a anon key (pública) direto no
-- comando, evitando essa armadilha. Dentro da function, o client com privilégio total usa
-- SUPABASE_SERVICE_ROLE_KEY, injetada automaticamente pela plataforma.

create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('sync-marketing-monday');
exception when others then
  null;
end $$;

select cron.schedule(
  'sync-marketing-monday',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := 'https://jvznmonrbrfgvxhovcih.supabase.co/functions/v1/sync-marketing-monday',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2em5tb25yYnJmZ3Z4aG92Y2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTAyODEsImV4cCI6MjA5MTc2NjI4MX0.RIACTV4YA4uglcSTngGnojpZKyGJXUp-x4iPHP6oMsQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
