import { assessTermination, type ResourceObservation } from './termination.js';
import type { Pool, PoolClient } from 'pg';
import { canonicalFacts, integer, reference, sha256 } from './evidence.js';
export const gatewayLimits = Object.freeze({perJobCents:200,dailyCents:500,concurrent:1,maxRuntimeMs:3600000});
export type GatewayState = 'SIMULATION_RESERVED' | 'SIMULATION_RUNNING' | 'STOP_REQUIRED' | 'QUARANTINED' | 'SIMULATION_RECONCILED' | 'CANCELLED';
export interface GatewayRequest {
  mode: 'SIMULATION'; idempotencyKey: string; customerId: string; workloadId: string;
  provider: 'vast_ai' | 'runpod'; accountId: string; offerId: string; gpuModel: string;
  gpuCount: number; minVramGb: number; maxCostCents: number; maxRuntimeMs: number;
  contractEvidenceId: string; supplierEvidenceId: string; paymentEvidenceId: string; approvalEvidenceId: string;
}
export interface GatewayRecord { id: string; request_digest: string; idempotency_key: string; state: GatewayState; version: number; max_cost_cents: number; deadline_ms: string; created_at: Date; cancellation_attempts: number; last_attempt_ms: string | null }
export interface GatewayResult { code: string; record?: GatewayRecord; executionAuthorized: false; simulated: true; realMoneyMovedCents: 0 }
export const gatewayResult = (code: string, record?: GatewayRecord): GatewayResult => ({code,...(record ? {record} : {}),executionAuthorized:false,simulated:true,realMoneyMovedCents:0});
export function denyRealExecution(): { allowed: false; reason: string; executionAuthorized: false } {
  return {allowed:false,reason:'SIMULATION_LOCKDOWN_REAL_EXECUTION_DENIED',executionAuthorized:false};
}
export function parseGatewayRequest(input: unknown): GatewayRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_GATEWAY_REQUEST');
  const r=input as GatewayRequest;
  const ids=['idempotencyKey','customerId','workloadId','accountId','offerId','contractEvidenceId','supplierEvidenceId','paymentEvidenceId','approvalEvidenceId'] as const;
  if (r.mode !== 'SIMULATION' || !['vast_ai','runpod'].includes(r.provider) || !ids.every(k=>reference(r[k])) ||
      typeof r.gpuModel !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _-]{1,79}$/.test(r.gpuModel) ||
      !integer(r.gpuCount,128) || r.gpuCount < 1 || !integer(r.minVramGb,512) || r.minVramGb < 1 ||
      !integer(r.maxCostCents,gatewayLimits.perJobCents) || r.maxCostCents < 1 ||
      !integer(r.maxRuntimeMs,gatewayLimits.maxRuntimeMs) || r.maxRuntimeMs < 1) throw Error('INVALID_GATEWAY_REQUEST');
  const allowed=['mode','provider','gpuModel','gpuCount','minVramGb','maxCostCents','maxRuntimeMs',...ids];
  if (Object.keys(r).some(k=>!allowed.includes(k))) throw Error('UNKNOWN_GATEWAY_FIELD');
  return Object.fromEntries(allowed.map(k=>[k,(r as unknown as Record<string,unknown>)[k]])) as unknown as GatewayRequest;
}
export function gatewayDigest(request: GatewayRequest): string { return sha256(canonicalFacts({...request})); }
export function previewGateway(input: unknown): GatewayResult {
  if ((input as {mode?:unknown})?.mode === 'REAL') return gatewayResult(denyRealExecution().reason);
  try {parseGatewayRequest(input);return gatewayResult('SIMULATION_REVIEW_ONLY_INDEPENDENT_EVIDENCE_REQUIRED');}
  catch {return gatewayResult('INVALID_GATEWAY_REQUEST');}
}
export const transitions: Readonly<Record<GatewayState, readonly GatewayState[]>> = Object.freeze({
  SIMULATION_RESERVED:['SIMULATION_RUNNING','CANCELLED','QUARANTINED'],
  SIMULATION_RUNNING:['STOP_REQUIRED','QUARANTINED'], STOP_REQUIRED:['STOP_REQUIRED','QUARANTINED','SIMULATION_RECONCILED'],
  QUARANTINED:['SIMULATION_RECONCILED'], SIMULATION_RECONCILED:[], CANCELLED:[]
});
export function auditHash(previous: string, requestId: string, sequence: number, kind: string, digest: string): string {
  return sha256(canonicalFacts({previous,requestId,sequence,kind,digest}));
}
/** Explicitly injected SQL store for simulation journals. Never instantiated by application startup.
 * SERIALIZABLE retry is limited to known-aborted transactions. Lost COMMIT replies remain uncertain.
 */
export class PostgresSimulationGateway {
  constructor(private readonly pool: Pick<Pool,'connect' | 'query'>) {}
  private async transaction(work: (client: PoolClient)=>Promise<GatewayResult>): Promise<GatewayResult> {
    for (let attempt=0;attempt<3;attempt++) {
      let client: PoolClient | undefined, committing=false;
      try {
        client=await this.pool.connect();
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        await client.query("SET LOCAL lock_timeout = '3s'");
        await client.query("SET LOCAL statement_timeout = '5s'");
        const result=await work(client);
        committing=true;
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client?.query('ROLLBACK').catch(()=>undefined);
        const code=(error as {code?:string}).code;
        if (['40001','40P01'].includes(code || '') && attempt<2) continue;
        return gatewayResult(committing ? 'OUTCOME_UNKNOWN_RELOAD_IDEMPOTENCY_KEY' : 'SIMULATION_STORE_UNAVAILABLE');
      } finally {client?.release();}
    }
    return gatewayResult('SIMULATION_STORE_UNAVAILABLE');
  }
  async reserve(input: unknown): Promise<GatewayResult> {
    if ((input as {mode?:unknown})?.mode === 'REAL') return gatewayResult(denyRealExecution().reason);
    let req: GatewayRequest;
    try {req=parseGatewayRequest(input);} catch {return gatewayResult('INVALID_GATEWAY_REQUEST');}
    const digest=gatewayDigest(req),id=sha256(req.idempotencyKey);
    return this.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[20261120]);
      const prior=await client.query<GatewayRecord>('SELECT * FROM phase20_simulation_requests WHERE idempotency_key=$1 FOR UPDATE',[req.idempotencyKey]);
      if (prior.rows[0]) return gatewayResult(prior.rows[0].request_digest === digest ? 'REPLAY' : 'IDEMPOTENCY_CONFLICT',prior.rows[0]);
      const exposure=await client.query(`SELECT
        COUNT(*) FILTER (WHERE state IN ('SIMULATION_RESERVED','SIMULATION_RUNNING','STOP_REQUIRED','QUARANTINED'))::int AS active,
        COALESCE(SUM(max_cost_cents) FILTER (WHERE state <> 'CANCELLED' AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0)::int AS daily
        FROM phase20_simulation_requests`);
      if (Number(exposure.rows[0].active) >= gatewayLimits.concurrent) return gatewayResult('SIMULATION_CONCURRENCY_LIMIT');
      if (Number(exposure.rows[0].daily)+req.maxCostCents>gatewayLimits.dailyCents) return gatewayResult('SIMULATION_DAILY_CAP');
      const inserted=await client.query<GatewayRecord>(`INSERT INTO phase20_simulation_requests
        (id,idempotency_key,request_digest,request_payload,max_cost_cents,max_runtime_ms,deadline_ms)
        VALUES($1,$2,$3,$4,$5,$6::integer,floor(extract(epoch FROM now())*1000)::bigint+$6::integer) RETURNING *`,
        [id,req.idempotencyKey,digest,JSON.stringify(req),req.maxCostCents,req.maxRuntimeMs]);
      const eventDigest=sha256(canonicalFacts({requestDigest:digest,state:'SIMULATION_RESERVED'}));
      await client.query(`INSERT INTO phase20_simulation_events(request_id,sequence,event_key,kind,payload_digest,previous_hash,event_hash)
        VALUES($1,1,'reserve','SIMULATION_RESERVED',$2,$3,$4)`,[id,eventDigest,'0'.repeat(64),auditHash('0'.repeat(64),id,1,'SIMULATION_RESERVED',eventDigest)]);
      return gatewayResult('SIMULATION_RESERVED',inserted.rows[0]);
    });
  }
  async load(key: string): Promise<GatewayResult> {
    if (!reference(key)) return gatewayResult('INVALID_IDEMPOTENCY_KEY');
    try {const r=await this.pool.query<GatewayRecord>('SELECT * FROM phase20_simulation_requests WHERE idempotency_key=$1',[key]);return gatewayResult(r.rows[0]?'FOUND':'NOT_FOUND',r.rows[0]);}
    catch {return gatewayResult('SIMULATION_STORE_UNAVAILABLE');}
  }
  async transition(key: string, eventKey: string, version: number, target: GatewayState, observation?: ResourceObservation, lease?: {worker:string;fence:string}): Promise<GatewayResult> {
    if (!reference(key) || !reference(eventKey) || !integer(version) || version<1 || !Object.hasOwn(transitions,target)) return gatewayResult('INVALID_TRANSITION');
    let digest: string;
    try { digest=sha256(canonicalFacts({key,eventKey,version,target,observationDigest:observation ? sha256(canonicalFacts({...observation})) : ''})); }
    catch { return gatewayResult('INVALID_TRANSITION'); }
    return this.transaction(async client=>{
      const r=await client.query<GatewayRecord>('SELECT * FROM phase20_simulation_requests WHERE idempotency_key=$1 FOR UPDATE',[key]);
      const row=r.rows[0]; if (!row) return gatewayResult('NOT_FOUND');
      if(lease) {
        if(!reference(lease.worker)||!(/^[1-9][0-9]{0,18}$/).test(lease.fence))return gatewayResult('STALE_WORKER_FENCE');
        const held=await client.query(`SELECT request_id FROM phase21_simulation_leases WHERE request_id=$1 AND worker=$2 AND fence=$3::bigint AND expires_at>clock_timestamp() FOR UPDATE`,[row.id,lease.worker,lease.fence]);
        if(!held.rows.length)return gatewayResult('STALE_WORKER_FENCE',row);
      }
      const duplicate=await client.query('SELECT payload_digest FROM phase20_simulation_events WHERE request_id=$1 AND event_key=$2',[row.id,eventKey]);
      if (duplicate.rows[0]) return gatewayResult(duplicate.rows[0].payload_digest===digest?'REPLAY':'IDEMPOTENCY_CONFLICT',row);
      if (target==='SIMULATION_RUNNING' && Number(row.deadline_ms)<=Date.now()) return gatewayResult('SIMULATION_DEADLINE_EXPIRED',row);
      if (row.version!==version || !transitions[row.state].includes(target)) return gatewayResult('INVALID_TRANSITION',row);
      if (target==='SIMULATION_RECONCILED') {
        const payload=(row as GatewayRecord & {request_payload:GatewayRequest}).request_payload;
        const decision=assessTermination({resourceId:'sim:'+row.id,accountId:payload.accountId,
          startedAtMs:row.created_at.getTime(),deadlineMs:Number(row.deadline_ms),maxCostCents:row.max_cost_cents,maxRuntimeMs:payload.maxRuntimeMs},observation ?? null);
        if (decision.state!=='SIMULATION_RECONCILED') return gatewayResult('BILLING_RECONCILIATION_REQUIRED',row);
      }
      const last=await client.query('SELECT event_hash FROM phase20_simulation_events WHERE request_id=$1 AND sequence=$2',[row.id,version]);
      if (!last.rows[0]) throw Error('AUDIT_CHAIN_MISSING');
      let actualTarget=target;
      if (target==='STOP_REQUIRED') {
        if (row.cancellation_attempts>=3) actualTarget='QUARANTINED';
        else if (row.last_attempt_ms!==null && Date.now()-Number(row.last_attempt_ms)<30000) return gatewayResult('SIMULATION_STOP_BACKOFF',row);
      }
      const next=await client.query<GatewayRecord>(`UPDATE phase20_simulation_requests SET state=$1,version=version+1,
        cancellation_attempts=cancellation_attempts+CASE WHEN $1='STOP_REQUIRED' THEN 1 ELSE 0 END,
        last_attempt_ms=CASE WHEN $1='STOP_REQUIRED' THEN floor(extract(epoch FROM now())*1000)::bigint ELSE last_attempt_ms END
        WHERE id=$2 RETURNING *`,[actualTarget,row.id]);
      await client.query(`INSERT INTO phase20_simulation_events(request_id,sequence,event_key,kind,payload_digest,previous_hash,event_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[row.id,version+1,eventKey,actualTarget,digest,last.rows[0].event_hash,auditHash(last.rows[0].event_hash,row.id,version+1,actualTarget,digest)]);
      return gatewayResult('SIMULATION_TRANSITION_RECORDED',next.rows[0]);
    });
  }
  async recoverOutstanding() {
    try {
      const r=await this.pool.query<GatewayRecord>("SELECT * FROM phase20_simulation_requests WHERE state IN ('SIMULATION_RESERVED','SIMULATION_RUNNING','STOP_REQUIRED','QUARANTINED') ORDER BY created_at LIMIT 100");
      return r.rows.map(record=>({record,nextStep:record.state==='QUARANTINED' || record.cancellation_attempts>=3 ? 'HUMAN_RECONCILIATION' :
        Number(record.deadline_ms)<=Date.now() ? 'CUTOFF_REVIEW_REQUIRED' : 'SIMULATION_REVIEW',executionAuthorized:false as const}));
    } catch {throw Error('SIMULATION_RECOVERY_UNAVAILABLE');}
  }
  async audit(key: string): Promise<boolean> {
    if (!reference(key)) return false;
    try {
      const r=await this.pool.query('SELECT e.*,r.version,r.state,r.request_digest,r.request_payload FROM phase20_simulation_events e JOIN phase20_simulation_requests r ON r.id=e.request_id WHERE r.idempotency_key=$1 ORDER BY sequence',[key]);
      let previous='0'.repeat(64),sequence=1;
      if (!r.rows.length || r.rows[r.rows.length-1].kind!==r.rows[0].state || r.rows.length!==r.rows[0].version || gatewayDigest(parseGatewayRequest(r.rows[0].request_payload))!==r.rows[0].request_digest) return false;
      for (const e of r.rows) {
        if (e.sequence!==sequence || e.previous_hash!==previous || e.event_hash!==auditHash(previous,e.request_id,sequence,e.kind,e.payload_digest)) return false;
        previous=e.event_hash;sequence++;
      }
      return true;
    } catch {return false;}
  }
}
/** Non-billable provider interface: no create-instance, payment or outbound transport capability. */
export interface NonExecutingProviderAdapter {
  simulate(input: unknown, record: GatewayRecord): {origin:'SIMULATION';resourceId:string;state:'SIMULATED_RESOURCE_ONLY';capacityVerified:false;realMoneySpentCents:0};
  executeReal(): ReturnType<typeof denyRealExecution>;
}
export class SimulationProvisioningAdapter implements NonExecutingProviderAdapter {
  simulate(input: unknown, record: GatewayRecord) {
    const req=parseGatewayRequest(input);
    if (!record || record.id!==sha256(req.idempotencyKey) || record.idempotency_key!==req.idempotencyKey || record.request_digest!==gatewayDigest(req) ||
        !['SIMULATION_RESERVED','SIMULATION_RUNNING'].includes(record.state) || !Number.isSafeInteger(Number(record.deadline_ms)) || Number(record.deadline_ms)<=Date.now()) throw Error('SIMULATION_RESERVATION_BINDING_REQUIRED');
    return {origin:'SIMULATION' as const,resourceId:'sim:'+record.id,state:'SIMULATED_RESOURCE_ONLY' as const,capacityVerified:false as const,realMoneySpentCents:0 as const};
  }
  executeReal() {return denyRealExecution();}
}
