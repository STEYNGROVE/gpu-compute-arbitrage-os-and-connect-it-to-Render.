-- Phase 9.5: immutable allocation ledger. Does not authenticate or settle payments.
BEGIN;
CREATE TABLE IF NOT EXISTS gpu_payment_evidence_allocations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL CHECK (provider ~ '^[A-Z0-9_]{2,32}$'),
  provider_transaction_id text NOT NULL CHECK (length(btrim(provider_transaction_id)) BETWEEN 8 AND 256),
  customer_id text NOT NULL CHECK (length(btrim(customer_id)) BETWEEN 1 AND 128),
  order_id text NOT NULL CHECK (length(btrim(order_id)) BETWEEN 1 AND 128),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3,8}$'),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id),
  UNIQUE (order_id)
);
-- Ledger rows cannot be edited or deleted by ordinary application operations.
CREATE OR REPLACE FUNCTION gpu_reject_payment_allocation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PAYMENT_ALLOCATION_IMMUTABLE' USING ERRCODE='23514';
END $$;
DROP TRIGGER IF EXISTS gpu_payment_allocation_immutable ON gpu_payment_evidence_allocations;
CREATE TRIGGER gpu_payment_allocation_immutable BEFORE UPDATE OR DELETE ON gpu_payment_evidence_allocations
FOR EACH ROW EXECUTE FUNCTION gpu_reject_payment_allocation_mutation();
COMMIT;
