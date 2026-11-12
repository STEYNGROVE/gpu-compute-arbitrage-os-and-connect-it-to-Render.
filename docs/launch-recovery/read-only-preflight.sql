-- Prepared only. Execute through an authorized read-only connection after workspace confirmation.
SELECT now() AS observed_at, pg_database_size(current_database()) AS database_bytes;
SELECT version, checksum, applied_at FROM public.schema_migrations ORDER BY version;
SELECT state,count(*) FROM pg_stat_activity WHERE datname=current_database() GROUP BY state;
SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid();
SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('commercial_quote_requests','customer_intelligence_leads','gpu_hunter_opportunities','preapproved_workload_evidence','acquisition_leads')
 ORDER BY table_name,ordinal_position;
