import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const scanner=path.resolve('scripts/security-check.cjs');
function scanTracked(source:string) {
  const root=mkdtempSync(path.join(tmpdir(),'phase22-security-'));
  try {
    execFileSync('git',['init','--quiet',root]);
    writeFileSync(path.join(root,'fixture.ts'),source);
    execFileSync('git',['-C',root,'add','fixture.ts']);
    const result=spawnSync(process.execPath,[scanner],{cwd:root,encoding:'utf8'});
    assert.ifError(result.error);
    return {status:result.status,output:result.stdout+result.stderr};
  } finally {rmSync(root,{recursive:true,force:true});}
}
test('tracked credential literals still fail security scanning without disclosure',()=>{
  // Deliberately synthetic, assembled only inside a disposable tracked-file fixture.
  const synthetic='not-a-real-credential-'+ 'x'.repeat(32);
  for(const name of ['DATABASE_URL','BINANCE_API_SECRET','GROQ_API_KEY']) {
    const result=scanTracked('const '+name+' = '+JSON.stringify(synthetic)+';');
    assert.equal(result.status,1);assert.match(result.output,/Possible hardcoded credential: fixture.ts/);
    assert.ok(!result.output.includes(synthetic));
  }
});
test('runtime construction of a synthetic database fixture passes unchanged scanner',()=>{
  const source=[
    "const fixture=new URL('postgresql://fixture@primary.example/db');",
    "fixture.password='synthetic-password';",
    'process.env.DATABASE_URL=fixture.href;'
  ].join('\n');
  const result=scanTracked(source);assert.equal(result.status,0);assert.match(result.output,/PASS: Basic tracked-file security checks/);
});
