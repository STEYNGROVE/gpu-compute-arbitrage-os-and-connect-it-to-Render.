import subprocess,os,json,time,pathlib
root=pathlib.Path('docs/verification/phase24')
keep=['PATH','HOME','TMPDIR','PREFIX','SHELL','LANG','LD_LIBRARY_PATH','LD_PRELOAD','ANDROID_ROOT','ANDROID_DATA']
env={k:v for k,v in os.environ.items() if k in keep}
env.update(NODE_ENV='test',DISABLE_JSON_PERSISTENCE='true',APP_OPERATING_MODE='DISCOVERY_ONLY',STRICT_AUTH_ENFORCEMENT='true')
commands=['npm run test:provider-billing', 'NODE_ENV=test npx --no-install tsx test/secureFeedIntegrationSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedDnsIsolationSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedTransportSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedDnsPinningSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedDnsEdgeSuite.ts', 'mkdir -p test/fixtures/tls', 'openssl req -x509 -newkey rsa:2048 -nodes -keyout test/fixtures/tls/server.key -out test/fixtures/tls/server.crt -days 1 -subj /CN=localhost -addext subjectAltName=DNS:localhost', 'NODE_ENV=test npx --no-install tsx test/secureFeedTlsSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedSocketSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedFinalNetworkSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedTimeoutSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedNode24LookupSuite.ts', 'NODE_ENV=test npx --no-install tsx test/secureFeedNode24ProductionSuite.ts', 'NODE_ENV=production STRICT_AUTH_ENFORCEMENT=true npx --no-install tsx --test server/gpuOfferEvidence.test.ts server/gpuEvidenceIntegration.test.ts server/gpuEvidenceHttp.test.ts server/gpuAuthIsolation.test.ts server/gpuOwnerAuthHttp.test.ts', 'npm audit --json']
rows=[]
for i,command in enumerate(commands):
 log=f'supplemental-{i:02}.log';start=time.monotonic()
 with (root/log).open('w') as f:r=subprocess.run(command,shell=True,env=env,stdout=f,stderr=subprocess.STDOUT)
 row=dict(command=command,exit_code=r.returncode,seconds=round(time.monotonic()-start,2),log=log)
 rows.append(row);(root/'supplemental-commands.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
