import {CollectorCircuit} from './circuitBreaker.js';
import {sha256,canonicalFacts} from '../phase20/evidence.js';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isPublicIPv4,type FeedDnsResolver,type FeedHttpsTransport} from '../secureFeedFetch.js';
const operations={
  VAST_ACCOUNT:{url:'https://console.vast.ai/api/v0/users/current/',method:'GET',body:undefined},
  VAST_OFFERS:{url:'https://console.vast.ai/api/v0/bundles',method:'POST',body:JSON.stringify({limit:100,type:'on-demand',verified:{eq:true},rentable:{eq:true},rented:{eq:false}})},
  RUNPOD_ACCOUNT:{url:'https://api.runpod.io/graphql',method:'POST',body:JSON.stringify({query:'query AccountBinding { myself { id clientBalance } }'})},
  RUNPOD_CATALOG:{url:'https://api.runpod.io/graphql',method:'POST',body:JSON.stringify({query:'query ReadOnlyCatalog { gpuTypes { id displayName memoryInGb lowestPrice(input: { gpuCount: 1, secureCloud: true }) { stockStatus uninterruptablePrice availableGpuCounts } } }'})}
} as const;
const collectorCircuit=new CollectorCircuit(Object.keys(operations));
export type ReadOnlyOperation=keyof typeof operations;
/** Fixed read-only operations, public DNS pinning, TLS validation, no redirects or credentials in URLs/results. */
export async function readSupplierOperation(operation:ReadOnlyOperation,readSecret:()=>string|undefined,
  testTransport?:{resolve:FeedDnsResolver;request:FeedHttpsTransport}):Promise<unknown> {
  if(!Object.hasOwn(operations,operation))throw Error('OPERATION_FORBIDDEN');
  if(testTransport && !(process.env.NODE_ENV==='test'&&process.env.DISABLE_JSON_PERSISTENCE==='true'&&!process.env.DATABASE_URL))throw Error('TEST_TRANSPORT_FORBIDDEN');
  let secret:string|undefined;try{secret=readSecret();}catch{throw Error('SUPPLIER_CREDENTIAL_UNAVAILABLE');}
  if(typeof secret!=='string' || !/^[A-Za-z0-9_.-]{8,512}$/.test(secret))throw Error('SUPPLIER_CREDENTIAL_REQUIRED');
  const op=operations[operation],url=new URL(op.url),controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const complete=testTransport?(_success:boolean)=>{}:collectorCircuit.enter(operation);
  try {
    const result=await Promise.race([(async()=>{
      const resolve:FeedDnsResolver=testTransport?.resolve ?? lookup;
      const addresses=await resolve(url.hostname,{all:true,verbatim:true});
      if(!addresses.length || addresses.some(a=>!isPublicIPv4(a.address)))throw Error('UNSAFE_SUPPLIER_DNS');
      controller.signal.throwIfAborted();
      const address=addresses[0].address;
      return await new Promise<unknown>((resolve,reject)=>{
        let settled=false;
        const fail=(error:Error)=>{if(!settled){settled=true;reject(error);}};
        const req=(testTransport?.request ?? https.request)(url,{
          method:op.method,agent:false,rejectUnauthorized:true,servername:url.hostname,signal:controller.signal,timeout:6000,
          headers:{Authorization:'Bearer '+secret,Accept:'application/json','Accept-Encoding':'identity',...(op.body?{'Content-Type':'application/json'}:{})},
          lookup:(_hostname,options,callback)=>{if(typeof options==='object'&&options.all)callback(null,[{address,family:4}]);else callback(null,address,4);}
        },response=>{
          response.on('error',fail);response.on('aborted',()=>fail(Error('SUPPLIER_RESPONSE_ABORTED')));
          if(!response.statusCode || response.statusCode<200 || response.statusCode>=300 || response.headers['content-encoding'] && response.headers['content-encoding']!=='identity'){
            response.destroy();fail(Error('SUPPLIER_HTTP_REJECTED'));return;
          }
          const chunks:Buffer[]=[];let bytes=0;
          response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>1048576){response.destroy();fail(Error('SUPPLIER_BODY_LIMIT'));}else chunks.push(chunk);});
          response.on('end',()=>{if(settled)return;try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));settled=true;resolve(parsed);}catch{fail(Error('INVALID_SUPPLIER_JSON'));}});
        });
        req.on('timeout',()=>req.destroy(Error('SUPPLIER_TIMEOUT')));req.on('error',fail);req.end(op.body);
      });
    })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('SUPPLIER_TIMEOUT'));},6000);})]);
    complete(true);return result;
  } catch {complete(false);throw Error('READ_ONLY_SUPPLIER_VERIFICATION_FAILED');}
  finally {clearTimeout(timer);controller.abort();}
}
/** Parse the provider's decimal representation with integer arithmetic; never multiply binary floats. */
export const providerUsdCents=(value:unknown,roundUp=false):number|null=>{
  if(typeof value!=='number'||!Number.isFinite(value))return null;
  const match=/^(0|[1-9][0-9]{0,6})(?:\.([0-9]{1,16}))?$/.exec(String(value));
  if(!match)return null;
  const fraction=match[2]??'',tail=fraction.slice(2),hasRemainder=/[1-9]/.test(tail);
  if(hasRemainder&&!roundUp)return null;
  const cents=BigInt(match[1])*100n+BigInt((fraction+'00').slice(0,2))+(hasRemainder&&roundUp?1n:0n);
  return cents<=100000000n?Number(cents):null;
};
const identity=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)?value:typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):null;
/** Two independently requested API responses, expected-account binding, no capacity reservation or signing. */
export async function collectSupplierSnapshot(provider:'vast_ai'|'runpod',expectedAccountId:string,
  read:(operation:ReadOnlyOperation)=>Promise<unknown>,origin:'AUTHENTICATED_READ_ONLY'|'SIMULATION',now=Date.now()) {
  if(!['vast_ai','runpod'].includes(provider)||!identity(expectedAccountId)||!['AUTHENTICATED_READ_ONLY','SIMULATION'].includes(origin)||!Number.isSafeInteger(now)||now<0)throw Error('INVALID_COLLECTION_REQUEST');
  const account:any=await read(provider==='vast_ai'?'VAST_ACCOUNT':'RUNPOD_ACCOUNT');
  if(account?.errors!=null && (!Array.isArray(account.errors)||account.errors.length))throw Error('SUPPLIER_ACCOUNT_UNVERIFIED');
  const user=provider==='vast_ai'?account:account?.data?.myself;
  if(identity(user?.id)!==expectedAccountId)throw Error('SUPPLIER_ACCOUNT_MISMATCH');
  const balanceCents=providerUsdCents(provider==='vast_ai'?user.credit:user.clientBalance);
  const catalog:any=await read(provider==='vast_ai'?'VAST_OFFERS':'RUNPOD_CATALOG');
  if(catalog?.errors!=null && (!Array.isArray(catalog.errors)||catalog.errors.length))throw Error('SUPPLIER_CATALOG_UNVERIFIED');
  const raw=provider==='vast_ai'?catalog?.offers:catalog?.data?.gpuTypes;
  if(!Array.isArray(raw)||raw.length>1000)throw Error('SUPPLIER_CATALOG_UNVERIFIED');
  const offers=raw.slice(0,100).flatMap((row:any)=>{
    const rawId=typeof row?.id==='number'?String(row.id):row?.id;
    const id=typeof rawId==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,127}$/.test(rawId)?rawId:null,model=provider==='vast_ai'?row?.gpu_name:row?.displayName;
    const rawPrice=provider==='vast_ai'?row?.dph_total:row?.lowestPrice?.uninterruptablePrice;
    const price=providerUsdCents(rawPrice,true);
    if(!id || typeof model!=='string'||!model.trim()||model.length>80||price===null||price<=0)return [];
    const count=provider==='vast_ai'?row.num_gpus:1;
    if(!Number.isSafeInteger(count)||count<1||count>128)return [];
    return [{offerId:sha256(canonicalFacts({provider,providerOfferId:id})),providerOfferId:id,gpuModel:model,bundleGpuCount:count,bundleHourlyCents:price,observedHourlyUsd:rawPrice,
      reportedMemory:typeof (provider==='vast_ai'?row.gpu_ram:row.memoryInGb)==='number'&&Number.isFinite(provider==='vast_ai'?row.gpu_ram:row.memoryInGb)&& (provider==='vast_ai'?row.gpu_ram:row.memoryInGb)>0?(provider==='vast_ai'?row.gpu_ram:row.memoryInGb):null,
      memoryUnit:provider==='vast_ai'?'PROVIDER_MB':'PROVIDER_GB',
      advertisedGpuCounts:provider==='runpod'&&Array.isArray(row.lowestPrice?.availableGpuCounts)?row.lowestPrice.availableGpuCounts.filter((n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=1&&n<=128).slice(0,128):[count],
      advertisedAvailable:provider==='vast_ai'?row.rentable===true&&row.rented===false:['High','Medium','Low'].includes(row.lowestPrice?.stockStatus),capacityVerified:false}];
  });
  return {provider,accountBound:true,accountId:expectedAccountId,balanceCents,offers,origin,observedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString(),
    rawEvidenceDigest:sha256(JSON.stringify({account,catalog})),apiVersion:provider==='vast_ai'?'v0':'GraphQL',authenticationMethod:'BEARER',endpoints:provider==='vast_ai'?[operations.VAST_ACCOUNT.url,operations.VAST_OFFERS.url]:[operations.RUNPOD_ACCOUNT.url,operations.RUNPOD_CATALOG.url],billingMinimumSeconds:null,storageHourlyCents:null,networkEgressCents:null,regionRestrictions:null,automaticCharging:'NOT_VERIFIED',trustStatus:origin==='SIMULATION'?'NOT_VERIFIED':'PARTIAL',evidenceStatus:origin==='SIMULATION'?'UNVERIFIED':'PARTIALLY_VERIFIED',independentlyVerified:false,autoChargeDisabledVerified:false,purchasingAllowed:false};
}
