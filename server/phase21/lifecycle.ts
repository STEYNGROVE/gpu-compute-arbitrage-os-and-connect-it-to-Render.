export type ServiceState='STARTING'|'READY'|'FAILED'|'DRAINING'|'STOPPED';
export class ServiceLifecycle {
  private state:ServiceState='STARTING';
  private failures=0;
  complete(success:boolean) {if(this.state!=='STARTING')return;this.state=success?'READY':'FAILED';if(!success)this.failures++;}
  drain() {if(this.state!=='STOPPED')this.state='DRAINING';}
  stopped(){this.state='STOPPED';}
  snapshot(){return {state:this.state,bootstrapFailures:this.failures,financialExecutionAllowed:false as const};}
}
export const deploymentLifecycle=new ServiceLifecycle();
/** Idempotent bounded shutdown. Never dispatches provider termination or releases financial exposure. */
export function gracefulShutdown(runtime:ServiceLifecycle,stopAccepting:()=>void,closeDependencies:()=>Promise<void>,exit:(code:number)=>void,deadlineMs=10000) {
  if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>30000)throw Error('INVALID_SHUTDOWN_DEADLINE');
  let running:Promise<void>|undefined;
  return ()=>running ??= (async()=>{
    runtime.drain();
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      stopAccepting();
      await Promise.race([closeDependencies(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('SHUTDOWN_TIMEOUT')),deadlineMs);})]);
      runtime.stopped();exit(0);
    } catch {exit(1);} finally {clearTimeout(timer);}
  })();
}
