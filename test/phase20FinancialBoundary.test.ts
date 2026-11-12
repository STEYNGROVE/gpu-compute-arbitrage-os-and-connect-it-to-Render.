import {SettlementRepository} from '../server/repositories/operationJobSettlementOutboxRepo.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TreasuryRepository, ReservationRepository} from '../server/repositories/treasuryAndReservationRepo.js';
import {reserveVerifiedCredit} from '../server/prepaidReservationGate.js';

for(const operation of ['recordDoubleEntryTransaction','createReservationAtomic','consumeReservation','releaseReservation']) test(`legacy ${operation} rejects before DB and financial state mutation`,async()=>{
  let calls=0;
  const target=operation==='recordDoubleEntryTransaction' ? new TreasuryRepository() : new ReservationRepository();
  (target as any).query=async()=>{calls++;throw Error('UNEXPECTED_DB');};
  (target as any).withTransaction=async()=>{calls++;throw Error('UNEXPECTED_TRANSACTION');};
  await assert.rejects((target as any)[operation]({}),/SIMULATION_LOCKDOWN/);assert.equal(calls,0);
});
test('legacy internal credit reservation is unavailable outside explicit isolated tests',async()=>{
  const oldMode=process.env.NODE_ENV,oldPersistence=process.env.DISABLE_JSON_PERSISTENCE;
  try {
    process.env.NODE_ENV='production';process.env.DISABLE_JSON_PERSISTENCE='true';
    const result=await reserveVerifiedCredit({connect:()=>{throw Error('NO_DB');}} as any,{} as any,1000,100);
    assert.equal(result.reserved,false);assert.equal(result.reason,'SIMULATION_LOCKDOWN_INTERNAL_RESERVATION_DISABLED');
  } finally {if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;if(oldPersistence===undefined)delete process.env.DISABLE_JSON_PERSISTENCE;else process.env.DISABLE_JSON_PERSISTENCE=oldPersistence;}
});
test('transaction errors redact callback/rollback messages and enumerable diagnostic payloads',async()=>{
  const {BasePostgresRepository}=await import('../server/repositories/baseRepo.js');
  const {pgDbService}=await import('../server/pgDatabase.js');
  const originalConnected=pgDbService.isLiveDatabaseConnected, originalClient=pgDbService.getClient, originalLog=console.error;
  const logs:unknown[][]=[];let released=false;
  class Probe extends BasePostgresRepository {run(){return this.withTransaction(async()=>{const error=Object.assign(Error('PRIVATE_DB_PAYLOAD'),{detail:'PRIVATE_DB_DETAIL'});throw error;});}}
  try {
    pgDbService.isLiveDatabaseConnected=()=>true;
    pgDbService.getClient=(async()=>({query:async(sql:string)=>{if(sql==='ROLLBACK')throw Object.assign(Error('PRIVATE_ROLLBACK_PAYLOAD'),{code:'40001'});return {rows:[]};},release:()=>{released=true;}})) as any;
    console.error=(...args:unknown[])=>{logs.push(args);};
    await assert.rejects(new Probe().run(),error=>{
      assert.equal((error as Error).message,'PostgreSQL transaction failed');assert(!JSON.stringify(error).includes('PRIVATE_DB'));return true;
    });
    assert(released);assert(!JSON.stringify(logs).includes('PRIVATE_ROLLBACK'));
  } finally {pgDbService.isLiveDatabaseConnected=originalConnected;pgDbService.getClient=originalClient;console.error=originalLog;}
});

test('direct settled-record insertion cannot fabricate realized financial state',async()=>{
  const repository=new SettlementRepository();let calls=0;
  (repository as any).query=async()=>{calls++;throw Error('UNEXPECTED_DB');};
  await assert.rejects(repository.createSettlement({} as any),/SIMULATION_LOCKDOWN/);assert.equal(calls,0);
});
