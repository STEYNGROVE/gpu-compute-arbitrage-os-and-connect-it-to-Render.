const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

let failures = 0;

function fail(message) {
  console.error('FAIL:', message);
  failures++;
}

const files = execFileSync('git', ['ls-files', '-z'])
  .toString()
  .split('\0')
  .filter(Boolean);

for (const file of files) {
  if (/(^|\/)\.env($|\.)/.test(file) &&
      !file.endsWith('.example')) {
    fail('Tracked environment file: ' + file);
  }

  if (/\.(pem|key|p12|pfx)$/i.test(file)) {
    fail('Tracked private-key candidate: ' + file);
  }

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    continue;
  }

  if (!/\.(ts|tsx|js|jsx|cjs|mjs|json|ya?ml)$/.test(file)) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');

  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    fail('Private key detected: ' + file);
  }

  const sanitized = file === 'test/binanceAndFloatsTest.ts'
    ? content.replace(
        /process\.env\.BINANCE_API_SECRET\s*=\s*["']test-only-binance-api-secret-not-valid["']/g,
        '/* approved synthetic Binance test fixture */'
      )
    : content;

  if (/(?:BINANCE_API_SECRET|GROQ_API_KEY|DATABASE_URL)\s*[:=]\s*["'][^"']{16,}["']/.test(sanitized)) {
    fail('Possible hardcoded credential: ' + file);
  }
}

if (failures) {
  console.error('Security check failed:', failures);
  process.exit(1);
}

console.log('PASS: Basic tracked-file security checks');
