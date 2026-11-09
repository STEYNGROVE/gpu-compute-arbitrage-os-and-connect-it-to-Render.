-- Separate unverified observations from verified allocations.
-- No UNIQUE(order_id): untrusted observations must never reserve orders.
CREATE TABLE IF NOT EXISTS gpu_payment_observations (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id),
  CHECK (length(provider_transaction_id) BETWEEN 8 AND 256)
);
CREATE INDEX IF NOT EXISTS gpu_payment_observations_order_idx ON gpu_payment_observations(order_id);
CREATE OR REPLACE FUNCTION gpu_payment_observations_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'payment observations are immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS gpu_payment_observations_no_mutation ON gpu_payment_observations;
CREATE TRIGGER gpu_payment_observations_no_mutation
BEFORE UPDATE OR DELETE ON gpu_payment_observations
FOR EACH ROW EXECUTE FUNCTION gpu_payment_observations_immutable();
