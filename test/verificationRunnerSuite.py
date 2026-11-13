"""Local process fixtures only: never opens a provider or database connection."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shlex
import signal
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'docs/verification/phase25-recovery/run_checks.py'
spec = importlib.util.spec_from_file_location('phase25_verifier', SCRIPT)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class VerificationRunnerTests(unittest.TestCase):
    def test_real_command_exit_and_log_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            passed = runner.run_check(shlex.join([sys.executable, '-c', 'print("fixture pass")']), directory)
            failed = runner.run_check(shlex.join([sys.executable, '-c', 'raise SystemExit(7)']), directory, 1)
            self.assertEqual(passed['exit'], 0)
            self.assertIn('fixture pass', (Path(directory) / passed['evidence']).read_text())
            self.assertEqual(failed['exit'], 7)

    def test_environment_scrubs_credentials_and_locks_test_mode(self):
        with patch.dict(os.environ, {'DATABASE_URL': 'private-fixture', 'BINANCE_API_SECRET': 'private-fixture', 'NODE_ENV': 'production'}):
            env = runner.clean_environment()
            self.assertNotIn('DATABASE_URL', env)
            self.assertNotIn('BINANCE_API_SECRET', env)
            self.assertEqual(env['NODE_ENV'], 'test')
            self.assertEqual(env['APP_OPERATING_MODE'], 'DISCOVERY_ONLY')
            self.assertEqual(env.get('LD_PRELOAD'), os.environ.get('LD_PRELOAD'))

    def test_failed_check_makes_aggregate_nonzero_without_skipping_later_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = [shlex.join([sys.executable, '-c', 'raise SystemExit(7)']), shlex.join([sys.executable, '-c', 'pass'])]
            with patch.dict(os.environ, {'PHASE25_EVIDENCE_DIRECTORY': directory}), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(commands), 1)
            self.assertEqual([r['exit'] for r in json.loads((Path(directory) / 'results.json').read_text())], [7, 0])

    def test_test_counts_keep_python_and_node_reporting_units_separate(self):
        node, python = runner.output_counts('ℹ pass 3\nℹ fail 1\nℹ skipped 2\nRan 6 tests in 0.1s\n\nFAILED (failures=1, errors=1, skipped=1)\n')
        self.assertEqual(node, {'pass': 3, 'fail': 1, 'skipped': 2})
        self.assertEqual(python, {'pass': None, 'fail': None, 'skipped': None, 'reported_tests': 6, 'failure_events': 2, 'skip_events': 1})

    def test_invalid_deadlines_fail_before_starting_process(self):
        for value in [0, -1, 901, float('nan'), float('inf')]:
            with self.assertRaisesRegex(ValueError, 'INVALID_CHECK_TIMEOUT'):
                runner.run_check('must-not-run', '/unused', timeout_seconds=value)

    def test_subtest_failures_do_not_become_invented_case_counts(self):
        source = '''import unittest
class Fixture(unittest.TestCase):
 def test_ok(self): pass
 def test_subtests(self):
  for value in range(2):
   with self.subTest(value=value): self.fail("fixture failure")
unittest.main()
'''
        with tempfile.TemporaryDirectory() as directory:
            record = runner.run_check(shlex.join([sys.executable, '-c', source]), directory)
            self.assertEqual(record['exit'], 1)
            self.assertEqual(record['python_test_counts']['reported_tests'], 2)
            self.assertEqual(record['python_test_counts']['failure_events'], 2)
            self.assertIsNone(record['python_test_counts']['pass'])
            self.assertIsNone(record['python_test_counts']['fail'])

    @unittest.skipUnless(os.name == 'posix' and Path('/proc/self/status').is_file(), 'process cleanup observation requires POSIX and /proc')
    def test_timeout_kills_a_grandchild_that_ignores_term(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child = root / 'child.py'
            pidfile = root / 'pid'
            child.write_text('import os,signal,time\nfrom pathlib import Path\nsignal.signal(signal.SIGTERM, signal.SIG_IGN)\nPath(' + repr(str(pidfile)) + ').write_text(str(os.getpid()))\ntime.sleep(30)\n')
            parent = root / 'parent.py'
            parent.write_text('import subprocess,sys,time\nsubprocess.Popen([sys.executable,' + repr(str(child)) + '])\ntime.sleep(30)\n')
            record = runner.run_check(shlex.join([sys.executable, str(parent)]), root, timeout_seconds=1)
            self.assertEqual(record['exit'], 124)
            self.assertTrue(pidfile.exists(), 'the timeout must occur after the grandchild starts')
            pid = int(pidfile.read_text())
            def stopped():
                try:
                    return '\nState:\tZ' in Path('/proc/' + str(pid) + '/status').read_text()
                except (FileNotFoundError, ProcessLookupError):
                    return True
            try:
                # SIGKILL delivery/reaping is asynchronous, especially on Termux.
                # Observe termination within a bound rather than racing the kernel.
                deadline = time.monotonic() + 1
                while not stopped() and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertTrue(stopped(), 'timed-out grandchild must not remain running')
            finally:
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass


if __name__ == '__main__':
    unittest.main()
