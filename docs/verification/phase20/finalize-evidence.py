"""Summarize executed logs, never infer that a missing/failed command passed."""
import json, pathlib, re
root=pathlib.Path(__file__).resolve().parent
commands=json.loads((root/'commands.json').read_text())
by_command={r['command']:r for r in json.loads((root/'results.json').read_text())}
results=[by_command[c] for c in commands]
for record in results:
    expected=1 if record['command']=='npm run audit:gpu-execution' else 0
    if record['exitStatus']!=expected: raise SystemExit('Unresolved command result: '+record['command'])
    if not (root/record['log']).is_file(): raise SystemExit('Missing command log')
(root/'results.json').write_text(json.dumps(results,indent=2)+'\n')
def log(command): return (root/by_command[command]['log']).read_text()
def counts(text):
    return {k:int(v) for k,v in re.findall(r'(?:^|\n)[ℹ#] (tests|pass|fail|skipped|cancelled) (\d+)',text)}
new_counts=counts(log('npm run test:phase20'))
if not new_counts or new_counts['fail'] or new_counts['skipped']: raise SystemExit('Phase 20 named test summary invalid')
pg=log('npm run test:phase20-postgres')
pg_counts=json.loads(re.search(r'PHASE20_POSTGRES_COUNTS (\{[^\n]+\})',pg).group(1))
auth_command=next(c for c in commands if c.startswith('NODE_ENV=production'))
audit=log('npm run audit:gpu-execution')
audit_json=json.loads(audit[audit.index('{'):audit.rfind('}')+1])
summary={'namedPhase20Tests':new_counts,'phase20PostgresScenarios':pg_counts,'productionAuthTests':counts(log(auth_command)),
         'networkSuiteCommands':sum('test/secureFeed' in c for c in commands),
         'latestCommandExitZero':sum(r['exitStatus']==0 for r in results),'expectedLaunchAuditExitOne':1,
         'commercialBlockers':audit_json['remainingBlockers'],'independentCommercialEvidence':'NOT_VERIFIED'}
(root/'counts.json').write_text(json.dumps(summary,indent=2)+'\n')
(root/'launch-audit.json').write_text(json.dumps(audit_json,indent=2)+'\n')
(root/'postgres-evidence.txt').write_text('\n'.join(line for line in pg.splitlines() if line.startswith(('PHASE20_PG_PASS','PHASE20_POSTGRES_COUNTS','PASS:','Local test artifacts')) or line=='server stopped')+'\n')
report=pathlib.Path('docs/PHASE20_TEST_EVIDENCE.md')
text=report.read_text().split('<!-- GENERATED_COMMAND_TABLE -->')[0]
text+='<!-- GENERATED_COMMAND_TABLE -->\n\n| Executed command | Actual exit |\n| --- | --- |\n'
for record in results: text+='| `'+record['command']+'` | '+str(record['exitStatus'])+(' (expected launch denial)' if record['exitStatus'] else '')+' |\n'
text+='\nMachine-readable exact counts: [counts.json](verification/phase20/counts.json). Latest results: [results.json](verification/phase20/results.json). Failure/retry history: [attempts.json](verification/phase20/attempts.json). Historical migration/source hashes: [source-manifest.json](verification/phase20/source-manifest.json).\n'
report.write_text(text)
print(json.dumps(summary,indent=2))
