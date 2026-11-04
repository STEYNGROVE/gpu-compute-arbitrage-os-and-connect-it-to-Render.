-- =============================================================================
-- Migration: 20261001000002_complete_versioned_financial_migrations.sql
-- Purpose: Versioned PostgreSQL schema migration consolidating all historical
--          table additions, column alignments, check constraints, triggers,
--          and indexes that were previously executed at application startup.
--          The production application runtime NEVER executes DDL mutations.
-- =============================================================================

-- 0. Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  checksum VARCHAR(128) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Synchronize legacy account_identifier if present on treasury_accounts
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'treasury_accounts'
      AND column_name = 'account_identifier'
  ) THEN
    CREATE OR REPLACE FUNCTION sync_treasury_accounts_legacy() RETURNS TRIGGER AS $func$
    BEGIN
      IF NEW.external_account_id IS NOT NULL AND (NEW.account_identifier IS NULL OR NEW.account_identifier = '') THEN
        NEW.account_identifier := NEW.external_account_id;
      ELSIF NEW.account_identifier IS NOT NULL AND (NEW.external_account_id IS NULL OR NEW.external_account_id = '') THEN
        NEW.external_account_id := NEW.account_identifier;
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_treasury_accounts_legacy ON treasury_accounts;
    CREATE TRIGGER trg_sync_treasury_accounts_legacy
      BEFORE INSERT OR UPDATE ON treasury_accounts
      FOR EACH ROW
      EXECUTE FUNCTION sync_treasury_accounts_legacy();
  END IF;
END $$;

-- 2. Outbox Events schema alignment & status check constraints
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS aggregate_type VARCHAR(64) DEFAULT 'OPERATION';
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS aggregate_id VARCHAR(128) DEFAULT '';
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(64);
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS lease_timeout_at TIMESTAMPTZ;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, lease_timeout_at);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_updated ON outbox_events(status, updated_at);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_outbox_status') THEN
    ALTER TABLE outbox_events DROP CONSTRAINT chk_outbox_status;
  END IF;
  ALTER TABLE outbox_events ADD CONSTRAINT chk_outbox_status CHECK (
    status IN ('PENDING', 'CLAIMED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'RETRYING', 'DEAD_LETTER', 'RECOVERY_REQUIRED')
  );
END $$;

-- 3. Capital Reservations schema alignment & constraints
ALTER TABLE capital_reservations ADD COLUMN IF NOT EXISTS account_id VARCHAR(64);
ALTER TABLE capital_reservations ADD COLUMN IF NOT EXISTS asset VARCHAR(16) DEFAULT 'USD';
ALTER TABLE capital_reservations ADD COLUMN IF NOT EXISTS amount NUMERIC(28, 8) DEFAULT 0.00;
ALTER TABLE capital_reservations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capital_reservations' AND column_name = 'amount_minor') THEN
    UPDATE capital_reservations SET amount = amount_minor / 100.0 WHERE (amount IS NULL OR amount = 0) AND amount_minor IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capital_reservations' AND column_name = 'expires_at' AND data_type = 'bigint') THEN
    ALTER TABLE capital_reservations
      ALTER COLUMN expires_at TYPE TIMESTAMPTZ
      USING CASE
        WHEN expires_at > 1000000000000 THEN to_timestamp(expires_at / 1000.0)
        WHEN expires_at > 0 THEN to_timestamp(expires_at)
        ELSE NOW() + interval '10 minutes'
      END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_res_status') THEN
    ALTER TABLE capital_reservations DROP CONSTRAINT chk_res_status;
  END IF;
  ALTER TABLE capital_reservations ADD CONSTRAINT chk_res_status CHECK (
    status IN ('REQUESTED', 'RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED', 'FAILED')
  );
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_res_amount') THEN
    ALTER TABLE capital_reservations ADD CONSTRAINT chk_positive_res_amount CHECK (amount >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_capital_res_status_exp ON capital_reservations(status, expires_at);

-- 4. Treasury Accounts & Chart of Accounts classification
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS external_account_id VARCHAR(128);
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) DEFAULT 'CLEARING';
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS account_class VARCHAR(32);
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS asset VARCHAR(16) DEFAULT 'USD';
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(16) DEFAULT 'USD';

UPDATE treasury_accounts SET account_class = 'ASSET' WHERE account_type IN ('CLEARING', 'TREASURY_CASH') AND account_class IS NULL;
UPDATE treasury_accounts SET account_class = 'LIABILITY' WHERE account_type = 'ESCROW_LIABILITY' AND account_class IS NULL;
UPDATE treasury_accounts SET account_class = 'EXPENSE' WHERE account_type = 'COMPUTE_EXPENSE' AND account_class IS NULL;
UPDATE treasury_accounts SET account_class = 'REVENUE' WHERE account_type = 'REVENUE' AND account_class IS NULL;
ALTER TABLE treasury_accounts ALTER COLUMN account_class SET DEFAULT 'ASSET';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'treasury_accounts' AND column_name = 'account_identifier') THEN
    ALTER TABLE treasury_accounts ALTER COLUMN account_identifier DROP NOT NULL;
    ALTER TABLE treasury_accounts ALTER COLUMN account_identifier SET DEFAULT '';
    UPDATE treasury_accounts SET external_account_id = account_identifier WHERE external_account_id IS NULL;
    UPDATE treasury_accounts SET account_identifier = COALESCE(external_account_id, id) WHERE account_identifier IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'treasury_accounts' AND column_name = 'currency_or_asset') THEN
    ALTER TABLE treasury_accounts ALTER COLUMN currency_or_asset DROP NOT NULL;
    ALTER TABLE treasury_accounts ALTER COLUMN currency_or_asset SET DEFAULT 'USD';
    UPDATE treasury_accounts SET asset = currency_or_asset, currency = currency_or_asset WHERE asset IS NULL;
    UPDATE treasury_accounts SET currency_or_asset = COALESCE(asset, 'USD') WHERE currency_or_asset IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_account_env') THEN
    ALTER TABLE treasury_accounts ADD CONSTRAINT chk_account_env CHECK (environment IN ('LIVE', 'PAPER'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_account_type') THEN
    ALTER TABLE treasury_accounts ADD CONSTRAINT chk_account_type CHECK (account_type IN ('CLEARING', 'ESCROW_LIABILITY', 'TREASURY_CASH', 'COMPUTE_EXPENSE', 'REVENUE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_account_class') THEN
    ALTER TABLE treasury_accounts ADD CONSTRAINT chk_account_class CHECK (account_class IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'));
  END IF;
END $$;

-- 5. Treasury Ledger financial constraints & composite index
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_quantity') THEN
    ALTER TABLE treasury_ledger ADD CONSTRAINT chk_positive_quantity CHECK (quantity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_precision') THEN
    ALTER TABLE treasury_ledger ADD CONSTRAINT chk_valid_precision CHECK (precision >= 0 AND precision <= 18);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_direction') THEN
    ALTER TABLE treasury_ledger ADD CONSTRAINT chk_valid_direction CHECK (direction IN ('DEBIT', 'CREDIT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_currency') THEN
    ALTER TABLE treasury_ledger ADD CONSTRAINT chk_valid_currency CHECK (currency IN ('USD', 'ZAR', 'EUR', 'GBP', 'BTC', 'ETH', 'USDT', 'USDC'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_group_asset_curr ON treasury_ledger(entry_group_id, asset, currency);

-- 6. Quotes, Customer Sessions, Webhook Events, Audit Events, and Treasury Snapshots
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS region VARCHAR(64) DEFAULT 'global';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ISSUED';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS consumed_by VARCHAR(64);

ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS run_id VARCHAR(128) DEFAULT 'legacy_run';
ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS external_balance_minor BIGINT DEFAULT 0;
ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS internal_ledger_balance_minor BIGINT DEFAULT 0;
ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS discrepancy_minor BIGINT DEFAULT 0;
ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS valuation_usd NUMERIC(16, 2) DEFAULT 0.00;
ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE treasury_snapshots ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 7. Auxiliary tables for hot wallet, worker heartbeats, and profit withdrawals
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id VARCHAR(64) PRIMARY KEY,
  worker_type VARCHAR(64) NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_poll_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  queue_depth INT NOT NULL DEFAULT 0,
  dead_letter_count INT NOT NULL DEFAULT 0,
  stale_claimed_count INT NOT NULL DEFAULT 0,
  stale_processing_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY',
  error_message TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  transaction_id VARCHAR(128) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  amount_minor BIGINT NOT NULL,
  direction VARCHAR(16) NOT NULL,
  transaction_type VARCHAR(64) NOT NULL,
  external_reference VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  previous_hash VARCHAR(128) NOT NULL,
  record_hash VARCHAR(128) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_account ON treasury_transactions(account_id);

CREATE TABLE IF NOT EXISTS profit_withdrawals_audit (
  id VARCHAR(128) PRIMARY KEY,
  operator VARCHAR(128) NOT NULL,
  coin VARCHAR(16) NOT NULL,
  amount NUMERIC(28, 8) NOT NULL,
  network VARCHAR(32) NOT NULL,
  destination_address VARCHAR(256) NOT NULL,
  binance_withdraw_id VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
  error_message TEXT,
  prev_audit_hash VARCHAR(128) NOT NULL,
  record_audit_hash VARCHAR(128) NOT NULL,
  calculation_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawal_allowlist (
  id VARCHAR(128) PRIMARY KEY,
  destination_address VARCHAR(256) NOT NULL,
  network VARCHAR(32) NOT NULL,
  coin VARCHAR(16) NOT NULL DEFAULT 'USDT',
  label VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_allowlist_addr_net UNIQUE (destination_address, network, coin)
);

CREATE TABLE IF NOT EXISTS hot_wallet_transactions (
  id VARCHAR(128) PRIMARY KEY,
  idempotency_key VARCHAR(256) NOT NULL UNIQUE,
  tx_hash VARCHAR(128),
  chain_id INT NOT NULL DEFAULT 56,
  network VARCHAR(32) NOT NULL DEFAULT 'BSC',
  token VARCHAR(16) NOT NULL DEFAULT 'USDT',
  token_contract VARCHAR(128) NOT NULL,
  amount NUMERIC(28, 8) NOT NULL,
  destination VARCHAR(256) NOT NULL,
  destination_label VARCHAR(256),
  gas_price VARCHAR(64),
  gas_limit VARCHAR(64),
  gas_used VARCHAR(64),
  effective_gas_price VARCHAR(64),
  nonce INT,
  block_number BIGINT,
  confirmation_count INT NOT NULL DEFAULT 0,
  status VARCHAR(64) NOT NULL,
  operator VARCHAR(128) NOT NULL,
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  explorer_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hot_wallet_idempotency (
  idempotency_key VARCHAR(256) PRIMARY KEY,
  tx_id VARCHAR(128) NOT NULL REFERENCES hot_wallet_transactions(id) ON DELETE CASCADE,
  status VARCHAR(64) NOT NULL,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hot_wallet_nonce_state (
  network VARCHAR(32) NOT NULL,
  address VARCHAR(256) NOT NULL,
  last_assigned_nonce INT NOT NULL DEFAULT -1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (network, address)
);

CREATE TABLE IF NOT EXISTS hot_wallet_emergency_state (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'MAIN',
  is_halted BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  halted_by VARCHAR(128),
  halted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
