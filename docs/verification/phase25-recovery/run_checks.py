"""Offline verification by default; isolated migration harnesses require explicit opt-in."""
import os,subprocess,time,json,re,sys
from pathlib import Path
root=Path(os.environ.get('PHASE25_EVIDENCE_DIRECTORY',Path(__file__).resolve().parent))
root.mkdir(parents=True,exist_ok=True)
commands=sys.argv[1:] or ['npm run typecheck','npm run security:check','node --import tsx --test test/phase21Readiness.test.ts','npm run test:phase21','npm run test:phase25','node --import tsx test/readinessRecoverySuite.ts','node --import tsx test/databaseOutageIsolationSuite.ts','npm test','npm run build','git diff --check']
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','PREFIX','SHELL','LANG','LD_LIBRARY_PATH','LD_PRELOAD','ANDROID_ROOT','ANDROID_DATA']}
env.update(NODE_ENV='test',DISABLE_JSON_PERSISTENCE='true',APP_OPERATING_MODE='DISCOVERY_ONLY',NO_COLOR='1')
results=[]
for i,cmd in enumerate(commands):
    name=('check-'+str(i)+'-'+re.sub('[^a-zA-Z0-9]+','-',cmd).strip('-'))[:120]+'.log'
    start=time.monotonic()
    with open(root/name,'w') as log:
        try: result=subprocess.run(cmd,shell=True,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=900);code=result.returncode
        except subprocess.TimeoutExpired:code=124
    text=(root/name).read_text();duration=round(time.monotonic()-start,3)
    counts={k:sum(map(int,re.findall(r'(?:ℹ |# )'+k+r' (\d+)',text))) for k in ['pass','fail','skipped']}
    records=len(re.findall(r'^\s*(?:PASS(?::|\b)|PHASE(?:23|25)_PG_PASS\b|✅)',text,re.M))
    r=dict(command=cmd,exit=code,duration_seconds=duration,node_test_counts=counts,legacy_pass_output_records=records,legacy_skip_output_records=len(re.findall(r'^\s*SKIPPED:',text,re.M)),evidence=name)
    results.append(r);(root/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(r),flush=True)
if any(r['exit'] for r in results):sys.exit(1)
