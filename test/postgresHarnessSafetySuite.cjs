const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
async function scenario(failStart,phase23=false) {
  const calls=[], errors=[];let passwordMode;
  const fakeProcess={argv:phase23?['node','harness','--phase23']:['node','harness'],env:{DATABASE_URL:'fixture'},execPath:process.execPath,exitCode:undefined};
  const listener={once(){return this;},listen(_port,_host,done){done();},address(){return {port:34567};},close(done){done();}};
  const context={process:fakeProcess,console:{log(){},error(...args){errors.push(args.join(' '));}},require(name){
    if(name==='node:net') return {createServer:()=>listener};
    if(name==='node:fs') return {mkdtempSync:()=>'/isolated-fixture',writeFileSync(_p,_v,opts){passwordMode=opts.mode;},unlinkSync(){},chmodSync(){}};
    if(name==='node:child_process') return {spawnSync(command,args,options){
      calls.push({command,args,env:options.env});
      if(failStart&&command==='pg_ctl') return {status:1};
      return {status:0};
    }};
    return require(name);
  }};
  vm.runInNewContext(fs.readFileSync('scripts/test-phase16-postgres.cjs','utf8'),context);
  await new Promise(setImmediate);
  assert.equal(passwordMode,0o600);
  const init=calls.find(x=>x.command==='initdb');
  assert(init.args.includes('--auth-host=scram-sha-256'));assert(!init.args.includes('--auth=trust'));
  assert(calls.some(x=>x.command==='pg_ctl'&&x.args.includes('stop')),'Cleanup must follow startup attempt');
  if(failStart){assert.equal(fakeProcess.exitCode,1);assert(errors.some(x=>x.includes('Cleanup also failed')));assert(errors.some(x=>x.includes('pg_ctl failed: 1')));}
  else {assert.equal(calls.some(x=>x.args.includes('test/phase23DatabaseRemediation.ts')),phase23);assert.equal(fakeProcess.exitCode,undefined);for(const call of calls.filter(x=>x.command===process.execPath))assert.equal(call.env.DATABASE_URL,undefined);}
}
(async()=>{await scenario(false);await scenario(true);await scenario(false,true);console.log('PASS: password-authenticated harness and best-effort cleanup preserve startup failure');})().catch(e=>{console.error(e);process.exitCode=1;});
