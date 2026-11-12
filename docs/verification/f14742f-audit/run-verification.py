import subprocess,os,json,time
root='docs/verification/f14742f-audit'
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','PREFIX','SHELL','LANG','LD_LIBRARY_PATH','LD_PRELOAD','ANDROID_ROOT','ANDROID_DATA']}
env.update(NODE_ENV='test',DISABLE_JSON_PERSISTENCE='true',APP_OPERATING_MODE='DISCOVERY_ONLY',STRICT_AUTH_ENFORCEMENT='true')
commands=['npm run typecheck','npm run lint','npm run security:check','npm run test:postgres-tls','npm run test:phase20','npm run test:phase21','npm test','npm run test:phase21-postgres','npm run test:purchase-boundary','npm run audit:gpu-execution','npm run build','git diff --check']
results=[]
for i,cmd in enumerate(commands):
    name='verify-'+str(i).zfill(2)+'.log';start=time.monotonic()
    with open(root+'/'+name,'w') as f:
        result=subprocess.run(cmd,shell=True,env=env,stdout=f,stderr=subprocess.STDOUT)
    row=dict(command=cmd,exit_code=result.returncode,seconds=round(time.monotonic()-start,2),log=name)
    results.append(row)
    with open(root+'/commands.json','w') as f:json.dump(results,f,indent=2)
    print(json.dumps(row),flush=True)

# Propagate aggregate status after collecting every check.
raise SystemExit(1 if any(row['exit_code'] != 0 for row in results) else 0)
