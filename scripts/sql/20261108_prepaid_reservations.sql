-- Run manually against staging PostgreSQL after backup; no provider calls.
CREATE TABLE IF NOT EXISTS gpu_prepaid_reservations (
 id BIGSERIAL PRIMARY KEY,
 job_id TEXT NOT NULL UNIQUE,
 provider TEXT NOT NULL CHECK (provider IN ('vast_ai','runpod')),
 estimated_cost_cents INTEGER NOT NULL CHECK (estimated_cost_cents BETWEEN 1 AND 200),
 customer_payment_evidence_id TEXT NOT NULL,
 provider_balance_evidence_id TEXT NOT NULL,
 owner_approval_evidence_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','RUNNING','SETTLED','CANCELLED','FAILED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gpu_prepaid_reservations_active_idx ON gpu_prepaid_reservations(provider,status,created_at);
