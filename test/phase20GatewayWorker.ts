import {Pool} from 'pg';
import {PostgresSimulationGateway} from '../server/phase20/gateway.js';
import {request} from './phase20Fixtures.js';
if(process.env.NODE_ENV!=='test' || process.env.ALLOW_ISOLATED_GPU_DB_TEST!=='YES' || process.env.DATABASE_URL ||
   !/^gpu_test_[a-f0-9]{16}$/.test(process.env.PHASE20_TEST_SCHEMA || '') || !process.env.TEST_DATABASE_URL) throw Error('ISOLATED_TEST_ENVIRONMENT_REQUIRED');
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path='+process.env.PHASE20_TEST_SCHEMA,connectionTimeoutMillis:5000});
if(process.env.PHASE20_WORKER_MODE==='CRASH') {
  const original=pool.connect.bind(pool);
  (pool as any).connect=async()=>{
    const client=await original();const query=client.query.bind(client);
    (client as any).query=async(sql:string,args?:unknown[])=>{
      const result=await query(sql,args);
      if(sql.startsWith('INSERT INTO phase20_simulation_requests')) process.exit(17);
      return result;
    };return client;
  };
}
try {
  const result=await new PostgresSimulationGateway(pool).reserve({...request,idempotencyKey:process.env.PHASE20_REQUEST_KEY || request.idempotencyKey});
  console.log(JSON.stringify({code:result.code,executionAuthorized:result.executionAuthorized}));
} finally {await pool.end();}
