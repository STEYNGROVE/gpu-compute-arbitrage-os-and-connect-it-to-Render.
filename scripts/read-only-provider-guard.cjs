const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dir = path.join(__dirname, '..', 'server', 'providers');
const names = ['vast','runpod','akash','salad','tensordock','lightning','hyperstack','coreweave','lambda','hostinger'];
for (const name of names) {
  const src = fs.readFileSync(path.join(dir, `${name}Provider.ts`), 'utf8');
  for (const action of ['provision','start','stop','restart','terminate','estimateCost']) {
    const start = src.indexOf(`  async ${action}(`);
    assert(start >= 0, `${name}.${action} missing`);
    const next = src.indexOf('\n  async ', start + 8);
    const body = src.slice(start, next < 0 ? undefined : next);
    assert(!/this\.safeFetch\(|fetch\(|await this\.(start|stop|restart|terminate)\(/.test(body), `${name}.${action} contains external action`);
    assert(action === 'estimateCost' ? body.includes('COST_UNVERIFIED') : body.includes('success: false'), `${name}.${action} must fail closed`);
  }
}
const router = fs.readFileSync(path.join(__dirname, '..', 'server', 'gpuPriceRouter.ts'), 'utf8');
assert(router.includes('const executableProviders = new Set<string>();'));
console.log('PASS: 10 providers fail closed on cost estimation and all lifecycle operations');
