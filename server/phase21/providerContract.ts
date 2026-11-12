import {integer,reference,canonicalFacts,sha256} from '../phase20/evidence.js';
export interface ProviderContract {
 provider:'vast_ai'|'runpod';accountId:string;offerId:string;gpuModel:string;vramGb:number;quantity:number;
 region:string;resourceType:'ON_DEMAND';hourlyMinorUnits:number;currency:'USD';minimumBillingSeconds:number;
 storageHourlyMinorUnits:number;networkPerGbMinorUnits:number;termsReference:string;resourceId:string;
 cancellationSemantics:'STOP_MAY_RETAIN_STORAGE'|'DESTROY_REQUIRES_FINAL_INVOICE';observedAtMs:number;expiresAtMs:number;
}
/** Recorded/nonexecuting contracts only. Complete metadata is necessary but cannot prove capacity. */
export function reviewProviderContract(input:ProviderContract,policy:{provider:ProviderContract['provider'];accountId:string;regions:readonly string[]},now=Date.now()) {
 if(!input||!integer(now)||!['vast_ai','runpod'].includes(input.provider)||input.provider!==policy.provider||input.accountId!==policy.accountId||
  ![input.accountId,input.offerId,input.resourceId].every(reference)||typeof input.gpuModel!=='string'||!input.gpuModel.trim()||input.gpuModel.length>80||
  !integer(input.vramGb,512)||input.vramGb<1||!integer(input.quantity,128)||input.quantity<1||!policy.regions.includes(input.region)||
  input.resourceType!=='ON_DEMAND'||input.currency!=='USD'||!integer(input.hourlyMinorUnits,100000000)||input.hourlyMinorUnits<1||
  !integer(input.minimumBillingSeconds,3600)||input.minimumBillingSeconds<1||!integer(input.storageHourlyMinorUnits,100000000)||!integer(input.networkPerGbMinorUnits,100000000)||
  !reference(input.termsReference)||!['STOP_MAY_RETAIN_STORAGE','DESTROY_REQUIRES_FINAL_INVOICE'].includes(input.cancellationSemantics)||
  !integer(input.observedAtMs)||!integer(input.expiresAtMs)||input.observedAtMs>now||input.expiresAtMs<=now||input.expiresAtMs-input.observedAtMs>60000)throw Error('INCOMPLETE_OR_UNBOUND_PROVIDER_CONTRACT');
 return {digest:sha256(canonicalFacts({...input})),reviewStatus:'RECORDED_CONTRACT_ONLY',capacityVerified:false,liveAdapterCertified:false,executionAuthorized:false};
}
