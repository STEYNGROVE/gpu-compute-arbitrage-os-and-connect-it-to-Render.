-- DISPOSABLE CERTIFICATION LAB ONLY. Not registered with production migration runner.
-- Integer minor units; simulation domain cannot be promoted by flags.
CREATE TABLE IF NOT EXISTS phase21_lab_accounts (
 id text PRIMARY KEY, owner_ref text NOT NULL, currency text NOT NULL CHECK(currency IN ('USD','ZAR')),
 balance bigint NOT NULL CHECK(balance BETWEEN 0 AND 9007199254740991),
 UNIQUE(id,owner_ref,currency)
);
CREATE TABLE IF NOT EXISTS phase21_lab_events (
 event_id text PRIMARY KEY, digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 currency text NOT NULL CHECK(currency IN ('USD','ZAR')), owner_ref text NOT NULL,
 reversal_of text UNIQUE REFERENCES phase21_lab_events(event_id),
 domain text NOT NULL DEFAULT 'SIMULATION' CHECK(domain='SIMULATION'), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS phase21_lab_entries (
 event_id text NOT NULL REFERENCES phase21_lab_events(event_id),
 account_id text NOT NULL, owner_ref text NOT NULL, currency text NOT NULL,
 amount bigint NOT NULL CHECK(amount<>0 AND amount BETWEEN -9007199254740991 AND 9007199254740991),
 PRIMARY KEY(event_id,account_id), FOREIGN KEY(account_id,owner_ref,currency) REFERENCES phase21_lab_accounts(id,owner_ref,currency)
);
CREATE OR REPLACE FUNCTION phase21_lab_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'LAB_APPEND_ONLY'; END; $$;
DROP TRIGGER IF EXISTS phase21_lab_events_immutable ON phase21_lab_events;
CREATE TRIGGER phase21_lab_events_immutable BEFORE UPDATE OR DELETE ON phase21_lab_events FOR EACH ROW EXECUTE FUNCTION phase21_lab_immutable();
DROP TRIGGER IF EXISTS phase21_lab_entries_immutable ON phase21_lab_entries;
CREATE TRIGGER phase21_lab_entries_immutable BEFORE UPDATE OR DELETE ON phase21_lab_entries FOR EACH ROW EXECUTE FUNCTION phase21_lab_immutable();
CREATE OR REPLACE FUNCTION phase21_lab_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT count(*) FROM phase21_lab_entries WHERE event_id=NEW.event_id)<2 OR
    (SELECT COALESCE(sum(amount),0) FROM phase21_lab_entries WHERE event_id=NEW.event_id)<>0 OR
    EXISTS(SELECT 1 FROM phase21_lab_entries WHERE event_id=NEW.event_id AND (currency<>NEW.currency OR owner_ref<>NEW.owner_ref))
 THEN RAISE EXCEPTION 'LAB_UNBALANCED_OR_UNBOUND'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS phase21_lab_balance ON phase21_lab_events;
CREATE CONSTRAINT TRIGGER phase21_lab_balance AFTER INSERT ON phase21_lab_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase21_lab_balanced();
CREATE TABLE IF NOT EXISTS phase21_simulation_leases (
 request_id text PRIMARY KEY REFERENCES phase20_simulation_requests(id), worker text NOT NULL,
 fence bigint NOT NULL CHECK(fence>0), expires_at timestamptz NOT NULL,
 domain text NOT NULL DEFAULT 'SIMULATION' CHECK(domain='SIMULATION')
);
REVOKE ALL ON phase21_lab_accounts,phase21_lab_events,phase21_lab_entries,phase21_simulation_leases FROM PUBLIC;
-- Inserting a later entry must not corrupt an already committed event.
CREATE OR REPLACE FUNCTION phase21_lab_entry_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent phase21_lab_events%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM phase21_lab_events WHERE event_id=NEW.event_id FOR UPDATE;
 IF (SELECT count(*) FROM phase21_lab_entries WHERE event_id=NEW.event_id)<>2 OR
    (SELECT sum(amount) FROM phase21_lab_entries WHERE event_id=NEW.event_id)<>0 OR
    NEW.currency<>parent.currency OR NEW.owner_ref<>parent.owner_ref THEN RAISE EXCEPTION 'LAB_UNBALANCED_OR_UNBOUND'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS phase21_lab_entry_balance ON phase21_lab_entries;
CREATE CONSTRAINT TRIGGER phase21_lab_entry_balance AFTER INSERT ON phase21_lab_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase21_lab_entry_balance();
