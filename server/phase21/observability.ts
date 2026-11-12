const eventNames=['REQUEST_FAILED','BOOTSTRAP_READY','BOOTSTRAP_FAILED','SHUTDOWN_STARTED','SHUTDOWN_FAILED','READINESS_FAILED','SUPPLIER_COLLECTION_FAILED','RECONCILIATION_REQUIRED'] as const;
export type OperationalEvent=typeof eventNames[number];
/** Allowlist fields instead of attempting to redact arbitrary provider/error bodies. */
export function operationalEvent(event:OperationalEvent,fields:Record<string,unknown>={}) {
  if(!eventNames.includes(event))throw Error('INVALID_OPERATIONAL_EVENT');
  const result:Record<string,string|number|boolean>={event,financialExecutionAllowed:false};
  for(const key of ['revision','requestId','provider','errorCode','durationMs']) {
    const value=fields[key];
    if(key==='durationMs' && typeof value==='number' && Number.isFinite(value) && value>=0 && value<86400000)result[key]=value;
    else if(key==='revision' && typeof value==='string' && /^[a-f0-9]{40}$/.test(value))result[key]=value;
    else if(key==='provider' && ['runpod','vast_ai'].includes(String(value)))result[key]=String(value);
    else if(key==='errorCode' && typeof value==='string' && /^[A-Z][A-Z_]{0,63}$/.test(value))result[key]=value;
    else if(key==='requestId' && typeof value==='string' && /^[a-f0-9]{64}$/.test(value))result[key]=value;
  }
  return result;
}

import type {ErrorRequestHandler} from 'express';
export const safeRequestErrorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(res.headersSent){res.destroy();return;}
  const code=error?.type==='entity.too.large'?'REQUEST_TOO_LARGE':error?.type==='entity.parse.failed'?'INVALID_JSON':'REQUEST_FAILED';
  const status=code==='REQUEST_TOO_LARGE'?413:code==='INVALID_JSON'?400:500;
  console.warn(operationalEvent('REQUEST_FAILED',{errorCode:code}));
  res.status(status).json({error:code,financialExecutionAllowed:false});
};
