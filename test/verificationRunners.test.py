"""Exercise historical collectors without executing any of their commands or overwriting evidence."""
import contextlib,io,pathlib,runpy,os,tempfile,types,unittest
from unittest.mock import patch
REPO=pathlib.Path(__file__).resolve().parents[1]
SCRIPTS=[p for p in (REPO/'docs'/'verification').rglob('run-*.py') if ('rows.append' in p.read_text() or 'results.append' in p.read_text()) and 'exit_code' in p.read_text()]
class VerificationRunnerTests(unittest.TestCase):
 def test_collectors_propagate_failure_and_preserve_success(self):
  for script in SCRIPTS:
   for fail in [False,True]:
    with self.subTest(script=str(script.relative_to(REPO)),failure=fail), tempfile.TemporaryDirectory() as temp:
     previous=os.getcwd();calls=[]
     # Recreate only output directories under the disposable cwd. Commands are intercepted.
     for directory in (REPO/'docs'/'verification').iterdir():
      if directory.is_dir():(pathlib.Path(temp)/'docs'/'verification'/directory.name).mkdir(parents=True)
     def fake_run(*args,**kwargs):
      calls.append(args[0]);return types.SimpleNamespace(returncode=1 if fail and len(calls)==1 else 0)
     try:
      os.chdir(temp)
      with patch('subprocess.run',fake_run),contextlib.redirect_stdout(io.StringIO()):
       with self.assertRaises(SystemExit) as outcome:runpy.run_path(str(script),run_name='__main__')
      self.assertEqual(outcome.exception.code,1 if fail else 0)
      self.assertGreater(len(calls),1,'collect remaining results after an early failure')
     finally:os.chdir(previous)
if __name__=='__main__':unittest.main()
