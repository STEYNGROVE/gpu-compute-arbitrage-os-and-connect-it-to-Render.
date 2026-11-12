import subprocess,os,json,time,pathlib
root=pathlib.Path('docs/verification/phase22')
# Preserve only platform execution variables; no production/provider credentials inherited.
keep=['PATH','HOME','TMPDIR','PREFIX','SHELL','LANG','LD_LIBRARY_PATH','LD_PRELOAD','ANDROID_ROOT','ANDROID_DATA']
env={k:v for k,v in os.environ.items() if k in keep}
env.update(NODE_ENV='test',DISABLE_JSON_PERSISTENCE='true',APP_OPERATING_MODE='DISCOVERY_ONLY',STRICT_AUTH_ENFORCEMENT='true')
commands=['npm run typecheck','npm run lint','npm run security:check','npm run test:security-regression','npm run test:postgres-tls','npm run test:phase20','npm run test:phase21','npm test','npm run test:phase21-postgres','npm run test:purchase-boundary','npm run audit:gpu-execution','npm run build','git diff HEAD --check','git diff --cached --check']
results=[]
for i,cmd in enumerate(commands):
    name=str(i).zfill(2)+'-'+cmd.split()[2].replace(':','-')+'.log' if cmd.startswith('npm run ') else str(i).zfill(2)+'.log'
    start=time.monotonic()
    with (root/name).open('w') as f:r=subprocess.run(cmd,shell=True,env=env,stdout=f,stderr=subprocess.STDOUT)
    row=dict(command=cmd,exit_code=r.returncode,seconds=round(time.monotonic()-start,2),log=name)
    results.append(row);(root/'commands.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(row),flush=True)
