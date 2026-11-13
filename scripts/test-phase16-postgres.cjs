/** Creates and stops only its own disposable local PostgreSQL cluster. Never uses DATABASE_URL. */
const { mkdtempSync, writeFileSync, unlinkSync, chmodSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const net = require('node:net');
const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error || result.status !== 0) throw Error(`${command} failed: ${result.error?.message || result.status}`);
};
async function main() {
  if (process.env.RENDER || process.env.NODE_ENV === 'production') throw Error('DEPLOYMENT_ENVIRONMENT_FORBIDDEN');
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const root = mkdtempSync(join(tmpdir(), 'phase16-pg-'));
  const cluster = join(root, 'data');
  const password = randomBytes(32).toString('hex');
  const passwordFile = join(root, 'password');
  writeFileSync(passwordFile, password, {mode: 0o600});
  const phase23=process.argv.includes('--phase23');
  const cert=join(root,'fixture.crt'),key=join(root,'fixture.key');
  let startupAttempted = false;
  let failed = false;
  try {
    if(phase23){
      run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=phase23-fixture','-addext','subjectAltName=IP:127.0.0.1']);
      chmodSync(key,0o600);
    }
    run('initdb', ['-D', cluster, '-U', 'phase16_testowner', '--auth-local=trust', '--auth-host=scram-sha-256', '--pwfile', passwordFile, '--no-locale']);
    unlinkSync(passwordFile);
    startupAttempted = true;
    // If the selected port is taken in the meantime, startup fails; never use its occupant.
    run('pg_ctl', ['-D', cluster, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${root}${phase23?' -c ssl=on -c ssl_cert_file='+cert+' -c ssl_key_file='+key:''}`, '-w', 'start']);
    run('createdb', ['-h', root, '-p', String(port), '-U', 'phase16_testowner', 'phase16_test']);
    const env = { ...process.env, NODE_ENV: 'test', DISABLE_JSON_PERSISTENCE: 'true',
      TEST_DATABASE_SSL_CA:phase23?cert:undefined,
      TEST_DATABASE_URL: `postgresql://phase16_testowner:${password}@127.0.0.1:${port}/phase16_test`, ALLOW_ISOLATED_GPU_DB_TEST: 'YES' };
    delete env.DATABASE_URL;
    run(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const { Client } = require('pg');
      const target = new URL(process.env.TEST_DATABASE_URL);
      target.password = 'deliberately-incorrect';
      const client = new Client({connectionString:target.toString(),connectionTimeoutMillis:5000});
      (async()=>{try {await assert.rejects(client.connect(), e=>e.code==='28P01');
        console.log('PASS: disposable PostgreSQL rejects incorrect TCP password');
      } finally {await client.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
    `], env);
    run(process.execPath, ['--import', 'tsx', 'test/prepaidPostgresIntegrationSuite.ts'], env);
    run(process.execPath, ['--import', 'tsx', 'test/postgresTimeoutIntegration.ts'], env);
    if (process.argv.includes('--phase25')) run(process.execPath, ['--import', 'tsx', 'test/phase25CommercialPostgres.ts'], env);
    if (process.argv.includes('--phase23')) run(process.execPath, ['--import', 'tsx', 'test/phase23DatabaseRemediation.ts'], env);
    console.log('PASS: disposable local reservation certification; broader financial-system certification remains blocked');
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (startupAttempted) {
      try { run('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', 'stop']); }
      catch (error) {
        if (!failed) throw error;
        console.error('Cleanup also failed:', error.message);
      }
    }
    console.log(`Local test artifacts retained at ${root}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
