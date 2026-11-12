import type { Express } from 'express';
import { pgDbService } from './pgDatabase.js';
import { deploymentLifecycle, type ServiceLifecycle } from './phase21/lifecycle.js';

export function registerReadinessHealth(app: Express, options: {runtime?:ServiceLifecycle;timeoutMs?:number}={}) {
  const timeout=options.timeoutMs ?? 2000;
  if(!Number.isSafeInteger(timeout)||timeout<1||timeout>3000)throw Error('INVALID_READINESS_TIMEOUT');
  // Coalesce stuck probes instead of accumulating unlimited outstanding queries.
  let probe:Promise<boolean>|undefined;
  app.get('/api/ready', async (_req,res)=>{
    res.set('Cache-Control','no-store');
    const revision=/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT || '')?process.env.RENDER_GIT_COMMIT:'unknown';
    const runtime=options.runtime ?? (process.env.NODE_ENV==='production'?deploymentLifecycle:undefined);
    const fail=()=>res.status(503).json({status:'not_ready',database:'unavailable',revision});
    if(runtime && runtime.snapshot().state!=='READY' || process.env.NODE_ENV!=='production' && !pgDbService.isLiveDatabaseConnected())return fail();
    if(!probe) {
      const current=Promise.resolve().then(async()=>{
        if(process.env.NODE_ENV==='production')return pgDbService.probeReadiness();
        await pgDbService.query('SELECT 1');return true;
      }).then(value=>value,()=>false);
      probe=current;void current.finally(()=>{if(probe===current)probe=undefined;});
    }
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const ok=await Promise.race([probe,new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),timeout);})]);
      if(!ok || runtime && runtime.snapshot().state!=='READY')return fail();
      return res.status(200).json({status:'ready',database:'connected',revision});
    } finally {clearTimeout(timer);}
  });
}
