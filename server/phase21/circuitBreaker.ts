/** Small fixed-key collector guard; unknown operations cannot grow memory. Process-local only. */
export class CollectorCircuit {
 private readonly states=new Map<string,{inflight:boolean;failures:number;next:number}>();
 constructor(private readonly operations:readonly string[]){}
 enter(operation:string,now=Date.now()) {
  if(!this.operations.includes(operation)||!Number.isSafeInteger(now)||now<0)throw Error('INVALID_COLLECTOR_OPERATION');
  const state=this.states.get(operation)??{inflight:false,failures:0,next:0};
  if(state.inflight||now<state.next)throw Error(state.failures>=3?'SUPPLIER_CIRCUIT_OPEN':'SUPPLIER_RATE_LIMIT');
  state.inflight=true;state.next=now+30000;this.states.set(operation,state);
  let finished=false;
  return (success:boolean,finishedAt=Date.now())=>{
   if(finished)return;finished=true;state.inflight=false;
   const time=Number.isSafeInteger(finishedAt)&&finishedAt>=now?finishedAt:now;
   state.failures=success?0:state.failures+1;
   state.next=Math.max(state.next,time+(state.failures>=3?60000:0));
  };
 }
}
