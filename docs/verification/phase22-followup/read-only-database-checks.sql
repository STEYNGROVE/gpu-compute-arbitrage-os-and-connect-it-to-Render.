-- Prepared for the confirmed Render database only. SELECT-only metadata; never migration SQL.
-- Connector role/TLS describe the connector session, not the application session.

-- availability
SELECT current_setting('transaction_read_only') AS transaction_read_only, current_setting('server_version_num') AS server_version_num;

-- required_tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('schema_migrations','customers','customer_api_keys','customer_sessions','demand_orders','webhook_events','treasury_accounts','treasury_ledger','treasury_transactions','treasury_snapshots','treasury_reconciliations','quotes','capital_reservations','provider_operations','provider_instances','compute_jobs','settlements','outbox_events','audit_events','idempotency_keys','reconciliation_runs','kill_switch_state','payment_intents','provider_transactions','worker_heartbeats','circuit_breaker_state','profit_withdrawals_audit','verified_profit_records','withdrawal_allowlist','provider_funding_events','autonomous_profit_allocations','hot_wallet_transactions','hot_wallet_idempotency','hot_wallet_nonce_state','hot_wallet_emergency_state','market_opportunities') ORDER BY table_name;

-- migration_history
SELECT version, checksum FROM schema_migrations ORDER BY version;

-- acquisition_columns
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='acquisition_leads' ORDER BY ordinal_position;

-- connector_role
SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user;

-- connector_tls
SELECT ssl, version, bits FROM pg_stat_ssl WHERE pid=pg_backend_pid();
