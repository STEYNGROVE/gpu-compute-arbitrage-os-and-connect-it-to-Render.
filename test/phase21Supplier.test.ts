import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readSupplierOperation,collectSupplierSnapshot} from '../server/phase21/supplierReadOnly.js';
process.env.NODE_ENV='test';process.env.DISABLE_JSON_PERSISTENCE='true';delete process.env.DATABASE_URL;
function transport(data:unknown,status=200) {
  const captured:any={requests:0,resolutions:0};
  return {captured,resolve:(async()=>{captured.resolutions++;return [{address:'8.8.8.8',family:4}];}) as any,
    request:((url:any,options:any,respond:any)=>{captured.requests++;captured.url=url.href;captured.options=options;
      const req:any=new EventEmitter();req.destroy=(error:Error)=>req.emit('error',error);req.end=(body:any)=>{captured.body=body;queueMicrotask(()=>{
        const res:any=new EventEmitter();res.statusCode=status;res.headers={};res.destroy=()=>{};respond(res);res.emit('data',Buffer.from(JSON.stringify(data)));res.emit('end');
      });};return req;}) as any};
}
test('fixed read-only queries pin DNS and TLS without credentials in URL/results',async()=>{
  const mock=transport({data:{myself:{id:'account_test01'}}});const data=await readSupplierOperation('RUNPOD_ACCOUNT',()=> 'synthetic-unit-credential',mock);
  assert.deepEqual(data,{data:{myself:{id:'account_test01'}}});assert.equal(mock.captured.options.rejectUnauthorized,true);assert.equal(mock.captured.options.agent,false);assert.equal(mock.captured.options.servername,'api.runpod.io');assert(!mock.captured.url.includes('synthetic'));assert(!mock.captured.body.includes('mutation'));
  const pinned:any[]=[];mock.captured.options.lookup('api.runpod.io',{all:true},(...args:any[])=>pinned.push(args));assert.equal(pinned[0][1][0].address,'8.8.8.8');assert.equal(mock.captured.resolutions,1);
});
test('unsafe DNS, redirects and unknown operations reject without paid transport',async()=>{
  const mock=transport({});mock.resolve=async()=>[{address:'127.0.0.1',family:4}];await assert.rejects(readSupplierOperation('VAST_OFFERS',()=> 'synthetic-unit-credential',mock));assert.equal(mock.captured.requests,0);
  await assert.rejects(readSupplierOperation('RUNPOD_ACCOUNT',()=> 'synthetic-unit-credential',transport({},302)));
  await assert.rejects(readSupplierOperation('CREATE_INSTANCE' as any,()=> 'synthetic-unit-credential',transport({})),/FORBIDDEN/);
});
test('production cannot accept injected transports or credential header injection',async()=>{
  const saved=process.env.NODE_ENV;try {process.env.NODE_ENV='production';await assert.rejects(readSupplierOperation('RUNPOD_ACCOUNT',()=> 'synthetic-unit-credential',transport({})),/TEST_TRANSPORT_FORBIDDEN/);}finally{process.env.NODE_ENV=saved;}
  await assert.rejects(readSupplierOperation('VAST_ACCOUNT',()=> 'bad\r\nheader',transport({})),/CREDENTIAL_REQUIRED/);
});
test('account mismatch blocks inventory queries and no-auto-charge is never inferred',async()=>{
  let count=0;await assert.rejects(collectSupplierSnapshot('runpod','account_test01',async()=>{count++;return {data:{myself:{id:'wrong_account'}}};},'SIMULATION'),/MISMATCH/);assert.equal(count,1);
  const snapshot=await collectSupplierSnapshot('runpod','account_test01',async op=>op==='RUNPOD_ACCOUNT'?{data:{myself:{id:'account_test01',clientBalance:2}}}:{data:{gpuTypes:[{id:'NVIDIA H100',displayName:'H100',memoryInGb:80,lowestPrice:{stockStatus:'High',uninterruptablePrice:0.3456}}]}},'SIMULATION');
  assert.equal(snapshot.evidenceStatus,'UNVERIFIED');assert.equal(snapshot.offers[0].bundleHourlyCents,35);assert.equal(snapshot.offers[0].providerOfferId,'NVIDIA H100');assert.equal(snapshot.autoChargeDisabledVerified,false);assert.equal(snapshot.independentlyVerified,false);assert.equal(snapshot.purchasingAllowed,false);
});

test('secret-store exceptions are sanitized before transport',async()=>{
  await assert.rejects(readSupplierOperation('VAST_ACCOUNT',()=>{throw Error('PRIVATE_SECRET_STORE_DETAIL');},transport({})),error=>{assert.equal((error as Error).message,'SUPPLIER_CREDENTIAL_UNAVAILABLE');return true;});
});
