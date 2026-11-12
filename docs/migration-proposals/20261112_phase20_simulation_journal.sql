-- PROPOSAL ONLY. Simulation journal, not a money ledger or execution outbox.
-- Not registered with any runtime migration runner. Never auto-apply.
CREATE TABLE IF NOT EXISTS phase20_simulation_requests (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
 idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$'),
 request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
 request_payload jsonb NOT NULL CHECK (jsonb_typeof(request_payload)='object' AND coalesce(request_payload->>'mode','') = 'SIMULATION'),
 authorization_state text NOT NULL DEFAULT 'SIMULATION_ONLY' CHECK (authorization_state = 'SIMULATION_ONLY'),
 execution_authorized boolean NOT NULL DEFAULT false CHECK (execution_authorized = false),
 real_money_moved_cents integer NOT NULL DEFAULT 0 CHECK (real_money_moved_cents = 0),
 max_cost_cents integer NOT NULL CHECK (max_cost_cents BETWEEN 1 AND 200),
 max_runtime_ms integer NOT NULL CHECK (max_runtime_ms BETWEEN 1 AND 3600000),
 deadline_ms bigint NOT NULL,
 state text NOT NULL DEFAULT 'SIMULATION_RESERVED' CHECK (state IN ('SIMULATION_RESERVED','SIMULATION_RUNNING','STOP_REQUIRED','QUARANTINED','SIMULATION_RECONCILED','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phase20_simulation_events (
 request_id text NOT NULL REFERENCES phase20_simulation_requests(id),
 sequence integer NOT NULL CHECK (sequence > 0),
 event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 128),
 kind text NOT NULL,
 payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
 previous_hash text NOT NULL CHECK (previous_hash ~ '^[a-f0-9]{64}$'),
 event_hash text NOT NULL UNIQUE CHECK (event_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(request_id,sequence), UNIQUE(request_id,event_key)
);
CREATE OR REPLACE FUNCTION phase20_reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PHASE20_AUDIT_APPEND_ONLY'; END; $$;
DROP TRIGGER IF EXISTS phase20_event_immutable ON phase20_simulation_events;
CREATE TRIGGER phase20_event_immutable BEFORE UPDATE OR DELETE ON phase20_simulation_events
 FOR EACH ROW EXECUTE FUNCTION phase20_reject_event_mutation();
ALTER TABLE phase20_simulation_requests ADD COLUMN IF NOT EXISTS cancellation_attempts integer NOT NULL DEFAULT 0 CHECK (cancellation_attempts BETWEEN 0 AND 3);
ALTER TABLE phase20_simulation_requests ADD COLUMN IF NOT EXISTS last_attempt_ms bigint;
CREATE OR REPLACE FUNCTION phase20_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   IF NEW.state<>'SIMULATION_RESERVED' OR NEW.version<>1 OR NEW.cancellation_attempts<>0 OR NEW.last_attempt_ms IS NOT NULL THEN RAISE EXCEPTION 'PHASE20_INVALID_INITIAL_STATE'; END IF;
   RETURN NEW;
 END IF;
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PHASE20_REQUEST_APPEND_ONLY'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
    NEW.request_digest IS DISTINCT FROM OLD.request_digest OR NEW.request_payload IS DISTINCT FROM OLD.request_payload OR
    NEW.max_cost_cents IS DISTINCT FROM OLD.max_cost_cents OR NEW.max_runtime_ms IS DISTINCT FROM OLD.max_runtime_ms OR
    NEW.deadline_ms IS DISTINCT FROM OLD.deadline_ms OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.version <> OLD.version+1 THEN
   RAISE EXCEPTION 'PHASE20_IMMUTABLE_REQUEST';
 END IF;
 IF NOT ((OLD.state='SIMULATION_RESERVED' AND NEW.state IN ('SIMULATION_RUNNING','CANCELLED','QUARANTINED')) OR
   (OLD.state='SIMULATION_RUNNING' AND NEW.state IN ('STOP_REQUIRED','QUARANTINED')) OR
   (OLD.state='STOP_REQUIRED' AND NEW.state IN ('STOP_REQUIRED','QUARANTINED','SIMULATION_RECONCILED')) OR
   (OLD.state='QUARANTINED' AND NEW.state='SIMULATION_RECONCILED')) THEN RAISE EXCEPTION 'PHASE20_INVALID_TRANSITION'; END IF;
 IF NEW.cancellation_attempts <> OLD.cancellation_attempts + (CASE WHEN NEW.state='STOP_REQUIRED' THEN 1 ELSE 0 END) OR
    (NEW.state<>'STOP_REQUIRED' AND NEW.last_attempt_ms IS DISTINCT FROM OLD.last_attempt_ms) OR
    (NEW.state='STOP_REQUIRED' AND (NEW.last_attempt_ms IS NULL OR NEW.last_attempt_ms<coalesce(OLD.last_attempt_ms,0))) THEN
   RAISE EXCEPTION 'PHASE20_INVALID_STOP_COUNTER';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS phase20_request_immutable ON phase20_simulation_requests;
CREATE TRIGGER phase20_request_immutable BEFORE INSERT OR UPDATE OR DELETE ON phase20_simulation_requests FOR EACH ROW EXECUTE FUNCTION phase20_request_guard();
CREATE OR REPLACE FUNCTION phase20_require_atomic_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM phase20_simulation_events WHERE request_id=NEW.id AND sequence=NEW.version AND kind=NEW.state) THEN
   RAISE EXCEPTION 'PHASE20_ATOMIC_AUDIT_REQUIRED';
 END IF;
 RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS phase20_atomic_event ON phase20_simulation_requests;
CREATE CONSTRAINT TRIGGER phase20_atomic_event AFTER INSERT OR UPDATE ON phase20_simulation_requests
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase20_require_atomic_event();
