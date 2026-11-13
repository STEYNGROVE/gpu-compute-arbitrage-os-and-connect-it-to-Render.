-- Additive guards: documentary metadata is immutable; one pending review decision is allowed.
CREATE OR REPLACE FUNCTION protect_workload_evidence_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'IMMUTABLE_EVIDENCE'; END IF;
 IF OLD.state <> 'PENDING_VERIFICATION' OR NEW.state = 'PENDING_VERIFICATION' OR
    (to_jsonb(NEW) - ARRAY['state','reviewer','verification_notes','verified_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['state','reviewer','verification_notes','verified_at']) THEN
   RAISE EXCEPTION 'IMMUTABLE_EVIDENCE';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workload_evidence_metadata_guard ON preapproved_workload_evidence;
CREATE TRIGGER workload_evidence_metadata_guard BEFORE UPDATE OR DELETE ON preapproved_workload_evidence
 FOR EACH ROW EXECUTE FUNCTION protect_workload_evidence_metadata();
CREATE OR REPLACE FUNCTION protect_commercial_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'IMMUTABLE_AUDIT';
END;
$$;
DROP TRIGGER IF EXISTS commercial_evidence_audit_guard ON commercial_evidence_audit;
CREATE TRIGGER commercial_evidence_audit_guard BEFORE UPDATE OR DELETE ON commercial_evidence_audit
 FOR EACH ROW EXECUTE FUNCTION protect_commercial_audit();

DROP TRIGGER IF EXISTS commercial_audit_truncate_guard ON commercial_evidence_audit;
CREATE TRIGGER commercial_audit_truncate_guard BEFORE TRUNCATE ON commercial_evidence_audit
 FOR EACH STATEMENT EXECUTE FUNCTION protect_commercial_audit();
DROP TRIGGER IF EXISTS workload_evidence_truncate_guard ON preapproved_workload_evidence;
CREATE TRIGGER workload_evidence_truncate_guard BEFORE TRUNCATE ON preapproved_workload_evidence
 FOR EACH STATEMENT EXECUTE FUNCTION protect_commercial_audit();
