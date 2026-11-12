import {canonicalFacts,sha256,reference} from '../phase20/evidence.js';
export const agentRoles=['LEAD_DISCOVERY','CUSTOMER_EVIDENCE','SUPPLIER_INTELLIGENCE','GPU_PRICING','QUOTATION','FINANCIAL_RISK','BILLING_RECONCILIATION','SECURITY_MONITORING','INFRASTRUCTURE_HEALTH','COMPLIANCE_REVIEW','CUSTOMER_DELIVERY_VERIFICATION','EXECUTIVE_REPORTING'] as const;
export type AgentRole=typeof agentRoles[number];
export interface AgentTask {id:string;role:AgentRole;facts:Record<string,string|boolean|number>;evidenceDigests:string[]}
/** Bounded preparation engine; injected advisory LLM has no tools. No Groq credential needed for deterministic mode. */
export class AdvisoryAgentRunner {
 private readonly running=new Set<AgentRole>();private readonly next=new Map<AgentRole,number>();
 async run(task:AgentTask,advisory?:(prompt:string,signal:AbortSignal)=>Promise<string>,now=Date.now()) {
  if(!agentRoles.includes(task.role)||!reference(task.id)||!Number.isSafeInteger(now)||now<0||task.evidenceDigests.length>32||task.evidenceDigests.some(d=>!/^[a-f0-9]{64}$/.test(d)))throw Error('INVALID_AGENT_TASK');
  const facts=canonicalFacts(task.facts);if(Buffer.byteLength(facts)>4096)throw Error('AGENT_INPUT_LIMIT');
  if(this.running.has(task.role)||now<(this.next.get(task.role)??0))throw Error('AGENT_RATE_LIMIT');
  this.running.add(task.role);this.next.set(task.role,now+30000);
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
   let narrative='DETERMINISTIC_REVIEW_REQUIRED',status='PREPARED';
   if(advisory)try {
    narrative=await Promise.race([advisory(JSON.stringify({role:task.role,facts:task.facts,evidenceDigests:task.evidenceDigests}),controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},3000);})]);
    if(typeof narrative!=='string'||Buffer.byteLength(narrative)>4096)throw Error('OUTPUT_LIMIT');
   }catch{narrative='ADVISORY_UNAVAILABLE';status='DEGRADED';}
   const auditDigest=sha256(canonicalFacts({taskId:task.id,role:task.role,inputDigest:sha256(facts),evidenceDigest:sha256(task.evidenceDigests.join(',')),status}));
   // Narrative is untrusted output, never parsed as an authorization or financial decision.
   return {taskId:task.id,role:task.role,status,narrative,auditDigest,humanReviewRequired:true,evidenceVerified:false,financialExecutionAllowed:false,externalActionsAllowed:false};
  }finally{clearTimeout(timer);controller.abort();this.running.delete(task.role);}
 }
}
