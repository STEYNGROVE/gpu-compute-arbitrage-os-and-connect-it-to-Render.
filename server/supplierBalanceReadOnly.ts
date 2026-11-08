/** Diagnostic only. No reservations, payments, provisioning or procurement authority. */
export type BalanceProbe = {supplier:'vast_ai'|'runpod'; authenticated:boolean; balanceUsd:number|null; balanceEvidenceVerified:boolean; autoChargeDisabledVerified:boolean; billingMode:string|null; errorCode:string|null; checkedAt:string; readOnly:true; procurementBlocked:true};
const result=(supplier:BalanceProbe['supplier']):BalanceProbe=>({supplier,authenticated:false,balanceUsd:null,balanceEvidenceVerified:false,autoChargeDisabledVerified:false,billingMode:null,errorCode:null,checkedAt:new Date().toISOString(),readOnly:true,procurementBlocked:true});
function amount(x:unknown):number|null {return typeof x==='number' && Number.isFinite(x) && x>=0 && x<100000000 ? x : null;}
async function request(url:string,key:string,method:'GET'|'POST',body?:string):Promise<unknown>{
 const origin=new URL(url).origin;
 if(!['https://console.vast.ai','https://api.runpod.io'].includes(origin))throw Error('ENDPOINT_BLOCKED');
 const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),6000);
 try {const response=await fetch(url,{method,redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body}:{})});if(!response.ok)throw Error('HTTP_ERROR');return await response.json();}finally{clearTimeout(timer);}
}
export async function probeSupplierBalance(supplier:'vast_ai'|'runpod'):Promise<BalanceProbe>{
 const r=result(supplier), key=supplier==='vast_ai'?process.env.VAST_API_KEY:process.env.RUNPOD_API_KEY;
 if(!key || key.trim().length<6){r.errorCode='KEY_REQUIRED';return r;}
 try {
  if(supplier==='runpod'){
   const data:any=await request('https://api.runpod.io/graphql',key,'POST',JSON.stringify({query:'query SupplierBalanceReadOnly { myself { id clientBalance billingMode isAutoPayEnabled enableBackupPayments stripeAutoReloadAmount } }'}));
   if(data?.errors?.length){r.errorCode='GRAPHQL_ERROR';return r;}
   const user=data?.data?.myself;
   if(!user?.id){r.errorCode='IDENTITY_UNVERIFIED';return r;}
   r.authenticated=true;r.balanceUsd=amount(user.clientBalance);
   r.billingMode=typeof user.billingMode==='string'?user.billingMode:null;
   r.balanceEvidenceVerified=r.balanceUsd!==null;
   r.autoChargeDisabledVerified=user.isAutoPayEnabled===false && user.enableBackupPayments===false && user.stripeAutoReloadAmount===0 && r.billingMode==='PREPAID';
  } else {
   const data:any=await request('https://console.vast.ai/api/v0/users/current/',key,'GET');
   if(!data || !(data.id || data.username || data.email)){r.errorCode='IDENTITY_UNVERIFIED';return r;}
   r.authenticated=true;
   // Do not infer prepaid credit from a negative debt/balance or unknown schema.
   r.balanceUsd=amount(data.credit);
   r.balanceEvidenceVerified=r.balanceUsd!==null;
   // Vast automatic charging cannot be verified from this API response; always require independent review.
   r.autoChargeDisabledVerified=false;
  }
  if(!r.balanceEvidenceVerified)r.errorCode='BALANCE_SCHEMA_UNVERIFIED';
  else if(!r.autoChargeDisabledVerified)r.errorCode='AUTO_CHARGE_NOT_INDEPENDENTLY_VERIFIED';
 } catch {r.errorCode='READ_ONLY_REQUEST_FAILED';}
 return r;
}
