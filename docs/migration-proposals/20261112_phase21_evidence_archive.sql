-- Unapplied proposal. No financial posting, real execution or runtime DDL.
CREATE TABLE IF NOT EXISTS phase21_evidence_receipts (
 digest text PRIMARY KEY CHECK(digest ~ '^[a-f0-9]{64}$'),
 receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object' AND octet_length(receipt::text)<=32768),
 status_at_collection text NOT NULL CHECK(status_at_collection IN ('VERIFIED','PARTIALLY_VERIFIED','UNVERIFIED','EXPIRED')),
 collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phase21_external_event_bindings (
 event_key text PRIMARY KEY CHECK(event_key ~ '^[a-f0-9]{64}$'),
 first_digest text NOT NULL REFERENCES phase21_evidence_receipts(digest),
 state text NOT NULL CHECK(state IN ('CONSISTENT','CONFLICTED'))
);
CREATE OR REPLACE FUNCTION phase21_archive_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PHASE21_APPEND_ONLY_ARCHIVE'; END; $$;
DROP TRIGGER IF EXISTS phase21_receipt_immutable ON phase21_evidence_receipts;
CREATE TRIGGER phase21_receipt_immutable BEFORE UPDATE OR DELETE ON phase21_evidence_receipts FOR EACH ROW EXECUTE FUNCTION phase21_archive_guard();
CREATE OR REPLACE FUNCTION phase21_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.event_key IS DISTINCT FROM OLD.event_key OR NEW.first_digest IS DISTINCT FROM OLD.first_digest OR
    (OLD.state='CONFLICTED' AND NEW.state<>'CONFLICTED') THEN RAISE EXCEPTION 'PHASE21_EVENT_BINDING_IMMUTABLE'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS phase21_binding_immutable ON phase21_external_event_bindings;
CREATE TRIGGER phase21_binding_immutable BEFORE UPDATE OR DELETE ON phase21_external_event_bindings FOR EACH ROW EXECUTE FUNCTION phase21_binding_guard();
