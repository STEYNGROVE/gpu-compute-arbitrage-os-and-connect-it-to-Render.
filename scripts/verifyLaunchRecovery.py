"""Safe local verification: no production credentials, migrations, deployment or financial operations."""
import os,sys,pathlib,subprocess,json,time,hashlib,datetime
ROOT=pathlib.Path('docs/launch-recovery');ROOT.mkdir(parents=True,exist_ok=True)
LOGS=pathlib.Path(os.environ.get('TMPDIR','/tmp'))/'gpu-launch-recovery-checks';LOGS.mkdir(parents=True,exist_ok=True)
keep=['PATH','HOME','TMPDIR','PREFIX','SHELL','LANG','LD_LIBRARY_PATH','LD_PRELOAD','ANDROID_ROOT','ANDROID_DATA']
env={k:os.environ[k] for k in keep if k in os.environ};env.update(NODE_ENV='test',DISABLE_JSON_PERSISTENCE='true',APP_OPERATING_MODE='DISCOVERY_ONLY',STRICT_AUTH_ENFORCEMENT='true')
commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
commands=[('lint',['npm','run','lint']),('typecheck',['npm','run','typecheck']),('security',['npm','run','security:check']),('dependencies',['npm','audit','--audit-level=low']),('combined-suite',['npm','test']),('purchase-boundary',['npm','run','test:purchase-boundary']),('execution-audit',['npm','run','audit:gpu-execution']),('production-build',['npm','run','build']),('migration-validation-only',['npm','run','db:migrate']),('postgres-migration-concurrency-restore',['npm','run','test:launch-recovery-postgres'])]
rows=[]
for name,command in commands:
 started=time.monotonic();log=LOGS/(name+'.txt')
 try:
  with log.open('w') as stream:result=subprocess.run(command,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=900)
  code=result.returncode
 except subprocess.TimeoutExpired:code=124
 content=log.read_bytes();row={'testName':name,'command':command,'commitSha':commit,'environment':'ISOLATED_NODE_TEST_NO_PRODUCTION_CREDENTIALS','result':'PASS' if code==0 else 'FAIL','exitCode':code,'seconds':round(time.monotonic()-started,3),'evidence':{'logFile':str(log),'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)},'note':'Strict financial audit failure is retained; it is not waived by passing public-mode checks.' if name=='execution-audit' else ''}
 rows.append(row);(ROOT/'tests.json').write_text(json.dumps({'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tests':rows,'complete':len(rows)==len(commands)},indent=2)+'\n');print(json.dumps({k:row[k] for k in ['testName','result','exitCode','seconds']}),flush=True)
raise SystemExit(1 if any(r['exitCode']!=0 for r in rows) else 0)
