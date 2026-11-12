"""Generate truthful latest verification tables; preserves attempt history and historical phases."""
import json,pathlib,re,hashlib
root=pathlib.Path('docs/verification/phase21');out=pathlib.Path('docs/phase21')
results=json.loads((root/'results.json').read_text())
counts={}
for command in ['npm run test:phase21','npm run test:phase21-postgres','npm run test:phase20','NODE_ENV=production STRICT_AUTH_ENFORCEMENT=true tsx --test server/gpuOfferEvidence.test.ts server/gpuEvidenceIntegration.test.ts server/gpuEvidenceHttp.test.ts server/gpuAuthIsolation.test.ts server/gpuOwnerAuthHttp.test.ts']:
 row=next((r for r in results if r['command']==command),None)
 if not row:continue
 text=(root/row['log']).read_text()
 c={k:int(v) for k,v in re.findall(r'[ℹ#] (tests|pass|fail|skipped) (\d+)',text)}
 scenarios={kind:json.loads(value) for kind,value in re.findall(r'(PHASE\d+_(?:CONTROL_)?POSTGRES_COUNTS) (\{[^\n]+\})',text)}
 counts[command]={'exitStatus':row['exitStatus'],'namedTests':c,'scenarios':scenarios,'log':row['log']}
(root/'counts.json').write_text(json.dumps(counts,indent=2)+'\n')
s='''# Phase 21 test evidence

Actual local executions, not provider/customer/production certification. Reproduce from repo root with `python docs/verification/phase21/run-checks.py`. Commands run with whitelisted runtime variables, test mode and disabled JSON persistence; ambient supplier/payment/database credentials are excluded. Node 24 local runtime; hosted Node 20/22 CI is separate. The disposable harness owns its random local cluster/port/password and never selects a production target. Test TLS fixtures are generated only if absent and only generated fixtures are cleaned up.

`results.json` contains latest command exits, `attempts.json` retains all recorded attempts. Log filenames identify exact attempts; logs are locally retained and Git-ignored. Historical Phase 19/20 results were not overwritten. The Android interruption completed its prior run before recovery; recovery rechecked processes and reran changed suites. Pre-recovery and post-recovery result counts are not added together.

Strict launch audit exit 1 is an actual failing launch gate: 13 safety controls pass and five commercial blockers remain. It is not a passing test and was not weakened. No other failure is relabeled as success. Lint is the existing TypeScript static-analysis script, not an installed ESLint suite.

## Exact command exits

| Command | Exit | Evidence log |
| --- | --- | --- |
'''
for r in results:s+=f"| `{r['command']}` | {r['exitStatus']} | `{r['log']}` |\n"
s+='\n## Named counts\n\n```json\n'+json.dumps(counts,indent=2)+'\n```\n'
s+='''
Legacy assert-based suites do not publish one uniform named-test count; do not invent a grand assertion total. Phase 21 named tests cover configuration, readiness timeout/coalescing/reconnect, owner/anonymous/customer routes, emergency latch, shutdown, key revocation, collector TLS/DNS/schema/mismatch, role quotas/output safety, provider/payment contracts, integer model, HTTP headers and lifecycle faults. PostgreSQL scenario counts are scenario groups rather than individual SQL assertions.

Phase 20 disposable scenarios retain multiprocess reservation serialization, abrupt child exit before commit, uncertain COMMIT lookup, restart reconstruction, expiry, durable stop/backoff and atomic audit rollback. Phase 21 adds receipt races/conflict/revocation/immutability, lab event races, exact full reversal, negative/cross-owner/currency/decimal denial, transaction rollback, post-commit entry corruption denial, integer conservation, lease takeover/stale fence and real pg_dump/restoration of disposable data.

## Skips and unexecuted acceptance

Named local suites report skips exactly above. No authenticated real supplier calls (credentials absent), provisioning/cancellation, real payment/refund/chargeback, real customer workflow, production migration/deployment, physical replica failover/lag or production backup restore was executed. Browser/ingress and realistic production load checks remain unexecuted. These omissions are acceptance gaps, not passing fixtures. Production PostgreSQL baseline/privilege certification remains unknown. Complete authoritative ledger, partial refunds/tax/FX and production webhook lifecycle are not implemented by the lab.

Dependency audit uses the current npm registry and is a point-in-time advisory check; lockfile was not changed. Secret pattern scan is limited to changed code/tests; no secret values are emitted. Full source/migration hashes are recorded separately. Financial execution remains unconditionally false and the strict audit denies launch.
'''
(out/'TEST_EVIDENCE.md').write_text(s)
manifest=[]
for p in sorted(pathlib.Path('docs/migration-proposals').glob('*.sql')):manifest.append({'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'proposal-hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'commands':len(results),'nonzero':[{'command':r['command'],'exitStatus':r['exitStatus']} for r in results if r['exitStatus']],'counts':counts},indent=2))
