'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const reservation = read('server/prepaidReservationGate.ts');
const worker = read('server/outboxWorker.ts');
const provisioner = read('server/providerProvisioner.ts');
const balance = read('server/supplierBalanceReadOnly.ts');
const pkg = JSON.parse(read('package.json'));
const checks = [
 ['Public reservation remains blocked without verified adapter', /EXTERNAL_EVIDENCE_VERIFICATION_NOT_IMPLEMENTED/.test(reservation)],
 ['Public reservation checks purchase-disabled flag', /GPU_PURCHASING_ENABLED/.test(reservation)],
 ['Worker independently blocks purchases', /throw new Error\('GPU_PURCHASE_GATE_BLOCKED:/.test(worker)],
 ['Direct provider independently blocks purchases', /throw new Error\('DIRECT_GPU_PURCHASE_BLOCKED:/.test(provisioner)],
 ['Supplier balance probes are read-only', /procurementBlocked:true/.test(balance)],
 ['Supplier balance tests run in npm test', /supplierBalanceReadOnlySuite\.ts/.test(pkg.scripts.test)],
];
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'}: ${name}`); assert.ok(ok,name); }
console.log('PASS: Phase 9.3 baseline source audit. This is not a runtime payment verification test.');
