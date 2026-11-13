-- Vigia da coleta: a cada 5 minutos, se a coleta de editais estiver parada no meio, chama /api/coleta para retomar.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('vigia-coleta-editais', '*/5 * * * *', $$
  select net.http_get(url := 'https://jrb-sistema.vercel.app/api/coleta')
  where exists (select 1 from public.coleta_execucoes e
                where e.id = (select max(id) from public.coleta_execucoes)
                  and e.status = 'rodando' and e.pulso_em < now() - interval '100 seconds');
$$);
