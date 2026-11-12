# Offline verification runner: inherited service credentials and database settings are excluded.
import os, subprocess, json, pathlib, time, sys
root = pathlib.Path(__file__).resolve().parent
safe = {k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','PREFIX','LANG','LD_LIBRARY_PATH','LD_PRELOAD','ANDROID_ROOT','ANDROID_DATA']}
safe['PATH'] = str(pathlib.Path.cwd()/'node_modules/.bin') + ':' + safe['PATH']
safe.update(NODE_ENV='test', DISABLE_JSON_PERSISTENCE='true')
results=json.loads((root/'results.json').read_text()) if len(sys.argv) > 1 and (root/'results.json').exists() else []
selected = set(map(int, sys.argv[1:])) if len(sys.argv) > 1 else None
for index, command in enumerate(json.loads((root/'commands.json').read_text())):
    if selected is not None and index not in selected: continue
    start=time.monotonic()
    generated=[]
    try:
        if 'secureFeedTlsSuite.ts' in command:
            fixtures=pathlib.Path('test/fixtures/tls')
            fixtures.mkdir(parents=True,exist_ok=True)
            key,cert=fixtures/'server.key',fixtures/'server.crt'
            if not key.exists() and not cert.exists():
                generated=[key,cert]
                with (root/'tls-fixture-generation.log').open('w') as log:
                    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],env=safe,stdout=log,stderr=subprocess.STDOUT,check=True)
        with (root/f'check-{index:02d}.log').open('w') as log:
            result=subprocess.run(command,shell=True,env=safe,stdout=log,stderr=subprocess.STDOUT)
    finally:
        for artifact in generated:
            artifact.unlink(missing_ok=True)
    results = [r for r in results if r['command'] != command]
    results.append({'command':command,'exitStatus':result.returncode,'seconds':round(time.monotonic()-start,2),'log':f'check-{index:02d}.log'})
    (root/'results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(command, result.returncode, flush=True)
