import type {Pool} from 'pg';
import {reference} from '../phase20/evidence.js';
/** Simulation leases use database time. Every durable worker write checks fence and expiry. No provider calls. */
export class SimulationLeaseStore {
 constructor(private readonly pool:Pick<Pool,'query'>){}
 async claim(requestId:string,worker:string,ttlMs=5000) {
  if(!/^[a-f0-9]{64}$/.test(requestId)||!reference(worker)||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>30000)throw Error('INVALID_LEASE');
  const result=await this.pool.query(`INSERT INTO phase21_simulation_leases(request_id,worker,fence,expires_at)
   SELECT id,$2,1,clock_timestamp()+$3::integer*interval '1 millisecond' FROM phase20_simulation_requests WHERE id=$1
   ON CONFLICT(request_id) DO UPDATE SET worker=EXCLUDED.worker,fence=phase21_simulation_leases.fence+1,expires_at=EXCLUDED.expires_at
   WHERE phase21_simulation_leases.expires_at<=clock_timestamp() RETURNING fence::text`,[requestId,worker,ttlMs]);
  return result.rows[0]?.fence as string|undefined;
 }
 async renew(requestId:string,worker:string,fence:string) {
  if(!/^[a-f0-9]{64}$/.test(requestId)||!reference(worker)||!(/^[1-9][0-9]{0,18}$/).test(fence))return false;
  const result=await this.pool.query(`UPDATE phase21_simulation_leases SET expires_at=clock_timestamp()+interval '5 seconds'
   WHERE request_id=$1 AND worker=$2 AND fence=$3::bigint AND expires_at>clock_timestamp() RETURNING request_id`,[requestId,worker,fence]);
  return result.rows.length===1;
 }
}
