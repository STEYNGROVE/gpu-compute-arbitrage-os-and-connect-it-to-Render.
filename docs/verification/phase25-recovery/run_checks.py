"""Offline verification by default; isolated migration harnesses require explicit opt-in."""
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

DEFAULT_COMMANDS = [
    'npm run typecheck', 'npm run security:check',
    'node --import tsx --test test/phase21Readiness.test.ts',
    'npm run test:phase21', 'npm run test:phase25',
    'node --import tsx test/readinessRecoverySuite.ts',
    'node --import tsx test/databaseOutageIsolationSuite.ts',
    'npm test', 'npm run build', 'git diff --check',
]


def clean_environment():
    allowed = {'PATH', 'HOME', 'TMPDIR', 'PREFIX', 'SHELL', 'LANG',
               'LD_LIBRARY_PATH', 'LD_PRELOAD', 'ANDROID_ROOT', 'ANDROID_DATA'}
    env = {key: value for key, value in os.environ.items() if key in allowed}
    env.update(NODE_ENV='test', DISABLE_JSON_PERSISTENCE='true',
               APP_OPERATING_MODE='DISCOVERY_ONLY', NO_COLOR='1')
    return env


def stop_process_group(process):
    """Only terminate the session created for this command, including grandchildren."""
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        pass
    # The shell can exit while a grandchild ignores TERM. Always check its group.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def output_counts(output):
    node = {key: sum(map(int, re.findall(r'(?:ℹ |# )' + key + r' (\d+)', output)))
            for key in ['pass', 'fail', 'skipped']}
    python = {'pass': 0, 'fail': 0, 'skipped': 0}
    reported = failure_events = skip_events = 0
    ambiguous = False
    for count, summary in re.findall(r'Ran (\d+) tests? in [^\n]+\n\s*\n(OK[^\n]*|FAILED[^\n]*)', output):
        total = int(count)
        skipped = sum(map(int, re.findall(r'skipped=(\d+)', summary)))
        failed = sum(map(int, re.findall(r'(?:failures|errors)=(\d+)', summary)))
        reported += total
        failure_events += failed
        skip_events += skipped
        # unittest summaries count subtest failure/skip events, not necessarily
        # distinct test cases. Do not invent case counts from those events.
        ambiguous |= bool(failed or skipped or summary.startswith('FAILED'))
        python['pass'] += total
    if ambiguous:
        python.update({'pass': None, 'fail': None, 'skipped': None,
                       'reported_tests': reported, 'failure_events': failure_events,
                       'skip_events': skip_events})
    return node, python


def run_check(command, root, index=0, timeout_seconds=900):
    if not math.isfinite(timeout_seconds) or not 0 < timeout_seconds <= 900:
        raise ValueError('INVALID_CHECK_TIMEOUT')
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    name = ('check-' + str(index) + '-' + re.sub('[^a-zA-Z0-9]+', '-', command).strip('-'))[:120] + '.log'
    start = time.monotonic()
    with (root / name).open('w') as log:
        process = subprocess.Popen(command, shell=True, env=clean_environment(),
                                   stdout=log, stderr=subprocess.STDOUT,
                                   start_new_session=True)
        try:
            code = process.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            stop_process_group(process)
            code = 124
        except KeyboardInterrupt:
            stop_process_group(process)
            code = 130
        except BaseException:
            stop_process_group(process)
            raise
    output = (root / name).read_text()
    node, python = output_counts(output)
    return dict(command=command, exit=code,
                duration_seconds=round(time.monotonic() - start, 3),
                node_test_counts=node, python_test_counts=python,
                legacy_pass_output_records=len(re.findall(r'^\s*(?:PASS(?::|\b)|PHASE(?:23|25)_PG_PASS\b|✅)', output, re.M)),
                legacy_skip_output_records=len(re.findall(r'^\s*SKIPPED:', output, re.M)),
                evidence=name)


def main(commands=None):
    root = Path(os.environ.get('PHASE25_EVIDENCE_DIRECTORY', Path(__file__).resolve().parent))
    results = []
    for index, command in enumerate(DEFAULT_COMMANDS if commands is None else commands):
        record = run_check(command, root, index)
        results.append(record)
        temporary = root / 'results.json.tmp'
        temporary.write_text(json.dumps(results, indent=2) + '\n')
        temporary.replace(root / 'results.json')
        print(json.dumps(record), flush=True)
        if record['exit'] == 130:
            return 130
    return int(any(record['exit'] for record in results))


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or None))
